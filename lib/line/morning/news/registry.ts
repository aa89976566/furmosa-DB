/**
 * 來源 registry（已查證紀錄）。
 * 未取得商業授權 → enabled=false，禁止實際網路存取。
 * 查驗日期：2026-08-08
 */

export type SourceCountryPriority = 'TW' | 'GLOBAL';

export type SourceUsagePolicy =
  | 'non_commercial_only'
  | 'rss_reader_personal_only'
  | 'ogdl_commercial_ok_but_out_of_scope'
  | 'unknown_or_unclear'
  | 'no_official_feed_found';

export type MorningSourceRegistryEntry = {
  sourceId: string;
  sourceName: string;
  countryPriority: SourceCountryPriority;
  allowedHosts: string[];
  /** exact path 或 prefix；live 關閉時僅作文件／測試 allowlist */
  feedPathAllowlist: string[];
  officialDocUrl: string;
  usagePolicy: SourceUsagePolicy;
  usageNote: string;
  verifiedAt: string; // YYYY-MM-DD
  /** 商業授權未取得一律 false */
  enabled: boolean;
  regionDefault: 'tw' | 'global';
  trustTier: 'tw_official' | 'global_official' | 'research' | 'media';
};

export const MORNING_SOURCE_REGISTRY: MorningSourceRegistryEntry[] = [
  {
    sourceId: 'moa_tw_rss',
    sourceName: '農業部',
    countryPriority: 'TW',
    allowedHosts: ['moa.gov.tw', 'www.moa.gov.tw', 'eng.moa.gov.tw'],
    feedPathAllowlist: ['/open_data.php'],
    officialDocUrl: 'https://www.moa.gov.tw/ws.php?id=9817',
    usagePolicy: 'non_commercial_only',
    usageNote:
      '官方 RSS 頁版權宣告限非商業用途免費使用；Furmosa 為商業用途，enabled=false。',
    verifiedAt: '2026-08-08',
    enabled: false,
    regionDefault: 'tw',
    trustTier: 'tw_official',
  },
  {
    sourceId: 'avma_rss',
    sourceName: 'AVMA',
    countryPriority: 'GLOBAL',
    allowedHosts: ['avma.org', 'www.avma.org'],
    feedPathAllowlist: ['/news'],
    officialDocUrl: 'https://www.avma.org/news/rss-feeds',
    usagePolicy: 'rss_reader_personal_only',
    usageNote:
      'Terms 限 noncommercial personal use；RSS 僅允許 via RSS reader 訂閱，不得商業再分發。',
    verifiedAt: '2026-08-08',
    enabled: false,
    regionDefault: 'global',
    trustTier: 'research',
  },
  {
    sourceId: 'woah_wahis',
    sourceName: 'WOAH',
    countryPriority: 'GLOBAL',
    allowedHosts: ['woah.org', 'www.woah.org', 'wahis.woah.org'],
    feedPathAllowlist: [],
    officialDocUrl:
      'https://www.woah.org/en/what-we-do/animal-health-and-welfare/disease-data-collection/',
    usagePolicy: 'unknown_or_unclear',
    usageNote: '疾病通報為主（晨報硬規則會擋）；無清楚商用新聞 RSS 一手授權。',
    verifiedAt: '2026-08-08',
    enabled: false,
    regionDefault: 'global',
    trustTier: 'global_official',
  },
  {
    sourceId: 'taipei_zoo',
    sourceName: '臺北市立動物園',
    countryPriority: 'TW',
    allowedHosts: ['zoo.taipei.gov.tw'],
    feedPathAllowlist: [],
    officialDocUrl: 'https://www.zoo.taipei.gov.tw/',
    usagePolicy: 'no_official_feed_found',
    usageNote: '查無官方 RSS/Atom/API 一手文件；禁止 HTML scraping。',
    verifiedAt: '2026-08-08',
    enabled: false,
    regionDefault: 'tw',
    trustTier: 'tw_official',
  },
  {
    sourceId: 'fixture_placeholder',
    sourceName: 'Fixture Placeholder',
    countryPriority: 'TW',
    allowedHosts: ['fixtures.morning.local'],
    feedPathAllowlist: ['/placeholder/'],
    officialDocUrl: 'docs/LINE-MORNING-SOURCES.md',
    usagePolicy: 'unknown_or_unclear',
    usageNote: '僅供 fixture／單元測試；永不對真實網路發請求。',
    verifiedAt: '2026-08-08',
    enabled: false,
    regionDefault: 'tw',
    trustTier: 'tw_official',
  },
];

export function getSourceById(sourceId: string): MorningSourceRegistryEntry | null {
  return MORNING_SOURCE_REGISTRY.find((s) => s.sourceId === sourceId) ?? null;
}

export function findSourceByHost(hostname: string): MorningSourceRegistryEntry | null {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  return (
    MORNING_SOURCE_REGISTRY.find((s) =>
      s.allowedHosts.some((h) => {
        const nh = h.replace(/^www\./, '').toLowerCase();
        return host === nh || host.endsWith(`.${nh}`);
      }),
    ) ?? null
  );
}

/** live 網路存取閘：一律要求 enabled=true（本階段全 false） */
export function assertSourceEnabledForLive(sourceId: string): void {
  const src = getSourceById(sourceId);
  if (!src?.enabled) {
    throw new Error(`source_disabled:${sourceId}`);
  }
}

export function listEnabledLiveSources(): MorningSourceRegistryEntry[] {
  return MORNING_SOURCE_REGISTRY.filter((s) => s.enabled);
}
