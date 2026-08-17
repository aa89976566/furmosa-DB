/**
 * Fixture／placeholder 新聞（不得偽裝成真新聞）
 * 所有 canonicalUrl 使用 fixtures.morning.local
 */

import type { MorningNewsProvider } from '@/lib/line/morning/news/provider';
import type { RawNewsCandidate } from '@/lib/line/morning/news/safety';

export type FixtureNewsRaw = {
  sourceId: string;
  canonicalUrl: string;
  title: string;
  summary: string;
  publishedAt: string;
  /** 單則區域；不得被 registry 預設蓋掉 */
  region: 'tw' | 'global';
  speciesTags?: string[];
  /** 僅 AUTO_APPROVED 路徑可用；不得含新事實 */
  safeObservation?: string | null;
};

type FixtureNewsTemplate = Omit<FixtureNewsRaw, 'publishedAt'> & {
  /** 若設為固定字串則沿用；否則用呼叫時 now */
  publishedAt?: string;
  stale?: boolean;
};

const FIXTURE_NEWS_TEMPLATES: FixtureNewsTemplate[] = [
  {
    sourceId: 'fixture_placeholder',
    canonicalUrl: 'https://fixtures.morning.local/placeholder/tw-enrichment-001',
    title: '[FIXTURE] 示範園區為水獺更新漂浮玩具',
    summary:
      '這是測試用占位摘要：示範園區替水獺更新漂浮玩具後，觀察到牠們探索與戲水的時間變長，工作人員持續記錄互動情況。非真實新聞。',
    region: 'tw',
    speciesTags: ['general'],
    safeObservation: '玩具一進水，認真程度瞬間像開會。',
  },
  {
    sourceId: 'fixture_placeholder',
    canonicalUrl: 'https://fixtures.morning.local/placeholder/global-dogpark-001',
    title: '[FIXTURE] 示範城市狗公園加設嗅聞步道',
    summary:
      '這是測試用占位摘要：示範城市在狗公園增加嗅聞步道，讓犬隻用鼻子探索環境，減少只圍繞跑道奔跑的單一設計。非真實新聞。',
    region: 'global',
    speciesTags: ['dog'],
    safeObservation: '鼻子行事曆，永遠比人類滿。',
  },
  {
    sourceId: 'fixture_placeholder',
    canonicalUrl: 'https://fixtures.morning.local/placeholder/blocked-disease-001',
    title: '[FIXTURE] 某地傳出寵物疾病疫情',
    summary: '測試用占位：疑似寵物疾病感染案例，用於驗證硬規則阻擋。非真實新聞。',
    region: 'tw',
    speciesTags: ['dog'],
    safeObservation: null,
  },
  {
    sourceId: 'fixture_placeholder',
    canonicalUrl: 'https://fixtures.morning.local/placeholder/blocked-unverified-001',
    title: '[FIXTURE] 五個偏方保證治好毛孩腸胃',
    summary: '測試用占位：未經證實的健康建議，應被阻擋。非真實新聞。',
    region: 'tw',
    safeObservation: null,
  },
  {
    sourceId: 'fixture_placeholder',
    canonicalUrl: 'https://fixtures.morning.local/placeholder/stale-001',
    title: '[FIXTURE] 過期示範新聞',
    summary: '測試用占位：用於驗證 72 小時時效。非真實新聞。',
    publishedAt: '2020-01-01T00:00:00.000Z',
    stale: true,
    region: 'tw',
    safeObservation: null,
  },
];

/** 以 now 產生 fixture（避免 module load 時間與 ingest now 不一致） */
export function buildFixtureNewsRaw(now: Date = new Date()): FixtureNewsRaw[] {
  return FIXTURE_NEWS_TEMPLATES.map((t) => ({
    sourceId: t.sourceId,
    canonicalUrl: t.canonicalUrl,
    title: t.title,
    summary: t.summary,
    region: t.region,
    speciesTags: t.speciesTags,
    safeObservation: t.safeObservation,
    publishedAt: t.stale || t.publishedAt ? (t.publishedAt as string) : now.toISOString(),
  }));
}

/** @deprecated 請優先用 buildFixtureNewsRaw(now)；保留相容讀取 */
export const FIXTURE_NEWS_RAW: FixtureNewsRaw[] = buildFixtureNewsRaw();

/** 相容舊 MorningNewsProvider 介面（轉成 RawNewsCandidate） */
export function buildMockNewsFixtures(now: Date = new Date()): RawNewsCandidate[] {
  return buildFixtureNewsRaw(now).map((f) => ({
    canonicalUrl: f.canonicalUrl,
    sourceName: 'Fixture Placeholder',
    publishedAt: f.publishedAt,
    title: f.title,
    factSummary: f.summary,
    region: f.region,
    barkLine: f.safeObservation ?? null,
    sourceId: f.sourceId,
  }));
}

export const MOCK_NEWS_FIXTURES: RawNewsCandidate[] = buildMockNewsFixtures();

export class MockMorningNewsProvider implements MorningNewsProvider {
  readonly id = 'mock';

  constructor(private readonly fixtures?: RawNewsCandidate[]) {}

  async fetchCandidates(now?: Date): Promise<RawNewsCandidate[]> {
    const list = this.fixtures ?? buildMockNewsFixtures(now ?? new Date());
    return list.map((f) => ({ ...f }));
  }
}

export const defaultMockNewsProvider = new MockMorningNewsProvider();
