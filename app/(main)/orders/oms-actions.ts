'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReviewError, runReview } from '@/lib/orders/review-service';
import { reviewDraft } from '@/lib/orders/review-policy';
import { revalidatePath } from 'next/cache';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';

export async function omsReviewAction(_previous: { message: string }, form: FormData) {
  const user = await getCurrentUser();
  if (!user) return { message: '請先登入 HQ' };
  const action = form.get('action');
  if (action !== 'check' && action !== 'approve' && action !== 'ship') return { message: '不支援的操作' };
  const field = (name: string) => String(form.get(name) ?? '');
  const draft = reviewDraft({ ...Object.fromEntries(form.entries()),
    lines: form.getAll('productId').map((id, index) => ({ productId: id, temperature: form.getAll('lineTemperature')[index] })),
    giftsConfirmed: form.get('giftsConfirmed') === 'on', duplicateConfirmed: form.get('duplicateConfirmed') === 'on',
  });
  let result;
  try {
    result = await runReview(prisma, { orderId: field('orderId'), actorId: user.userId,
      sourceHash: field('sourceHash'), action, draft });
  } catch (error) {
    return { message: error instanceof ReviewError ? error.message : '操作未完成，請重新整理後再試；若持續失敗請聯絡管理員' };
  }
  // A cache error after commit must not be reported as a failed order mutation.
  try {
    for (const path of ['/orders', `/orders/${field('orderId')}`, '/dashboard', '/shipments']) revalidatePath(path);
    await bustCacheTags(CACHE_TAGS.dashboard, CACHE_TAGS.orderHubTotals, CACHE_TAGS.shipmentQueueCounts);
  } catch { console.error('[oms.review]', 'CACHE_REFRESH_FAILED'); }
  return result;
}
