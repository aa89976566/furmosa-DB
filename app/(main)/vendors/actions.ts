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
      status: formData.get('status') === 'inactive' ? 'inactive' : 'active',
    },
  });

  revalidatePath('/vendors');
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
      status: formData.get('status') === 'inactive' ? 'inactive' : 'active',
    },
  });

  revalidatePath('/vendors');
  revalidatePath(`/vendors/${id}`);
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
