/**
 * 新聞 Provider interface
 * Preview：mock／fixtures；live adapter 因授權 enabled=false 不啟用。
 */

import type { MorningNewsStatus } from '@/lib/line/morning/constants';
import { gateNormalizedNews } from '@/lib/line/morning/news/gate';
import {
  computeContentHash,
  normalizeNewsCandidate,
} from '@/lib/line/morning/news/normalize';
import { findSourceByHost } from '@/lib/line/morning/news/registry';
import {
  classifyNewsSafety,
  type RawNewsCandidate,
} from '@/lib/line/morning/news/safety';

export type MorningNewsRecord = {
  fingerprint: string;
  contentHash: string;
  canonicalUrl: string;
  sourceName: string;
  sourceId: string;
  publishedAt: Date;
  region: 'tw' | 'global';
  riskLevel: 'low' | 'medium' | 'high';
  status: MorningNewsStatus;
  title: string;
  factSummary: string;
  barkLine: string | null;
  safetyReasons: string[];
  riskLabels: string[];
  confidence: number;
  speciesTags: string[];
};

export interface MorningNewsProvider {
  readonly id: string;
  /** 拉取候選；live 必須先通過 registry.enabled */
  fetchCandidates(now?: Date): Promise<RawNewsCandidate[]>;
}

export function processCandidates(
  candidates: RawNewsCandidate[],
  now: Date = new Date(),
): MorningNewsRecord[] {
  const out: MorningNewsRecord[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const host = (() => {
      try {
        return new URL(c.canonicalUrl).hostname;
      } catch {
        return '';
      }
    })();
    const hostSource = findSourceByHost(host);
    if (!c.sourceId && !hostSource) {
      // fail-closed：未授權 host 不進候選
      continue;
    }
    const sourceId = c.sourceId ?? hostSource!.sourceId;

    const normalized = normalizeNewsCandidate({
      sourceId,
      canonicalUrl: c.canonicalUrl,
      originalTitle: c.title,
      originalSummary: c.factSummary,
      publishedAt: c.publishedAt,
      now,
    });

    if (!normalized.ok) {
      // fail-closed：不進候選列表（可選記錄）
      continue;
    }

    const gate = gateNormalizedNews(normalized.value);
    const contentHash = normalized.value.contentHash;
    if (seen.has(contentHash)) continue;
    seen.add(contentHash);

    out.push({
      fingerprint: contentHash,
      contentHash,
      canonicalUrl: normalized.value.canonicalUrl,
      sourceName: normalized.value.sourceName,
      sourceId: normalized.value.sourceId,
      publishedAt: normalized.value.publishedAt,
      region: gate.region,
      riskLevel: gate.riskLevel,
      status: gate.status,
      title: normalized.value.originalTitle,
      factSummary: normalized.value.originalSummary,
      barkLine: c.barkLine?.trim() || null,
      safetyReasons: gate.reasons,
      riskLabels: gate.riskLabels,
      confidence: gate.confidence,
      speciesTags: normalized.value.speciesTags,
    });
  }

  // 台灣優先，再依時間
  out.sort((a, b) => {
    if (a.region !== b.region) return a.region === 'tw' ? -1 : 1;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  return out;
}

export function pickAutoApprovedNews(
  records: MorningNewsRecord[],
): MorningNewsRecord | null {
  return (
    records.find(
      (r) => r.status === 'AUTO_APPROVED' && r.confidence >= 50 && !r.title.includes('偏方'),
    ) ?? null
  );
}

// re-export for tests that still import classify from provider path
export { classifyNewsSafety, computeContentHash };
