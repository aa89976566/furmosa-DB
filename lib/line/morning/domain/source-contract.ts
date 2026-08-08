/**
 * 來源欄位合約
 * - NEWS / ANIMAL_FACT：provider、itemId、canonicalUrl、license*、attribution、contentHash 必填
 * - NEWS：sourcePublishedAt 必填
 * - ANIMAL_FACT：sourcePublishedAt 可 null（不得用 retrievedAt 冒充）
 * - HUMOR：所有外部來源欄位必須為 null
 */

import type { MorningContentType } from '@/lib/line/morning/domain/types';

export type MorningLicenseFields = {
  licenseType: string;
  licenseUrl: string | null;
  attribution: string;
};

export type MorningSourceFields = {
  provider: string | null;
  itemId: string | null;
  canonicalUrl: string | null;
  licenseType: string | null;
  licenseUrl: string | null;
  attribution: string | null;
  contentHash: string | null;
  /** 來源發布時間；FACT 可 null；不得用 retrievedAt 填入 */
  sourcePublishedAt: Date | null;
  /** 擷取時間；不參與「發布時間」合約 */
  retrievedAt: Date | null;
};

export type SourceContractResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function isHttpUrl(v: string | null | undefined): boolean {
  if (!nonEmpty(v)) return false;
  try {
    const u = new URL(v!);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSha256Hex(v: string | null | undefined): boolean {
  return typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
}

/** 驗證某 contentType 的來源欄位是否符合合約 */
export function validateSourceContract(
  contentType: MorningContentType,
  fields: MorningSourceFields,
): SourceContractResult {
  const reasons: string[] = [];

  if (contentType === 'HUMOR') {
    const externals: Array<keyof MorningSourceFields> = [
      'provider',
      'itemId',
      'canonicalUrl',
      'licenseType',
      'licenseUrl',
      'attribution',
      'contentHash',
      'sourcePublishedAt',
      'retrievedAt',
    ];
    for (const k of externals) {
      if (fields[k] != null) {
        reasons.push(`humor_external_field_not_null:${k}`);
      }
    }
    return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
  }

  // NEWS / ANIMAL_FACT shared required
  if (!nonEmpty(fields.provider)) reasons.push('missing_provider');
  if (!nonEmpty(fields.itemId)) reasons.push('missing_itemId');
  if (!isHttpUrl(fields.canonicalUrl)) reasons.push('invalid_canonicalUrl');
  if (!nonEmpty(fields.licenseType)) reasons.push('missing_licenseType');
  if (!nonEmpty(fields.attribution)) reasons.push('missing_attribution');
  if (!isSha256Hex(fields.contentHash)) reasons.push('invalid_contentHash');
  if (fields.licenseUrl != null && fields.licenseUrl !== '') {
    if (!isHttpUrl(fields.licenseUrl)) reasons.push('invalid_licenseUrl');
  }

  if (contentType === 'NEWS') {
    if (!(fields.sourcePublishedAt instanceof Date) || Number.isNaN(fields.sourcePublishedAt.getTime())) {
      reasons.push('missing_sourcePublishedAt');
    }
  }

  if (contentType === 'ANIMAL_FACT') {
    // publishedAt 可 null；不得用 retrievedAt 填入 sourcePublishedAt（型別分開；測試覆蓋）
    if (fields.sourcePublishedAt != null) {
      if (
        !(fields.sourcePublishedAt instanceof Date) ||
        Number.isNaN(fields.sourcePublishedAt.getTime())
      ) {
        reasons.push('invalid_sourcePublishedAt');
      }
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/** HUMOR 的標準空來源欄位 */
export function emptyHumorSourceFields(): MorningSourceFields {
  return {
    provider: null,
    itemId: null,
    canonicalUrl: null,
    licenseType: null,
    licenseUrl: null,
    attribution: null,
    contentHash: null,
    sourcePublishedAt: null,
    retrievedAt: null,
  };
}
