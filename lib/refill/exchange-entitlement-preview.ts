/**
 * 換購期限 Phase 1 — HQ Preview 訊息組裝（純函式、無 DB、無 push）。
 */

import {
  DEFAULT_REFILL_FLAVOURS,
  REFILL_PLAN_RULES,
  formatFlavourLabel,
} from '@/lib/jar-exchange/refill-plan-content';
import { buildRefillIntroBubblePreview } from '@/lib/line/refill-intro-flex';
import type { PreviewChatItem, PreviewLineMessage } from '@/lib/line-preview/types';
import {
  EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
  buildExchangeActivatedCopy,
  buildExchangeExpiredCopy,
  buildExchangeExpiringSoonCopy,
  buildExchangeWrongStoreCopy,
} from '@/lib/refill/exchange-entitlement-copy';
import {
  REFILL_EXCHANGE_WINDOW_COPY,
  REFILL_EXCHANGE_WINDOW_DAYS,
  computeExchangeExpiresAt,
  formatExchangeDeadlineDisplay,
} from '@/lib/refill/exchange-window';

export const REFILL_EXCHANGE_PREVIEW_STATES = [
  'join-before',
  'activated',
  'wrong-store',
  'expiring-soon',
  'expired',
] as const;

export type RefillExchangePreviewStateId =
  (typeof REFILL_EXCHANGE_PREVIEW_STATES)[number];

export const REFILL_EXCHANGE_PREVIEW_STATE_LABELS: Record<
  RefillExchangePreviewStateId,
  string
> = {
  'join-before': '加入前規則',
  activated: '資格啟用',
  'wrong-store': '錯店',
  'expiring-soon': '即將到期',
  expired: '已過期',
};

/** 驗收用：長店名 + 固定啟用日，方便測 YYYY/MM/DD 與換行 */
export const REFILL_EXCHANGE_PREVIEW_FIXTURE = {
  storeName: '豬窩寵物美容中和店・板橋文化路長名稱驗收分店',
  activatedAtIso: '2026-01-15T14:30:00.000+08:00',
} as const;

const INTRO_THEME = {
  ink: '#2E231D',
  muted: '#6B5E52',
  cta: '#C46A2F',
  cream: '#FFFCF7',
  bg: '#F8F3EA',
  warmBg: '#F4E2C8',
} as const;

function textNode(
  content: string,
  opts?: {
    size?: string;
    weight?: string;
    color?: string;
    margin?: string;
    wrap?: boolean;
  },
) {
  return {
    type: 'text' as const,
    text: content,
    size: opts?.size ?? 'sm',
    weight: opts?.weight,
    color: opts?.color ?? INTRO_THEME.ink,
    margin: opts?.margin,
    wrap: opts?.wrap ?? true,
  };
}

function previewBadgeFooter() {
  return textNode(REFILL_EXCHANGE_WINDOW_COPY.previewBadge, {
    size: 'xxs',
    color: INTRO_THEME.muted,
    margin: 'md',
  });
}

function buildSimpleBubble(
  altText: string,
  bodyContents: Record<string, unknown>[],
): PreviewLineMessage {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: { body: { backgroundColor: INTRO_THEME.bg } },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [...bodyContents, previewBadgeFooter()],
      },
    },
  };
}

export function buildJoinBeforePreviewMessages(): PreviewLineMessage[] {
  const bubble = buildRefillIntroBubblePreview({
    settings: {
      heroImageUrl: REFILL_PLAN_RULES.heroImagePath,
      firstJarPrice: REFILL_PLAN_RULES.firstJarPrice,
      exchangePrice: REFILL_PLAN_RULES.exchangePrice,
      pointsPerJar: REFILL_PLAN_RULES.pointsPerJar,
      pointsForDiscount: REFILL_PLAN_RULES.pointsForDiscount,
      discountAmount: REFILL_PLAN_RULES.discountAmountDefault,
      flavourUpdateNote: REFILL_PLAN_RULES.flavourUpdateCadence,
      periodStartedAt: null,
      periodEndedAt: null,
    },
    flavours: DEFAULT_REFILL_FLAVOURS.map((f, i) => ({
      id: `preview-f-${i}`,
      code: f.code,
      name: f.name,
      weightGrams: f.weightGrams,
      imageUrl: null,
      isActive: true,
      availableFrom: null,
      availableUntil: null,
      sortOrder: f.sortOrder,
      label: formatFlavourLabel(f.name, f.weightGrams),
    })),
  });
  return [
    {
      type: 'flex',
      altText: `${REFILL_PLAN_RULES.heroAlt}（Preview）`,
      contents: bubble,
    },
  ];
}

export function buildActivatedPreviewMessages(input?: {
  storeName?: string;
  activatedAt?: Date;
}): PreviewLineMessage[] {
  const storeName = input?.storeName ?? REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName;
  const activatedAt =
    input?.activatedAt ?? new Date(REFILL_EXCHANGE_PREVIEW_FIXTURE.activatedAtIso);
  const expiresAt = computeExchangeExpiresAt(activatedAt);
  const copy = buildExchangeActivatedCopy({ storeName, expiresAt });
  return [
    buildSimpleBubble(copy.altText, [
      textNode('空瓶安全回家，任務完成。', { size: 'md', weight: 'bold' }),
      textNode('你的 NT$99 換購資格已經啟用，可以挑一罐不同口味。', {
        size: 'sm',
        margin: 'md',
      }),
      {
        type: 'box',
        layout: 'vertical',
        margin: 'lg',
        paddingAll: '14px',
        backgroundColor: INTRO_THEME.warmBg,
        cornerRadius: '10px',
        borderColor: INTRO_THEME.cta,
        borderWidth: '2px',
        spacing: 'sm',
        contents: [
          textNode('⏰ 請在', { size: 'sm' }),
          textNode(`${REFILL_EXCHANGE_WINDOW_DAYS} 天內`, {
            size: 'xl',
            weight: 'bold',
            color: INTRO_THEME.cta,
          }),
          textNode('使用', { size: 'sm' }),
          textNode(`最後使用日：${formatExchangeDeadlineDisplay(expiresAt)}`, {
            size: 'sm',
            weight: 'bold',
            margin: 'sm',
          }),
        ],
      },
      textNode(`請回到「${storeName}」完成換罐，口味依門市現場庫存為準。`, {
        size: 'sm',
        color: INTRO_THEME.muted,
        margin: 'md',
      }),
    ]),
  ];
}

export function buildWrongStorePreviewMessages(input?: {
  storeName?: string;
}): PreviewLineMessage[] {
  const storeName = input?.storeName ?? REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName;
  const copy = buildExchangeWrongStoreCopy({ storeName });
  return [
    buildSimpleBubble(copy.altText, [
      textNode(copy.lines[0], { size: 'md', weight: 'bold' }),
      textNode(copy.lines[1], { size: 'sm', margin: 'md' }),
      textNode(copy.lines[2], {
        size: 'sm',
        color: INTRO_THEME.muted,
        margin: 'sm',
      }),
    ]),
  ];
}

export function buildExpiringSoonPreviewMessages(input?: {
  storeName?: string;
  activatedAt?: Date;
}): PreviewLineMessage[] {
  const storeName = input?.storeName ?? REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName;
  const activatedAt =
    input?.activatedAt ?? new Date(REFILL_EXCHANGE_PREVIEW_FIXTURE.activatedAtIso);
  const expiresAt = computeExchangeExpiresAt(activatedAt);
  const copy = buildExchangeExpiringSoonCopy({ storeName, expiresAt });
  return [
    buildSimpleBubble(copy.altText, [
      textNode(copy.lines[0], { size: 'md', weight: 'bold' }),
      textNode(`最後使用日：${formatExchangeDeadlineDisplay(expiresAt)}`, {
        size: 'lg',
        weight: 'bold',
        color: INTRO_THEME.cta,
        margin: 'md',
      }),
      textNode(copy.lines[2], { size: 'sm', margin: 'sm' }),
      textNode(copy.lines[3], {
        size: 'xs',
        color: INTRO_THEME.muted,
        margin: 'sm',
      }),
    ]),
  ];
}

export function buildExpiredPreviewMessages(input?: {
  storeName?: string;
  activatedAt?: Date;
}): PreviewLineMessage[] {
  const storeName = input?.storeName ?? REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName;
  const activatedAt =
    input?.activatedAt ?? new Date(REFILL_EXCHANGE_PREVIEW_FIXTURE.activatedAtIso);
  const expiresAt = computeExchangeExpiresAt(activatedAt);
  const copy = buildExchangeExpiredCopy({ storeName, expiresAt });
  return [
    buildSimpleBubble(copy.altText, [
      textNode(copy.lines[0], { size: 'md', weight: 'bold' }),
      textNode(copy.lines[1], { size: 'sm', margin: 'md' }),
      textNode(copy.lines[2], {
        size: 'sm',
        color: INTRO_THEME.muted,
        margin: 'sm',
      }),
    ]),
  ];
}

export function buildRefillExchangePreviewMessages(
  state: RefillExchangePreviewStateId,
): PreviewLineMessage[] {
  switch (state) {
    case 'join-before':
      return buildJoinBeforePreviewMessages();
    case 'activated':
      return buildActivatedPreviewMessages();
    case 'wrong-store':
      return buildWrongStorePreviewMessages();
    case 'expiring-soon':
      return buildExpiringSoonPreviewMessages();
    case 'expired':
      return buildExpiredPreviewMessages();
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function buildRefillExchangePreviewTranscript(
  state: RefillExchangePreviewStateId,
): PreviewChatItem[] {
  return [
    {
      id: `refill-exchange-${state}`,
      role: 'bot',
      messages: buildRefillExchangePreviewMessages(state),
    },
  ];
}

export function getRefillExchangePreviewMeta(state: RefillExchangePreviewStateId) {
  return {
    mode: EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
    state,
    label: REFILL_EXCHANGE_PREVIEW_STATE_LABELS[state],
    path: `/admin/line-message-preview/refill-exchange-window?state=${state}`,
    liveEnforcement: false as const,
    sendsLine: false as const,
    readsDb: false as const,
  };
}
