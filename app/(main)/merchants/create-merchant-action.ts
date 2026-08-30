'use server';

/**
 * 獨立 server action 檔，避免 Next 快取舊版 merchants/actions 內含 preferredCarrier 的 create。
 * 運輸欄位一律經 raw SQL 寫入（見 lib/merchant-shipping-persist.ts）。
 */
import { prisma } from '@/lib/prisma';
import { CARRIER_711 } from '@/lib/carrier-cvs';
import { insertMerchantRecord } from '@/lib/merchant-create';
import { parseMerchantShippingFromForm } from '@/lib/merchant-shipping-persist';
import { parseMerchantIndustry } from '@/lib/merchant-industry';
import {
  parseMerchantTypesFromForm,
  primaryMerchantType,
} from '@/lib/merchant-types';
import { isRedirectError } from '@/lib/redirect-error';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { bustCacheTags } from '@/lib/runtime-cache';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { syncPartnerStoreForJarExchangeMerchant } from '@/lib/stores/sync-merchant-stores';

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
    const returnTo = String(formData.get('returnTo') ?? '').trim();

    const types = parseMerchantTypesFromForm(formData);
    if (types.length === 0) return { error: '請至少選擇一種類型' };
    const type = primaryMerchantType(types);

    const email = toNullableField(formData.get('email'));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Email 格式錯誤' };
    }

    const industryRaw = String(formData.get('industry') ?? '').trim();
    if (industryRaw && !parseMerchantIndustry(industryRaw)) {
      return { error: '店家產業錯誤' };
    }
    const industry = parseMerchantIndustry(industryRaw);

    const shipping = parseMerchantShippingFromForm(formData);
    if (shipping.error) return { error: shipping.error };

    const merchant = await insertMerchantRecord(prisma, {
      merchantId: await nextMerchantId(),
      name,
      type,
      types,
      industry,
      contactName: toNullableField(formData.get('contactName')),
      phone: toNullableField(formData.get('phone')),
      email,
      city: toNullableField(formData.get('city')),
      notes: toNullableField(formData.get('notes')),
      shipping,
    });

    await syncPartnerStoreForJarExchangeMerchant(
      prisma,
      { ...merchant, status: 'active' },
      types,
    );

    revalidatePath('/merchants');
    revalidatePath('/jar-exchange/stores');
    revalidatePath('/store-redeem');
    await bustCacheTags(CACHE_TAGS.merchantsPortfolio, CACHE_TAGS.dashboard);
    redirect(
      returnTo === '/orders/new'
        ? `/orders/new?merchantId=${encodeURIComponent(merchant.id)}`
        : `/merchants/${merchant.id}`,
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : '建立失敗' };
  }
}
