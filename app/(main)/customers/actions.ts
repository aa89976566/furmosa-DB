'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createCustomerRecord,
  type CustomerCreateInput,
  type CreatedCustomerOption,
} from '@/lib/customers/create-customer';

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
  });

  redirect(`/customers/${created.id}`);
}
