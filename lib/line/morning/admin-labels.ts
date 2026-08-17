/**
 * HQ 後台對人顯示標籤（台灣繁中）。
 * 原始 enum／code 可作次要小字保留。
 */

export function labelNewsStatus(code: string): string {
  switch (code) {
    case 'AUTO_APPROVED':
      return '自動通過';
    case 'BLOCKED':
      return '已阻擋';
    case 'REVIEW_REQUIRED':
      return '待人工審核';
    case 'DRAFT':
      return '草稿';
    case 'APPROVED':
      return '已核准';
    case 'ARCHIVED':
      return '已封存';
    case 'DRY_RUN':
      return '試跑';
    case 'SKIPPED':
      return '已略過';
    case 'SENT':
      return '已送出';
    case 'FAILED':
      return '失敗';
    default:
      return code;
  }
}

export function labelRiskLevel(code: string): string {
  switch (code) {
    case 'low':
      return '低風險';
    case 'medium':
      return '中風險';
    case 'high':
      return '高風險';
    default:
      return code;
  }
}

export function labelRegion(code: string): string {
  switch (code) {
    case 'tw':
    case 'TW':
      return '台灣';
    case 'global':
    case 'GLOBAL':
      return '全球';
    default:
      return code;
  }
}

export function labelCountryPriority(code: string): string {
  return labelRegion(code);
}

export function labelEnabled(enabled: boolean): string {
  return enabled ? '啟用' : '未啟用';
}

export function labelUsagePolicy(code: string): string {
  switch (code) {
    case 'non_commercial_only':
      return '僅非商業';
    case 'rss_reader_personal_only':
      return '僅個人 RSS 閱讀';
    case 'ogdl_commercial_ok_but_out_of_scope':
      return 'OGDL 可商用（本階段不納入）';
    case 'unknown_or_unclear':
      return '授權不明';
    case 'no_official_feed_found':
      return '查無官方 feed';
    default:
      return code;
  }
}

export function labelPetTag(tag: string): string {
  switch (tag) {
    case 'dog':
      return '狗';
    case 'cat':
      return '貓';
    case 'rabbit':
      return '兔';
    case 'bird':
      return '鳥';
    case 'rodent':
      return '小型哺乳';
    case 'general':
      return '通用';
    default:
      return tag;
  }
}

export function isFixtureCanonicalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'fixtures.morning.local' || host.endsWith('.morning.local');
  } catch {
    return url.includes('fixtures.morning.local');
  }
}
