/**
 * 換購資格相關會員文案／Preview 資料形狀。
 * Phase 1：僅 builder + Preview；禁止真實 LINE push／cron。
 */

import {
  REFILL_EXCHANGE_WINDOW_COPY,
  REFILL_EXCHANGE_WINDOW_DAYS,
  deriveExchangeEntitlementLifecycle,
  formatExchangeDeadlineDisplay,
  type ExchangeEntitlementLifecycle,
} from '@/lib/refill/exchange-window';

export const EXCHANGE_ENTITLEMENT_PREVIEW_MODE = 'preview-only' as const;

export type ExchangeEntitlementCopyPreview = {
  /** 永遠 preview-only：本階段不可當 live 發送結果 */
  mode: typeof EXCHANGE_ENTITLEMENT_PREVIEW_MODE;
  kind:
    | 'activated'
    | 'wrong-store'
    | 'expiring-soon'
    | 'expired'
    | 'lifecycle';
  lifecycle?: ExchangeEntitlementLifecycle;
  altText: string;
  lines: string[];
  storeName?: string;
  expiresDisplay?: string;
};

/** 空瓶確認後（資格啟用）— Preview 文案 */
export function buildExchangeActivatedCopy(input: {
  storeName: string;
  expiresAt: Date;
}): ExchangeEntitlementCopyPreview {
  const expiresDisplay = formatExchangeDeadlineDisplay(input.expiresAt);
  return {
    mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
    kind: 'activated',
    lifecycle: 'active',
    altText: '換購資格已啟用（Preview）',
    storeName: input.storeName,
    expiresDisplay,
    lines: [
      '空瓶安全回家，任務完成。',
      '你的 NT$99 換購資格已經啟用，可以挑一罐不同口味。',
      `⏰ 請在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內使用`,
      `最後使用日：${expiresDisplay}`,
      `請回到「${input.storeName}」完成換罐，口味依門市現場庫存為準。`,
    ],
  };
}

/** 錯店（須回序號所屬原店） */
export function buildExchangeWrongStoreCopy(input: {
  storeName: string;
}): ExchangeEntitlementCopyPreview {
  return {
    mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
    kind: 'wrong-store',
    altText: '請回原店換罐（Preview）',
    storeName: input.storeName,
    lines: [
      '這罐有自己的回家路線。',
      `它是從「${input.storeName}」出發的，要帶回原店才能完成換罐。`,
      '不是故意刁難，是庫存和換罐紀錄要對得起來。',
    ],
  };
}

/** 即將到期 */
export function buildExchangeExpiringSoonCopy(input: {
  storeName: string;
  expiresAt: Date;
}): ExchangeEntitlementCopyPreview {
  const expiresDisplay = formatExchangeDeadlineDisplay(input.expiresAt);
  return {
    mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
    kind: 'expiring-soon',
    lifecycle: 'expiring-soon',
    altText: '換購資格即將到期（Preview）',
    storeName: input.storeName,
    expiresDisplay,
    lines: [
      '換購期限快到了。',
      `最後使用日：${expiresDisplay}`,
      `請回到「${input.storeName}」完成 NT$99 換罐。`,
      '口味依門市現場庫存為準。',
    ],
  };
}

/** 已過期 */
export function buildExchangeExpiredCopy(input: {
  storeName: string;
  expiresAt: Date;
}): ExchangeEntitlementCopyPreview {
  const expiresDisplay = formatExchangeDeadlineDisplay(input.expiresAt);
  return {
    mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
    kind: 'expired',
    lifecycle: 'expired',
    altText: '換購資格已過期（Preview）',
    storeName: input.storeName,
    expiresDisplay,
    lines: [
      '這次的 NT$99 換購資格已經到期。',
      `最後使用日是 ${expiresDisplay}。`,
      `若還想換罐，請再帶空瓶回「${input.storeName}」重新確認後啟用。`,
    ],
  };
}

/** 依派生狀態回傳對應 Preview 文案（不發送） */
export function buildExchangeLifecycleCopyPreview(input: {
  storeName: string;
  activatedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date | null;
  now?: Date;
}): ExchangeEntitlementCopyPreview {
  const lifecycle = deriveExchangeEntitlementLifecycle({
    activatedAt: input.activatedAt,
    expiresAt: input.expiresAt,
    redeemedAt: input.redeemedAt,
    now: input.now,
  });

  if (lifecycle === 'redeemed') {
    return {
      mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
      kind: 'lifecycle',
      lifecycle,
      altText: '換購資格已使用（Preview）',
      storeName: input.storeName,
      expiresDisplay: formatExchangeDeadlineDisplay(input.expiresAt),
      lines: ['這次的 NT$99 換購資格已經使用過了。'],
    };
  }
  if (lifecycle === 'expired') {
    return {
      ...buildExchangeExpiredCopy({
        storeName: input.storeName,
        expiresAt: input.expiresAt,
      }),
      kind: 'lifecycle',
    };
  }
  if (lifecycle === 'expiring-soon') {
    return {
      ...buildExchangeExpiringSoonCopy({
        storeName: input.storeName,
        expiresAt: input.expiresAt,
      }),
      kind: 'lifecycle',
    };
  }
  return {
    ...buildExchangeActivatedCopy({
      storeName: input.storeName,
      expiresAt: input.expiresAt,
    }),
    kind: 'lifecycle',
    lifecycle: 'active',
  };
}

export function buildJoinBeforeWindowLines(): string[] {
  return [
    REFILL_EXCHANGE_WINDOW_COPY.highlightTitle,
    `${REFILL_EXCHANGE_WINDOW_COPY.highlightLeadBefore}${REFILL_EXCHANGE_WINDOW_COPY.highlightLeadEmphasis}${REFILL_EXCHANGE_WINDOW_COPY.highlightLeadAfter}`,
    REFILL_EXCHANGE_WINDOW_COPY.highlightNote,
  ];
}
