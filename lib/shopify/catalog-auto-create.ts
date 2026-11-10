import type { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { loadShopifyCatalogAudit } from './catalog-sync-service';
import type { CatalogSyncPlan } from './catalog-sync';
import { catalogAutoCreateProfile } from './catalog-auto-profile';
import { createCandidateInTransaction } from './catalog-candidate-create';
import { candidateResolutionFingerprint, canonicalShopifyVariantId } from './catalog-candidate-resolution';
import { shopifyAdminAuthConfigFromEnv } from './admin-access-token';

/** Unlike the full manual audit, a scoped worker must never close unrelated candidates. */
export async function stageAutoCandidates(tx: Prisma.TransactionClient, input: { plan: CatalogSyncPlan; fingerprint: string; actorId: string }) {
  const rows = input.plan.unmatchedShopifyVariants;
  if (rows.length > 500) throw new Error('CATALOG_STAGE_LIMIT');
  for (const row of rows) {
    const fields = { productTitle: row.productTitle, variantTitle: row.variantTitle, sku: row.sku, price: row.price, shopifyStatus: row.productStatus };
    await tx.shopifyCatalogCandidate.upsert({ where: { shopifyVariantId: row.variantId },
      create: { ...fields, shopifyProductId: row.productId, shopifyVariantId: row.variantId },
      update: { ...fields, lastSeenAt: new Date() },
    });
  }
  return { runId: randomUUID(), candidateCount: rows.length, closedCount: 0, reopenedCount: 0 };
}

/** Bounded poller. Uses existing candidate locks/CAS; creates drafts only, never inventory or orders. */
export async function runCatalogAutoCreate(db: PrismaClient, mode: 'inspect' | 'create' = 'inspect', limit = 10,
  deps = { loadAudit: loadShopifyCatalogAudit, domain: () => shopifyAdminAuthConfigFromEnv().domain,
    stage: stageAutoCandidates, create: createCandidateInTransaction }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('INVALID_CATALOG_BATCH_LIMIT');
  if (mode !== 'inspect' && mode !== 'create') throw new Error('INVALID_CATALOG_MODE');
  const audit = await deps.loadAudit(db);
  const domain = deps.domain();
  const rows: Array<{ variantId: string; outcome: string; reason?: string }> = [];
  const eligible = audit.shopifyProducts.filter(product => catalogAutoCreateProfile(product, audit.shopifyProducts).ok);
  // No partial creation when any identity conflict involves this product or its variants.
  const existingProducts = await db.product.findMany({ where: { status: { in: ['active', 'draft'] } }, select: { id: true, name: true } });
  const previousBindings = await db.shopifyCatalogCandidate.findMany({ where: { resolution: { in: ['created', 'linked'] }, linkedProductId: { not: null } }, select: { shopifyProductId: true, linkedProductId: true } });
  const safeProducts = eligible.filter(product => !existingProducts.some(existing =>
    existing.name.trim().toLowerCase() === product.title.trim().toLowerCase() &&
    !previousBindings.some(binding => binding.shopifyProductId === product.id && binding.linkedProductId === existing.id)) && !audit.plan.conflicts.some(conflict =>
    conflict.ids.some(id => id === product.id || product.variants.some(variant => variant.id === id))));
  const pending = audit.plan.unmatchedShopifyVariants.filter(row => safeProducts.some(product => product.id === row.productId));
  const needsAttention = audit.shopifyProducts.filter(product => audit.plan.unmatchedShopifyVariants.some(row => row.productId === product.id) && !safeProducts.includes(product))
    .map(product => { const config = catalogAutoCreateProfile(product, audit.shopifyProducts); return { productId: product.id, reason: config.ok ? 'IDENTITY_REVIEW_REQUIRED' : config.code }; });
  if (mode === 'inspect') return { mode, examined: pending.length, rows: pending.slice(0, limit).map(row => ({ variantId: row.variantId, outcome: 'eligible' })), needsAttention, hasMore: pending.length > limit };
  if (!pending.length) return { mode, examined: 0, rows, needsAttention, hasMore: false };
  const runId = randomUUID();
  await db.statusAuditLog.create({ data: { entityType: 'catalog_auto_create', entityId: runId, newStatus: 'STARTED', actorType: 'system', metadataJson: JSON.stringify({ limit }) } });
  try {
    await db.$transaction(tx => deps.stage(tx, { plan: { ...audit.plan, unmatchedShopifyVariants: pending }, fingerprint: audit.fingerprint, actorId: 'catalog-auto-create' }), { timeout: 10_000 });
  } catch {
    await db.statusAuditLog.create({ data: { entityType: 'catalog_auto_create', entityId: runId, newStatus: 'FAILED', actorType: 'system', metadataJson: JSON.stringify({ reason: 'STAGE_FAILED' }) } });
    throw new Error('CATALOG_STAGE_FAILED');
  }
  // Only pending candidates are retried. A completed/manual decision is never reopened here.
  const candidates = await db.shopifyCatalogCandidate.findMany({ where: { resolution: 'pending', shopifyVariantId: { in: pending.map(row => row.variantId) } }, orderBy: { shopifyVariantId: 'asc' }, take: limit });
  for (const candidate of candidates) {
    const product = safeProducts.find(row => row.id === candidate.shopifyProductId)!;
    const variant = product.variants.find(row => row.id === candidate.shopifyVariantId)!;
    const config = catalogAutoCreateProfile(product, audit.shopifyProducts);
    if (!config.ok) continue;
    const spec = config.profile.variants[canonicalShopifyVariantId(variant.id)]!;
    try {
      await db.$transaction(async tx => {
        const current = await tx.shopifyCatalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
        const claims = await tx.productPriceTier.findMany({ where: { OR: [
          { sku: { equals: variant.sku!, mode: 'insensitive' } },
          { shopifySku: { equals: variant.sku!, mode: 'insensitive' } },
          { shopifyVariantId: { in: [variant.id, canonicalShopifyVariantId(variant.id)] } },
        ] }, select: { id: true, productId: true, status: true, sku: true, shopifySku: true, shopifyVariantId: true, product: { select: { status: true } } } });
        const result = await deps.create(tx, {
          candidateId: current.id, expectedFingerprint: candidateResolutionFingerprint({ shopDomain: domain, candidate: current, claims }),
          shopDomain: domain, actorId: 'catalog-auto-create', category: config.profile.category, ...spec,
          source: { productId: product.id, variantId: variant.id, productTitle: product.title, variantTitle: variant.title, sku: variant.sku!, price: variant.price, shopifyStatus: product.status },
        });
        if (!result.noop && result.createdProduct && product.content) await tx.product.update({ where: { id: result.productId }, data: { description: product.content.description, imageUrl: product.content.imageUrl } });
      }, { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 20_000 });
      rows.push({ variantId: variant.id, outcome: 'created_draft' });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'CREATE_FAILED';
      rows.push({ variantId: variant.id, outcome: 'needs_attention', reason: code });
    }
  }
  await db.statusAuditLog.create({ data: { entityType: 'catalog_auto_create', entityId: runId, newStatus: rows.some(row => row.outcome === 'needs_attention') ? 'PARTIAL' : 'FINISHED', actorType: 'system', metadataJson: JSON.stringify({ rows }) } });
  return { mode, examined: rows.length, rows, needsAttention, hasMore: candidates.length === limit };
}
