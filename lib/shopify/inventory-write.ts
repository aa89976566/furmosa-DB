import { createHash } from 'node:crypto';
import { HQ_MAIN_SHOPIFY_LOCATION } from './inventory-location.ts';

export type InventoryWritePlan = {
  variantId: string; inventoryItemId: string; locationId: string; sku: string;
  warehouseCode: 'WH-MAIN'; available: number | null; issues: string[];
  snapshotComplete: boolean; sourceRevision: string; observedAt: string;
};
export class InventoryWriteError extends Error {}
export const INVENTORY_WRITE = `mutation HqInventoryWrite($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    inventoryAdjustmentGroup { referenceDocumentUri }
    userErrors { code field message }
  }
}`;
export const INVENTORY_READ = `query HqInventoryWriteRead($id: ID!) {
  productVariant(id: $id) {
    id sku inventoryPolicy
    inventoryItem { id tracked inventoryLevels(first: 50) {
      nodes { location { id } quantities(names: ["available", "committed"]) { name quantity } }
      pageInfo { hasNextPage }
    } }
  }
}`;
type Level = { location: { id: string }; quantities: { name: string; quantity: number }[] };
type ReadResponse = { productVariant: { id: string; sku: string; inventoryPolicy: string;
  inventoryItem: { id: string; tracked: boolean; inventoryLevels: { nodes: Level[]; pageInfo: { hasNextPage: boolean } } } } | null };
type WriteResponse = { inventorySetQuantities: { inventoryAdjustmentGroup: { referenceDocumentUri: string } | null;
  userErrors: { code?: string; field?: string[]; message?: string }[] } };

/** Transport only: not a scheduler or an authorization boundary. Caller must load and certify source coverage. */
export async function writeVerifiedInventory(plan: InventoryWritePlan, deps: {
  domain: string; token: string;
  verifySourceRevision: (revision: string) => Promise<boolean>;
  request?: typeof fetch; now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  if (plan.warehouseCode !== HQ_MAIN_SHOPIFY_LOCATION.warehouseCode || plan.locationId !== HQ_MAIN_SHOPIFY_LOCATION.locationId) {
    throw new InventoryWriteError('HQ_MAIN_REQUIRES_TAIPEI_LOCATION');
  }
  const assertFresh = () => {
    const age = now() - Date.parse(plan.observedAt);
    if (!Number.isFinite(age) || age < 0 || age > 30_000) throw new InventoryWriteError('STALE_SOURCE');
  };
  if (!plan.snapshotComplete || plan.issues.length || plan.available == null) throw new InventoryWriteError('UNVERIFIED_SOURCE');
  if (plan.warehouseCode !== 'WH-MAIN' || !/^[a-f0-9]{64}$/.test(plan.sourceRevision) || !plan.sku.trim() ||
    !Number.isSafeInteger(plan.available) || plan.available < 0 || plan.available > 2147483647) throw new InventoryWriteError('INVALID_PLAN');
  for (const [type, value] of [['ProductVariant', plan.variantId], ['InventoryItem', plan.inventoryItemId], ['Location', plan.locationId]]) {
    if (!new RegExp(`^gid://shopify/${type}/[1-9]\\d*$`).test(value)) throw new InventoryWriteError('INVALID_BINDING');
  }
  const domain = deps.domain.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) || !deps.token.trim()) throw new InventoryWriteError('INVALID_CONFIG');
  assertFresh();
  const request = deps.request ?? fetch;
  async function graphql<T>(query: string, variables: object): Promise<T> {
    let response: Response;
    try { response = await request(`https://${domain}/admin/api/2026-10/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': deps.token },
      body: JSON.stringify({ query, variables }), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    }); } catch { throw new InventoryWriteError('RESULT_UNKNOWN_RECONCILE_BEFORE_RETRY'); }
    if (!response.ok) throw new InventoryWriteError(`HTTP_${response.status}_RECONCILE_BEFORE_RETRY`);
    let data: { data?: T; errors?: unknown } | null;
    try { data = await response.json(); } catch { throw new InventoryWriteError('INVALID_RESPONSE'); }
    if (!data?.data || data.errors) throw new InventoryWriteError('API_ERROR');
    return data.data;
  }
  async function read() {
    const v = (await graphql<ReadResponse>(INVENTORY_READ, { id: plan.variantId })).productVariant;
    if (!v || v.id !== plan.variantId || v.sku !== plan.sku || v.inventoryItem?.id !== plan.inventoryItemId) throw new InventoryWriteError('BINDING_CHANGED');
    if (!v.inventoryItem.tracked || v.inventoryPolicy !== 'DENY') throw new InventoryWriteError('SOLD_OUT_POLICY_REQUIRED');
    const levels = v.inventoryItem.inventoryLevels;
    if (!levels || levels.pageInfo?.hasNextPage !== false || !Array.isArray(levels.nodes)) throw new InventoryWriteError('INCOMPLETE_LOCATIONS');
    const quantity = (l: Level, name: string) => {
      const matches = l.quantities?.filter(q => q.name === name) ?? [];
      if (matches.length !== 1 || !Number.isSafeInteger(matches[0].quantity)) throw new InventoryWriteError('INVALID_LEVEL');
      return matches[0].quantity;
    };
    const matches = levels.nodes.filter(l => l.location?.id === plan.locationId);
    if (matches.length !== 1) throw new InventoryWriteError('LOCATION_NOT_UNIQUE');
    for (const level of levels.nodes) {
      if (level.location.id !== plan.locationId && (quantity(level, 'available') !== 0 || quantity(level, 'committed') !== 0)) {
        throw new InventoryWriteError('OTHER_LOCATION_HAS_STOCK_OR_DEMAND');
      }
    }
    return quantity(matches[0], 'available');
  }
  const before = await read();
  // Check HQ again after network reads, including no-op retries.
  if (!(await deps.verifySourceRevision(plan.sourceRevision))) throw new InventoryWriteError('SOURCE_CHANGED');
  assertFresh();
  if (before === plan.available) return { changed: false, before, after: before };
  const uri = `hq://inventory/${plan.sourceRevision}`;
  const idempotencyKey = createHash('sha256').update(JSON.stringify({ domain, ...plan, before })).digest('hex');
  const response = await graphql<WriteResponse>(INVENTORY_WRITE, { idempotencyKey, input: {
    name: 'available', reason: 'correction', referenceDocumentUri: uri,
    quantities: [{ inventoryItemId: plan.inventoryItemId, locationId: plan.locationId, quantity: plan.available, changeFromQuantity: before }],
  } });
  const result = response.inventorySetQuantities;
  if (!result || !Array.isArray(result.userErrors)) throw new InventoryWriteError('INVALID_RESPONSE');
  if (result.userErrors.length) throw new InventoryWriteError('WRITE_REJECTED_RELOAD_SOURCE_AND_SHOPIFY');
  if (result.inventoryAdjustmentGroup?.referenceDocumentUri !== uri) throw new InventoryWriteError('UNCONFIRMED_WRITE');
  const after = await read();
  if (after !== plan.available) throw new InventoryWriteError('READBACK_CHANGED_RECONCILE');
  return { changed: true, before, after };
}
