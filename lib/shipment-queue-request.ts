export type ShipmentQueueResult =
  | { ok: true; next: string; shipmentId: string }
  | { ok: false; error: string; uncertain?: boolean };

/** A timed-out write is never resubmitted: reconcile with a read-only request. */
export async function requestShipmentQueueStatus(
  formData: FormData,
  fetcher: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<ShipmentQueueResult> {
  const shipmentId = String(formData.get('shipmentId') ?? '');
  const next = String(formData.get('next') ?? '');
  const url = `/api/shipments/${encodeURIComponent(shipmentId)}/status`;
  async function readJson(init: RequestInit, deadline: number) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetcher(url, { ...init, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
          if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('INVALID_RESPONSE');
          }
          return { response, body: await response.json() };
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('REQUEST_TIMEOUT')); }, deadline);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  try {
    const { response, body } = await readJson({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData)),
    }, timeoutMs);
    if (response.ok && body.ok === true && body.shipmentId === shipmentId && typeof body.next === 'string') {
      return { ok: true, shipmentId, next: body.next };
    }
    if (response.status >= 400 && response.status < 500 && body.ok === false && typeof body.error === 'string') {
      return { ok: false, error: body.error };
    }
    throw new Error('UNCONFIRMED_WRITE');
  } catch {
    try {
      const { response, body } = await readJson({ method: 'GET' }, Math.min(timeoutMs, 5_000));
      if (response.ok && body.ok === true && body.shipmentId === shipmentId && body.status === next) {
        return { ok: true, shipmentId, next };
      }
    } catch { /* The write may still be running; never retry it automatically. */ }
    return { ok: false, uncertain: true, error: '尚無法確認儲存結果，請重新讀取訂單確認；系統不會重複送出寄出要求。' };
  }
}
