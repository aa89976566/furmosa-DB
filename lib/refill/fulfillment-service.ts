import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateRefillFulfillment } from '@/lib/refill/fulfillment-calculator';
import { RefillError } from '@/lib/refill/errors';
import { reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import { writeRefillAudit } from '@/lib/refill/audit';
import { buildMerchantTradeNo } from '@/lib/payments/ecpay/create';

type FulfillmentRequest = {
  orderId: string;
  merchantId: string;
  operatorMerchantUserId: string;
  pickupQuantity: number;
  returnedSerials: string[];
  idempotencyKey: string;
};

function paidAmount(order: {
  paidAt: Date | null;
  totalAmount: number;
  payments: { amount: number }[];
}) {
  const callbackTotal = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(callbackTotal, order.paidAt ? order.totalAmount : 0);
}

async function loadOrderForQuote(orderId: string, merchantId: string) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: orderId },
    include: {
      payments: { where: { status: 'paid' }, select: { amount: true } },
      fulfillments: {
        where: { status: 'completed' },
        select: { prepaidAmount: true },
      },
    },
  });
  if (!order) throw new RefillError('找不到這筆換罐訂單。', 'ORDER_NOT_FOUND', 404);
  if (order.merchantId !== merchantId) {
    throw new RefillError('這筆訂單不屬於目前門市。', 'WRONG_STORE', 403);
  }
  return order;
}

export async function quoteRefillFulfillment(input: {
  orderId: string;
  merchantId: string;
  pickupQuantity: number;
  returnedQuantity: number;
}) {
  const order = await loadOrderForQuote(input.orderId, input.merchantId);
  const remainingQuantity = order.quantity - order.fulfilledQuantity;
  if (input.pickupQuantity > remainingQuantity) {
    throw new RefillError(`本次最多可領取 ${remainingQuantity} 罐。`, 'QUANTITY_EXCEEDED', 409);
  }
  const allocated = order.fulfillments.reduce((sum, row) => sum + row.prepaidAmount, 0);
  return {
    ...calculateRefillFulfillment({
      pickupQuantity: input.pickupQuantity,
      returnedQuantity: input.returnedQuantity,
      availablePrepaidAmount: Math.max(0, paidAmount(order) - allocated),
    }),
    remainingQuantity,
  };
}

export async function requestRefillFulfillmentTopUp(input: FulfillmentRequest) {
  const order = await loadOrderForQuote(input.orderId, input.merchantId);
  if (!['paid_waiting_return', 'awaiting_extra_payment'].includes(order.status)) {
    throw new RefillError('這筆訂單目前不能申請補款。', 'INVALID_STATUS', 409);
  }
  const jars = input.returnedSerials.length
    ? await prisma.jarCode.findMany({ where: { code: { in: input.returnedSerials } } })
    : [];
  if (jars.length !== input.returnedSerials.length) {
    throw new RefillError('有空罐序號不存在，請重新確認。', 'SERIAL_NOT_FOUND', 404);
  }
  for (const jar of jars) {
    if (jar.redeemedByCustomerId !== order.customerId || jar.status !== 'issued') {
      throw new RefillError(`空罐 ${jar.code} 不屬於這位會員或已回收。`, 'SERIAL_NOT_OWNED', 409);
    }
  }
  const remainingQuantity = order.quantity - order.fulfilledQuantity;
  if (input.pickupQuantity > remainingQuantity) {
    throw new RefillError(`本次最多可領取 ${remainingQuantity} 罐。`, 'QUANTITY_EXCEEDED', 409);
  }
  const allocated = order.fulfillments.reduce((sum, row) => sum + row.prepaidAmount, 0);
  const quote = calculateRefillFulfillment({
    pickupQuantity: input.pickupQuantity,
    returnedQuantity: input.returnedSerials.length,
    availablePrepaidAmount: Math.max(0, paidAmount(order) - allocated),
  });
  if (quote.topUpAmount === 0) return { quote, payment: null };

  const payment = await prisma.$transaction(async (tx) => {
    const samePending = await tx.paymentOrder.findFirst({
      where: {
        refillOrderId: order.id,
        purpose: 'fulfillment_topup',
        status: 'pending',
        amount: quote.topUpAmount,
      },
    });
    let prepared = samePending;
    if (!prepared) {
      await tx.paymentOrder.updateMany({
        where: { refillOrderId: order.id, purpose: 'fulfillment_topup', status: 'pending' },
        data: { status: 'failed' },
      });
      prepared = await tx.paymentOrder.create({
        data: {
          refillOrderId: order.id,
          purpose: 'fulfillment_topup',
          provider: 'ecpay',
          merchantTradeNo: buildMerchantTradeNo('XT'),
          amount: quote.topUpAmount,
          status: 'pending',
        },
      });
    }
    if (order.status !== 'awaiting_extra_payment') {
      await tx.refillOrder.update({
        where: { id: order.id },
        data: {
          status: 'awaiting_extra_payment',
          missingContainerNote: `本次領取 ${input.pickupQuantity} 罐，需透過官方 LINE 補款 NT$${quote.topUpAmount}`,
        },
      });
    }
    await writeRefillAudit(tx, {
      refillOrderId: order.id,
      action: 'fulfillment_top_up_requested',
      actorType: 'merchant',
      actorId: input.operatorMerchantUserId,
      merchantId: input.merchantId,
      detail: {
        pickupQuantity: input.pickupQuantity,
        returnedSerials: input.returnedSerials,
        topUpAmount: quote.topUpAmount,
      },
    });
    return prepared;
  });
  return {
    quote,
    payment: payment
      ? { id: payment.id, amount: payment.amount, status: payment.status }
      : null,
  };
}

export async function completeRefillFulfillment(input: FulfillmentRequest) {
  const existing = await prisma.refillFulfillment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { jars: { orderBy: [{ role: 'asc' }, { sequence: 'asc' }] } },
  });
  if (existing) {
    if (existing.merchantId !== input.merchantId) {
      throw new RefillError('這個操作識別碼已被其他門市使用。', 'IDEMPOTENCY_CONFLICT', 409);
    }
    return { fulfillment: existing, reused: true as const };
  }

  try {
    const fulfillment = await prisma.$transaction(async (tx) => {
      const order = await tx.refillOrder.findUnique({
        where: { id: input.orderId },
        include: {
          payments: { where: { status: 'paid' }, select: { amount: true } },
          fulfillments: {
            where: { status: 'completed' },
            select: { prepaidAmount: true },
          },
        },
      });
      if (!order) throw new RefillError('找不到這筆換罐訂單。', 'ORDER_NOT_FOUND', 404);
      if (order.merchantId !== input.merchantId) {
        throw new RefillError('這筆訂單不屬於目前門市。', 'WRONG_STORE', 403);
      }
      if (!['paid_waiting_return', 'old_container_verified'].includes(order.status)) {
        throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
      }
      if (!order.productId) {
        throw new RefillError('訂單尚未指定商品，不能扣除庫存。', 'PRODUCT_MISSING', 409);
      }

      const remainingQuantity = order.quantity - order.fulfilledQuantity;
      if (input.pickupQuantity > remainingQuantity) {
        throw new RefillError(`本次最多可領取 ${remainingQuantity} 罐。`, 'QUANTITY_EXCEEDED', 409);
      }

      const jars = input.returnedSerials.length
        ? await tx.jarCode.findMany({
            where: { code: { in: input.returnedSerials } },
          })
        : [];
      if (jars.length !== input.returnedSerials.length) {
        throw new RefillError('有空罐序號不存在，請重新確認。', 'SERIAL_NOT_FOUND', 404);
      }
      const byCode = new Map(jars.map((jar) => [jar.code, jar]));
      for (const serial of input.returnedSerials) {
        const jar = byCode.get(serial)!;
        if (jar.redeemedByCustomerId !== order.customerId) {
          throw new RefillError(`空罐 ${serial} 不屬於這位會員。`, 'SERIAL_NOT_OWNED', 409);
        }
        if (jar.status !== 'issued') {
          throw new RefillError(`空罐 ${serial} 已回收或目前不可使用。`, 'SERIAL_USED', 409);
        }
        if (jar.lockedByRefillOrderId && jar.lockedByRefillOrderId !== order.id) {
          throw new RefillError(`空罐 ${serial} 正由另一筆訂單處理。`, 'SERIAL_LOCKED', 409);
        }
      }

      const allocated = order.fulfillments.reduce((sum, row) => sum + row.prepaidAmount, 0);
      const quote = calculateRefillFulfillment({
        pickupQuantity: input.pickupQuantity,
        returnedQuantity: input.returnedSerials.length,
        availablePrepaidAmount: Math.max(0, paidAmount(order) - allocated),
      });
      if (quote.topUpAmount > 0) {
        throw new RefillError(
          `請先請顧客透過官方 LINE 補款 NT$${quote.topUpAmount}，付款成功後再交付。`,
          'TOP_UP_REQUIRED',
          409,
        );
      }

      const stock = await tx.merchantStock.findUnique({
        where: {
          merchantId_productId_tierId: {
            merchantId: input.merchantId,
            productId: order.productId,
            tierId: '',
          },
        },
      });
      if (!stock || stock.quantity < input.pickupQuantity) {
        throw new RefillError('門市可售庫存不足，不能完成交付。', 'INSUFFICIENT_STOCK', 409);
      }

      const created = await tx.refillFulfillment.create({
        data: {
          refillOrderId: order.id,
          merchantId: input.merchantId,
          operatorMerchantUserId: input.operatorMerchantUserId,
          idempotencyKey: input.idempotencyKey,
          pickupQuantity: quote.pickupQuantity,
          returnedQuantity: quote.returnedQuantity,
          exchangeQuantity: quote.exchangeQuantity,
          originalPriceQuantity: quote.originalPriceQuantity,
          extraReturnQuantity: quote.extraReturnQuantity,
          finalAmount: quote.finalAmount,
          prepaidAmount: quote.prepaidAmount,
          topUpAmount: quote.topUpAmount,
        },
      });

      const now = new Date();
      for (const serial of input.returnedSerials) {
        const jar = byCode.get(serial)!;
        const updated = await tx.jarCode.updateMany({
          where: {
            id: jar.id,
            status: 'issued',
            redeemedByCustomerId: order.customerId,
            OR: [
              { lockedByRefillOrderId: null },
              { lockedByRefillOrderId: order.id },
            ],
          },
          data: {
            status: 'returned',
            returnedAt: now,
            returnedMerchantId: input.merchantId,
            lockedByRefillOrderId: order.id,
          },
        });
        if (updated.count !== 1) {
          throw new RefillError(`空罐 ${serial} 已被其他操作使用。`, 'SERIAL_RACE', 409);
        }
      }

      if (input.returnedSerials.length > 0) {
        await tx.refillFulfillmentJar.createMany({
          data: input.returnedSerials.map((serial, index) => ({
            fulfillmentId: created.id,
            jarCodeId: byCode.get(serial)!.id,
            role: 'returned_old',
            sequence: index + 1,
            serial,
            status: 'accepted',
          })),
        });
      }
      await tx.refillFulfillmentJar.createMany({
        data: Array.from({ length: input.pickupQuantity }, (_, index) => ({
          fulfillmentId: created.id,
          role: 'issued_new',
          sequence: index + 1,
          status: 'pending_line_registration',
        })),
      });

      const nextStockQuantity = stock.quantity - input.pickupQuantity;
      await tx.merchantStock.update({
        where: { id: stock.id },
        data: { quantity: nextStockQuantity, lastSaleAt: now },
      });
      const [txnNumber] = await reserveStockTxnNumbers(tx, 1, now);
      await tx.merchantStockTxn.create({
        data: {
          txnNumber,
          merchantId: input.merchantId,
          productId: order.productId,
          type: 'refill_delivery',
          quantity: -input.pickupQuantity,
          balanceAfter: nextStockQuantity,
          unitPrice: quote.finalAmount / input.pickupQuantity,
          commissionAmount: 0,
          companyRevenue: quote.finalAmount,
          refillFulfillmentId: created.id,
          note: `換罐交付 ${created.id}`,
        },
      });

      const nextFulfilledQuantity = order.fulfilledQuantity + input.pickupQuantity;
      const isOrderComplete = nextFulfilledQuantity === order.quantity;
      const updatedOrder = await tx.refillOrder.updateMany({
        where: { id: order.id, fulfilledQuantity: order.fulfilledQuantity },
        data: {
          fulfilledQuantity: nextFulfilledQuantity,
          status: isOrderComplete ? 'completed' : 'paid_waiting_return',
          oldContainerSerial: input.returnedSerials[0] ?? order.oldContainerSerial,
          oldContainerReturnedAt: input.returnedSerials.length > 0 ? now : order.oldContainerReturnedAt,
          completedAt: isOrderComplete ? now : null,
        },
      });
      if (updatedOrder.count !== 1) {
        throw new RefillError('訂單已被另一台裝置更新，請重新整理。', 'ORDER_RACE', 409);
      }

      await writeRefillAudit(tx, {
        refillOrderId: order.id,
        action: 'fulfillment_completed',
        actorType: 'merchant',
        actorId: input.operatorMerchantUserId,
        merchantId: input.merchantId,
        detail: {
          fulfillmentId: created.id,
          pickupQuantity: quote.pickupQuantity,
          returnedQuantity: quote.returnedQuantity,
          exchangeQuantity: quote.exchangeQuantity,
          originalPriceQuantity: quote.originalPriceQuantity,
          extraReturnQuantity: quote.extraReturnQuantity,
          finalAmount: quote.finalAmount,
          remainingOrderQuantity: order.quantity - nextFulfilledQuantity,
          newJarRegistration: 'pending_official_line',
        },
      });

      return tx.refillFulfillment.findUniqueOrThrow({
        where: { id: created.id },
        include: { jars: { orderBy: [{ role: 'asc' }, { sequence: 'asc' }] } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { fulfillment, reused: false as const };
  } catch (error) {
    const raced = await prisma.refillFulfillment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { jars: { orderBy: [{ role: 'asc' }, { sequence: 'asc' }] } },
    });
    if (raced) return { fulfillment: raced, reused: true as const };
    throw error;
  }
}
