/**
 * 自動內容安全閘門
 * - 輕鬆社會新聞、動物研究與趣聞 → AUTO_APPROVED
 * - 疾病／醫療／召回／法規／災害／血腥／募款／政治／未核實健康建議 → BLOCKED 或 REVIEW_REQUIRED
 */

import type { MorningNewsStatus } from '@/lib/line/morning/constants';
import { findWhitelistedSource } from '@/lib/line/morning/news/whitelist';

export type NewsRiskLevel = 'low' | 'medium' | 'high';

export type RawNewsCandidate = {
  canonicalUrl: string;
  sourceName: string;
  publishedAt: Date | string;
  title: string;
  factSummary: string;
  region?: 'tw' | 'global';
  barkLine?: string | null;
};

export type SafetyClassification = {
  status: MorningNewsStatus;
  riskLevel: NewsRiskLevel;
  reasons: string[];
  sourceId: string | null;
  region: 'tw' | 'global';
};

const BLOCK_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /疾病|疫情|感染|病原|病毒|細菌|狂犬|禽流感|寄生蟲病/i, reason: 'disease' },
  { re: /醫療|用藥|處方|手術|診斷|治療建議|症狀/i, reason: 'medical' },
  { re: /召回|回收產品|飼料污染|產品下架/i, reason: 'recall' },
  { re: /法規|修法|條例|禁令|罰鍰/i, reason: 'regulation' },
  { re: /地震|颱風|洪水|火災|空難|重大傷亡|災害/i, reason: 'disaster' },
  { re: /血腥|虐殺|死亡|屍體|解剖畫面/i, reason: 'graphic' },
  { re: /募款|捐款|眾籌|急難救助金/i, reason: 'fundraising' },
  { re: /戰爭|衝突|制裁|選舉|政黨/i, reason: 'politics' },
  { re: /偏方|必癒|保證治好|未經證實|網傳秘方/i, reason: 'unverified_health' },
];

const REVIEW_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /受傷|走失尋獲|救援|收容所爆滿/i, reason: 'sensitive_rescue' },
  { re: /研究指出|臨床試驗|營養補充/i, reason: 'research_nuance' },
];

function textBlob(c: RawNewsCandidate): string {
  return `${c.title}\n${c.factSummary}\n${c.barkLine ?? ''}`;
}

function parsePublishedAt(v: Date | string): Date | null {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function classifyNewsSafety(candidate: RawNewsCandidate): SafetyClassification {
  const reasons: string[] = [];
  const source = findWhitelistedSource(candidate.canonicalUrl);
  if (!source) {
    return {
      status: 'BLOCKED',
      riskLevel: 'high',
      reasons: ['source_not_whitelisted'],
      sourceId: null,
      region: candidate.region ?? 'global',
    };
  }

  if (candidate.sourceName.trim() && candidate.sourceName.trim() !== source.name) {
    // 允許別名但記錄；名稱空白則之後補
    reasons.push('source_name_mismatch_soft');
  }

  const publishedAt = parsePublishedAt(candidate.publishedAt);
  if (!publishedAt) {
    return {
      status: 'BLOCKED',
      riskLevel: 'high',
      reasons: ['invalid_published_at'],
      sourceId: source.id,
      region: candidate.region ?? source.regionDefault,
    };
  }

  // 過舊（>30 天）不進晨報自動池
  const ageMs = Date.now() - publishedAt.getTime();
  if (ageMs > 30 * 24 * 60 * 60 * 1000) {
    return {
      status: 'BLOCKED',
      riskLevel: 'medium',
      reasons: ['stale_published_at'],
      sourceId: source.id,
      region: candidate.region ?? source.regionDefault,
    };
  }

  if (!candidate.canonicalUrl.startsWith('http')) {
    return {
      status: 'BLOCKED',
      riskLevel: 'high',
      reasons: ['invalid_url'],
      sourceId: source.id,
      region: candidate.region ?? source.regionDefault,
    };
  }

  const blob = textBlob(candidate);
  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(blob)) {
      return {
        status: 'BLOCKED',
        riskLevel: 'high',
        reasons: [...reasons, p.reason],
        sourceId: source.id,
        region: candidate.region ?? source.regionDefault,
      };
    }
  }

  for (const p of REVIEW_PATTERNS) {
    if (p.re.test(blob)) {
      return {
        status: 'REVIEW_REQUIRED',
        riskLevel: 'medium',
        reasons: [...reasons, p.reason],
        sourceId: source.id,
        region: candidate.region ?? source.regionDefault,
      };
    }
  }

  return {
    status: 'AUTO_APPROVED',
    riskLevel: 'low',
    reasons: reasons.length ? reasons : ['ok'],
    sourceId: source.id,
    region: candidate.region ?? source.regionDefault,
  };
}

/** 去重指紋：normalize URL + 日期 */
export function newsFingerprint(canonicalUrl: string, publishedAt: Date): string {
  let normalized = canonicalUrl.trim().toLowerCase();
  try {
    const u = new URL(normalized);
    u.hash = '';
    // 去掉常見追蹤參數
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid'].forEach((k) =>
      u.searchParams.delete(k),
    );
    normalized = `${u.origin}${u.pathname}${u.search}`;
  } catch {
    // keep raw
  }
  const day = publishedAt.toISOString().slice(0, 10);
  return `${normalized}|${day}`;
}
