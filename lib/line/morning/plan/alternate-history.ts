/**
 * alternate 推進歷史：只認 SENT morning delivery
 * PLANNED／SKIPPED／DRY_RUN 不推進
 */

import { prisma } from '@/lib/prisma';
import { MORNING_CAMPAIGN_KEY } from '@/lib/line/morning/constants';
import {
  deliveryKindToContentType,
} from '@/lib/line/morning/domain/decision';
import type { MorningContentType } from '@/lib/line/morning/domain/types';

export async function findLastSuccessMorningContentType(
  lineUserId: string,
): Promise<MorningContentType | null> {
  const row = await prisma.lineMorningDelivery.findFirst({
    where: {
      lineUserId,
      campaignKey: MORNING_CAMPAIGN_KEY,
      status: 'SENT',
      contentKind: { in: ['joke', 'news'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { contentKind: true },
  });
  return deliveryKindToContentType(row?.contentKind);
}
