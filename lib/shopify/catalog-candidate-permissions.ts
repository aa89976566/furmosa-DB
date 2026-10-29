export const CATALOG_CANDIDATE_MANAGER_ROLES = ['admin', 'inventory_reviewer'] as const;

export function canManageCatalogCandidates(role: string | null | undefined): boolean {
  return Boolean(role && (CATALOG_CANDIDATE_MANAGER_ROLES as readonly string[]).includes(role));
}
