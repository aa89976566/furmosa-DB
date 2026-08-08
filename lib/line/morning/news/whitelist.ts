/**
 * 相容層：白名單改由 registry 管理。
 */

import {
  findSourceByHost,
  MORNING_SOURCE_REGISTRY,
  type MorningSourceRegistryEntry,
} from '@/lib/line/morning/news/registry';

export type WhitelistedSource = {
  id: string;
  name: string;
  tier: string;
  hostnames: string[];
  regionDefault: 'tw' | 'global';
  enabled: boolean;
};

export const NEWS_SOURCE_WHITELIST: WhitelistedSource[] = MORNING_SOURCE_REGISTRY.map(
  (s: MorningSourceRegistryEntry) => ({
    id: s.sourceId,
    name: s.sourceName,
    tier: s.trustTier,
    hostnames: s.allowedHosts,
    regionDefault: s.regionDefault,
    enabled: s.enabled,
  }),
);

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
  const src = findSourceByHost(host);
  if (!src) return null;
  return {
    id: src.sourceId,
    name: src.sourceName,
    tier: src.trustTier,
    hostnames: src.allowedHosts,
    regionDefault: src.regionDefault,
    enabled: src.enabled,
  };
}
