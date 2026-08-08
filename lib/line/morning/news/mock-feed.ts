/**
 * MVP mock feed／fixtures（不可預設核准危險內容；安全閘門仍會跑）
 */

import type { RawNewsCandidate } from '@/lib/line/morning/news/safety';
import type { MorningNewsProvider } from '@/lib/line/morning/news/provider';

export const MOCK_NEWS_FIXTURES: RawNewsCandidate[] = [
  {
    canonicalUrl: 'https://zoo.taipei.gov.tw/news/mock-otter-enrichment-2026',
    sourceName: '臺北市立動物園',
    publishedAt: '2026-08-05T02:00:00.000Z',
    region: 'tw',
    title: '動物園為水獺增加漂浮玩具',
    factSummary: '臺北市立動物園宣布為亞洲小爪水獺更新戲水玩具，觀察到牠們探索時間變長。',
    barkLine: '玩具一丟下水，認真程度瞬間像開會。',
  },
  {
    canonicalUrl: 'https://www.bbc.com/news/mock-dog-park-design-2026',
    sourceName: 'BBC News',
    publishedAt: '2026-08-04T10:00:00.000Z',
    region: 'global',
    title: '城市狗公園開始加設嗅聞步道',
    factSummary: '多個城市在狗公園增設嗅聞步道，讓犬隻用鼻子探索環境，減少只圍著跑步的設計。',
    barkLine: '鼻子行事曆永遠比人類滿。',
  },
  {
    canonicalUrl: 'https://www.reuters.com/mock-pet-disease-outbreak',
    sourceName: 'Reuters',
    publishedAt: '2026-08-03T08:00:00.000Z',
    region: 'global',
    title: '某地傳出寵物疾病疫情',
    factSummary: '外電報導出現疑似寵物疾病感染案例，衛生單位持續調查。',
    barkLine: null,
  },
  {
    canonicalUrl: 'https://unknown-blog.example/pet-tips',
    sourceName: 'Random Blog',
    publishedAt: '2026-08-02T08:00:00.000Z',
    region: 'global',
    title: '五個偏方保證治好毛孩腸胃',
    factSummary: '網傳未經證實的健康建議。',
    barkLine: null,
  },
];

export class MockMorningNewsProvider implements MorningNewsProvider {
  readonly id = 'mock';

  constructor(private readonly fixtures: RawNewsCandidate[] = MOCK_NEWS_FIXTURES) {}

  async fetchCandidates(): Promise<RawNewsCandidate[]> {
    return this.fixtures.map((f) => ({ ...f }));
  }
}

export const defaultMockNewsProvider = new MockMorningNewsProvider();
