'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { outreachAdmin } from '@/lib/outreach/admin';
import { outreachStore, runOutreach } from '@/lib/outreach/service';

export async function approveContact(form: FormData) {
  const user = await outreachAdmin();
  if (!user) throw new Error('管理員權限不足');
  const value = (key: string) => String(form.get(key) || '').trim();
  try {
    if (value('verified') !== 'on') throw new Error('SOURCE_REQUIRED');
    await outreachStore.approve({brand: value('brand'), domain: value('domain'), email: value('email'),
      sourceUrl: value('sourceUrl'), product: value('product'), reason: value('reason'),
      subject: value('subject'), body: value('body'), sourceVerified: true, decision: 'DO'}, user.id);
  } catch { redirect('/outreach?notice=invalid'); }
  revalidatePath('/outreach');
  redirect('/outreach?notice=saved');
}

export async function stopContact(form: FormData) {
  if (!await outreachAdmin()) throw new Error('管理員權限不足');
  const id = String(form.get('id') || '');
  if (!/^[a-z0-9]{1,40}$/.test(id)) throw new Error('無效紀錄');
  await outreachStore.optOut(id);
  revalidatePath('/outreach');
}

export async function checkOutreach() {
  if (!await outreachAdmin()) throw new Error('管理員權限不足');
  try { await runOutreach(true); }
  catch { redirect('/outreach?notice=check-failed'); }
  redirect('/outreach?notice=checked');
}
