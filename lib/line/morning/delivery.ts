import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  MORNING_CAMPAIGN_KEY,
  type MorningDeliveryStatus,
  type MorningSkipReason,
} from '@/lib/line/morning/constants';

export type DeliveryWrite = {
  lineUserId: string;
  taipeiDate: string;
  status: MorningDeliveryStatus;
  skipReason?: MorningSkipReason | string | null;
  contentKind?: 'joke' | 'news' | 'animal_fact' | null;
  contentId?: string | null;
  newsItemId?: string | null;
  animalFactId?: string | null;
  slotMinute: number;
  renderedText?: string | null;
  campaignKey?: string;
};

/**
 * Exactly-once insert。unique 衝突 → 回傳 existing（cron 重跑不重複）。
 */
export async function recordMorningDelivery(input: DeliveryWrite): Promise<{
  created: boolean;
  id: string;
  status: string;
  skipReason: string | null;
}> {
  const campaignKey = input.campaignKey ?? MORNING_CAMPAIGN_KEY;
  try {
    const row = await prisma.lineMorningDelivery.create({
      data: {
        lineUserId: input.lineUserId,
        campaignKey,
        taipeiDate: input.taipeiDate,
        status: input.status,
        skipReason: input.skipReason ?? null,
        contentKind: input.contentKind ?? null,
        contentId: input.contentId ?? null,
        newsItemId: input.newsItemId ?? null,
        animalFactId: input.animalFactId ?? null,
        slotMinute: input.slotMinute,
        renderedText: input.renderedText ?? null,
      },
      select: { id: true, status: true, skipReason: true },
    });
    return {
      created: true,
      id: row.id,
      status: row.status,
      skipReason: row.skipReason,
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await prisma.lineMorningDelivery.findUnique({
        where: {
          lineUserId_campaignKey_taipeiDate: {
            lineUserId: input.lineUserId,
            campaignKey,
            taipeiDate: input.taipeiDate,
          },
        },
        select: { id: true, status: true, skipReason: true },
      });
      if (existing) {
        return {
          created: false,
          id: existing.id,
          status: existing.status,
          skipReason: existing.skipReason,
        };
      }
    }
    throw e;
  }
}

export async function listRecentDeliveries(opts?: {
  take?: number;
  taipeiDate?: string;
}) {
  return prisma.lineMorningDelivery.findMany({
    where: {
      campaignKey: MORNING_CAMPAIGN_KEY,
      ...(opts?.taipeiDate ? { taipeiDate: opts.taipeiDate } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.take ?? 50,
    include: {
      content: { select: { stableId: true, status: true } },
      newsItem: { select: { title: true, status: true, sourceName: true } },
    },
  });
}
