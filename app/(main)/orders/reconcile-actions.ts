'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchRecentOrders, reconcileRecentOrders, ReconcileError, type ReconcileReport } from '@/lib/shopify/reconcile';
import { persistShopifyIntake } from '@/lib/shopify/intake';
import { revalidatePath } from 'next/cache';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

export type ReconcileState = { message: string; report?: ReconcileReport };
export async function reconcileOrdersAction(_previous: ReconcileState, form: FormData): Promise<ReconcileState> {
  const user = await getCurrentUser();
  if (!user) return { message: '請先登入 HQ' };
  if (process.env.SHOPIFY_RECONCILE_TEST_MODE !== 'true' || process.env.VERCEL_ENV === 'production') {
    return { message: '補同步尚未開放；必須先確認隔離測試資料庫，不能在正式部署操作' };
  }
  const mode = form.get('mode');
  if (mode !== 'inspect' && mode !== 'sync') return { message: '不支援的操作' };
  const domain = process.env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase() ?? '';
  try {
    const report = await reconcileRecentOrders({ actorId: user.userId, mode, limit: Number(form.get('limit')) }, {
      authorize: async id => (await prisma.user.findUnique({ where: { id }, select: { role: true } }))?.role === 'admin',
      domain,
      fetch: limit => fetchRecentOrders({ domain, token: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '' }, limit),
      existing: async id => {
        const order = await prisma.order.findUnique({ where: { externalStore_externalOrderId: { externalStore: domain, externalOrderId: id } },
          select: { omsStatus: true, shopifySnapshot: true } });
        return order ? { omsStatus: order.omsStatus, snapshot: order.shopifySnapshot } : null;
      },
      persist: event => persistShopifyIntake(prisma, event),
      audit: async (runId, status, metadata) => {
        await prisma.statusAuditLog.create({ data: { entityType: 'shopify_reconcile', entityId: runId,
          actorType: 'user', actorId: user.userId, newStatus: status,
          metadataJson: JSON.stringify({ domain, ...metadata }) } });
      },
    });
    if (mode === 'sync') {
      try { revalidatePath('/orders'); revalidatePath('/dashboard'); await bustCacheTags(CACHE_TAGS.dashboard, CACHE_TAGS.orderHubTotals); }
      catch { console.error('[shopify.reconcile]', 'CACHE_REFRESH_FAILED'); }
    }
    return { message: mode === 'inspect' ? (report.complete ? '比對完成；沒有修改訂單。這只涵蓋本次抓取的最近訂單。' : '比對未全部完成；沒有修改訂單，請查看結果後重試。') :
      report.complete ? '本批次處理結束，請查看每筆結果；不代表整間商店已無漏單。' : '本批次未全部完成；已完成的資料會保留，請查看結果後重試。', report };
  } catch (error) {
    return { message: error instanceof ReconcileError ? error.message : '同步檢查未完成，請稍後重試或聯絡管理員' };
  }
}
