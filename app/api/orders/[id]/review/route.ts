import { getCurrentUser } from '@/lib/auth';
import { omsReviewAction } from '@/app/(main)/orders/oms-actions';
import { emptyReviewResult } from '@/lib/orders/review-service';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getCurrentUser()) return json(emptyReviewResult({ ok: false, kind: 'error', message: '請先登入 HQ' }), 401);
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || new URL(request.url).host;
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin && new URL(origin).host === host); } catch { /* Reject malformed origins. */ }
  if (!sameOrigin || !request.headers.get('content-type')?.startsWith('application/json')) {
    return json(emptyReviewResult({ ok: false, kind: 'error', message: '不允許的請求來源' }), 403);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return json(emptyReviewResult({ ok: false, kind: 'error', message: '請求格式錯誤' }), 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(emptyReviewResult({ ok: false, kind: 'error', message: '請求格式錯誤' }), 400);
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) if (typeof value === 'string') form.set(key, value);
  form.set('orderId', (await params).id);
  const result = await omsReviewAction(emptyReviewResult(), form);
  return json(result, result.ok === false ? 409 : 200);
}
