'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReviewError, emptyReviewResult, runReview, type ReviewResult } from '@/lib/orders/review-service';
import { reviewDraft } from '@/lib/orders/review-policy';
import { revalidatePath } from 'next/cache';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

export async function omsReviewAction(_previous: ReviewResult, form: FormData): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return emptyReviewResult({ ok: false, message: '請先登入 HQ', kind: 'error' });
  const action = form.get('action');
  if (action !== 'check' && action !== 'approve' && action !== 'ship') {
    return emptyReviewResult({ ok: false, message: '不支援的操作', kind: 'error' });
  }
  const field = (name: string) => String(form.get(name) ?? '');
  const draft = reviewDraft({ ...Object.fromEntries(form.entries()),
    lines: form.getAll('productId').map((id, index) => ({ productId: id, temperature: form.getAll('lineTemperature')[index] })),
    giftsConfirmed: form.get('giftsConfirmed') === 'on', duplicateConfirmed: form.get('duplicateConfirmed') === 'on',
  });
  let result;
  try {
    result = await runReview(prisma, { orderId: field('orderId'), actorId: user.userId,
      sourceHash: field('sourceHash'), action, draft, sourceOnly: true });

    // 「確認訂單」對已可出貨的 OMS 訂單應直接完成建立 HQ 出貨單，
    // 避免 REVIEW -> READY 後從待審核消失、卻尚未出現在出貨區的中間斷層。
    // 若仍在等付款，approveSuccess 會帶 blockers，此時保留 READY 等付款，不建立出貨單。
    if (action === 'approve' && result.ok && result.blockers.length === 0) {
      result = await runReview(prisma, {
        orderId: field('orderId'),
        actorId: user.userId,
        sourceHash: field('sourceHash'),
        action: 'ship',
        draft,
        sourceOnly: true,
      });
    }
  } catch (error) {
    return emptyReviewResult({
      ok: false,
      action,
      message: error instanceof ReviewError ? error.message : '操作未完成，請重新整理後再試；若持續失敗請聯絡管理員',
      blockers: error instanceof ReviewError ? error.blockers : [],
      kind: error instanceof ReviewError ? error.kind : 'error',
    });
  }
  // A cache error after commit must not be reported as a failed order mutation.
  try {
    for (const path of ['/orders', `/orders/${field('orderId')}`, '/reviews', '/dashboard', '/shipments']) revalidatePath(path);
    void bustCacheTags(CACHE_TAGS.dashboard, CACHE_TAGS.orderHubTotals, CACHE_TAGS.shipmentQueueCounts)
      .catch(() => console.error('[oms.review]', 'CACHE_TAG_REFRESH_FAILED'));
  } catch { console.error('[oms.review]', 'CACHE_REFRESH_FAILED'); }

  // Return the committed state immediately. The client refreshes and scrolls after showing
  // a visible success state, avoiding long server-side redirect waits on slow cache invalidation.
  return result;
}
