import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export const PREVIEW_MANLISA_SHIPMENT_ID = 'cmtuoxyod000rkryvf7081cbf';
const MERCHANT_CODE = 'MER-PREVIEW-MANLISA';
const USERNAME = 'preview-manlisa';

const products = [
  { productId: 'PREVIEW-0001', sku: 'FUR-0022', name: '牛肉丁凍乾', weightGrams: 30, quantity: 7 },
  { productId: 'PREVIEW-0002', sku: 'FUR-0028', name: '水晶魚凍乾', weightGrams: 30, quantity: 1 },
  { productId: 'PREVIEW-0003', sku: 'FUR-0003', name: '混合蔬果凍乾', weightGrams: 30, quantity: 4 },
  { productId: 'PREVIEW-0004', sku: 'FUR-0004', name: '地瓜山藥雞肉月餅', weightGrams: 50, quantity: 16 },
  { productId: 'PREVIEW-0005', sku: 'FUR-0002', name: '原味雞霸', weightGrams: null, quantity: 7 },
];

function enabled() {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.PREVIEW_DEMO_LOGIN_ENABLED === 'true'
    && process.env.VERCEL_GIT_COMMIT_REF === 'codex/shipment-detail-reference-ux';
}

export function canUsePreviewManlisaDemo() {
  return enabled();
}

/** A branch-scoped fixture. It never reads or writes the production database; the Vercel flag is Preview-only. */
export async function ensurePreviewManlisaDemo() {
  if (!enabled()) throw new Error('Preview demo is not enabled for this deployment.');

  const merchant = await prisma.merchant.upsert({
    where: { merchantId: MERCHANT_CODE },
    update: { name: '曼莉莎寵物美容', status: 'active' },
    create: {
      merchantId: MERCHANT_CODE,
      name: '曼莉莎寵物美容',
      type: 'consignment',
      types: ['consignment'],
      industry: 'beauty',
      city: '桃園',
      status: 'active',
    },
  });
  const passwordHash = await hashPassword(`preview-${merchant.id}`);
  const user = await prisma.merchantUser.upsert({
    where: { username: USERNAME },
    update: { merchantId: merchant.id, passwordHash, isActive: true, displayName: '曼莉莎店員' },
    create: { merchantId: merchant.id, username: USERNAME, passwordHash, isActive: true, displayName: '曼莉莎店員' },
  });
  const seededProducts = await Promise.all(products.map((item) => prisma.product.upsert({
    where: { productId: item.productId },
    update: { name: item.name, sku: item.sku, status: 'active' },
    create: { productId: item.productId, sku: item.sku, name: item.name, category: 'freeze_dried', unit: '包', price: 99, cost: 40, status: 'active' },
  })));

  await prisma.shipment.upsert({
    where: { id: PREVIEW_MANLISA_SHIPMENT_ID },
    update: {
      merchantId: merchant.id,
      status: 'shipped',
      items: { deleteMany: {}, create: seededProducts.map((product, index) => ({ productId: product.id, productName: products[index].name, sku: products[index].sku, quantity: products[index].quantity, weightGrams: products[index].weightGrams, unit: '包' })) },
    },
    create: {
      id: PREVIEW_MANLISA_SHIPMENT_ID,
      shipmentNumber: 'SHP-PREVIEW-0010',
      type: 'merchant_restock',
      merchantId: merchant.id,
      status: 'shipped',
      carrier: 'HQ 配送',
      trackingNumber: 'PREVIEW-ONLY',
      notes: '此為 Preview 專用示範資料，不會影響正式庫存。',
      packedAt: new Date('2026-09-21T01:30:00.000Z'),
      shippedAt: new Date('2026-09-21T02:00:00.000Z'),
      items: { create: seededProducts.map((product, index) => ({ productId: product.id, productName: products[index].name, sku: products[index].sku, quantity: products[index].quantity, weightGrams: products[index].weightGrams, unit: '包' })) },
    },
  });
  return { merchant, user };
}
