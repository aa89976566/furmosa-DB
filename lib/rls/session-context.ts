/**
 * Phase 2 design stub — transaction-local claims for true DB RLS.
 *
 * Current Prisma runtime (`lib/prisma.ts`) does NOT call these.
 * Do not pretend per-user policies are active until callers wrap
 * queries with set_config in the same transaction.
 */

export type RlsActorType = 'hq' | 'merchant' | 'customer' | 'system' | 'anonymous';

export type RlsSessionClaims = {
  actorType: RlsActorType;
  merchantId?: string | null;
  customerId?: string | null;
  lineUserId?: string | null;
};

/** SQL fragments for documentation / future Prisma $executeRaw usage. */
export function buildSetConfigSql(claims: RlsSessionClaims): string[] {
  const lines = [
    `SELECT set_config('app.actor_type', ${sqlQuote(claims.actorType)}, true)`,
  ];
  if (claims.merchantId) {
    lines.push(`SELECT set_config('app.merchant_id', ${sqlQuote(claims.merchantId)}, true)`);
  }
  if (claims.customerId) {
    lines.push(`SELECT set_config('app.customer_id', ${sqlQuote(claims.customerId)}, true)`);
  }
  if (claims.lineUserId) {
    lines.push(`SELECT set_config('app.line_user_id', ${sqlQuote(claims.lineUserId)}, true)`);
  }
  return lines;
}

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Phase 1: Prisma still uses a single DB role; identity is enforced in app code.
 * Phase 2: switch DATABASE_URL user to REPLACE_ME_FURMOSA_RUNTIME and set claims.
 */
export const RLS_PHASE = {
  current: 1 as const,
  dbRowTenantIsolation: false,
  postgrestAnonBlockedByDesign: true,
  runtimeRoleMustNotBypassRls: true,
};
