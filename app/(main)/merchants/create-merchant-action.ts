'use server';

/**
 * 獨立 server action 檔，避免 Next 快取舊版 merchants/actions 內含 preferredCarrier 的 create。
 * 運輸欄位一律經 raw SQL 寫入（見 lib/merchant-shipping-persist.ts）。
 */
import { prisma } from '@/lib/prisma';
import { CARRIER_711 } from '@/lib/carrier-cvs';
import {
  createMerchantBaseRecord,
  parseMerchantShippingFromForm,
} from '@/lib/merchant-shipping-persist';
import { isRedirectError } from '@/lib/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const MERCHANT_TYPES = ['consignment', 'pop_up', 'flagship', 'partner'] as const;

function toNullableField(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

async function nextMerchantId() {
  const last = await prisma.merchant.findFirst({
    where: { merchantId: { startsWith: 'MER-' } },
    orderBy: { merchantId: 'desc' },
  });
  const seq = last ? Number(last.merchantId.replace('MER-', '')) + 1 : 1;
  return `MER-${String(seq).padStart(4, '0')}`;
}

export type CreateMerchantState = { error: string | null };

export async function createMerchantAction(
  _prev: CreateMerchantState,
  formData: FormData,
): Promise<CreateMerchantState> {
  try {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { error: '店家名稱為必填' };

    const typeRaw = String(formData.get('type') ?? 'consignment');
    if (!MERCHANT_TYPES.includes(typeRaw as (typeof MERCHANT_TYPES)[number])) {
      return { error: '店家類型錯誤' };
    }

    const email = toNullableField(formData.get('email'));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Email 格式錯誤' };
    }

    const shipping = parseMerchantShippingFromForm(formData);
    if (shipping.error) return { error: shipping.error };

    const merchant = await createMerchantBaseRecord(prisma, {
      merchantId: await nextMerchantId(),
      name,
      type: typeRaw,
      contactName: toNullableField(formData.get('contactName')),
      phone: toNullableField(formData.get('phone')),
      email,
      city: toNullableField(formData.get('city')),
      notes: toNullableField(formData.get('notes')),
      shipping,
    });

    revalidatePath('/merchants');
    redirect(`/merchants/${merchant.id}`);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : '建立失敗' };
  }
}
