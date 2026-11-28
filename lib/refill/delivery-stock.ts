export function checkRefillDeliveryStock(input: {
  requestedFlavourId: string | null;
  deliveredFlavourId: string;
  quantity: number;
  onHand: number;
  reservedForOthers: number;
}): 'PREORDER_ITEM_MISMATCH' | 'STOCK_RESERVED' | null {
  if (input.requestedFlavourId &&
      (input.requestedFlavourId !== input.deliveredFlavourId || input.quantity !== 1)) {
    return 'PREORDER_ITEM_MISMATCH';
  }
  return input.onHand - input.reservedForOthers < input.quantity ? 'STOCK_RESERVED' : null;
}
