'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

async function nextCustomerId() {
  const last = await prisma.customer.findFirst({
    where: { customerId: { startsWith: 'CUST-' } },
    orderBy: { customerId: 'desc' },
  });
  const seq = last ? Number(last.customerId.slice('CUST-'.length)) + 1 : 1;
  return `CUST-${pad(seq, 4)}`;
}

export type CustomerCreateInput = {
  name: string;
  type?: 'individual' | 'business';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  lineDisplay?: string | null;
  // 預設運輸偏好
  preferredShippingMethod?: 'home' | 'convenience' | null;
  preferredCvsBrand?: string | null; // 711 / familymart / hilife
  preferredCvsStoreId?: string | null;
  preferredCvsStoreName?: string | null;
};

export type CreatedCustomerOption = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  address: string | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
};

/**
 * 建立新客戶（可從訂單表單呼叫，回傳精簡的 option 物件供 select 帶入）。
 * 自動產生 CUST-XXXX 編號。
 */
export async function createCustomer(input: CustomerCreateInput): Promise<CreatedCustomerOption> {
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('客戶姓名為必填');

  const type = input.type === 'business' ? 'business' : 'individual';
  const phone = (input.phone ?? '').trim() || null;
  const email = (input.email ?? '').trim() || null;
  const lineDisplay = (input.lineDisplay ?? '').trim() || null;

  // Email 簡易檢查（避免拼錯）
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email 格式錯誤');
  }

  // 運輸偏好：home / convenience，未填或無效則 null
  const sm = input.preferredShippingMethod;
  const preferredShippingMethod =
    sm === 'home' || sm === 'convenience' ? sm : null;

  let preferredCvsBrand: string | null = null;
  let preferredCvsStoreId: string | null = null;
  let preferredCvsStoreName: string | null = null;

  if (preferredShippingMethod === 'convenience') {
    const VALID_BRANDS = ['711', 'familymart', 'hilife'];
    const brand = (input.preferredCvsBrand ?? '').trim();
    if (brand && !VALID_BRANDS.includes(brand)) {
      throw new Error('超商品牌錯誤');
    }
    preferredCvsBrand = brand || null;
    preferredCvsStoreId = (input.preferredCvsStoreId ?? '').trim() || null;
    preferredCvsStoreName = (input.preferredCvsStoreName ?? '').trim() || null;
  }

  const address =
    preferredShippingMethod === 'convenience'
      ? null
      : (input.address ?? '').trim() || null;

  const customerId = await nextCustomerId();
  const created = await prisma.customer.create({
    data: {
      customerId,
      name,
      type,
      phone,
      email,
      address,
      lineDisplay,
      preferredShippingMethod,
      preferredCvsBrand,
      preferredCvsStoreId,
      preferredCvsStoreName,
    },
    select: {
      id: true,
      customerId: true,
      name: true,
      phone: true,
      address: true,
      preferredShippingMethod: true,
      preferredCvsBrand: true,
      preferredCvsStoreId: true,
      preferredCvsStoreName: true,
    },
  });

  revalidatePath('/customers');
  revalidatePath('/orders/new');
  return created;
}

/** 客戶列表頁「新增客戶」表單 */
export async function createCustomerFromForm(formData: FormData) {
  const created = await createCustomer({
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? 'individual') === 'business' ? 'business' : 'individual',
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    lineDisplay: String(formData.get('lineDisplay') ?? ''),
    preferredShippingMethod:
      String(formData.get('preferredShippingMethod') ?? '') === 'home'
        ? 'home'
        : String(formData.get('preferredShippingMethod') ?? '') === 'convenience'
          ? 'convenience'
          : null,
    preferredCvsBrand: String(formData.get('preferredCvsBrand') ?? ''),
    preferredCvsStoreId: String(formData.get('preferredCvsStoreId') ?? ''),
    preferredCvsStoreName: String(formData.get('preferredCvsStoreName') ?? ''),
  });

  redirect(`/customers/${created.id}`);
}
