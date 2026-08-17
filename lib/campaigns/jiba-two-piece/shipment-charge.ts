import { prisma } from '@/lib/prisma';
import { shippingFeeTypeLabel } from '@/lib/labels';
import {
  describeJibaShippingCharge,
  isJibaPaymentReviewHold,
} from '@/lib/campaigns/jiba-two-piece/payment';

export type JibaChargeSource = {
  paymentStatus: string | null;
  collectedDataJson: string | null;
};

export type ShipmentFulfillmentFeeView = {
  isJiba: boolean;
  fulfillmentFeeLabel: string | null;
  paymentReviewHold: boolean;
};

export async function loadJibaChargeSourcesByOrderIds(
  orderIds: Array<string | null | undefined>,
): Promise<Map<string, JibaChargeSource>> {
  const ids = [...new Set(orderIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const apps = await prisma.campaignApplication.findMany({
    where: { orderId: { in: ids } },
    select: {
      orderId: true,
      paymentStatus: true,
      conversationSession: { select: { collectedDataJson: true } },
    },
  });

  return new Map(
    apps
      .filter((app): app is typeof app & { orderId: string } => Boolean(app.orderId))
      .map((app) => [
        app.orderId,
        {
          paymentStatus: app.paymentStatus,
          collectedDataJson: app.conversationSession?.collectedDataJson ?? null,
        },
      ]),
  );
}

export function resolveShipmentFulfillmentFee(input: {
  orderStatus?: string | null;
  shippingFeeType?: string | null;
  jiba?: JibaChargeSource | null;
}): ShipmentFulfillmentFeeView {
  if (input.jiba) {
    const charge = describeJibaShippingCharge({
      paymentStatus: input.jiba.paymentStatus,
      collected: input.jiba.collectedDataJson,
    });
    return {
      isJiba: true,
      fulfillmentFeeLabel: charge.label,
      paymentReviewHold: isJibaPaymentReviewHold({
        status: input.orderStatus,
        paymentStatus: input.jiba.paymentStatus,
        collected: input.jiba.collectedDataJson,
        isJiba: true,
      }),
    };
  }

  return {
    isJiba: false,
    fulfillmentFeeLabel: input.shippingFeeType
      ? (shippingFeeTypeLabel[input.shippingFeeType] ?? input.shippingFeeType)
      : null,
    paymentReviewHold: isJibaPaymentReviewHold({ status: input.orderStatus }),
  };
}
