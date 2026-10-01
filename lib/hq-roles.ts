/**
 * Canonical HQ identity role vocabulary.
 * Exact lowercase only; unknown, blank, and case variants are rejected.
 * finance / warehouse are legacy identity labels, not elevated capabilities.
 */
export const HQ_IDENTITY_ROLES = Object.freeze([
  'owner',
  'admin',
  'staff',
  'finance',
  'warehouse',
] as const);

export type HqIdentityRole = (typeof HQ_IDENTITY_ROLES)[number];

const HQ_IDENTITY_ROLE_SET: ReadonlySet<string> = new Set(HQ_IDENTITY_ROLES);

export function isHqIdentityRole(value: unknown): value is HqIdentityRole {
  return typeof value === 'string' && HQ_IDENTITY_ROLE_SET.has(value);
}

export function parseHqIdentityRole(value: unknown): HqIdentityRole | null {
  return isHqIdentityRole(value) ? value : null;
}
