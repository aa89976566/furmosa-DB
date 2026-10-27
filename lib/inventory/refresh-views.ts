import { revalidatePath } from 'next/cache';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

/** Call only after the database transaction commits. A display refresh must never undo/report a failed stock write. */
export async function refreshInventoryViews(productIds: string[] = []) {
  const paths = new Set([
    '/inventory', '/inventory/new', '/inventory/purchases', '/inventory/purchase-orders/new',
    '/inventory/purchases/new', '/inventory/transactions', '/products', '/dashboard',
    ...productIds.map(id => `/products/${encodeURIComponent(id)}`),
  ]);
  let failed = false;
  for (const path of paths) {
    try { revalidatePath(path); } catch { failed = true; }
  }
  try { await bustCacheTags(CACHE_TAGS.dashboard); } catch { failed = true; }
  if (failed) console.error('[inventory] VIEW_REFRESH_FAILED_AFTER_COMMIT');
}
