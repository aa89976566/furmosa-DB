'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { confirmMerchantRestockReceipt } from '@/lib/merchant-restock-receipt';
import { receiptErrorMessage, type ReceiptFeedback } from '@/lib/pos/receipt-feedback';
import { loadMerchantRestockShipment } from '@/lib/pos/load-merchant-restock-shipment';

export async function confirmDirectShipmentReceiptAction(formData: FormData) {
  const result = await confirmDirectShipmentReceiptWithFeedback(formData);
  if (result.status === 'error') {
    const shipmentId = String(formData.get('shipmentId') ?? '').trim();
    redirect(`/pos/shipments/${shipmentId}?receipt=failed`);
  }
  redirect(result.href);
}

export async function confirmDirectShipmentReceiptWithFeedback(formData: FormData): Promise<ReceiptFeedback> {
  const session = await requireMerchantSession();
  const { merchantId, merchantUserId } = session;
  const shipmentId = String(formData.get('shipmentId') ?? '').trim();
  if (!shipmentId) return { status: 'redirect', href: '/pos/notifications' };

  const loaded = await loadMerchantRestockShipment(shipmentId, merchantId);
  if (!loaded) return { status: 'error', message: '找不到這張補貨出貨單' };
  if (loaded.kind === 'linked_request') {
    return { status: 'redirect', href: `/pos/restock/${loaded.requestId}` };
  }

  let result: 'just_received' | 'already_received';
  try {
    result = await confirmMerchantRestockReceipt({
      shipmentId,
      merchantId,
      merchantUserId,
    });
  } catch (error) {
    console.error('[pos-restock-receipt] failed', {
      shipmentId,
      merchantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'error', message: receiptErrorMessage(error) };
  }

  // The stock transaction has committed at this point. Keep cache invalidation
  // outside the transaction error boundary so a post-commit redirect/revalidate
  // cannot incorrectly tell the merchant that receipt failed.
  try {
    revalidatePath('/pos');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/notifications');
    revalidatePath(`/pos/shipments/${shipmentId}`);
    revalidatePath('/shipments');
  } catch {
    // Receipt already committed: navigation reloads its authoritative state.
    console.error('[pos-restock-receipt] post-commit cache refresh failed', { shipmentId });
  }

  return { status: 'success', href: result === 'just_received'
      ? `/pos/shipments/${shipmentId}?receipt=just_received`
      : `/pos/shipments/${shipmentId}?receipt=already_received` };
}
