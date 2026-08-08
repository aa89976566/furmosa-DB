'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ensureMorningAnimalFactFixtures,
  ensureMorningDraftFixtures,
} from '@/lib/line/morning/fixtures';
import { updateMorningSettings } from '@/lib/line/morning/settings';
import {
  MORNING_CONTENT_MODES,
  MORNING_CONTENT_STATUSES,
  MORNING_FREQUENCIES,
  type MorningContentMode,
  type MorningFrequency,
} from '@/lib/line/morning/constants';
import {
  runMorningDryRunPreview,
  type MorningDryRunPreviewResult,
} from '@/lib/line/morning/dry-run-preview';

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

export type { MorningDryRunPreviewResult };

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
  const result = await ensureMorningDraftFixtures();
  // 缺 bird／任一 stableId 時 ensureMorningDraftFixtures 會 throw
  if (!result.speciesPresent.includes('bird') || result.present.length < 4) {
    throw new Error(
      `草稿範例不完整：present=${result.present.join(',')} species=${result.speciesPresent.join(',')}`,
    );
  }
  revalidate();
}

/** Preview refresh：fixture → normalize → gate → DB；不真送、不打 live 網路 */
export async function refreshMorningNewsPreviewAction(_formData?: FormData) {
  void _formData;
  const user = await requireMorningAdmin();
  const { ingestFixtureNewsPreview } = await import('@/lib/line/morning/news/ingest');
  await ingestFixtureNewsPreview({
    createdBy: user.email,
    persist: true,
  });
  revalidate();
}

/** 載入 ANIMAL_FACT Preview fixtures；可選核准新建列供 dry-run */
export async function ensureMorningAnimalFactFixturesAction(formData: FormData) {
  await requireMorningAdmin();
  const approve = String(formData.get('approveNew') ?? '') === '1';
  await ensureMorningAnimalFactFixtures({ approveNewForPreview: approve });
  revalidate();
}

/**
 * 單筆 Preview dry-run。
 * - 禁止批次改正式會員 consent
 * - 非 U_TEST_* 只做記憶體覆寫、不寫 preference
 * - LINE push call count 必須為 0
 */
export async function runMorningDryRunPreviewAction(
  formData: FormData,
): Promise<MorningDryRunPreviewResult> {
  await requireMorningAdmin();
  const lineUserId = String(formData.get('lineUserId') ?? '').trim();
  const contentMode = String(formData.get('contentMode') ?? '').trim();
  const frequency = String(formData.get('frequency') ?? 'daily').trim();
  const taipeiDate = String(formData.get('taipeiDate') ?? '').trim();
  const confirmTestPreview = String(formData.get('confirmTestPreview') ?? '') === '1';

  if (!(MORNING_CONTENT_MODES as readonly string[]).includes(contentMode)) {
    throw new Error('contentMode 無效');
  }
  if (!(MORNING_FREQUENCIES as readonly string[]).includes(frequency)) {
    throw new Error('frequency 無效');
  }

  const result = await runMorningDryRunPreview({
    lineUserId,
    contentMode: contentMode as MorningContentMode,
    frequency: frequency as MorningFrequency,
    taipeiDate,
    confirmTestPreview,
  });
  revalidate();
  return result;
}
