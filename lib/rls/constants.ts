/**
 * Preview RLS placeholders — never substitute real secrets in repo.
 * Actual role names must be filled out-of-band before Preview apply.
 */
export const RLS_PLACEHOLDER_RUNTIME_ROLE = 'REPLACE_ME_FURMOSA_RUNTIME';
export const RLS_PLACEHOLDER_SCHEMA_OWNER = 'REPLACE_ME_SCHEMA_OWNER';

/** Supabase platform roles (documented by Supabase). */
export const SUPABASE_PLATFORM_ROLES = ['anon', 'authenticated', 'service_role'] as const;

export const RLS_DRAFT_MIGRATION_PATH =
  'prisma/rls-drafts/20260805190000_preview_rls_phase1_baseline/migration.sql';

export const RLS_DRAFT_ROLLBACK_PATH =
  'prisma/rls-drafts/20260805190000_preview_rls_phase1_baseline/rollback.sql';
