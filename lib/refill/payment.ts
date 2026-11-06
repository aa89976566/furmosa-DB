import { allowsExternalEffects } from '@/lib/external-effects';
import { prisma } from '@/lib/prisma';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import {
  REFILL_PRICES,
  amountsForOrderType,
  type PaymentPurpose,
} from '@/lib/refill/constants';
import {
  buildEcpayAioCheckout,
  buildMerchantTradeNo,
} from '@/lib/payments/ecpay/create';
import { isEcpayConfigured } from '@/lib/payments/ecpay/config';
import type { RefillOrderStatus } from '@/lib/refill/constants';

/** Runtime adapter：僅在 choke 讀取兩個政策變數名，傳給純核心。 */
function isEcpayExternalEffectsAllowed(): boolean {
  return allowsExternalEffects({
    APP_ENV: process.env.APP_ENV,
    EXTERNAL_EFFECTS_MODE: process.env.EXTERNAL_EFFECTS_MODE,
  });
}

export function assertRefillPaymentSnapshot(input: {
  orderType: string;
  deliveryMode: string;
  baseAmount: number;
  extraAmount: number;
  totalAmount: number;
  hasValidReservation: boolean;
}): void {
  if (!['first', 'exchange'].includes(input.orderType)) {
    throw new RefillError(
      '訂單金額已變更，請返回換罐頁重新建立訂單。',
      'REFILL_PRICE_CHANGED',
      409,
    );
  }
  const normalizedType = input.orderType as 'first' | 'exchange';
  const expected = amountsForOrderType(normalizedType);
  const amountSnapshotMatches =
    input.baseAmount === expected.baseAmount &&
    input.extraAmount === expected.extraAmount &&
    input.totalAmount === expected.totalAmount &&
    input.deliveryMode === normalizedType;

  if (!amountSnapshotMatches) {
    throw new RefillError(
      '訂單金額已變更，請返回換罐頁重新建立訂單。',
      'REFILL_PRICE_CHANGED',
      409,
    );
  }
  if (normalizedType === 'exchange' && !input.hasValidReservation) {
    throw new RefillError(
      '空罐資格已變更，請返回換罐頁重新確認。',
      'REFILL_JAR_RESERVATION_MISSING',
      409,
    );
  }
}

export async function initiateRefillPayment(input: {
  orderId: string;
  customerId: string;
  purpose?: PaymentPurpose;
}) {
  // Fail-closed：任何 Prisma 讀寫／pending／transaction 之前先拒絕非 production checkout。
  if (!isEcpayExternalEffectsAllowed()) {
    throw new RefillError(
      '付款功能目前無法使用，請稍後再試。',
      'EXTERNAL_EFFECTS_DISABLED',
      503,
    );
  }

  if (!isEcpayConfigured()) {
    throw new RefillError(
      '付款功能尚未設定完成，請稍後再試或聯繫匠寵。',
      'ECPAY_NOT_CONFIGURED',
      503,
    );
  }

  const purpose: PaymentPurpose = input.purpose ?? 'refill';
  // ECPay rejects a MerchantTradeNo after it has already received that checkout,
  // even when the customer leaves or the hosted page expires before payment.
  // Therefore every explicit checkout request is a new payment attempt. Older
  // pending attempts remain available for their signed callback and audit trail.
  const { order, payment } = await prisma.$transaction(async (tx) => {
    const order = await tx.refillOrder.findUnique({
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

      let hasValidReservation = order.orderType !== 'exchange';
      if (order.orderType === 'exchange') {
        if (order.oldContainerSerial) {
          const reservedJar = await tx.jarCode.findFirst({
            where: {
              lockedByRefillOrderId: order.id,
              redeemedByCustomerId: input.customerId,
              code: order.oldContainerSerial,
              status: { in: ['used', 'issued'] },
            },
            select: { id: true },
          });
          hasValidReservation = Boolean(reservedJar);
        }
      }
      assertRefillPaymentSnapshot({
        orderType: order.orderType,
        deliveryMode: order.deliveryMode,
        baseAmount: order.baseAmount,
        extraAmount: order.extraAmount,
        totalAmount: order.totalAmount,
        hasValidReservation,
      });
    } else if (order.status !== 'awaiting_extra_payment') {
      throw new RefillError('這筆訂單目前不需要補差額。', 'INVALID_STATUS', 409);
    }

    const amount =
      purpose === 'extra_topup' ? REFILL_PRICES.extraTopup : order.baseAmount;

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
    return { order, payment: created };
  });

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
  };
}
