import { prisma } from '@/lib/prisma';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import { REFILL_PRICES, type PaymentPurpose } from '@/lib/refill/constants';
import {
  buildEcpayAioCheckout,
  buildMerchantTradeNo,
} from '@/lib/payments/ecpay/create';
import { isEcpayConfigured } from '@/lib/payments/ecpay/config';
import type { RefillOrderStatus } from '@/lib/refill/constants';

function isUniqueActivePaymentConflict(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: string | string[] } };
  if (err?.code !== 'P2002') return false;
  const target = err.meta?.target;
  if (!target) return true;
  const t = Array.isArray(target) ? target.join(',') : String(target);
  return (
    t.includes('payment_orders_active_refill_purpose_key') ||
    (t.includes('refill_order_id') && t.includes('purpose')) ||
    t.includes('refillOrderId')
  );
}

async function findActivePaymentPreferPaid(refillOrderId: string, purpose: PaymentPurpose) {
  const paid = await prisma.paymentOrder.findFirst({
    where: { refillOrderId, purpose, status: 'paid' },
    orderBy: { createdAt: 'asc' },
  });
  if (paid) return paid;
  return prisma.paymentOrder.findFirst({
    where: { refillOrderId, purpose, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
}

export async function initiateRefillPayment(input: {
  orderId: string;
  customerId: string;
  purpose?: PaymentPurpose;
}) {
  if (!isEcpayConfigured()) {
    throw new RefillError(
      '付款功能尚未設定完成，請稍後再試或聯繫匠寵。',
      'ECPAY_NOT_CONFIGURED',
      503,
    );
  }

  const purpose: PaymentPurpose = input.purpose ?? 'refill';
  const order = await prisma.refillOrder.findUnique({
    where: { id: input.orderId },
    include: { merchant: { select: { name: true } } },
  });
  if (!order || order.customerId !== input.customerId) {
    throw new RefillError('找不到這筆換罐訂單。', 'ORDER_NOT_FOUND', 404);
  }

  if (purpose === 'refill') {
    if (['paid_waiting_return', 'old_container_verified', 'completed'].includes(order.status)) {
      throw new RefillError('這筆換罐已經付款，不需要再付一次。', 'ALREADY_PAID', 409);
    }
    if (!['draft', 'payment_pending', 'payment_failed'].includes(order.status)) {
      throw new RefillError('這筆訂單目前不能付款。', 'INVALID_STATUS', 409);
    }
  } else {
    if (order.status !== 'awaiting_extra_payment') {
      throw new RefillError('這筆訂單目前不需要補差額。', 'INVALID_STATUS', 409);
    }
  }

  const amount =
    purpose === 'extra_topup' ? REFILL_PRICES.extraTopup : order.baseAmount;

  // 已有 paid → 不可再建（含補款）
  const existingPaid = await prisma.paymentOrder.findFirst({
    where: { refillOrderId: order.id, purpose, status: 'paid' },
  });
  if (existingPaid) {
    if (purpose === 'extra_topup') {
      throw new RefillError('這筆補差額已經付款，不需要再付一次。', 'ALREADY_PAID', 409);
    }
    throw new RefillError('這筆換罐已經付款，不需要再付一次。', 'ALREADY_PAID', 409);
  }

  // 重用 pending（failed 允許重建；由 partial unique 排除 failed）
  let payment = await prisma.paymentOrder.findFirst({
    where: {
      refillOrderId: order.id,
      purpose,
      status: 'pending',
      amount,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!payment) {
    try {
      payment = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentOrder.create({
          data: {
            refillOrderId: order.id,
            purpose,
            provider: 'ecpay',
            merchantTradeNo: buildMerchantTradeNo(purpose === 'extra_topup' ? 'XT' : 'RF'),
            amount,
            status: 'pending',
          },
        });

        if (purpose === 'refill' && order.status === 'draft') {
          assertTransition(order.status as RefillOrderStatus, 'payment_pending');
          await tx.refillOrder.update({
            where: { id: order.id },
            data: { status: 'payment_pending' },
          });
        }

        await writeRefillAudit(tx, {
          refillOrderId: order.id,
          paymentOrderId: created.id,
          action: 'payment_initiated',
          actorType: 'customer',
          actorId: input.customerId,
          merchantId: order.merchantId,
          detail: { purpose, amount, merchantTradeNo: created.merchantTradeNo },
        });
        return created;
      });
    } catch (e) {
      if (!isUniqueActivePaymentConflict(e)) throw e;
      // 並發：回傳既有有效付款，不 500
      const active = await findActivePaymentPreferPaid(order.id, purpose);
      if (!active) throw e;
      if (active.status === 'paid') {
        throw new RefillError(
          purpose === 'extra_topup'
            ? '這筆補差額已經付款，不需要再付一次。'
            : '這筆換罐已經付款，不需要再付一次。',
          'ALREADY_PAID',
          409,
        );
      }
      payment = active;
    }
  }

  const itemName =
    purpose === 'extra_topup'
      ? '換罐補差額（忘帶空罐）'
      : order.orderType === 'exchange'
        ? '換罐計畫 NT$99'
        : '首罐 NT$129';

  const checkout = buildEcpayAioCheckout({
    merchantTradeNo: payment.merchantTradeNo,
    amount: payment.amount,
    itemName,
    tradeDesc: `FurmosaRefill-${order.id.slice(0, 8)}`,
    customField1: order.id,
  });

  return {
    paymentOrderId: payment.id,
    merchantTradeNo: payment.merchantTradeNo,
    amount: payment.amount,
    checkout,
    reused: Boolean(payment),
  };
}
