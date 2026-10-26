'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyCatalogSyncPlan, loadShopifyCatalogAudit } from '@/lib/shopify/catalog-sync-service';

export type CatalogSyncState = { ok: boolean; message: string };

export async function applySafeCatalogSyncAction(_previous: CatalogSyncState, form: FormData): Promise<CatalogSyncState> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, message: '請先登入 HQ' };
  const role = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (role?.role !== 'admin') return { ok: false, message: '只有 HQ 管理員可以正式同步商品' };

  const expectedFingerprint = String(form.get('fingerprint') ?? '').trim();
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) return { ok: false, message: '同步確認碼不完整，請重新檢查' };

  try {
    const audit = await loadShopifyCatalogAudit(prisma);
    if (audit.fingerprint !== expectedFingerprint) {
      return { ok: false, message: 'Shopify 或 HQ 商品剛有更新；為避免套用舊資料，請重新檢查後再確認' };
    }
    const changeCount = audit.plan.tierUpdates.length + audit.plan.productUpdates.length + audit.plan.tierArchives.length;
    if (changeCount === 0) return { ok: true, message: '目前可安全同步的商品都已是最新狀態' };

    const result = await prisma.$transaction((tx) => applyCatalogSyncPlan(tx, {
      plan: audit.plan, fingerprint: audit.fingerprint, actorId: session.userId,
    }));
    revalidatePath('/products');
    revalidatePath('/products/shopify-audit');
    return { ok: true, message: `已安全同步 ${result.changeCount} 筆；未確認的商品沒有被新增或覆蓋` };
  } catch (error) {
    console.error('[SHOPIFY_CATALOG_SYNC_ACTION_FAILED]', error instanceof Error ? error.message : String(error));
    return { ok: false, message: '同步未完成，HQ 沒有套用不確定的資料；請重新檢查後再試' };
  }
}
