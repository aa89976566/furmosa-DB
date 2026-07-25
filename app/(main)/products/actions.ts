'use server';

import { prisma } from '@/lib/prisma';
import {
  costPerUnitFromTierTotal,
  isGramUnit,
  isWeightTier,
  resolveTierCost,
} from '@/lib/product-price-tier';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { bustCacheTags } from '@/lib/runtime-cache';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

async function bustProductCaches() {
  await bustCacheTags(CACHE_TAGS.productsCatalog, CACHE_TAGS.vendorsList);
}

const VALID_CATEGORIES = [
  'staple_food',
  'treats',
  'health',
  'freeze_dried',
  'toys',
  'accessories',
  'other',
] as const;

const VALID_STATUSES = ['active', 'draft', 'inactive'] as const;

async function nextProductId() {
  const last = await prisma.product.findFirst({
    where: { productId: { startsWith: 'PROD-' } },
    orderBy: { productId: 'desc' },
  });
  const seq = last ? Number(last.productId.slice('PROD-'.length)) + 1 : 1;
  return `PROD-${pad(seq, 4)}`;
}

async function nextSku(productSeq: number) {
  // 跟 import.ts 一致用 FUR-XXXX
  return `FUR-${pad(productSeq, 4)}`;
}

function toNullableString(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function toNumber(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseCategory(v: FormDataEntryValue | null): string {
  const s = String(v ?? 'other');
  return (VALID_CATEGORIES as readonly string[]).includes(s) ? s : 'other';
}

function parseStatus(v: FormDataEntryValue | null): string {
  const s = String(v ?? 'active');
  return (VALID_STATUSES as readonly string[]).includes(s) ? s : 'active';
}

export async function createProduct(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    throw new Error('商品名稱為必填');
  }

  const price = toNumber(formData.get('price'));
  if (price < 0) throw new Error('售價不可為負數');
  const cost = toNumber(formData.get('cost'));
  if (cost < 0) throw new Error('成本不可為負數');

  const productId = await nextProductId();
  const seq = Number(productId.slice('PROD-'.length));
  const sku = await nextSku(seq);

  const vendorId = toNullableString(formData.get('vendorId'));

  const created = await prisma.product.create({
    data: {
      productId,
      sku,
      name,
      category: parseCategory(formData.get('category')),
      style: toNullableString(formData.get('style')),
      unit: String(formData.get('unit') ?? '件').trim() || '件',
      price,
      cost,
      reorderPoint: Math.max(0, toInt(formData.get('reorderPoint'), 10)),
      status: parseStatus(formData.get('status')),
      vendorId,
      notes: toNullableString(formData.get('notes')),
    },
  });

  revalidatePath('/products');
  revalidatePath('/vendors');
  if (vendorId) revalidatePath(`/vendors/${vendorId}`);
  await bustProductCaches();
  redirect(`/products/${created.id}`);
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少商品 id');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('商品名稱為必填');

  const productType = String(formData.get('productType') ?? 'simple');
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { price: true, cost: true, unit: true, vendorId: true },
  });
  if (!existing) throw new Error('找不到商品');
  const newVendorId = toNullableString(formData.get('vendorId'));

  const price =
    productType === 'variable'
      ? Number(existing.price)
      : toNumber(formData.get('price'));
  if (price < 0) throw new Error('售價不可為負數');
  const cost =
    productType === 'variable'
      ? Number(existing.cost)
      : toNumber(formData.get('cost'));
  if (cost < 0) throw new Error('成本不可為負數');
  const unit =
    productType === 'variable'
      ? existing.unit
      : String(formData.get('unit') ?? '件').trim() || '件';

  await prisma.product.update({
    where: { id },
    data: {
      name,
      category: parseCategory(formData.get('category')),
      style: toNullableString(formData.get('style')),
      unit,
      price,
      cost,
      reorderPoint: Math.max(0, toInt(formData.get('reorderPoint'), 10)),
      status: parseStatus(formData.get('status')),
      vendorId: newVendorId,
      notes: toNullableString(formData.get('notes')),
    },
  });

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  revalidatePath('/vendors');
  if (existing.vendorId) revalidatePath(`/vendors/${existing.vendorId}`);
  if (newVendorId) revalidatePath(`/vendors/${newVendorId}`);
  await bustProductCaches();
}

export async function setProductStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = parseStatus(formData.get('status'));
  if (!id) throw new Error('缺少商品 id');
  await prisma.product.update({ where: { id }, data: { status } });
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  await bustProductCaches();
}

export async function deleteProduct(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: '缺少商品 id' };

  const [orderItemCount, shipmentItemCount] = await Promise.all([
    prisma.orderItem.count({ where: { productId: id } }),
    prisma.shipmentItem.count({ where: { productId: id } }),
  ]);

  const blockers: string[] = [];
  if (orderItemCount > 0) blockers.push(`訂單明細 ${orderItemCount} 筆`);
  if (shipmentItemCount > 0) blockers.push(`出貨明細 ${shipmentItemCount} 筆`);

  if (blockers.length > 0) {
    return {
      ok: false,
      error: `此商品已用於正式交易（${blockers.join('、')}），為保留紀錄無法刪除。建議改將狀態切換為「下架」。`,
    };
  }

  try {
    await prisma.$transaction([
      prisma.merchantStockTxn.deleteMany({ where: { productId: id } }),
      prisma.merchantStock.deleteMany({ where: { productId: id } }),
      prisma.merchantProductRule.deleteMany({ where: { productId: id } }),
      prisma.inventoryTransaction.deleteMany({ where: { productId: id } }),
      prisma.inventoryBalance.deleteMany({ where: { productId: id } }),
      prisma.productPriceTier.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '刪除失敗' };
  }

  revalidatePath('/products');
  revalidatePath('/merchants');
  await bustProductCaches();
  redirect('/products');
}

// =====================================================
// 規格 / 售價（ProductPriceTier）CRUD
// 同一商品下可有多筆規格：依「重量」（30g/50g/100g）或「單位」（5 隻/10 片）。
// schema 設計：weightGrams + unit + unitQty 的組合在同商品內唯一。
// =====================================================

function parseTierFields(formData: FormData) {
  const mode = String(formData.get('mode') ?? 'weight'); // weight | unit
  const price = toNumber(formData.get('price'));
  if (price <= 0) throw new Error('售價必須大於 0');
  const rawCostStr = String(formData.get('tierCost') ?? '').trim();
  const rawCost = rawCostStr === '' ? null : toNumber(formData.get('tierCost'));
  if (rawCost == null || rawCost <= 0) throw new Error('請填寫此規格的成本');
  if (rawCost < 0) throw new Error('成本不可為負數');
  const notes = toNullableString(formData.get('notes'));

  if (mode === 'weight') {
    const weightGrams = toInt(formData.get('weightGrams'));
    if (weightGrams <= 0) throw new Error('重量必須大於 0');
    return {
      weightGrams,
      unit: 'g',
      unitQty: 1,
      price,
      cost: rawCost,
      notes,
    };
  }
  // unit mode
  const unit = String(formData.get('unit') ?? '').trim();
  if (!unit) throw new Error('單位為必填（例：隻、片、包）');
  const unitQty = Math.max(1, toInt(formData.get('unitQty'), 1));
  return {
    weightGrams: null,
    unit,
    unitQty,
    price,
    cost: rawCost,
    notes,
  };
}

function isPriceTierUniqueConflict(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: unknown }).code === 'P2002'
  );
}

async function syncProductBaseFromVariations(productId: string) {
  const [product, tiers] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { cost: true },
    }),
    prisma.productPriceTier.findMany({
      where: { productId },
      orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
    }),
  ]);
  if (!product || tiers.length === 0) return;

  const anchor = tiers.reduce((current, tier) =>
    tier.price < current.price ? tier : current,
  );

  const anchorTotalCost = resolveTierCost(anchor.cost, anchor.weightGrams);
  let costPerUnit = product.cost;
  let unit = anchor.unit;

  if (isWeightTier(anchor)) {
    unit = 'g';
    if (anchorTotalCost != null && anchor.weightGrams! > 0) {
      costPerUnit = costPerUnitFromTierTotal(anchorTotalCost, anchor.weightGrams!);
    }
  } else if (isGramUnit(anchor.unit)) {
    unit = 'g';
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      price: anchor.price,
      cost: costPerUnit,
      unit,
    },
  });
}

export async function createPriceTier(formData: FormData) {
  const productId = String(formData.get('productId') ?? '');
  if (!productId) throw new Error('缺少商品 id');

  const data = parseTierFields(formData);

  try {
    await prisma.productPriceTier.create({
      data: { productId, ...data },
    });
  } catch (e) {
    if (isPriceTierUniqueConflict(e)) {
      throw new Error('已存在相同規格（重量 + 單位 + 包裝數量）。請改編輯既有規格。');
    }
    throw e;
  }

  await syncProductBaseFromVariations(productId);

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  await bustProductCaches();
}

export async function updatePriceTier(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const productId = String(formData.get('productId') ?? '');
  if (!id || !productId) throw new Error('缺少 tier id 或 productId');

  const data = parseTierFields(formData);

  try {
    await prisma.productPriceTier.update({
      where: { id },
      data,
    });
  } catch (e) {
    if (isPriceTierUniqueConflict(e)) {
      throw new Error('已存在相同規格（重量 + 單位 + 包裝數量）。');
    }
    throw e;
  }

  await syncProductBaseFromVariations(productId);

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  await bustProductCaches();
}

export async function deletePriceTier(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const productId = String(formData.get('productId') ?? '');
  if (!id) throw new Error('缺少 tier id');

  await prisma.productPriceTier.delete({ where: { id } });

  if (productId) {
    await syncProductBaseFromVariations(productId);
  }

  revalidatePath('/products');
  if (productId) revalidatePath(`/products/${productId}`);
  await bustProductCaches();
}
