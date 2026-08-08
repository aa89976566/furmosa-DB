/**
 * 新聞 Provider interface（MVP：mock／fixtures；Production ingestion 後續）
 */

import type { MorningNewsStatus } from '@/lib/line/morning/constants';
import {
  classifyNewsSafety,
  newsFingerprint,
  type RawNewsCandidate,
} from '@/lib/line/morning/news/safety';

export type MorningNewsRecord = {
  fingerprint: string;
  canonicalUrl: string;
  sourceName: string;
  publishedAt: Date;
  region: 'tw' | 'global';
  riskLevel: 'low' | 'medium' | 'high';
  status: MorningNewsStatus;
  title: string;
  factSummary: string;
  barkLine: string | null;
  safetyReasons: string[];
};

export interface MorningNewsProvider {
  readonly id: string;
  /** 拉取候選（MVP 為 mock；不得在此打付費／即時網路 API） */
  fetchCandidates(now?: Date): Promise<RawNewsCandidate[]>;
}

export function processCandidates(
  candidates: RawNewsCandidate[],
): MorningNewsRecord[] {
  const out: MorningNewsRecord[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const publishedAt =
      c.publishedAt instanceof Date ? c.publishedAt : new Date(c.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) continue;

    const classification = classifyNewsSafety(c);
    const fingerprint = newsFingerprint(c.canonicalUrl, publishedAt);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    out.push({
      fingerprint,
      canonicalUrl: c.canonicalUrl,
      sourceName: c.sourceName,
      publishedAt,
      region: classification.region,
      riskLevel: classification.riskLevel,
      status: classification.status,
      title: c.title.trim(),
      factSummary: c.factSummary.trim(),
      barkLine: c.barkLine?.trim() || null,
      safetyReasons: classification.reasons,
    });
  }

  // 台灣優先
  out.sort((a, b) => {
    if (a.region !== b.region) return a.region === 'tw' ? -1 : 1;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  return out;
}

export function pickAutoApprovedNews(
  records: MorningNewsRecord[],
): MorningNewsRecord | null {
  return records.find((r) => r.status === 'AUTO_APPROVED') ?? null;
}
