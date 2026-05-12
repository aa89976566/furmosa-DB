'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

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
  redirect(`/products/${created.id}`);
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少商品 id');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('商品名稱為必填');

  const price = toNumber(formData.get('price'));
  if (price < 0) throw new Error('售價不可為負數');
  const cost = toNumber(formData.get('cost'));
  if (cost < 0) throw new Error('成本不可為負數');

  await prisma.product.update({
    where: { id },
    data: {
      name,
      category: parseCategory(formData.get('category')),
      style: toNullableString(formData.get('style')),
      unit: String(formData.get('unit') ?? '件').trim() || '件',
      price,
      cost,
      reorderPoint: Math.max(0, toInt(formData.get('reorderPoint'), 10)),
      status: parseStatus(formData.get('status')),
      vendorId: toNullableString(formData.get('vendorId')),
      notes: toNullableString(formData.get('notes')),
    },
  });

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function setProductStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = parseStatus(formData.get('status'));
  if (!id) throw new Error('缺少商品 id');
  await prisma.product.update({ where: { id }, data: { status } });
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少商品 id');

  // 檢查有沒有不能刪的歷史關聯
  const [orderItemCount, txnCount, ruleCount, stockCount] = await Promise.all([
    prisma.orderItem.count({ where: { productId: id } }),
    prisma.inventoryTransaction.count({ where: { productId: id } }),
    prisma.merchantProductRule.count({ where: { productId: id } }),
    prisma.merchantStock.count({ where: { productId: id } }),
  ]);

  const blockers: string[] = [];
  if (orderItemCount > 0) blockers.push(`訂單明細 ${orderItemCount} 筆`);
  if (txnCount > 0) blockers.push(`庫存異動 ${txnCount} 筆`);
  if (ruleCount > 0) blockers.push(`寄賣規則 ${ruleCount} 筆`);
  if (stockCount > 0) blockers.push(`寄賣店庫存 ${stockCount} 筆`);

  if (blockers.length > 0) {
    throw new Error(
      `此商品仍有歷史關聯（${blockers.join('、')}），無法刪除。建議改將狀態切換為「下架」。`,
    );
  }

  // 沒有歷史的話，連同價格規格一起刪
  await prisma.productPriceTier.deleteMany({ where: { productId: id } });
  await prisma.inventoryBalance.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });

  revalidatePath('/products');
  redirect('/products');
}
