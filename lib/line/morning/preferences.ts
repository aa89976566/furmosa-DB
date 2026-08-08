import { prisma } from '@/lib/prisma';
import {
  MORNING_CONTENT_MODES,
  MORNING_FREQUENCIES,
  type MorningContentMode,
  type MorningFrequency,
} from '@/lib/line/morning/constants';

export type MorningPreferenceRow = {
  id: string;
  lineUserId: string;
  customerId: string | null;
  contentMode: MorningContentMode;
  frequency: MorningFrequency;
  pausedAt: Date | null;
  promptedAt: Date | null;
};

function asMode(v: string): MorningContentMode {
  return (MORNING_CONTENT_MODES as readonly string[]).includes(v)
    ? (v as MorningContentMode)
    : 'unset';
}

function asFreq(v: string): MorningFrequency {
  return (MORNING_FREQUENCIES as readonly string[]).includes(v)
    ? (v as MorningFrequency)
    : 'unset';
}

function mapRow(row: {
  id: string;
  lineUserId: string;
  customerId: string | null;
  contentMode: string;
  frequency: string;
  pausedAt: Date | null;
  promptedAt: Date | null;
}): MorningPreferenceRow {
  return {
    id: row.id,
    lineUserId: row.lineUserId,
    customerId: row.customerId,
    contentMode: asMode(row.contentMode),
    frequency: asFreq(row.frequency),
    pausedAt: row.pausedAt,
    promptedAt: row.promptedAt,
  };
}

export async function getMorningPreference(
  lineUserId: string,
): Promise<MorningPreferenceRow | null> {
  const row = await prisma.lineMorningPreference.findUnique({ where: { lineUserId } });
  return row ? mapRow(row) : null;
}

export async function upsertMorningPreference(
  lineUserId: string,
  data: {
    customerId?: string | null;
    contentMode?: MorningContentMode;
    frequency?: MorningFrequency;
    pausedAt?: Date | null;
    promptedAt?: Date | null;
  },
): Promise<MorningPreferenceRow> {
  const row = await prisma.lineMorningPreference.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      customerId: data.customerId ?? null,
      contentMode: data.contentMode ?? 'unset',
      frequency: data.frequency ?? 'unset',
      pausedAt: data.pausedAt ?? null,
      promptedAt: data.promptedAt ?? null,
    },
    update: {
      ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
      ...(data.contentMode !== undefined ? { contentMode: data.contentMode } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.pausedAt !== undefined ? { pausedAt: data.pausedAt } : {}),
      ...(data.promptedAt !== undefined ? { promptedAt: data.promptedAt } : {}),
    },
  });
  return mapRow(row);
}

export function isPreferenceComplete(pref: MorningPreferenceRow | null): boolean {
  if (!pref) return false;
  return pref.contentMode !== 'unset' && pref.frequency !== 'unset';
}

export function isActivelySubscribed(pref: MorningPreferenceRow | null): boolean {
  if (!pref) return false;
  if (pref.pausedAt) return false;
  if (pref.contentMode === 'off' || pref.contentMode === 'unset') return false;
  if (pref.frequency === 'off' || pref.frequency === 'unset') return false;
  return true;
}

/** 是否該補問偏好（已註冊、未完成、且距上次提示超過 7 天） */
export function shouldPromptPreference(
  pref: MorningPreferenceRow | null,
  now: Date = new Date(),
): boolean {
  if (isPreferenceComplete(pref)) return false;
  if (!pref?.promptedAt) return true;
  return now.getTime() - pref.promptedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
}
