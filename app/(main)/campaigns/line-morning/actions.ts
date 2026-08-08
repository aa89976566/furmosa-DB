'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureMorningDraftFixtures } from '@/lib/line/morning/fixtures';
import { updateMorningSettings } from '@/lib/line/morning/settings';
import { MORNING_CONTENT_STATUSES } from '@/lib/line/morning/constants';

const ALLOWED_ROLES = new Set(['admin', 'staff']);

async function requireMorningAdmin() {
  const user = await getCurrentUser();
  if (!user || !ALLOWED_ROLES.has(user.role)) {
    throw new Error('權限不足：需要 admin 或 staff');
  }
  return user;
}

function revalidate() {
  revalidatePath('/campaigns/line-morning');
}

export async function setMorningMasterEnabledAction(formData: FormData) {
  const user = await requireMorningAdmin();
  const enabled = String(formData.get('enabled') ?? '') === '1';
  await updateMorningSettings({
    masterEnabled: enabled,
    updatedBy: user.email,
  });
  revalidate();
}

export async function setMorningDailyQuotaAction(formData: FormData) {
  const user = await requireMorningAdmin();
  const raw = String(formData.get('dailyQuota') ?? '').trim();
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 10000) {
    throw new Error('每日配額請填 0–10000 整數');
  }
  await updateMorningSettings({ dailyQuota: n, updatedBy: user.email });
  revalidate();
}

export async function updateMorningContentStatusAction(formData: FormData) {
  const user = await requireMorningAdmin();
  const id = String(formData.get('contentId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!id) throw new Error('缺少內容 ID');
  if (!(MORNING_CONTENT_STATUSES as readonly string[]).includes(status)) {
    throw new Error('狀態無效');
  }
  await prisma.lineMorningContent.update({
    where: { id },
    data: {
      status,
      reviewedBy: user.email,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });
  revalidate();
}

export async function ensureMorningFixturesAction() {
  await requireMorningAdmin();
  await ensureMorningDraftFixtures();
  revalidate();
}

/** Preview refresh：fixture → normalize → gate → DB；不真送、不打 live 網路 */
export async function refreshMorningNewsPreviewAction() {
  const user = await requireMorningAdmin();
  const { ingestFixtureNewsPreview } = await import('@/lib/line/morning/news/ingest');
  const stats = await ingestFixtureNewsPreview({
    createdBy: user.email,
    persist: true,
  });
  revalidate();
  return stats;
}
