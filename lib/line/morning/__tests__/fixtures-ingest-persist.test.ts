import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';

import {
  ensureMorningDraftFixtures,
  MORNING_JOKE_DRAFT_FIXTURES,
  REQUIRED_DRAFT_SPECIES,
  type MorningContentFixtureDb,
} from '../fixtures';
import {
  buildNewsCorrectableUpdate,
  ingestFixtureNewsPreview,
  persistNormalizedNewsItem,
  type MorningNewsPersistDb,
  type MorningNewsPersistRow,
} from '../news/ingest';
import { gateNormalizedNews } from '../news/gate';
import { normalizeNewsCandidate } from '../news/normalize';
import { FIXTURE_NEWS_RAW } from '../news/mock-feed';

function createMemoryContentDb(): MorningContentFixtureDb & {
  rows: Map<string, { id: string; stableId: string; status: string; petTags: string; body: string }>;
} {
  const rows = new Map<
    string,
    { id: string; stableId: string; status: string; petTags: string; body: string }
  >();
  return {
    rows,
    lineMorningContent: {
      async findUnique({ where }) {
        const r = rows.get(where.stableId);
        return r ? { id: r.id } : null;
      },
      async create({ data }) {
        if (rows.has(data.stableId)) {
          throw new Error(`unique_violation:${data.stableId}`);
        }
        const row = {
          id: `id-${data.stableId}`,
          stableId: data.stableId,
          status: data.status,
          petTags: data.petTags,
          body: data.body,
        };
        rows.set(data.stableId, row);
        return { id: row.id, stableId: row.stableId };
      },
      async findMany({ where }) {
        return where.stableId.in
          .map((id) => rows.get(id))
          .filter((r): r is NonNullable<typeof r> => !!r)
          .map((r) => ({
            stableId: r.stableId,
            status: r.status,
            petTags: r.petTags,
          }));
      },
    },
    lineMorningSettings: {
      async upsert() {
        return {};
      },
    },
  };
}

function createMemoryNewsDb(): MorningNewsPersistDb & {
  rows: MorningNewsPersistRow[];
  ingestRuns: number;
} {
  const rows: MorningNewsPersistRow[] = [];
  let ingestRuns = 0;
  const db: MorningNewsPersistDb & {
    rows: MorningNewsPersistRow[];
    ingestRuns: number;
  } = {
    rows,
    get ingestRuns() {
      return ingestRuns;
    },
    lineMorningNewsItem: {
      async findFirst({ where }) {
        for (const clause of where.OR) {
          if ('contentHash' in clause) {
            const hit = rows.find((r) => r.contentHash === clause.contentHash);
            if (hit) return { ...hit };
          }
          if ('fingerprint' in clause) {
            const hit = rows.find((r) => r.fingerprint === clause.fingerprint);
            if (hit) return { ...hit };
          }
          if ('canonicalUrl' in clause) {
            const hit = rows.find((r) => r.canonicalUrl === clause.canonicalUrl);
            if (hit) return { ...hit };
          }
        }
        return null;
      },
      async update({ where, data }) {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('not_found');
        const cur = rows[idx]!;
        const next: MorningNewsPersistRow = {
          ...cur,
          region: String(data.region ?? cur.region),
          status: String(data.status ?? cur.status),
          sourceId:
            data.sourceId === undefined ? cur.sourceId : (data.sourceId as string | null),
          sourceName: String(data.sourceName ?? cur.sourceName),
          contentHash:
            data.contentHash === undefined
              ? cur.contentHash
              : (data.contentHash as string | null),
          title: cur.title, // audit-safe：update path 不改 title
          fingerprint: cur.fingerprint,
        };
        rows[idx] = next;
        return { ...next };
      },
      async create({ data }) {
        const row: MorningNewsPersistRow = {
          id: `news-${rows.length + 1}`,
          fingerprint: String(data.fingerprint),
          contentHash: (data.contentHash as string | null) ?? null,
          canonicalUrl: String(data.canonicalUrl),
          title: String(data.title),
          region: String(data.region),
          status: String(data.status),
          sourceId: (data.sourceId as string | null) ?? null,
          sourceName: String(data.sourceName),
        };
        rows.push(row);
        return { ...row };
      },
    },
    lineMorningIngestRun: {
      async create() {
        ingestRuns += 1;
        return {};
      },
    },
  };
  return db;
}

describe('ensureMorningDraftFixtures action/integration（記憶體 store）', () => {
  it('首次載入建立 4 筆含 bird；重跑不重複且物種齊全', async () => {
    const db = createMemoryContentDb();
    const first = await ensureMorningDraftFixtures(db);
    assert.equal(first.created.length, 4);
    assert.equal(first.skipped.length, 0);
    assert.equal(db.rows.size, 4);
    assert.ok(db.rows.has('morning-joke-draft-004'));
    assert.match(db.rows.get('morning-joke-draft-004')!.petTags, /bird/);
    assert.deepEqual(first.speciesPresent, [...REQUIRED_DRAFT_SPECIES].sort());

    const second = await ensureMorningDraftFixtures(db);
    assert.equal(second.created.length, 0);
    assert.equal(second.skipped.length, 4);
    assert.equal(db.rows.size, 4);

    // 已核准的列不被覆寫
    const dog = db.rows.get('morning-joke-draft-001')!;
    dog.status = 'APPROVED';
    dog.body = '已被人工改過';
    await ensureMorningDraftFixtures(db);
    assert.equal(db.rows.get('morning-joke-draft-001')!.status, 'APPROVED');
    assert.equal(db.rows.get('morning-joke-draft-001')!.body, '已被人工改過');
  });

  it('缺 bird 時會 throw（避免靜默只剩 3 筆）', async () => {
    const db = createMemoryContentDb();
    // 預先塞入前三筆，並讓 create 對 004 失敗
    for (const f of MORNING_JOKE_DRAFT_FIXTURES.slice(0, 3)) {
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
    }
    const origCreate = db.lineMorningContent.create.bind(db.lineMorningContent);
    db.lineMorningContent.create = async (args) => {
      if (args.data.stableId === 'morning-joke-draft-004') {
        throw new Error('simulated_create_fail');
      }
      return origCreate(args);
    };
    await assert.rejects(() => ensureMorningDraftFixtures(db), /simulated_create_fail|missing/);
  });
});

describe('ingest region correction upsert', () => {
  it('seed 錯誤 tw 後重跑 global fixture：仍 1 row 且 region=global', async () => {
    const db = createMemoryNewsDb();
    const raw = FIXTURE_NEWS_RAW.find((f) =>
      f.canonicalUrl.includes('global-dogpark-001'),
    )!;
    const now = new Date('2026-08-08T08:00:00.000Z');
    const normalized = normalizeNewsCandidate({
      sourceId: raw.sourceId,
      canonicalUrl: raw.canonicalUrl,
      originalTitle: raw.title,
      originalSummary: raw.summary,
      publishedAt: now.toISOString(),
      region: 'global',
      now,
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    // seed：同 canonical／hash，但 region 錯成 tw
    const wrongHash = normalized.value.contentHash;
    db.rows.push({
      id: 'seed-1',
      fingerprint: wrongHash,
      contentHash: wrongHash,
      canonicalUrl: normalized.value.canonicalUrl,
      title: normalized.value.originalTitle,
      region: 'tw',
      status: 'AUTO_APPROVED',
      sourceId: 'fixture_placeholder',
      sourceName: 'Fixture Placeholder',
    });

    const gate = gateNormalizedNews(normalized.value);
    assert.equal(gate.region, 'global');

    const result = await persistNormalizedNewsItem(db, {
      normalized: normalized.value,
      gate,
      observation: raw.safeObservation ?? null,
    });
    assert.equal(result.outcome, 'updated');
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0]!.region, 'global');
    assert.equal(db.rows[0]!.title, normalized.value.originalTitle);
    assert.equal(db.rows[0]!.contentHash, wrongHash);
  });

  it('僅有 canonicalUrl 對得上（舊列 contentHash 不同／null）仍校正 region', async () => {
    const db = createMemoryNewsDb();
    const url = 'https://fixtures.morning.local/placeholder/global-dogpark-001';
    db.rows.push({
      id: 'legacy-1',
      fingerprint: 'legacy-fingerprint-not-sha',
      contentHash: null,
      canonicalUrl: url,
      title: '[FIXTURE] 示範城市狗公園加設嗅聞步道',
      region: 'tw',
      status: 'AUTO_APPROVED',
      sourceId: null,
      sourceName: 'old',
    });

    const now = new Date('2026-08-08T08:00:00.000Z');
    const normalized = normalizeNewsCandidate({
      sourceId: 'fixture_placeholder',
      canonicalUrl: url,
      originalTitle: '[FIXTURE] 示範城市狗公園加設嗅聞步道',
      originalSummary:
        '這是測試用占位摘要：示範城市在狗公園增加嗅聞步道，讓犬隻用鼻子探索環境，減少只圍繞跑道奔跑的單一設計。非真實新聞。',
      publishedAt: now.toISOString(),
      region: 'global',
      now,
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;
    const gate = gateNormalizedNews(normalized.value);
    const result = await persistNormalizedNewsItem(db, {
      normalized: normalized.value,
      gate,
      observation: '鼻子行事曆，永遠比人類滿。',
    });
    assert.equal(result.outcome, 'updated');
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0]!.region, 'global');
    assert.equal(db.rows[0]!.fingerprint, 'legacy-fingerprint-not-sha');
    assert.equal(db.rows[0]!.contentHash, normalized.value.contentHash); // null → 回填
    assert.equal(db.rows[0]!.title, '[FIXTURE] 示範城市狗公園加設嗅聞步道');
  });

  it('buildNewsCorrectableUpdate 不覆寫既有 contentHash／由呼叫端保留 title', () => {
    const existing: MorningNewsPersistRow = {
      id: '1',
      fingerprint: 'fp',
      contentHash: 'abc',
      canonicalUrl: 'https://fixtures.morning.local/placeholder/global-dogpark-001',
      title: 'KEEP_TITLE',
      region: 'tw',
      status: 'AUTO_APPROVED',
      sourceId: 'fixture_placeholder',
      sourceName: 'Fixture Placeholder',
    };
    const normalized = {
      sourceId: 'fixture_placeholder',
      sourceName: 'Fixture Placeholder',
      canonicalUrl: existing.canonicalUrl,
      originalTitle: 'NEW_TITLE_SHOULD_NOT_APPLY_HERE',
      originalSummary: '摘要',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      region: 'global' as const,
      speciesTags: ['dog'],
      contentHash: createHash('sha256').update('x').digest('hex'),
    };
    const gate = {
      status: 'AUTO_APPROVED' as const,
      riskLevel: 'low' as const,
      riskLabels: ['ok'],
      confidence: 80,
      reasons: ['ok'],
      region: 'global' as const,
    };
    const data = buildNewsCorrectableUpdate({
      existing,
      normalized,
      gate,
      observation: null,
    });
    assert.equal(data.region, 'global');
    assert.equal(data.contentHash, undefined);
    assert.equal(data.title, undefined);
    assert.equal(data.fingerprint, undefined);
  });

  it('完整 ingestFixtureNewsPreview：seed 錯 tw → 重跑仍 1 row 且 global', async () => {
    const db = createMemoryNewsDb();
    const now = new Date('2026-08-08T08:00:00.000Z');
    const dogpark = {
      ...FIXTURE_NEWS_RAW.find((f) => f.canonicalUrl.includes('global-dogpark-001'))!,
      publishedAt: now.toISOString(),
    };
    const n = normalizeNewsCandidate({
      sourceId: dogpark.sourceId,
      canonicalUrl: dogpark.canonicalUrl,
      originalTitle: dogpark.title,
      originalSummary: dogpark.summary,
      publishedAt: dogpark.publishedAt,
      region: 'global',
      now,
    });
    assert.ok(n.ok);
    if (!n.ok) return;
    db.rows.push({
      id: 'x',
      fingerprint: n.value.contentHash,
      contentHash: n.value.contentHash,
      canonicalUrl: n.value.canonicalUrl,
      title: n.value.originalTitle,
      region: 'tw',
      status: 'AUTO_APPROVED',
      sourceId: 'fixture_placeholder',
      sourceName: 'Fixture Placeholder',
    });

    const stats = await ingestFixtureNewsPreview({
      fixtures: [dogpark],
      now,
      persist: true,
      db,
      settings: { masterEnabled: false, dailyQuota: 100 },
    });
    assert.equal(stats.updatedCount, 1);
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0]!.region, 'global');

    const stats2 = await ingestFixtureNewsPreview({
      fixtures: [dogpark],
      now,
      persist: true,
      db,
      settings: { masterEnabled: false, dailyQuota: 100 },
    });
    assert.equal(stats2.updatedCount, 1);
    assert.equal(db.rows.length, 1);
    assert.equal(db.rows[0]!.region, 'global');
  });
});
