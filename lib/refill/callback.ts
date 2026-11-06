import { prisma } from '@/lib/prisma';
import { verifyCheckMacValue } from '@/lib/payments/ecpay/check-mac';
import { getEcpayConfig } from '@/lib/payments/ecpay/config';
import { assertTransition } from '@/lib/refill/transitions';
import { writeRefillAudit } from '@/lib/refill/audit';
import { amountsAfterExtraTopup, type RefillOrderStatus } from '@/lib/refill/constants';
import {
  enqueueRefillPaidNotification,
  safelyAttemptAutomationJob,
} from '@/lib/automation/line-jobs';

export type EcpayCallbackParams = Record<string, string>;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * 綠界 server callback 為付款真相。重複送達冪等。
 * 回傳給綠界的字串必須是 `1|OK` 才會停止重送。
 */
export async function handleEcpayCallback(
  params: EcpayCallbackParams,
): Promise<{ ack: string; updated: boolean; reason?: string }> {
  let cfg;
  try {
    cfg = getEcpayConfig();
  } catch (e) {
    console.error('[ecpay.callback] config', e);
    return { ack: '0|ConfigError', updated: false, reason: 'config' };
  }

  const macOk = verifyCheckMacValue(params, cfg.hashKey, cfg.hashIV);
  if (!macOk) {
    console.error('[ecpay.callback] CheckMacValue failed', params.MerchantTradeNo);
    await writeRefillAudit(prisma, {
      action: 'ecpay_callback_mac_failed',
      actorType: 'ecpay',
      success: false,
      detail: { merchantTradeNo: params.MerchantTradeNo, rtnCode: params.RtnCode },
    }).catch(() => undefined);
    return { ack: '0|CheckMacValueError', updated: false, reason: 'mac' };
  }

  const tradeNo = params.MerchantTradeNo;
  if (!tradeNo) {
    return { ack: '0|MissingTradeNo', updated: false };
  }

  const payment = await prisma.paymentOrder.findUnique({
    where: { merchantTradeNo: tradeNo },
    include: {
      refillOrder: {
        include: {
          customer: { select: { id: true, lineUserId: true, name: true } },
          merchant: { select: { name: true } },
          appointment: { select: { startsAt: true, petName: true } },
        },
      },
    },
  });

  if (!payment) {
    console.error('[ecpay.callback] payment not found', tradeNo);
    await writeRefillAudit(prisma, {
      action: 'ecpay_callback_unknown_trade',
      actorType: 'ecpay',
      success: false,
      detail: { merchantTradeNo: tradeNo },
    }).catch(() => undefined);
    // 仍回 1|OK 避免綠界無限重送未知單（已記 audit）
    return { ack: '1|OK', updated: false, reason: 'unknown_trade' };
  }

  const rtnCode = params.RtnCode;
  const tradeAmt = Number(params.TradeAmt ?? params.TotalAmount ?? NaN);

  if (rtnCode !== '1') {
    await prisma.$transaction(async (tx) => {
      if (payment.status === 'pending') {
        await tx.paymentOrder.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            callbackPayload: params,
            providerTradeNo: params.TradeNo ?? null,
          },
        });
        if (
          payment.purpose === 'refill' &&
          payment.refillOrder.status === 'payment_pending'
        ) {
          assertTransition('payment_pending', 'payment_failed');
          await tx.refillOrder.update({
            where: { id: payment.refillOrderId },
            data: { status: 'payment_failed' },
          });
        }
      }
      await writeRefillAudit(tx, {
        refillOrderId: payment.refillOrderId,
        paymentOrderId: payment.id,
        action: 'ecpay_payment_failed',
        actorType: 'ecpay',
        success: false,
        detail: { rtnCode, tradeAmt, merchantTradeNo: tradeNo },
      });
    });
    return { ack: '1|OK', updated: true, reason: 'failed' };
  }

  // Amount must match
  if (!Number.isFinite(tradeAmt) || tradeAmt !== payment.amount) {
    console.error('[ecpay.callback] amount mismatch', {
      tradeNo,
      tradeAmt,
      expected: payment.amount,
    });
    await writeRefillAudit(prisma, {
      refillOrderId: payment.refillOrderId,
      paymentOrderId: payment.id,
      action: 'ecpay_amount_mismatch',
      actorType: 'ecpay',
      success: false,
      detail: { tradeAmt, expected: payment.amount, merchantTradeNo: tradeNo },
    });
    return { ack: '0|AmountError', updated: false, reason: 'amount' };
  }

  // Idempotent: already paid
  if (payment.status === 'paid') {
    await writeRefillAudit(prisma, {
      refillOrderId: payment.refillOrderId,
      paymentOrderId: payment.id,
      action: 'ecpay_callback_duplicate',
      actorType: 'ecpay',
      detail: { merchantTradeNo: tradeNo },
    }).catch(() => undefined);
    return { ack: '1|OK', updated: false, reason: 'duplicate' };
  }

  const now = new Date();
  let outcome:
    | { kind: 'paid'; notificationJobId: string }
    | { kind: 'duplicate_payment' }
    | { kind: 'unchanged' };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const existingPaid = await tx.paymentOrder.findFirst({
        where: {
          refillOrderId: payment.refillOrderId,
          purpose: payment.purpose,
          status: 'paid',
          id: { not: payment.id },
        },
        select: { id: true },
      });
      if (existingPaid) {
        await tx.paymentOrder.updateMany({
          where: { id: payment.id, status: { not: 'paid' } },
          data: {
            status: 'duplicate_paid',
            paidAt: now,
            providerTradeNo: params.TradeNo ?? null,
            callbackPayload: params,
          },
        });
        await writeRefillAudit(tx, {
          refillOrderId: payment.refillOrderId,
          paymentOrderId: payment.id,
          action: 'ecpay_duplicate_payment_requires_refund',
          actorType: 'ecpay',
          success: false,
          merchantId: payment.refillOrder.merchantId,
          detail: {
            purpose: payment.purpose,
            amount: payment.amount,
            merchantTradeNo: tradeNo,
            providerTradeNo: params.TradeNo,
            winningPaymentOrderId: existingPaid.id,
          },
        });
        return { kind: 'duplicate_payment' } as const;
      }

      const claimed = await tx.paymentOrder.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: {
          status: 'paid',
          paidAt: now,
          providerTradeNo: params.TradeNo ?? null,
          callbackPayload: params,
        },
      });
      if (claimed.count === 0) {
        return { kind: 'unchanged' } as const;
      }

      const refill = payment.refillOrder;
      if (payment.purpose === 'refill') {
        const from = refill.status as RefillOrderStatus;
        if (
          from === 'payment_pending' ||
          from === 'draft' ||
          from === 'payment_failed'
        ) {
          assertTransition(from, 'paid_waiting_return');
          await tx.refillOrder.update({
            where: { id: refill.id },
            data: {
              status: 'paid_waiting_return',
              paidAt: now,
            },
          });
        }
      } else if (payment.purpose === 'extra_topup') {
        const top = amountsAfterExtraTopup(refill.baseAmount);
        if (refill.status === 'awaiting_extra_payment') {
          assertTransition('awaiting_extra_payment', 'paid_waiting_return');
          await tx.refillOrder.update({
            where: { id: refill.id },
            data: {
              status: 'paid_waiting_return',
              deliveryMode: 'first',
              extraAmount: top.extraAmount,
              totalAmount: top.totalAmount,
              missingContainerNote: refill.missingContainerNote
                ? `${refill.missingContainerNote}；已補差額`
                : '已補差額 NT$30',
            },
          });
        }
      }

      await writeRefillAudit(tx, {
        refillOrderId: payment.refillOrderId,
        paymentOrderId: payment.id,
        action: 'ecpay_payment_paid',
        actorType: 'ecpay',
        merchantId: refill.merchantId,
        detail: {
          purpose: payment.purpose,
          amount: payment.amount,
          merchantTradeNo: tradeNo,
          providerTradeNo: params.TradeNo,
        },
      });
      const notificationJob = await enqueueRefillPaidNotification(
        payment.refillOrderId,
        tx,
      );
      return { kind: 'paid', notificationJobId: notificationJob.id } as const;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // Two valid callbacks may race. The database's paid-only unique index decides
    // the winner; preserve the charged loser for an explicit refund workflow.
    await prisma.$transaction(async (tx) => {
      const existingPaid = await tx.paymentOrder.findFirst({
        where: {
          refillOrderId: payment.refillOrderId,
          purpose: payment.purpose,
          status: 'paid',
          id: { not: payment.id },
        },
        select: { id: true },
      });
      if (!existingPaid) throw error;

      await tx.paymentOrder.updateMany({
        where: { id: payment.id, status: { not: 'paid' } },
        data: {
          status: 'duplicate_paid',
          paidAt: now,
          providerTradeNo: params.TradeNo ?? null,
          callbackPayload: params,
        },
      });
      await writeRefillAudit(tx, {
        refillOrderId: payment.refillOrderId,
        paymentOrderId: payment.id,
        action: 'ecpay_duplicate_payment_requires_refund',
        actorType: 'ecpay',
        success: false,
        merchantId: payment.refillOrder.merchantId,
        detail: {
          purpose: payment.purpose,
          amount: payment.amount,
          merchantTradeNo: tradeNo,
          providerTradeNo: params.TradeNo,
          winningPaymentOrderId: existingPaid.id,
          detectedBy: 'paid_unique_index',
        },
      });
    });
    outcome = { kind: 'duplicate_payment' };
  }

  if (outcome.kind === 'duplicate_payment') {
    return {
      ack: '1|OK',
      updated: true,
      reason: 'duplicate_payment_requires_refund',
    };
  }
  if (outcome.kind === 'unchanged') {
    return { ack: '1|OK', updated: false, reason: 'not_pending' };
  }

  // 作業已和付款一起提交；立即嘗試失敗時由 cron 接手，不會遺失通知。
  await safelyAttemptAutomationJob(outcome.notificationJobId);

  return { ack: '1|OK', updated: true };
}

export function parseEcpayFormBody(raw: string): EcpayCallbackParams {
  const params: EcpayCallbackParams = {};
  const usp = new URLSearchParams(raw);
  for (const [k, v] of usp.entries()) {
    params[k] = v;
  }
  return params;
}
