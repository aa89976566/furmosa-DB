/**
 * Approved permission matrix (product sign-off) — application intent.
 * Phase 1 DB policies are server-blanket; tenant rules here drive app tests.
 */

export type Actor =
  | 'anonymous'
  | 'customer_line'
  | 'merchant' // owner === staff (v1)
  | 'hq'
  | 'system_webhook_cron';

export type Op = 'select' | 'insert' | 'update' | 'delete';

export type Access = 'allow' | 'deny' | 'allow_own_merchant' | 'allow_self' | 'allow_readonly_own_merchant';

export type MatrixRow = {
  table: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  tenantKey?: 'merchantId' | 'customerId' | 'lineUserId' | 'none';
  byActor: Record<Actor, Partial<Record<Op, Access>>>;
  notes?: string;
};

const denyAll: Partial<Record<Op, Access>> = {
  select: 'deny',
  insert: 'deny',
  update: 'deny',
  delete: 'deny',
};

const hqFull: Partial<Record<Op, Access>> = {
  select: 'allow',
  insert: 'allow',
  update: 'allow',
  delete: 'allow',
};

const systemWrite: Partial<Record<Op, Access>> = {
  select: 'allow',
  insert: 'allow',
  update: 'allow',
  delete: 'deny',
};

export const POLICY_MATRIX: MatrixRow[] = [
  {
    table: 'appointments',
    risk: 'high',
    tenantKey: 'merchantId',
    byActor: {
      anonymous: denyAll,
      customer_line: {
        select: 'allow_self',
        insert: 'allow_self',
        update: 'deny',
        delete: 'deny',
      },
      merchant: {
        select: 'allow_own_merchant',
        insert: 'allow_own_merchant',
        update: 'allow_own_merchant',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: systemWrite,
    },
    notes: '匿名預約禁止；商家不得見他店顧客預約',
  },
  {
    table: 'Customer',
    risk: 'critical',
    tenantKey: 'customerId',
    byActor: {
      anonymous: denyAll,
      customer_line: {
        select: 'allow_self',
        insert: 'allow_self',
        update: 'allow_self',
        delete: 'deny',
      },
      merchant: {
        select: 'allow_own_merchant',
        insert: 'allow_own_merchant',
        update: 'deny',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: systemWrite,
    },
    notes: '商家僅能透過本店預約／訂單關聯看見顧客，不得瀏覽全庫',
  },
  {
    table: 'Order',
    risk: 'critical',
    tenantKey: 'merchantId',
    byActor: {
      anonymous: denyAll,
      customer_line: denyAll,
      merchant: {
        select: 'allow_readonly_own_merchant',
        insert: 'deny',
        update: 'deny',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: { select: 'allow', insert: 'allow', update: 'allow', delete: 'deny' },
    },
  },
  {
    table: 'OrderItem',
    risk: 'high',
    tenantKey: 'none',
    byActor: {
      anonymous: denyAll,
      customer_line: denyAll,
      merchant: {
        select: 'allow_readonly_own_merchant',
        insert: 'deny',
        update: 'deny',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: { select: 'allow', insert: 'allow', update: 'allow', delete: 'deny' },
    },
    notes: 'merchant 唯讀透過本店 Order 關聯',
  },
  {
    table: 'Settlement',
    risk: 'critical',
    tenantKey: 'merchantId',
    byActor: {
      anonymous: denyAll,
      customer_line: denyAll,
      merchant: {
        select: 'allow_readonly_own_merchant',
        insert: 'deny',
        update: 'deny',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: denyAll,
    },
    notes: '結算修改只屬 HQ',
  },
  {
    table: 'MerchantStock',
    risk: 'high',
    tenantKey: 'merchantId',
    byActor: {
      anonymous: denyAll,
      customer_line: denyAll,
      merchant: {
        select: 'allow_own_merchant',
        insert: 'deny',
        update: 'deny',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: denyAll,
    },
  },
  {
    table: 'InventoryBalance',
    risk: 'high',
    tenantKey: 'none',
    byActor: {
      anonymous: denyAll,
      customer_line: denyAll,
      merchant: denyAll,
      hq: hqFull,
      system_webhook_cron: { select: 'allow', insert: 'deny', update: 'deny', delete: 'deny' },
    },
  },
  {
    table: 'LineChatSession',
    risk: 'critical',
    tenantKey: 'lineUserId',
    byActor: {
      anonymous: denyAll,
      customer_line: denyAll,
      merchant: denyAll,
      hq: { select: 'allow', insert: 'deny', update: 'deny', delete: 'deny' },
      system_webhook_cron: systemWrite,
    },
  },
  {
    table: 'refill_orders',
    risk: 'high',
    tenantKey: 'merchantId',
    byActor: {
      anonymous: denyAll,
      customer_line: {
        select: 'allow_self',
        insert: 'allow_self',
        update: 'deny',
        delete: 'deny',
      },
      merchant: {
        select: 'allow_own_merchant',
        insert: 'deny',
        update: 'allow_own_merchant',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: systemWrite,
    },
  },
  {
    table: 'payment_orders',
    risk: 'critical',
    tenantKey: 'none',
    byActor: {
      anonymous: denyAll,
      customer_line: { select: 'allow_self', insert: 'deny', update: 'deny', delete: 'deny' },
      merchant: {
        select: 'allow_own_merchant',
        insert: 'deny',
        update: 'deny',
        delete: 'deny',
      },
      hq: hqFull,
      system_webhook_cron: systemWrite,
    },
  },
  {
    table: 'member_points_ledger',
    risk: 'high',
    tenantKey: 'customerId',
    byActor: {
      anonymous: denyAll,
      customer_line: { select: 'allow_self', insert: 'deny', update: 'deny', delete: 'deny' },
      merchant: denyAll,
      hq: hqFull,
      system_webhook_cron: { select: 'allow', insert: 'allow', update: 'deny', delete: 'deny' },
    },
  },
];

export function accessFor(
  table: string,
  actor: Actor,
  op: Op,
): Access {
  const row = POLICY_MATRIX.find((r) => r.table === table);
  if (!row) return 'deny';
  return row.byActor[actor][op] ?? 'deny';
}

/** Pure helpers used by unit tests (no DB). */
export function merchantCanReadOtherMerchant(
  actorMerchantId: string,
  rowMerchantId: string,
): boolean {
  return actorMerchantId === rowMerchantId;
}

export function customerCanReadOtherCustomer(
  actorCustomerId: string,
  rowCustomerId: string,
): boolean {
  return actorCustomerId === rowCustomerId;
}

export function isAnonymousBookingAllowed(): boolean {
  return false;
}

export function runtimeRoleMustBypassRls(): boolean {
  return false;
}
