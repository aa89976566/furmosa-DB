'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getShopifyAdminAccessToken, shopifyAdminAuthConfigFromEnv } from '@/lib/shopify/admin-access-token';
import { productPushFingerprint, singleTierForPush, pushSingleProduct, ProductPushError } from '@/lib/shopify/product-push';

export type ProductPushState = { ok: boolean; message: string };
export async function pushProductToShopifyAction(_previous: ProductPushState, form: FormData): Promise<ProductPushState> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, message: '請先登入 HQ' };
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (user?.role !== 'admin') return { ok: false, message: '只有 HQ 管理員可以同步至 Shopify' };
  if (process.env.HQ_SHOPIFY_PRODUCT_PUSH_ENABLED !== 'true') return { ok: false, message: '商品反向同步尚未啟用' };
  const productId = String(form.get('productId') ?? '');
  const expected = String(form.get('fingerprint') ?? '');
  if (!productId || !/^[a-f0-9]{64}$/.test(expected)) return { ok: false, message: '請重新整理商品頁後再同步' };
  const runId = randomUUID();
  let started = false;
  let externallyConfirmed = false;
  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: {
      id: true, status: true, productCategory: true,
      priceTiers: { select: { id: true, status: true, sku: true, shopifySku: true, shopifyVariantId: true, weightGrams: true, price: true, cost: true,
        bundleComponents: { select: { componentProductId: true } } } },
    } });
    if (!product || productPushFingerprint(product) !== expected) return { ok: false, message: 'HQ 資料已更新，請重新整理後再同步' };
    if (product.priceTiers.some(t => t.status === 'active' && t.bundleComponents.length)) return { ok: false, message: '組合商品請使用配方同步流程' };
    const tier = singleTierForPush(product);
    const conflicts = await prisma.productPriceTier.count({ where: { id: { not: tier.id }, status: 'active',
      OR: [{ shopifyVariantId: tier.shopifyVariantId }, { shopifySku: { equals: tier.sku, mode: 'insensitive' } }, { sku: { equals: tier.sku, mode: 'insensitive' } }] } });
    if (conflicts) return { ok: false, message: 'SKU 或 Shopify 規格有重複綁定，請先處理對應' };
    const auth = shopifyAdminAuthConfigFromEnv();
    const token = await getShopifyAdminAccessToken(auth);
    await prisma.statusAuditLog.create({ data: { entityType: 'hq_shopify_product_push', entityId: runId, newStatus: 'STARTED',
      actorType: 'user', actorId: session.userId,
      metadataJson: JSON.stringify({ productId, tierId: tier.id, fingerprint: expected, sku: tier.sku,
        shopifyVariantId: tier.shopifyVariantId, price: tier.price, cost: tier.cost, weightGrams: tier.weightGrams }) } });
    started = true;
    const result = await pushSingleProduct(product, { domain: auth.domain, token });
    externallyConfirmed = true;
    await prisma.statusAuditLog.create({ data: { entityType: 'hq_shopify_product_push', entityId: runId, newStatus: 'VERIFIED',
      actorType: 'user', actorId: session.userId,
      metadataJson: JSON.stringify({ productId, fingerprint: expected, ...result }) } });
    revalidatePath(`/products/${productId}`);
    return { ok: true, message: result.changed ? 'Shopify 售價、每包成本與重量已同步並讀回確認' : 'Shopify 售價、每包成本與重量已是最新' };
  } catch (error) {
    if (started) {
      try { await prisma.statusAuditLog.create({ data: { entityType: 'hq_shopify_product_push', entityId: runId,
        newStatus: externallyConfirmed ? 'VERIFIED_AUDIT_INCOMPLETE' : 'NEEDS_VERIFICATION', actorType: 'user', actorId: session.userId,
        metadataJson: JSON.stringify({ productId, fingerprint: expected }) } }); } catch { /* STARTED remains visible for reconciliation. */ }
    }
    return { ok: false, message: externallyConfirmed ? 'Shopify 已讀回確認，但操作紀錄未完整保存；請檢查紀錄後再操作' :
      error instanceof ProductPushError ? error.message : '同步未完成；請核對 Shopify 與操作紀錄後再試' };
  }
}
