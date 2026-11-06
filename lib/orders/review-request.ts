import type { ReviewResult } from './review-service';

export async function requestOmsReview(form: FormData, fetcher: typeof fetch = fetch, timeoutMs = 30_000): Promise<ReviewResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const orderId = String(form.get('orderId') ?? '');
    const body = Object.fromEntries(form.entries());
    return await Promise.race([
      (async () => {
        const response = await fetcher(`/api/orders/${encodeURIComponent(orderId)}/review`, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
        });
        if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) throw new Error('INVALID_REVIEW_RESPONSE');
        const result = await response.json();
        if (typeof result?.ok !== 'boolean' || typeof result.message !== 'string' || !Array.isArray(result.blockers)) throw new Error('INVALID_REVIEW_RESULT');
        return result as ReviewResult;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('REVIEW_TIMEOUT')); }, timeoutMs);
      }),
    ]);
  } catch {
    return { ok: false, action: null, omsStatus: null, blockers: [], next: null, kind: 'error', uncertain: true,
      message: '連線中斷或等待逾時，尚未確認操作結果。請重新載入訂單核對狀態；系統不會自動重送。' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
