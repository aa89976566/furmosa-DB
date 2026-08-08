/**
 * 新聞來源白名單（MVP：靜態設定；不串即時抓取）
 * 優先：台灣官方 → 可信國際媒體 → 官方獸醫／研究機構
 */

export type NewsSourceTier = 'tw_official' | 'intl_media' | 'vet_research';

export type WhitelistedSource = {
  id: string;
  name: string;
  tier: NewsSourceTier;
  /** 允許的 hostname（不含 www） */
  hostnames: string[];
  regionDefault: 'tw' | 'global';
};

export const NEWS_SOURCE_WHITELIST: WhitelistedSource[] = [
  {
    id: 'coa_tw',
    name: '農業部',
    tier: 'tw_official',
    hostnames: ['moa.gov.tw', 'coa.gov.tw'],
    regionDefault: 'tw',
  },
  {
    id: 'cdc_tw',
    name: '疾管署',
    tier: 'tw_official',
    hostnames: ['cdc.gov.tw'],
    regionDefault: 'tw',
  },
  {
    id: 'taipei_zoo',
    name: '臺北市立動物園',
    tier: 'tw_official',
    hostnames: ['zoo.taipei.gov.tw'],
    regionDefault: 'tw',
  },
  {
    id: 'bbc_news',
    name: 'BBC News',
    tier: 'intl_media',
    hostnames: ['bbc.com', 'bbc.co.uk'],
    regionDefault: 'global',
  },
  {
    id: 'reuters',
    name: 'Reuters',
    tier: 'intl_media',
    hostnames: ['reuters.com'],
    regionDefault: 'global',
  },
  {
    id: 'ap_news',
    name: 'Associated Press',
    tier: 'intl_media',
    hostnames: ['apnews.com'],
    regionDefault: 'global',
  },
  {
    id: 'avma',
    name: 'AVMA',
    tier: 'vet_research',
    hostnames: ['avma.org'],
    regionDefault: 'global',
  },
  {
    id: 'woah',
    name: 'WOAH',
    tier: 'vet_research',
    hostnames: ['woah.org'],
    regionDefault: 'global',
  },
];

export function normalizeHostname(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function findWhitelistedSource(canonicalUrl: string): WhitelistedSource | null {
  const host = normalizeHostname(canonicalUrl);
  if (!host) return null;
  return (
    NEWS_SOURCE_WHITELIST.find((s) =>
      s.hostnames.some((h) => host === h || host.endsWith(`.${h}`)),
    ) ?? null
  );
}
