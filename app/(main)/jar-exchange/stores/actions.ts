'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { canWritePreviewIdentityData } from '@/lib/jar-exchange/partner-store-identity-isolation';
import {
  ensurePreviewIdentityTable,
  seedPreviewIdentityDecisions,
} from '@/lib/jar-exchange/partner-store-identity-preview';

function revalidateStores() {
  revalidatePath('/jar-exchange/stores');
}

export async function createPreviewAcceptanceIdentityData() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: '請先登入總部帳號' };
  if (!canWritePreviewIdentityData()) {
    return {
      ok: false as const,
      error: '資料庫未與正式環境隔離，拒絕建立驗收資料',
    };
  }
  await ensurePreviewIdentityTable();
  const inserted = await seedPreviewIdentityDecisions({
    userId: user.userId,
    email: user.email,
  });
  revalidateStores();
  return { ok: true as const, inserted };
}
