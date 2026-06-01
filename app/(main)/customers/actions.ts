'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createCustomerRecord,
  updateCustomerRecord,
  type CustomerCreateInput,
  type CreatedCustomerOption,
} from '@/lib/customers/create-customer';
import { parsePetFieldsFromFormData } from '@/lib/customers/pet-fields';
import { prisma } from '@/lib/prisma';

export type { CustomerCreateInput, CreatedCustomerOption };

export async function createCustomer(input: CustomerCreateInput): Promise<CreatedCustomerOption> {
  const created = await createCustomerRecord(input);
  revalidatePath('/customers');
  revalidatePath('/orders/new');
  revalidatePath('/jar-exchange/members');
  return created;
}

/** 客戶列表頁「新增客戶」表單 */
export async function createCustomerFromForm(formData: FormData) {
  const pet = parsePetFieldsFromFormData(formData);
  const created = await createCustomer({
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? 'individual') === 'business' ? 'business' : 'individual',
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    lineUserId: String(formData.get('lineUserId') ?? ''),
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
    ...pet,
  });

  redirect(`/customers/${created.id}`);
}

/** 客戶編輯頁表單 */
export async function updateCustomerFromForm(id: string, formData: FormData) {
  const pet = parsePetFieldsFromFormData(formData);
  await updateCustomerRecord(id, {
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? 'individual') === 'business' ? 'business' : 'individual',
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    lineUserId: String(formData.get('lineUserId') ?? ''),
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
    ...pet,
  });

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  revalidatePath('/jar-exchange/members');
  redirect(`/customers/${id}`);
}

/**
 * 刪除客戶。為保留交易紀錄，若客戶已有訂單或訂閱合約則阻擋刪除；
 * 其餘關聯（換罐服務、點數流水、獎勵兌換）會一併清除，已返航序號會退回未使用。
 */
export async function deleteCustomer(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false as const, error: '缺少客戶 ID' };

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { orders: true, subscriptions: true } },
    },
  });
  if (!customer) return { ok: false as const, error: '找不到客戶' };

  if (customer._count.orders > 0) {
    return {
      ok: false as const,
      error: `此客戶有 ${customer._count.orders} 筆訂單紀錄，無法刪除（保留交易歷史）`,
    };
  }
  if (customer._count.subscriptions > 0) {
    return {
      ok: false as const,
      error: `此客戶有 ${customer._count.subscriptions} 筆訂閱合約，請先結束訂閱再刪除`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 已返航的序號退回未使用（避免成為無主的已用序號）
      await tx.jarCode.updateMany({
        where: { redeemedByCustomerId: id },
        data: {
          status: 'unused',
          redeemedByCustomerId: null,
          redeemedAt: null,
        },
      });
      // 點數流水、獎勵兌換、換罐服務以 onDelete: Cascade 自動清除
      await tx.customer.delete({ where: { id } });
    });
  } catch (e) {
    console.error('deleteCustomer', e);
    return { ok: false as const, error: e instanceof Error ? e.message : '刪除失敗' };
  }

  revalidatePath('/customers');
  revalidatePath('/jar-exchange/members');
  revalidatePath('/jar-exchange/manage');
  redirect('/customers');
}
