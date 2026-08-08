import { prisma } from '@/lib/prisma';
import { fetchLineUserProfile } from '@/lib/line/profile';

/** 避免每個 webhook 都打 LINE；預設 24 小時內已同步則略過 */
const DEFAULT_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type SyncLineProfileOptions = {
  force?: boolean;
  minIntervalMs?: number;
};

/**
 * 背景 upsert：把 Messaging API 個資寫入既有 campaign_applications（及已綁定 Customer.lineDisplay）。
 * 永不拋錯，以免打斷 webhook／報名主流程。不 log 個資內容。
 */
export async function syncLineProfileForUser(
  lineUserId: string,
  opts: SyncLineProfileOptions = {},
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const uid = lineUserId.trim();
  if (!uid) return { ok: false, reason: 'empty_user' };

  try {
    const minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    if (!opts.force) {
      const recent = await prisma.campaignApplication.findFirst({
        where: {
          lineUserId: uid,
          lineProfileSyncedAt: {
            gte: new Date(Date.now() - minIntervalMs),
          },
        },
        select: { id: true },
      });
      if (recent) return { ok: true, skipped: true, reason: 'throttled' };
    }

    const profile = await fetchLineUserProfile(uid);
    if (!profile) return { ok: false, reason: 'fetch_failed' };

    const syncedAt = new Date();
    await prisma.campaignApplication.updateMany({
      where: { lineUserId: uid },
      data: {
        lineDisplayName: profile.displayName,
        linePictureUrl: profile.pictureUrl,
        lineProfileSyncedAt: syncedAt,
      },
    });

    if (profile.displayName) {
      await prisma.customer.updateMany({
        where: { lineUserId: uid },
        data: { lineDisplay: profile.displayName },
      });
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'sync_error' };
  }
}
