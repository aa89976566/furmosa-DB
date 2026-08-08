/**
 * DRAFT 範例 fixtures（不可預設核准；不覆寫既有 status／body）
 * 以 stableId 為 unique key：不存在才建立；已存在 skip（重跑不重複）。
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

export const REQUIRED_DRAFT_SPECIES = ['dog', 'cat', 'rabbit', 'bird'] as const;

export type MorningContentFixtureDb = {
  lineMorningContent: {
    findUnique: (args: {
      where: { stableId: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: {
        stableId: string;
        kind: string;
        status: string;
        body: string;
        petTags: string;
        cooldownDays: number;
      };
    }) => Promise<{ id: string; stableId: string }>;
    findMany: (args: {
      where: { stableId: { in: string[] } };
      select: { stableId: true; status: true; petTags: true };
    }) => Promise<Array<{ stableId: string; status: string; petTags: string }>>;
  };
  lineMorningSettings: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

export type EnsureDraftFixturesResult = {
  created: string[];
  skipped: string[];
  /** 執行後實際存在的 DRAFT stableId */
  present: string[];
  speciesPresent: string[];
};

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * 只新增 DRAFT；既有列（含已核准）不覆寫 body／status。
 * 結束後驗證 4 物種皆在庫，否則 throw（避免「按了卻缺鳥」靜默失敗）。
 */
export async function ensureMorningDraftFixtures(
  db: MorningContentFixtureDb = prisma as unknown as MorningContentFixtureDb,
): Promise<EnsureDraftFixturesResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const f of MORNING_JOKE_DRAFT_FIXTURES) {
    const existing = await db.lineMorningContent.findUnique({
      where: { stableId: f.stableId },
      select: { id: true },
    });
    if (existing) {
      skipped.push(f.stableId);
      continue;
    }
    await db.lineMorningContent.create({
      data: {
        stableId: f.stableId,
        kind: 'joke',
        status: 'DRAFT',
        body: f.body,
        petTags: JSON.stringify([...f.petTags]),
        cooldownDays: 14,
      },
    });
    created.push(f.stableId);
  }

  await db.lineMorningSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', masterEnabled: false, dailyQuota: 100 },
    update: {},
  });

  const expectedIds = MORNING_JOKE_DRAFT_FIXTURES.map((f) => f.stableId);
  const rows = await db.lineMorningContent.findMany({
    where: { stableId: { in: [...expectedIds] } },
    select: { stableId: true, status: true, petTags: true },
  });
  const present = rows.map((r) => r.stableId).sort();
  const missing = expectedIds.filter((id) => !present.includes(id));
  if (missing.length) {
    throw new Error(
      `DRAFT fixtures incomplete after load: missing ${missing.join(', ')}`,
    );
  }

  const speciesPresent = [
    ...new Set(
      rows.flatMap((r) =>
        parseTags(r.petTags).filter((t) =>
          (REQUIRED_DRAFT_SPECIES as readonly string[]).includes(t),
        ),
      ),
    ),
  ].sort();
  for (const need of REQUIRED_DRAFT_SPECIES) {
    if (!speciesPresent.includes(need)) {
      throw new Error(`DRAFT fixtures missing species tag: ${need}`);
    }
  }

  return { created, skipped, present, speciesPresent };
}
