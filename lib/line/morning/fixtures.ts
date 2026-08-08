/**
 * DRAFT 範例 fixtures（不可預設核准；不覆寫既有資料）
 * 使用 upsert by stableId，僅在不存在時建立；已存在不改 status。
 */

import { prisma } from '@/lib/prisma';

/** DRAFT 笑話：至少 dog／cat／rabbit／bird；成熟台灣語境，不預設核准 */
export const MORNING_JOKE_DRAFT_FIXTURES = [
  {
    stableId: 'morning-joke-draft-001',
    body: '早餐時牠盯著吐司，像在審核我的人生選擇。結果審核沒過，改咬鞋帶。',
    petTags: ['dog', 'general'],
  },
  {
    stableId: 'morning-joke-draft-002',
    body: '貓從沙發跳下來，落地無聲。我打噴嚏，全屋震動。誰才是大型犬？',
    petTags: ['cat', 'general'],
  },
  {
    stableId: 'morning-joke-draft-003',
    body: '兔子忽然彈射起步，三秒後優雅坐下，像剛開完秘密會議。',
    petTags: ['rabbit', 'general'],
  },
  {
    stableId: 'morning-joke-draft-004',
    body: '鳥在鏡子前整理羽毛，每根都像要見重要客戶。我還穿著睡衣，突然有點心虛。',
    petTags: ['bird', 'general'],
  },
] as const;

/** 只新增 DRAFT；既有列（含已核准）不覆寫 */
export async function ensureMorningDraftFixtures(): Promise<{
  created: string[];
  skipped: string[];
}> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const f of MORNING_JOKE_DRAFT_FIXTURES) {
    const existing = await prisma.lineMorningContent.findUnique({
      where: { stableId: f.stableId },
      select: { id: true },
    });
    if (existing) {
      skipped.push(f.stableId);
      continue;
    }
    await prisma.lineMorningContent.create({
      data: {
        stableId: f.stableId,
        kind: 'joke',
        status: 'DRAFT',
        body: f.body,
        petTags: JSON.stringify(f.petTags),
        cooldownDays: 14,
      },
    });
    created.push(f.stableId);
  }

  await prisma.lineMorningSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', masterEnabled: false, dailyQuota: 100 },
    update: {},
  });

  return { created, skipped };
}
