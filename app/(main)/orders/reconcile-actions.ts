'use server';

import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchOrderById, fetchRecentOrders, reconcileRecentOrders, ReconcileError, type ReconcileReport } from '@/lib/shopify/reconcile';
import { persistShopifyIntake } from '@/lib/shopify/intake';
import { hasPromotionCapture, type Snapshot } from '@/lib/shopify/intake-policy';
import { resolvePromotion } from '@/lib/orders/promotion-resolver';
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

export type PromotionResyncState = { ok: boolean; message: string };

/**
 * Narrow production-safe reconcile for one existing OMS order whose only blocker is missing
 * promotion capture metadata. It never creates a shipment, enrolls a legacy order, or performs
 * a batch sync. persistShopifyIntake remains the final same-version safety gate.
 */
export async function reconcilePromotionCaptureAction(
  _previous: PromotionResyncState,
  form: FormData,
): Promise<PromotionResyncState> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, message: '請先登入 HQ' };
  const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (actor?.role !== 'admin') return { ok: false, message: '僅限 HQ 管理員重新同步來源資料' };

  const orderId = String(form.get('orderId') ?? '').trim();
  if (!orderId) return { ok: false, message: '缺少訂單' };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      externalStore: true,
      externalOrderId: true,
      omsStatus: true,
      status: true,
      fulfillmentStatus: true,
      deletedAt: true,
      shopifySnapshot: true,
      shipments: { select: { id: true }, take: 1 },
    },
  });
  if (!order || !order.externalStore || !order.externalOrderId || !order.omsStatus) {
    return { ok: false, message: '找不到可重新同步的 Shopify OMS 訂單' };
  }
  if (order.deletedAt || order.shipments.length > 0 || !['NEW', 'REVIEW', 'READY'].includes(order.omsStatus)
    || ['cancelled', 'packed', 'shipped', 'delivered', 'completed'].includes(order.status)
    || ['packed', 'shipped', 'delivered', 'returned'].includes(order.fulfillmentStatus)) {
    return { ok: false, message: '此訂單已進入履約或終止狀態，不能重新同步活動來源' };
  }

  const current = order.shopifySnapshot as Snapshot | null;
  if (!current) return { ok: false, message: '此訂單缺少 Shopify 來源快照' };
  if (hasPromotionCapture(current)) return { ok: true, message: '此訂單的活動來源資料已是最新版本' };
  if (resolvePromotion(current).reason !== 'MISSING_CAPTURE') {
    return { ok: false, message: '此訂單目前不是「缺少活動來源資料」問題，不執行重新同步' };
  }

  const configuredDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase() ?? '';
  const orderDomain = order.externalStore.trim().toLowerCase();
  if (!configuredDomain || configuredDomain !== orderDomain) {
    return { ok: false, message: 'Shopify 商店來源與 HQ 設定不一致，已停止重新同步' };
  }

  const runId = randomUUID();
  try {
    await prisma.statusAuditLog.create({ data: {
      entityType: 'shopify_promotion_resync', entityId: runId,
      actorType: 'user', actorId: session.userId, newStatus: 'STARTED',
      metadataJson: JSON.stringify({ orderId: order.id, externalOrderId: order.externalOrderId, domain: orderDomain }),
    } });

    const snapshot = await fetchOrderById({
      domain: orderDomain,
      token: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '',
    }, order.externalOrderId);
    if (!hasPromotionCapture(snapshot)) throw new ReconcileError('Shopify 回傳資料仍缺少活動辨識欄位');

    const result = await persistShopifyIntake(prisma, {
      shopDomain: orderDomain,
      topic: 'orders/updated',
      origin: 'reconcile',
      eventId: `promotion-resync:${runId}:${order.externalOrderId}`,
      snapshot,
    });

    await prisma.statusAuditLog.create({ data: {
      entityType: 'shopify_promotion_resync', entityId: runId,
      actorType: 'user', actorId: session.userId, newStatus: result.disposition === 'saved' ? 'FINISHED' : 'STOPPED',
      metadataJson: JSON.stringify({ orderId: order.id, externalOrderId: order.externalOrderId, disposition: result.disposition }),
    } });

    revalidatePath(`/orders/${order.id}`);
    revalidatePath('/orders');
    revalidatePath('/dashboard');
    try { await bustCacheTags(CACHE_TAGS.dashboard, CACHE_TAGS.orderHubTotals); }
    catch { console.error('[shopify.promotion-resync]', 'CACHE_REFRESH_FAILED'); }

    if (result.disposition === 'saved') {
      return { ok: true, message: '已重新同步 Shopify 活動資料，請重新檢查訂單' };
    }
    if (result.disposition === 'duplicate') {
      return { ok: true, message: 'Shopify 來源資料沒有新變更' };
    }
    if (result.disposition === 'conflict') {
      return { ok: false, message: 'Shopify 來源版本與 HQ 不一致，已保留原資料並標記人工核對' };
    }
    return { ok: false, message: `重新同步未套用：${result.disposition}` };
  } catch (error) {
    try {
      await prisma.statusAuditLog.create({ data: {
        entityType: 'shopify_promotion_resync', entityId: runId,
        actorType: 'user', actorId: session.userId, newStatus: 'FAILED',
        metadataJson: JSON.stringify({ orderId: order.id, externalOrderId: order.externalOrderId }),
      } });
    } catch { /* preserve original error */ }
    return {
      ok: false,
      message: error instanceof ReconcileError ? error.message : '重新同步未完成，HQ 資料未被強制覆寫',
    };
  }
}
