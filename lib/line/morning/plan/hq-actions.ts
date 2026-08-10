'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { runDailyMorningPlan } from '@/lib/line/morning/plan/daily-runner';

const ALLOWED_ROLES = new Set(['admin', 'staff']);

async function requireHqMorningAdmin() {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ROLES.has(user.role)) {
    throw new Error('無權限');
  }
  return user;
}

/** HQ only：產生今日 plan ledger（結構零發送；不真送 LINE） */
export async function generateMorningPlanPreviewAction() {
  await requireHqMorningAdmin();
  await runDailyMorningPlan({ limit: 100 });
  revalidatePath('/campaigns/line-morning');
}
