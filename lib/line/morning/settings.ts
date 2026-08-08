import { prisma } from '@/lib/prisma';
import {
  ENV_MORNING_MASTER_ENABLED,
  MORNING_SETTINGS_ID,
} from '@/lib/line/morning/constants';

export type MorningSettings = {
  masterEnabled: boolean;
  dailyQuota: number;
  updatedBy: string | null;
};

/** env 可強制 OFF；只有明確 '1'/'true' 才視為想開（仍受 DB 控制） */
export function envMasterOverride(
  env: NodeJS.ProcessEnv = process.env,
): boolean | null {
  const raw = env[ENV_MORNING_MASTER_ENABLED];
  if (raw === undefined || raw === '') return null;
  if (raw === '0' || raw.toLowerCase() === 'false') return false;
  if (raw === '1' || raw.toLowerCase() === 'true') return true;
  return null;
}

export async function getMorningSettings(): Promise<MorningSettings> {
  const row = await prisma.lineMorningSettings.upsert({
    where: { id: MORNING_SETTINGS_ID },
    create: {
      id: MORNING_SETTINGS_ID,
      masterEnabled: false,
      dailyQuota: 100,
    },
    update: {},
  });
  const envOverride = envMasterOverride();
  return {
    // env=false 強制 OFF；env=true 強制 ON；未設則看 DB（預設 false）
    masterEnabled: envOverride === null ? row.masterEnabled : envOverride,
    dailyQuota: row.dailyQuota,
    updatedBy: row.updatedBy,
  };
}

export async function updateMorningSettings(data: {
  masterEnabled?: boolean;
  dailyQuota?: number;
  updatedBy?: string | null;
}): Promise<MorningSettings> {
  const row = await prisma.lineMorningSettings.upsert({
    where: { id: MORNING_SETTINGS_ID },
    create: {
      id: MORNING_SETTINGS_ID,
      masterEnabled: data.masterEnabled ?? false,
      dailyQuota: data.dailyQuota ?? 100,
      updatedBy: data.updatedBy ?? null,
    },
    update: {
      ...(data.masterEnabled !== undefined ? { masterEnabled: data.masterEnabled } : {}),
      ...(data.dailyQuota !== undefined ? { dailyQuota: data.dailyQuota } : {}),
      ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
    },
  });
  return {
    masterEnabled: row.masterEnabled,
    dailyQuota: row.dailyQuota,
    updatedBy: row.updatedBy,
  };
}

export async function countDeliveriesToday(taipeiDate: string): Promise<number> {
  return prisma.lineMorningDelivery.count({
    where: {
      taipeiDate,
      campaignKey: 'morning',
      status: { in: ['SENT', 'DRY_RUN'] },
    },
  });
}
