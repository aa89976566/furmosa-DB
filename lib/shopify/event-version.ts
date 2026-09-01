export const SHOPIFY_AUDIT_ENTITY_TYPE = 'shopify_order';

export const SHOPIFY_FIELD_GROUPS = [
  'payment',
  'snapshot',
  'fulfillment',
  'cancellation',
  'refund',
] as const;

export type ShopifyFieldGroup = (typeof SHOPIFY_FIELD_GROUPS)[number];

export const SHOPIFY_AUDIT_METADATA_KEYS = [
  'topic',
  'shopDomain',
  'externalOrderId',
  'webhookId',
  'sourceUpdatedAt',
  'fieldGroup',
  'decision',
] as const;

export type ShopifyAuditMetadataKey = (typeof SHOPIFY_AUDIT_METADATA_KEYS)[number];

export type ShopifyAuditDecision =
  | 'accepted'
  | 'ignored_duplicate'
  | 'ignored_stale'
  | 'ignored_missing_timestamp'
  | 'ignored_operational'
  | 'ignored_cancelled_order'
  | 'ignored_missing_order'
  | 'ignored_missing_shipment'
  | 'ignored_not_cancellable'
  | 'ignored_terminal'
  | 'ignored_unknown_status'
  | 'ignored_not_paid';

export type ShopifyAuditMetadata = {
  topic: string;
  shopDomain: string;
  externalOrderId: string;
  webhookId: string;
  sourceUpdatedAt: string | null;
  fieldGroup: ShopifyFieldGroup;
  decision: ShopifyAuditDecision;
};

export type ShopifyAuditRecord = {
  id: string;
  actorId: string | null;
  metadataJson: string | null;
  createdAt: Date;
};

export type ShopifyVersionAction =
  | { action: 'apply'; decision: 'accepted' }
  | { action: 'ignore'; decision: Exclude<ShopifyAuditDecision, 'accepted' | 'ignored_duplicate'> }
  | { action: 'skip'; decision: 'ignored_duplicate' };

const METADATA_KEY_SET = new Set<string>(SHOPIFY_AUDIT_METADATA_KEYS);

export function shopifyAuditEntityId(shopDomain: string, externalOrderId: string) {
  return `${shopDomain}:${externalOrderId}`;
}

export function parseSourceUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis).toISOString();
}

export function sourceUpdatedAtMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFieldGroup(value: unknown): value is ShopifyFieldGroup {
  return typeof value === 'string' && SHOPIFY_FIELD_GROUPS.some((group) => group === value);
}

function isAuditDecision(value: unknown): value is ShopifyAuditDecision {
  return typeof value === 'string' && AUDIT_DECISIONS.has(value);
}

const AUDIT_DECISIONS = new Set<string>([
  'accepted',
  'ignored_duplicate',
  'ignored_stale',
  'ignored_missing_timestamp',
  'ignored_operational',
  'ignored_cancelled_order',
  'ignored_missing_order',
  'ignored_missing_shipment',
  'ignored_not_cancellable',
  'ignored_terminal',
  'ignored_unknown_status',
  'ignored_not_paid',
]);

export function parseShopifyAuditMetadata(raw: string | null | undefined): ShopifyAuditMetadata | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainRecord(parsed)) return null;
  for (const key of Object.keys(parsed)) {
    if (!METADATA_KEY_SET.has(key)) return null;
  }
  if (typeof parsed.topic !== 'string') return null;
  if (typeof parsed.shopDomain !== 'string') return null;
  if (typeof parsed.externalOrderId !== 'string') return null;
  if (typeof parsed.webhookId !== 'string') return null;
  if (parsed.sourceUpdatedAt !== null && typeof parsed.sourceUpdatedAt !== 'string') return null;
  if (!isFieldGroup(parsed.fieldGroup)) return null;
  if (!isAuditDecision(parsed.decision)) return null;
  return {
    topic: parsed.topic,
    shopDomain: parsed.shopDomain,
    externalOrderId: parsed.externalOrderId,
    webhookId: parsed.webhookId,
    sourceUpdatedAt: parsed.sourceUpdatedAt,
    fieldGroup: parsed.fieldGroup,
    decision: parsed.decision,
  };
}

export function compactShopifyAuditMetadata(metadata: ShopifyAuditMetadata): ShopifyAuditMetadata {
  return {
    topic: metadata.topic,
    shopDomain: metadata.shopDomain,
    externalOrderId: metadata.externalOrderId,
    webhookId: metadata.webhookId,
    sourceUpdatedAt: metadata.sourceUpdatedAt,
    fieldGroup: metadata.fieldGroup,
    decision: metadata.decision,
  };
}

export function stringifyShopifyAuditMetadata(metadata: ShopifyAuditMetadata): string {
  return JSON.stringify(compactShopifyAuditMetadata(metadata));
}

export function auditHasWebhookId(records: ShopifyAuditRecord[], webhookId: string): boolean {
  if (!webhookId) return false;
  return records.some((row) => row.actorId === webhookId);
}

export function decideShopifyEventVersion(input: {
  records: ShopifyAuditRecord[];
  fieldGroup: ShopifyFieldGroup;
  webhookId: string;
  sourceUpdatedAt: string | null;
}): ShopifyVersionAction {
  if (input.webhookId && auditHasWebhookId(input.records, input.webhookId)) {
    return { action: 'skip', decision: 'ignored_duplicate' };
  }

  const accepted = input.records
    .map((row) => parseShopifyAuditMetadata(row.metadataJson))
    .filter((meta): meta is ShopifyAuditMetadata => Boolean(meta))
    .filter((meta) => meta.fieldGroup === input.fieldGroup && meta.decision === 'accepted');

  const incomingMillis = sourceUpdatedAtMillis(input.sourceUpdatedAt);
  if (incomingMillis == null) {
    if (accepted.length > 0) {
      return { action: 'ignore', decision: 'ignored_missing_timestamp' };
    }
    return { action: 'apply', decision: 'accepted' };
  }

  let latestMillis: number | null = null;
  for (const meta of accepted) {
    const millis = sourceUpdatedAtMillis(meta.sourceUpdatedAt);
    if (millis == null) continue;
    if (latestMillis == null || millis > latestMillis) latestMillis = millis;
  }

  if (latestMillis != null && incomingMillis <= latestMillis) {
    return { action: 'ignore', decision: 'ignored_stale' };
  }
  return { action: 'apply', decision: 'accepted' };
}
