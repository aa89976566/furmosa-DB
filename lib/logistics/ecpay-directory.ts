import { createHash } from 'node:crypto';
import { parseStoreList, type Directory, type Store } from './store-search';

// Server-only module. Logistics uses MD5, not the existing payment SHA256 helper.
// https://developers.ecpay.com.tw/47496/ and https://developers.ecpay.com.tw/7424/
export function logisticsMac(params: Record<string, string>, key: string, iv: string): string {
  const body = Object.keys(params).filter(k => k !== 'CheckMacValue').sort()
    .map(k => `${k}=${params[k]}`).join('&');
  const encoded = encodeURIComponent(`HashKey=${key}&${body}&HashIV=${iv}`)
    .replace(/%20/g, '+').replace(/~/g, '%7e').toLowerCase();
  return createHash('md5').update(encoded).digest('hex').toUpperCase();
}
export type LogisticsConfig = {
  merchantId: string; hashKey: string; hashIV: string; environment: 'stage' | 'production';
};
export async function fetchDirectory(config: LogisticsConfig, service: Store['serviceType'], deps: {
  fetch: typeof fetch; now: () => number; timeoutMs?: number;
}): Promise<Directory> {
  if (!/^\d{1,10}$/.test(config.merchantId) || !config.hashKey || !config.hashIV ||
      !['stage', 'production'].includes(config.environment) || !['UNIMART', 'UNIMARTFREEZE'].includes(service)) {
    throw new Error('物流服務設定不完整');
  }
  const timeoutMs = deps.timeoutMs ?? 10000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('物流服務設定不完整');
  const url = config.environment === 'production'
    ? 'https://logistics.ecpay.com.tw/Helper/GetStoreList'
    : 'https://logistics-stage.ecpay.com.tw/Helper/GetStoreList';
  const params = { MerchantID: config.merchantId, CvsType: service };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await deps.fetch(url, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, CheckMacValue: logisticsMac(params, config.hashKey, config.hashIV) }).toString(),
    });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const stores = parseStoreList(JSON.parse(Buffer.concat(chunks).toString('utf8')), service);
    if (!stores.length) throw new Error(); // Do not replace a valid cache with an empty directory.
    return { stores, fetchedAt: deps.now() };
  } catch {
    // Never expose provider text, request signatures, or credentials in errors.
    throw new Error(controller.signal.aborted ? '門市查詢逾時，請稍後再試' : '暫時無法取得門市資料');
  } finally { clearTimeout(timer); }
}
