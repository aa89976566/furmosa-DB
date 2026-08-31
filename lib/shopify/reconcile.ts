import { randomUUID } from 'node:crypto';
import { record, shopifySnapshot, snapshotHash, type Snapshot } from './intake-policy';
import type { IntakeEvent } from './intake';

export class ReconcileError extends Error {}
export type ReconcileRow = { orderId: string; outcome: string };
export type ReconcileReport = { mode: 'inspect' | 'sync'; fetched: number; processed: number;
  complete: boolean; rows: ReconcileRow[]; auditRecorded: boolean };

export function reconcileLimit(value: unknown) {
  const limit = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 25) throw new ReconcileError('請選擇 1～25 筆訂單');
  return limit;
}

/** Compatibility adapter for the existing store's REST-capable custom app. No public/client token. */
export async function fetchRecentOrders(config: { domain: string; token: string }, limit: number, request: typeof fetch = fetch): Promise<Snapshot[]> {
  const domain = config.domain.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !config.token.trim()) throw new ReconcileError('尚未設定 Shopify 管理 API 網域與讀取憑證');
  const url = new URL(`https://${domain}/admin/api/2026-07/orders.json`);
  url.searchParams.set('status', 'any');
  url.searchParams.set('limit', String(reconcileLimit(limit)));
  url.searchParams.set('order', 'created_at desc');
  // Match the webhook projection to avoid introducing unrelated payload differences.
  url.searchParams.set('fields', 'id,name,order_number,email,phone,financial_status,fulfillment_status,cancelled_at,created_at,updated_at,processed_at,currency,subtotal_price,total_discounts,total_price,customer,shipping_address,total_shipping_price_set,line_items,shipping_lines,note_attributes');
  let response: Response;
  try {
    response = await request(url, { headers: { 'X-Shopify-Access-Token': config.token, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
  } catch { throw new ReconcileError('Shopify 讀取逾時或連線失敗，尚未開始補同步'); }
  if (response.status === 429) throw new ReconcileError('Shopify 暫時限制讀取頻率，請稍後再試');
  if (response.status === 401 || response.status === 403) throw new ReconcileError('Shopify 讀取授權不足，請確認 read_orders 與客戶資料權限');
  if (!response.ok) throw new ReconcileError('Shopify 讀取失敗，尚未開始補同步');
  try {
    const data = record(await response.json());
    if (!Array.isArray(data.orders) || data.orders.length > limit) throw new Error('INVALID_RESPONSE');
    const snapshots = data.orders.map(shopifySnapshot);
    if (new Set(snapshots.map(s => s.order.id)).size !== snapshots.length) throw new Error('DUPLICATE_RESPONSE');
    return snapshots;
  } catch { throw new ReconcileError('Shopify 回傳資料不完整，未開始補同步'); }
}

export async function reconcileRecentOrders(input: { actorId: string; mode: 'inspect' | 'sync'; limit: number }, deps: {
  authorize: (actorId: string) => Promise<boolean>;
  fetch: (limit: number) => Promise<Snapshot[]>;
  domain: string;
  existing: (id: string) => Promise<{ omsStatus: string | null; snapshot: unknown } | null>;
  persist: (event: IntakeEvent) => Promise<{ created: boolean; disposition: string }>;
  audit: (runId: string, status: string, metadata: Record<string, unknown>) => Promise<void>;
  now?: () => number;
}): Promise<ReconcileReport> {
  if (!await deps.authorize(input.actorId)) throw new ReconcileError('僅限 HQ 管理員操作');
  if (input.mode !== 'inspect' && input.mode !== 'sync') throw new ReconcileError('不支援的操作');
  const limit = reconcileLimit(input.limit);
  const runId = randomUUID();
  const now = deps.now ?? Date.now;
  const start = now();
  const snapshots = await deps.fetch(limit); // Fetch/validate entire bounded batch before any writes.
  const report: ReconcileReport = { mode: input.mode, fetched: snapshots.length, processed: 0, complete: true, rows: [], auditRecorded: false };
  if (input.mode === 'sync') {
    try { await deps.audit(runId, 'STARTED', { limit, fetched: snapshots.length }); }
    catch { throw new ReconcileError('無法建立同步紀錄，未開始補同步'); }
  }
  for (const snapshot of snapshots) {
    if (now() - start > 20000) { report.complete = false; break; }
    const orderId = String(snapshot.order.id);
    try {
      if (input.mode === 'inspect') {
        const existing = await deps.existing(orderId);
        const outcome = !existing ? 'missing' : !existing.omsStatus ? 'legacy' :
          existing.snapshot && snapshotHash(existing.snapshot as Snapshot) === snapshotHash(snapshot) ? 'matched' : 'different';
        report.rows.push({ orderId, outcome });
      } else {
        const result = await deps.persist({ shopDomain: deps.domain.trim().toLowerCase(), topic: 'orders/updated', origin: 'reconcile',
          eventId: `reconcile:${runId}:${orderId}`, snapshot });
        report.rows.push({ orderId, outcome: result.created ? 'created' : result.disposition });
      }
    } catch { report.rows.push({ orderId, outcome: 'failed' }); report.complete = false; }
    report.processed++;
  }
  if (input.mode === 'sync') {
    try {
      await deps.audit(runId, report.complete ? 'FINISHED' : 'PARTIAL', { ...report });
      report.auditRecorded = true;
    } catch { report.complete = false; }
  }
  return report;
}
