import { SALMON_STOCK, type StockTarget } from './salmon-stock-source.ts';

export const SALMON_ORDER_DEMAND = `query HqSalmonOrderDemand($after: String) {
  orders(first: 5, after: $after, query: "sku:FUR-SALMON-SKIN-50 -status:cancelled") {
    nodes { id cancelledAt displayFinancialStatus lineItems(first: 50) {
      nodes { sku unfulfilledQuantity variant { id } } pageInfo { hasNextPage }
    } } pageInfo { hasNextPage endCursor }
  }
}`;
export type ExternalDemand = { store: string; orderId: string; quantity: number };
export class StockDemandError extends Error {}
const orderId = (value: string) => value.replace(/^gid:\/\/shopify\/Order\//, '');

export function verifyDemandCoverage(hq: ExternalDemand[], remote: ExternalDemand[], domain: string) {
  function canonical(rows: ExternalDemand[]) {
    const ids = new Set<string>();
    return rows.map(row => {
      const id = orderId(row.orderId);
      if (row.store.toLowerCase() !== domain.toLowerCase() || !/^[1-9]\d*$/.test(id) ||
        !Number.isSafeInteger(row.quantity) || row.quantity < 0 || ids.has(id)) throw new StockDemandError('ORDER_COVERAGE_INVALID');
      ids.add(id);
      return row.quantity ? `${id}:${row.quantity}` : null;
    }).filter(row => row !== null).sort();
  }
  if (JSON.stringify(canonical(hq)) !== JSON.stringify(canonical(remote))) throw new StockDemandError('ORDER_COVERAGE_MISMATCH');
  return remote.reduce((sum, row) => sum + row.quantity, 0);
}

export async function readSalmonOrderDemand(domain: string, token: string, request: typeof fetch = fetch, stock: StockTarget = SALMON_STOCK): Promise<ExternalDemand[]> {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !token.trim()) throw new StockDemandError('INVALID_CONFIG');
  if (!/^[A-Za-z0-9_-]+$/.test(stock.sku)) throw new StockDemandError('INVALID_STOCK_TARGET');
  const query = SALMON_ORDER_DEMAND.replace('sku:FUR-SALMON-SKIN-50', `sku:${stock.sku}`);
  const result: ExternalDemand[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;
  // Bounded scan; incompleteness never authorizes a write.
  for (let page = 0; page < 20; page++) {
    let response: Response;
    try { response = await request(`https://${domain}/admin/api/2026-10/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables: { after } }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    }); } catch { throw new StockDemandError('ORDER_SCAN_FAILED'); }
    if (!response.ok) throw new StockDemandError('ORDER_SCAN_FAILED');
    let body: any;
    try { body = await response.json(); } catch { throw new StockDemandError('ORDER_SCAN_INVALID'); }
    if (Array.isArray(body?.errors) && body.errors.length) {
      const codes = new Set(body.errors.map((error: any) => error?.extensions?.code));
      if (codes.has('ACCESS_DENIED')) throw new StockDemandError('ORDER_ACCESS_DENIED');
      if (codes.has('MAX_COST_EXCEEDED')) throw new StockDemandError('ORDER_QUERY_COST_LIMIT');
      if (codes.has('THROTTLED')) throw new StockDemandError('ORDER_API_THROTTLED');
      throw new StockDemandError('ORDER_API_ERROR');
    }
    const orders = body?.data?.orders;
    if (body?.errors || !Array.isArray(orders?.nodes) || typeof orders?.pageInfo?.hasNextPage !== 'boolean') throw new StockDemandError('ORDER_SCAN_INVALID');
    for (const order of orders.nodes) {
      if (!Array.isArray(order.lineItems?.nodes) || order.lineItems.pageInfo?.hasNextPage !== false) throw new StockDemandError('ORDER_LINES_INCOMPLETE');
      if (order.cancelledAt || order.displayFinancialStatus === 'REFUNDED') continue;
      let quantity = 0;
      for (const line of order.lineItems.nodes) {
        if (line.sku !== stock.sku && line.variant?.id !== stock.variantId) continue;
        if (line.sku !== stock.sku || line.variant?.id !== stock.variantId ||
          !Number.isSafeInteger(line.unfulfilledQuantity) || line.unfulfilledQuantity < 0) throw new StockDemandError('ORDER_BINDING_CHANGED');
        quantity += line.unfulfilledQuantity;
        if (!Number.isSafeInteger(quantity)) throw new StockDemandError('ORDER_QUANTITY_OVERFLOW');
      }
      if (quantity) result.push({ store: domain, orderId: order.id, quantity });
    }
    if (!orders.pageInfo.hasNextPage) return result;
    const cursor = orders.pageInfo.endCursor;
    if (typeof cursor !== 'string' || !cursor || cursors.has(cursor)) throw new StockDemandError('ORDER_SCAN_INCOMPLETE');
    cursors.add(cursor); after = cursor;
  }
  throw new StockDemandError('ORDER_SCAN_LIMIT');
}
