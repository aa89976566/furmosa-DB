/**
 * 舊介面相容層：轉呼叫 normalize + gate。
 * 新程式請直接用 normalize.ts / gate.ts。
 */

import type { MorningNewsStatus } from '@/lib/line/morning/constants';
import { gateNormalizedNews, type NewsRiskLevel } from '@/lib/line/morning/news/gate';
import { normalizeNewsCandidate } from '@/lib/line/morning/news/normalize';
import { findSourceByHost } from '@/lib/line/morning/news/registry';

export type { NewsRiskLevel };

export type RawNewsCandidate = {
  canonicalUrl: string;
  sourceName: string;
  publishedAt: Date | string;
  title: string;
  factSummary: string;
  region?: 'tw' | 'global';
  barkLine?: string | null;
  sourceId?: string;
};

export type SafetyClassification = {
  status: MorningNewsStatus;
  riskLevel: NewsRiskLevel;
  reasons: string[];
  sourceId: string | null;
  region: 'tw' | 'global';
  riskLabels?: string[];
  confidence?: number;
};

export function classifyNewsSafety(candidate: RawNewsCandidate): SafetyClassification {
  const host = (() => {
    try {
      return new URL(candidate.canonicalUrl).hostname;
    } catch {
      return '';
    }
  })();
  const hostSource = findSourceByHost(host);

  // 未提供 sourceId 且 host 不在 registry → fail-closed（不得落到 fixture）
  if (!candidate.sourceId && !hostSource) {
    return {
      status: 'BLOCKED',
      riskLevel: 'high',
      reasons: ['source_not_whitelisted'],
      sourceId: null,
      region: candidate.region ?? 'global',
      riskLabels: ['source_not_whitelisted'],
      confidence: 100,
    };
  }

  const sourceId = candidate.sourceId ?? hostSource!.sourceId;

  const normalized = normalizeNewsCandidate({
    sourceId,
    canonicalUrl: candidate.canonicalUrl,
    originalTitle: candidate.title,
    originalSummary: candidate.factSummary,
    publishedAt: candidate.publishedAt,
    region: candidate.region,
  });
  if (!normalized.ok) {
    return {
      status: 'BLOCKED',
      riskLevel: 'high',
      reasons: [normalized.reason],
      sourceId,
      region: candidate.region ?? 'global',
      riskLabels: [normalized.reason],
      confidence: 100,
    };
  }
  const gate = gateNormalizedNews(normalized.value);
  return {
    status: gate.status,
    riskLevel: gate.riskLevel,
    reasons: gate.reasons,
    sourceId: normalized.value.sourceId,
    region: gate.region,
    riskLabels: gate.riskLabels,
    confidence: gate.confidence,
  };
}

/** @deprecated 改用 SHA-256 contentHash（normalize.computeContentHash） */
export function newsFingerprint(canonicalUrl: string, publishedAt: Date): string {
  let normalized = canonicalUrl.trim().toLowerCase();
  try {
    const u = new URL(normalized);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid'].forEach((k) =>
      u.searchParams.delete(k),
    );
    normalized = `${u.origin}${u.pathname}${u.search}`;
  } catch {
    // keep
  }
  const day = publishedAt.toISOString().slice(0, 10);
  return `${normalized}|${day}`;
}
