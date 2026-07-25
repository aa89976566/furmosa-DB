import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const DASHBOARD_KPI_SNAPSHOT_ID = 'default';
/** 快照視為新鮮的時間（毫秒）— 讀頁直接吃快照 */
export const DASHBOARD_KPI_FRESH_MS = 10 * 60 * 1000;

export type DashboardKpiSnapshotRow = {
  payload: unknown;
  computedAt: Date;
};

export async function readDashboardKpiSnapshot(): Promise<DashboardKpiSnapshotRow | null> {
  try {
    const row = await prisma.dashboardKpiSnapshot.findUnique({
      where: { id: DASHBOARD_KPI_SNAPSHOT_ID },
      select: { payload: true, computedAt: true },
    });
    return row;
  } catch (error) {
    // 遷移尚未套用時不擋讀頁
    console.warn('[dashboard-kpi-snapshot] read failed', error);
    return null;
  }
}

export function isDashboardKpiFresh(computedAt: Date, now = Date.now()): boolean {
  return now - computedAt.getTime() < DASHBOARD_KPI_FRESH_MS;
}

export async function writeDashboardKpiSnapshot(payload: unknown): Promise<void> {
  const computedAt = new Date();
  const json = payload as Prisma.InputJsonValue;
  try {
    await prisma.dashboardKpiSnapshot.upsert({
      where: { id: DASHBOARD_KPI_SNAPSHOT_ID },
      create: {
        id: DASHBOARD_KPI_SNAPSHOT_ID,
        payload: json,
        computedAt,
      },
      update: {
        payload: json,
        computedAt,
      },
    });
  } catch (error) {
    console.warn('[dashboard-kpi-snapshot] write failed', error);
  }
}
