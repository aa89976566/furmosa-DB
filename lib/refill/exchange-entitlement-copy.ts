/**
 * 換購資格相關會員文案／Preview 資料形狀。
 * Phase 1：僅 builder + Preview；禁止真實 LINE push／cron。
 *
 * 顧客文案語氣：見 lib/jar-exchange/refill-customer-copy-tone.ts
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
    altText: '換口味資格已開好（Preview）',
    storeName: input.storeName,
    expiresDisplay,
    lines: [
      '空瓶平安回店，這一罐有好好完成任務。',
      'NT$99 換口味資格已經開好，可以替毛孩挑下一罐了。',
      `⏰ 記得在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內使用`,
      `最晚使用日：${expiresDisplay}`,
      `到「${input.storeName}」出示資格就能換；口味以現場庫存為準。`,
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
      '這罐今天走錯店了。',
      `它原本從「${input.storeName}」出發，還是要帶回這間店才能換。`,
      '每間店的庫存和紀錄各自管理，走原路回去才不會對錯帳。',
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
    altText: '換口味期限快到了（Preview）',
    storeName: input.storeName,
    expiresDisplay,
    lines: [
      '提醒一下，毛孩的下一罐還在等你。',
      `最晚使用日：${expiresDisplay}`,
      `記得回「${input.storeName}」，用 NT$99 換一罐新口味。`,
      '現場有哪些口味，以門市當天庫存為準。',
    ],
  };
}

/**
 * 已過期
 * 規則：一空瓶一組期限；過期後需再帶空瓶、店家確認後開「新」期限，不是舊資格重新啟用。
 */
export function buildExchangeExpiredCopy(input: {
  storeName: string;
  expiresAt: Date;
}): ExchangeEntitlementCopyPreview {
  const expiresDisplay = formatExchangeDeadlineDisplay(input.expiresAt);
  return {
    mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
    kind: 'expired',
    lifecycle: 'expired',
    altText: '換口味資格已過期（Preview）',
    storeName: input.storeName,
    expiresDisplay,
    lines: [
      '這次的 NT$99 換口味資格已經過期了。',
      `最後使用日是 ${expiresDisplay}。`,
      `沒關係，下次再帶一個空瓶回「${input.storeName}」。店家確認後，會再開一組新的 NT$99 換口味期限。`,
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
      altText: '換口味已使用（Preview）',
      storeName: input.storeName,
      expiresDisplay: formatExchangeDeadlineDisplay(input.expiresAt),
      lines: [
        '這次的 NT$99 換口味已經用過了，下一罐也有好好接棒。',
      ],
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
    `${REFILL_EXCHANGE_WINDOW_COPY.highlightLeadBefore}${REFILL_EXCHANGE_WINDOW_COPY.highlightLeadEmphasis}${REFILL_EXCHANGE_WINDOW_COPY.highlightLeadAfter}`,
  ];
}
