'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { prisma } from '@/lib/prisma';
import { bustCacheTags } from '@/lib/runtime-cache';
import { getMerchantTypes, getMerchantTypesMap, persistMerchantTypes } from '@/lib/merchant-types-persist';
import {
  mergeMerchantTypes,
  selectedCooperationTypes,
  type MerchantSearchItem,
} from '@/lib/merchants/onboarding';
import { syncPartnerStoreForJarExchangeMerchant } from '@/lib/stores/sync-merchant-stores';

export type MerchantSearchResult =
  | { ok: true; items: MerchantSearchItem[] }
  | { ok: false; error: string; items: [] };

export async function searchMerchantsAction(query: string): Promise<MerchantSearchResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '請先登入總部帳號', items: [] };

  const q = query.trim();
  if (q.length < 2) return { ok: true, items: [] };

  const merchants = await prisma.merchant.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { merchantId: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ],
    },
    select: {
      id: true,
      merchantId: true,
      name: true,
      phone: true,
      city: true,
      type: true,
      users: { where: { isActive: true }, select: { id: true }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 12,
  });
  const typesMap = await getMerchantTypesMap(prisma, merchants);

  return {
    ok: true,
    items: merchants.map((merchant) => ({
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      phone: merchant.phone,
      city: merchant.city,
      types: typesMap.get(merchant.id) ?? [],
      hasPosAccount: merchant.users.length > 0,
    })),
  };
}

export type ActivateMerchantState = { error: string | null };

export async function activateMerchantAction(
  _previous: ActivateMerchantState,
  formData: FormData,
): Promise<ActivateMerchantState> {
  const user = await getCurrentUser();
  if (!user) return { error: '請先登入總部帳號' };

  const merchantId = String(formData.get('merchantId') ?? '').trim();
  const selected = selectedCooperationTypes(
    formData.getAll('types').map((value) => String(value)),
  );
  if (!merchantId) return { error: '請重新選擇店家' };
  if (selected.length === 0) return { error: '請至少選擇一種合作方式' };

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, merchantId: true, name: true, type: true, status: true },
  });
  if (!merchant) return { error: '找不到這家店，請重新搜尋' };

  const current = await getMerchantTypes(prisma, merchant.id, merchant.type);
  const merged = mergeMerchantTypes(current, selected);
  await persistMerchantTypes(prisma, merchant.id, merged);
  await syncPartnerStoreForJarExchangeMerchant(prisma, merchant, merged);

  revalidatePath('/merchants');
  revalidatePath(`/merchants/${merchant.id}`);
  revalidatePath('/jar-exchange/stores');
  await bustCacheTags(CACHE_TAGS.merchantsPortfolio, CACHE_TAGS.dashboard);
  redirect(`/merchants/${merchant.id}/pos-access`);
}
