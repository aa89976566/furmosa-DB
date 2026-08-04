/** 純邏輯：可給 client／unit test 使用，勿 import prisma */

/** 付款時不得把 preferred 當 fulfilled、也不得扣庫存 */
export function assertPaymentDoesNotLockFlavour(input: {
  preferredFlavourId: string | null | undefined;
  fulfilledFlavourId: string | null | undefined;
  stockDecrementedAtPayment: boolean;
}): void {
  if (input.fulfilledFlavourId) {
    throw new Error('fulfilledFlavour must be null at payment');
  }
  if (input.stockDecrementedAtPayment) {
    throw new Error('stock must not decrement at payment');
  }
  void input.preferredFlavourId;
}

export function canEnableFulfilment(input: {
  paid: boolean;
  isFirstPath: boolean;
  oldJarVerified: boolean;
  fulfilledFlavourId: string | null | undefined;
  flavourInStock: boolean;
  newSerialValid: boolean;
}): boolean {
  if (!input.paid) return false;
  if (!input.fulfilledFlavourId) return false;
  if (!input.flavourInStock) return false;
  if (!input.newSerialValid) return false;
  if (!input.isFirstPath && !input.oldJarVerified) return false;
  return true;
}
