'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { confirmMerchantRestockReceipt } from '@/lib/merchant-restock-receipt';
import { loadMerchantRestockShipment } from '@/lib/pos/load-merchant-restock-shipment';
import { isRedirectError } from '@/lib/redirect-error';

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

  try {
    const result = await confirmMerchantRestockReceipt({
      shipmentId,
      merchantId,
      merchantUserId,
    });

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
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(`/pos/shipments/${shipmentId}?receipt=failed`);
  }
}
