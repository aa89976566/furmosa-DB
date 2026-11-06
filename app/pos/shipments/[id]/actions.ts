'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { confirmMerchantRestockReceipt } from '@/lib/merchant-restock-receipt';
import { loadMerchantRestockShipment } from '@/lib/pos/load-merchant-restock-shipment';
import { RECEIPT_REVIEW_MESSAGE } from '@/lib/pos/receipt-review';

export async function confirmDirectShipmentReceiptAction(formData: FormData) {
  const session = await requireMerchantSession();
  const { merchantId, merchantUserId } = session;
  const shipmentId = String(formData.get('shipmentId') ?? '').trim();
  if (!shipmentId) redirect('/pos/notifications');

  const loaded = await loadMerchantRestockShipment(shipmentId, merchantId);
  if (!loaded) redirect(`/pos/shipments/${shipmentId}?receipt=failed`);
  if (loaded.kind === 'linked_request') {
    redirect(`/pos/restock/${loaded.requestId}`);
  }

  let result: 'just_received' | 'already_received';
  try {
    result = await confirmMerchantRestockReceipt({
      shipmentId,
      merchantId,
      merchantUserId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === RECEIPT_REVIEW_MESSAGE) {
      redirect(`/pos/shipments/${shipmentId}?receipt=review_required`);
    }
    console.error('[pos-restock-receipt] failed', {
      shipmentId,
      merchantId,
      error: error instanceof Error ? error.message : String(error),
    });
    redirect(`/pos/shipments/${shipmentId}?receipt=failed`);
  }

  // The stock transaction has committed at this point. Keep cache invalidation
  // outside the transaction error boundary so a post-commit redirect/revalidate
  // cannot incorrectly tell the merchant that receipt failed.
  revalidatePath('/pos');
  revalidatePath('/pos/stock');
  revalidatePath('/pos/notifications');
  revalidatePath(`/pos/shipments/${shipmentId}`);
  revalidatePath('/shipments');

  redirect(
    result === 'just_received'
      ? `/pos/shipments/${shipmentId}?receipt=just_received`
      : `/pos/shipments/${shipmentId}?receipt=already_received`,
  );
}
