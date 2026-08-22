import { REFILL_PRICES } from '@/lib/refill/constants';

export type RefillFulfillmentQuote = {
  pickupQuantity: number;
  returnedQuantity: number;
  exchangeQuantity: number;
  originalPriceQuantity: number;
  extraReturnQuantity: number;
  finalAmount: number;
  prepaidAmount: number;
  topUpAmount: number;
};

export function calculateRefillFulfillment(input: {
  pickupQuantity: number;
  returnedQuantity: number;
  availablePrepaidAmount: number;
}): RefillFulfillmentQuote {
  const pickupQuantity = Math.trunc(input.pickupQuantity);
  const returnedQuantity = Math.trunc(input.returnedQuantity);
  const availablePrepaidAmount = Math.max(0, Math.trunc(input.availablePrepaidAmount));

  if (!Number.isSafeInteger(pickupQuantity) || pickupQuantity <= 0) {
    throw new Error('本次領取數量至少為 1');
  }
  if (!Number.isSafeInteger(returnedQuantity) || returnedQuantity < 0) {
    throw new Error('歸還數量不可小於 0');
  }

  const exchangeQuantity = Math.min(pickupQuantity, returnedQuantity);
  const originalPriceQuantity = pickupQuantity - exchangeQuantity;
  const extraReturnQuantity = Math.max(0, returnedQuantity - pickupQuantity);
  const finalAmount =
    exchangeQuantity * REFILL_PRICES.exchange +
    originalPriceQuantity * REFILL_PRICES.first;
  const prepaidAmount = Math.min(finalAmount, availablePrepaidAmount);

  return {
    pickupQuantity,
    returnedQuantity,
    exchangeQuantity,
    originalPriceQuantity,
    extraReturnQuantity,
    finalAmount,
    prepaidAmount,
    topUpAmount: finalAmount - prepaidAmount,
  };
}
