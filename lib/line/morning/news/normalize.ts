/**
 * Normalize schema：只保留必要 metadata／短摘要／canonical URL，不存全文。
 */

import { createHash } from 'node:crypto';
import { MORNING_NEWS_MAX_AGE_HOURS } from '@/lib/line/morning/constants';
import { getSourceById } from '@/lib/line/morning/news/registry';
import { stripHtml } from '@/lib/line/morning/news/xml-safe';

export type NormalizedNewsCandidate = {
  sourceId: string;
  sourceName: string;
  canonicalUrl: string;
  originalTitle: string;
  originalSummary: string;
  publishedAt: Date;
  fetchedAt: Date;
  region: 'tw' | 'global';
  speciesTags: string[];
  contentHash: string;
};

export type NormalizeFail = {
  ok: false;
  reason: string;
};

export type NormalizeOk = {
  ok: true;
  value: NormalizedNewsCandidate;
};

function canonicalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach((k) =>
      u.searchParams.delete(k),
    );
    // fixture host 允許 http for tests
    return u.toString();
  } catch {
    return null;
  }
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computeContentHash(parts: {
  canonicalUrl: string;
  originalTitle: string;
  publishedAt: Date;
}): string {
  const day = parts.publishedAt.toISOString().slice(0, 10);
  return sha256Hex(
    `${parts.canonicalUrl}\n${parts.originalTitle.trim().toLowerCase()}\n${day}`,
  );
}

export function parsePublishedAtStrict(
  raw: string | Date | null | undefined,
  now: Date = new Date(),
  maxAgeHours = MORNING_NEWS_MAX_AGE_HOURS,
): { ok: true; date: Date } | { ok: false; reason: string } {
  if (raw == null || raw === '') {
    return { ok: false, reason: 'missing_published_at' };
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, reason: 'invalid_published_at' };
  }
  if (d.getTime() > now.getTime() + 5 * 60 * 1000) {
    return { ok: false, reason: 'future_published_at' };
  }
  const ageMs = now.getTime() - d.getTime();
  if (ageMs > maxAgeHours * 60 * 60 * 1000) {
    return { ok: false, reason: 'stale_published_at' };
  }
  return { ok: true, date: d };
}

/** 自 fixture path 推斷區域（global- / tw-）；明確傳入 region 時優先 */
export function resolveFixtureRegion(
  canonicalUrl: string,
  explicit?: 'tw' | 'global' | null,
  sourceDefault: 'tw' | 'global' = 'tw',
): 'tw' | 'global' {
  if (explicit === 'tw' || explicit === 'global') return explicit;
  try {
    const path = new URL(canonicalUrl).pathname.toLowerCase();
    if (path.includes('/global-') || path.includes('/placeholder/global')) return 'global';
    if (path.includes('/tw-') || path.includes('/placeholder/tw')) return 'tw';
  } catch {
    // ignore
  }
  return sourceDefault;
}

export function normalizeNewsCandidate(input: {
  sourceId: string;
  canonicalUrl: string;
  originalTitle: string;
  originalSummary: string;
  publishedAt: Date | string | null;
  fetchedAt?: Date;
  speciesTags?: string[];
  /** 單則覆蓋（fixture 全球／台灣）；優先於 registry.regionDefault */
  region?: 'tw' | 'global';
  now?: Date;
}): NormalizeOk | NormalizeFail {
  const source = getSourceById(input.sourceId);
  if (!source) {
    return { ok: false, reason: 'unknown_source' };
  }

  const canonicalUrl = canonicalizeUrl(input.canonicalUrl);
  if (!canonicalUrl) {
    return { ok: false, reason: 'invalid_canonical_url' };
  }

  // fixture host 例外；真實來源要求 https
  if (
    !canonicalUrl.startsWith('https://') &&
    !canonicalUrl.startsWith('http://fixtures.morning.local/')
  ) {
    return { ok: false, reason: 'canonical_must_be_https' };
  }

  const title = stripHtml(input.originalTitle);
  const summary = stripHtml(input.originalSummary);
  if (!title || title.length < 2) {
    return { ok: false, reason: 'empty_title' };
  }
  if (summary.length > 500) {
    // 截斷而非存全文
  }

  const pub = parsePublishedAtStrict(input.publishedAt, input.now);
  if (!pub.ok) return pub;

  const fetchedAt = input.fetchedAt ?? input.now ?? new Date();
  const contentHash = computeContentHash({
    canonicalUrl,
    originalTitle: title,
    publishedAt: pub.date,
  });

  const region = resolveFixtureRegion(
    canonicalUrl,
    input.region,
    source.regionDefault,
  );

  return {
    ok: true,
    value: {
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      canonicalUrl,
      originalTitle: title.slice(0, 200),
      originalSummary: summary.slice(0, 280),
      publishedAt: pub.date,
      fetchedAt,
      region,
      speciesTags: (input.speciesTags ?? []).slice(0, 8),
      contentHash,
    },
  };
}
