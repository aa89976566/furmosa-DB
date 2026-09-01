'use server';

import { revalidatePath } from 'next/cache';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import { submitSelfSelectRestockRequest } from '@/lib/restock-request/service';
import { adjustStoreProductQuantity } from '@/lib/pos/adjust-store-stock';
import { revalidateHqRestockInbox } from '@/lib/restock-request/hq-inbox-cache';

export type InventoryActionResult =
  | { ok: true; quantity?: number; requestId?: string }
  | { ok: false; error: string };

function toMerchantError(error: unknown): string {
  const msg = error instanceof Error ? error.message : '';
  if (msg.includes('數量沒有變化')) return '數量沒有變化';
  if (msg.includes('庫存數量不合法')) return '庫存數量不合法';
  if (msg.includes('至少選擇') || msg.includes('數量大於')) {
    return '請至少選一個商品。數量需要大於 0。';
  }
  if (msg.includes('不能補貨')) return '這項商品目前不能補貨，請聯絡匠寵。';
  if (msg.includes('不存在')) return '有商品找不到了，請重新整理後再試。';
  return '送出失敗，請再試一次。';
}

export async function adjustInventoryQuantityAction(
  productId: string,
  newQuantity: number,
): Promise<InventoryActionResult> {
  const session = await requireMerchantSession();
  try {
    const result = await adjustStoreProductQuantity({
      merchantId: session.merchantId,
      productId,
      newQuantity,
    });
    revalidatePath('/pos');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/restock');
    revalidatePath('/pos/records');
    return { ok: true, quantity: result.quantity };
  } catch (error) {
    return { ok: false, error: toMerchantError(error) };
  }
}

export async function submitInventoryRestockCartAction(
  items: { productId: string; quantity: number }[],
): Promise<InventoryActionResult> {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  try {
    const req = await submitSelfSelectRestockRequest({
      merchantId,
      merchantUserId: session.merchantUserId,
      items,
    });
    revalidatePath('/pos');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/restock');
    revalidatePath('/pos/restock/progress');
    revalidatePath('/pos/records');
    revalidateHqRestockInbox();
    return { ok: true, requestId: req.id };
  } catch (error) {
    return { ok: false, error: toMerchantError(error) };
  }
}
