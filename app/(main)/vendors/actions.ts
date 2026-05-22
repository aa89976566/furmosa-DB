'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

async function nextVendorId() {
  const last = await prisma.vendor.findFirst({
    where: { vendorId: { startsWith: 'VEND-' } },
    orderBy: { vendorId: 'desc' },
  });
  const seq = last ? Number(last.vendorId.slice('VEND-'.length)) + 1 : 1;
  return `VEND-${pad(seq, 4)}`;
}

function toNullableString(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export async function createVendor(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    throw new Error('廠商名稱為必填');
  }
  const vendorId = await nextVendorId();

  const created = await prisma.vendor.create({
    data: {
      vendorId,
      name,
      contactName: toNullableString(formData.get('contactName')),
      phone: toNullableString(formData.get('phone')),
      email: toNullableString(formData.get('email')),
      address: toNullableString(formData.get('address')),
      paymentTerms: toNullableString(formData.get('paymentTerms')),
      notes: toNullableString(formData.get('notes')),
      status: formData.has('statusActive') ? 'active' : 'inactive',
    },
  });

  revalidatePath('/vendors');
  revalidatePath('/products');
  redirect(`/vendors/${created.id}`);
}

export async function updateVendor(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少廠商 id');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('廠商名稱為必填');

  await prisma.vendor.update({
    where: { id },
    data: {
      name,
      contactName: toNullableString(formData.get('contactName')),
      phone: toNullableString(formData.get('phone')),
      email: toNullableString(formData.get('email')),
      address: toNullableString(formData.get('address')),
      paymentTerms: toNullableString(formData.get('paymentTerms')),
      notes: toNullableString(formData.get('notes')),
      status: formData.has('statusActive') ? 'active' : 'inactive',
    },
  });

  revalidatePath('/vendors');
  revalidatePath(`/vendors/${id}`);
  revalidatePath('/products');
}

function parseCategory(v: FormDataEntryValue | null): string {
  const s = String(v ?? 'other');
  const allowed = [
    'staple_food',
    'treats',
    'health',
    'freeze_dried',
    'toys',
    'accessories',
    'other',
  ] as const;
  return (allowed as readonly string[]).includes(s) ? s : 'other';
}

async function nextProductId() {
  const last = await prisma.product.findFirst({
    where: { productId: { startsWith: 'PROD-' } },
    orderBy: { productId: 'desc' },
  });
  const seq = last ? Number(last.productId.slice('PROD-'.length)) + 1 : 1;
  return `PROD-${pad(seq, 4)}`;
}

async function nextSku(seq: number) {
  return `FUR-${pad(seq, 4)}`;
}

function toNumber(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : fallback;
}

/** 在廠商頁直接建立商品（寫入 Product，自動綁定 vendorId） */
export async function createVendorProduct(formData: FormData) {
  const vendorId = String(formData.get('vendorId') ?? '');
  if (!vendorId) throw new Error('缺少廠商 id');

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new Error('找不到廠商');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('商品名稱為必填');

  const productId = await nextProductId();
  const seq = Number(productId.slice('PROD-'.length));
  let sku = await nextSku(seq);
  while (await prisma.product.findUnique({ where: { sku } })) {
    sku = `FUR-${pad(seq + Math.floor(Math.random() * 100), 4)}`;
  }

  const unit = String(formData.get('unit') ?? 'g').trim() || 'g';
  const price = toNumber(formData.get('price'));
  const cost = toNumber(formData.get('cost'));

  await prisma.product.create({
    data: {
      productId,
      sku,
      name,
      category: parseCategory(formData.get('category')),
      unit,
      price,
      cost,
      reorderPoint: 10,
      status: 'active',
      vendorId,
      notes: toNullableString(formData.get('notes')),
    },
  });

  revalidatePath('/products');
  revalidatePath('/vendors');
  revalidatePath(`/vendors/${vendorId}`);
}

/** 將既有商品綁定到此廠商 */
export async function linkProductToVendor(formData: FormData) {
  const vendorId = String(formData.get('vendorId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  if (!vendorId || !productId) throw new Error('缺少廠商或商品');

  await prisma.product.update({
    where: { id: productId },
    data: { vendorId },
  });

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  revalidatePath('/vendors');
  revalidatePath(`/vendors/${vendorId}`);
}

/** 解除商品與廠商的綁定 */
export async function unlinkProductFromVendor(formData: FormData) {
  const productId = String(formData.get('productId') ?? '');
  const vendorId = String(formData.get('vendorId') ?? '');
  if (!productId) throw new Error('缺少商品 id');

  await prisma.product.update({
    where: { id: productId },
    data: { vendorId: null },
  });

  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  revalidatePath('/vendors');
  if (vendorId) revalidatePath(`/vendors/${vendorId}`);
}

export async function setVendorStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['active', 'inactive'].includes(status)) {
    throw new Error('參數錯誤');
  }
  await prisma.vendor.update({ where: { id }, data: { status } });
  revalidatePath('/vendors');
  revalidatePath(`/vendors/${id}`);
}

export async function deleteVendor(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少廠商 id');

  const productCount = await prisma.product.count({ where: { vendorId: id } });
  if (productCount > 0) {
    throw new Error(`此廠商仍綁定 ${productCount} 個商品，請先移除後再刪除`);
  }

  await prisma.vendor.delete({ where: { id } });
  revalidatePath('/vendors');
  redirect('/vendors');
}

export type VendorPanelProduct = {
  id: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  cost: number;
};

export type VendorPanelData = {
  id: string;
  vendorId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerms: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  products: VendorPanelProduct[];
};

export async function fetchVendorPanel(vendorId: string): Promise<VendorPanelData | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      products: {
        orderBy: { productId: 'asc' },
        select: {
          id: true,
          productId: true,
          name: true,
          category: true,
          price: true,
          cost: true,
        },
      },
    },
  });
  if (!vendor) return null;

  return {
    id: vendor.id,
    vendorId: vendor.vendorId,
    name: vendor.name,
    contactName: vendor.contactName,
    phone: vendor.phone,
    email: vendor.email,
    address: vendor.address,
    paymentTerms: vendor.paymentTerms,
    notes: vendor.notes,
    status: vendor.status,
    createdAt: vendor.createdAt.toISOString(),
    products: vendor.products.map((product) => ({
      id: product.id,
      productId: product.productId,
      name: product.name,
      category: product.category,
      price: Number(product.price),
      cost: Number(product.cost),
    })),
  };
}
