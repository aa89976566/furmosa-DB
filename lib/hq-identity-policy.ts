import { parseHqIdentityRole, type HqIdentityRole } from './hq-roles.ts';

export type FreshHqIdentity = {
  id: string;
  role: HqIdentityRole;
  isActive: true;
};

export type FreshHqIdentityResult =
  | { ok: true; user: FreshHqIdentity }
  | { ok: false };

export type FreshHqIdentityRow = {
  id: string;
  role: string;
  isActive: boolean;
};

function deny(): { ok: false } {
  return { ok: false };
}

function verifiedSubjectUserId(userId: string | null): string {
  if (typeof userId !== 'string') return '';
  return userId.trim();
}

/**
 * Pure fresh-identity check for an already-verified HQ session subject
 * and an already-loaded User row. No I/O.
 * This does not authorize mutations or grant capabilities.
 */
export function evaluateFreshHqIdentity(input: {
  userId: string | null;
  row: FreshHqIdentityRow | null;
}): FreshHqIdentityResult {
  const userId = verifiedSubjectUserId(input.userId);
  if (!userId) return deny();

  const row = input.row;
  if (!row) return deny();
  if (row.id !== userId) return deny();
  if (row.isActive !== true) return deny();

  const role = parseHqIdentityRole(row.role);
  if (!role) return deny();

  return {
    ok: true,
    user: {
      id: row.id,
      role,
      isActive: true,
    },
  };
}
