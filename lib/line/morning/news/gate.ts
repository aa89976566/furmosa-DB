/**
 * 三層安全閘門（fail-closed）：
 * 1) deterministic hard rules
 * 2) source trust
 * 3) structured classifier（僅可更嚴格，不可覆寫硬規則放行）
 * 不得把 LLM 當唯一安全門；本階段 classifier 為規則型。
 */

import type { MorningNewsStatus } from '@/lib/line/morning/constants';
import { getSourceById } from '@/lib/line/morning/news/registry';
import type { NormalizedNewsCandidate } from '@/lib/line/morning/news/normalize';

export type NewsRiskLevel = 'low' | 'medium' | 'high';

export type GateResult = {
  status: MorningNewsStatus;
  riskLevel: NewsRiskLevel;
  riskLabels: string[];
  /** 0–100；愈高代表分類愈確定 */
  confidence: number;
  reasons: string[];
  region: 'tw' | 'global';
};

const HARD_BLOCK: Array<{ re: RegExp; label: string }> = [
  { re: /疾病|疫情|感染|病原|病毒|細菌|狂犬|禽流感|寄生蟲病|非洲豬瘟|口蹄疫/i, label: 'disease' },
  { re: /醫療|用藥|處方|手術|診斷|治療建議|症狀|照護建議|投藥/i, label: 'medical' },
  { re: /召回|回收產品|飼料污染|產品下架|食品安全/i, label: 'recall' },
  { re: /法規|修法|條例|禁令|罰鍰|修訂/i, label: 'regulation' },
  { re: /地震|颱風|洪水|火災|空難|重大傷亡|災害|土石流/i, label: 'disaster' },
  { re: /血腥|虐殺|死亡|屍體|解剖畫面|安樂死大批/i, label: 'graphic' },
  { re: /募款|捐款|眾籌|急難救助金|勸募/i, label: 'fundraising' },
  { re: /戰爭|衝突|制裁|選舉|政黨|抗議衝突/i, label: 'politics' },
  { re: /偏方|必癒|保證治好|未經證實|網傳秘方|保證痊癒/i, label: 'unverified_health' },
];

const REVIEW_ONLY: Array<{ re: RegExp; label: string }> = [
  { re: /受傷|走失尋獲|救援|收容所爆滿|路殺/i, label: 'sensitive_rescue' },
  { re: /研究指出|臨床試驗|營養補充|實驗動物/i, label: 'research_nuance' },
];

function blob(n: NormalizedNewsCandidate): string {
  return `${n.originalTitle}\n${n.originalSummary}`;
}

function sourceTrustScore(sourceId: string): {
  ok: boolean;
  trust: number;
  reasons: string[];
} {
  const src = getSourceById(sourceId);
  if (!src) return { ok: false, trust: 0, reasons: ['source_unknown'] };
  // live 未授權來源仍可用於 fixture（sourceId=fixture_placeholder）
  if (src.sourceId === 'fixture_placeholder') {
    return { ok: true, trust: 70, reasons: ['fixture_trust'] };
  }
  if (src.usagePolicy === 'non_commercial_only' || src.usagePolicy === 'rss_reader_personal_only') {
    // 未授權商業使用：不得 AUTO_APPROVED 進晨報候選（即使是手動貼文也標記）
    return { ok: false, trust: 20, reasons: ['source_license_blocks_commercial'] };
  }
  if (src.usagePolicy === 'no_official_feed_found' || src.usagePolicy === 'unknown_or_unclear') {
    return { ok: false, trust: 10, reasons: ['source_unverified'] };
  }
  if (src.trustTier === 'tw_official') return { ok: true, trust: 90, reasons: ['trust_tw_official'] };
  if (src.trustTier === 'global_official') {
    return { ok: true, trust: 80, reasons: ['trust_global_official'] };
  }
  if (src.trustTier === 'research') return { ok: true, trust: 75, reasons: ['trust_research'] };
  return { ok: true, trust: 60, reasons: ['trust_other'] };
}

/** 結構化 classifier：輸出固定 schema；不確定 → BLOCKED */
function structuredClassifier(text: string): {
  riskLabels: string[];
  confidence: number;
  escalateTo: 'none' | 'REVIEW_REQUIRED' | 'BLOCKED';
  reasons: string[];
} {
  const riskLabels: string[] = [];
  const reasons: string[] = [];

  for (const p of HARD_BLOCK) {
    if (p.re.test(text)) riskLabels.push(p.label);
  }
  for (const p of REVIEW_ONLY) {
    if (p.re.test(text)) riskLabels.push(p.label);
  }

  // 空摘要或不確定語氣
  if (text.trim().length < 12) {
    return {
      riskLabels: [...riskLabels, 'uncertain'],
      confidence: 20,
      escalateTo: 'BLOCKED',
      reasons: ['classifier_uncertain_short'],
    };
  }
  if (/可能|疑似|網傳|據說|未證實/i.test(text)) {
    return {
      riskLabels: [...riskLabels, 'uncertain'],
      confidence: 35,
      escalateTo: 'BLOCKED',
      reasons: ['classifier_uncertain_hedge'],
    };
  }

  if (riskLabels.some((l) => HARD_BLOCK.some((h) => h.label === l))) {
    return {
      riskLabels,
      confidence: 95,
      escalateTo: 'BLOCKED',
      reasons: ['classifier_hard_risk'],
    };
  }
  if (riskLabels.some((l) => REVIEW_ONLY.some((h) => h.label === l))) {
    return {
      riskLabels,
      confidence: 80,
      escalateTo: 'REVIEW_REQUIRED',
      reasons: ['classifier_review_risk'],
    };
  }

  return {
    riskLabels: riskLabels.length ? riskLabels : ['ok'],
    confidence: 85,
    escalateTo: 'none',
    reasons: ['classifier_ok'],
  };
}

/**
 * 合併三層：硬規則結果不可被 classifier 放寬。
 */
export function gateNormalizedNews(n: NormalizedNewsCandidate): GateResult {
  const reasons: string[] = [];
  const riskLabels = new Set<string>();
  let status: MorningNewsStatus = 'AUTO_APPROVED';
  let riskLevel: NewsRiskLevel = 'low';
  let confidence = 100;

  const text = blob(n);

  // Layer 1: hard rules
  for (const p of HARD_BLOCK) {
    if (p.re.test(text)) {
      riskLabels.add(p.label);
      status = 'BLOCKED';
      riskLevel = 'high';
      reasons.push(`hard:${p.label}`);
    }
  }
  if (status !== 'BLOCKED') {
    for (const p of REVIEW_ONLY) {
      if (p.re.test(text)) {
        riskLabels.add(p.label);
        status = 'REVIEW_REQUIRED';
        riskLevel = 'medium';
        reasons.push(`hard_review:${p.label}`);
      }
    }
  }

  // Layer 2: source trust（不可放寬硬規則）
  const trust = sourceTrustScore(n.sourceId);
  reasons.push(...trust.reasons);
  confidence = Math.min(confidence, trust.trust);
  if (!trust.ok) {
    // 僅可更嚴
    if (status === 'AUTO_APPROVED') {
      status = 'BLOCKED';
      riskLevel = 'high';
    } else if (status === 'REVIEW_REQUIRED') {
      status = 'BLOCKED';
      riskLevel = 'high';
    }
    riskLabels.add('source_trust_fail');
  }

  // Layer 3: structured classifier（僅更嚴）
  const clf = structuredClassifier(text);
  reasons.push(...clf.reasons);
  confidence = Math.min(confidence, clf.confidence);
  clf.riskLabels.forEach((l) => riskLabels.add(l));
  if (clf.escalateTo === 'BLOCKED') {
    status = 'BLOCKED';
    riskLevel = 'high';
  } else if (clf.escalateTo === 'REVIEW_REQUIRED' && status === 'AUTO_APPROVED') {
    status = 'REVIEW_REQUIRED';
    riskLevel = 'medium';
  }

  // 不確定 → fail closed
  if (confidence < 50 && status === 'AUTO_APPROVED') {
    status = 'BLOCKED';
    riskLevel = 'high';
    reasons.push('confidence_below_threshold');
    riskLabels.add('uncertain');
  }

  // 單則 normalize 區域優先（避免 fixture_placeholder 預設 tw 蓋掉 global 條目）
  void getSourceById(n.sourceId);
  return {
    status,
    riskLevel,
    riskLabels: [...riskLabels],
    confidence,
    reasons,
    region: n.region,
  };
}

export function isMorningNewsCandidate(gate: GateResult): boolean {
  return gate.status === 'AUTO_APPROVED';
}
