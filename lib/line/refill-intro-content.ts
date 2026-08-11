/**
 * 換罐介紹 Flex 純內容組裝（無 Prisma／無 reply）。
 * 供 LINE 回覆與 HQ Preview 共用，避免 Preview bundle 拉進 fs。
 *
 * 加入前主卡：只服務「是否參加」決策；完整規則／口味／合作店走既有回覆。
 */

import { REFILL_INTRO_COPY } from '@/lib/jar-exchange/refill-plan-content';
import { withJarDialogueBackground } from '@/lib/line/jar-dialogue-shell';
import { REFILL_EXCHANGE_WINDOW_COPY } from '@/lib/refill/exchange-window';

/** 介紹 Flex 品牌色（對齊官網／規格） */
export const REFILL_INTRO_THEME = {
  bg: '#F8F3EA',
  ink: '#2E231D',
  muted: '#6B5E52',
  cta: '#C46A2F',
  accent: '#71836B',
  cream: '#FFFCF7',
  border: '#2E231D',
} as const;

export type RefillIntroFlexSettings = {
  firstJarPrice: number;
  exchangePrice: number;
};

export type RefillIntroFlexFlavour = {
  label: string;
};

type FlexComponent = Record<string, unknown>;

export function refillIntroText(
  content: string,
  opts?: {
    size?: string;
    weight?: string;
    color?: string;
    margin?: string;
    align?: string;
    wrap?: boolean;
  },
) {
  return {
    type: 'text' as const,
    text: content,
    size: opts?.size ?? 'sm',
    weight: opts?.weight,
    color: opts?.color ?? REFILL_INTRO_THEME.ink,
    margin: opts?.margin,
    align: opts?.align,
    wrap: opts?.wrap ?? true,
  };
}

/**
 * 加入前「換購期限」醒目區塊。
 * 「30 天內」獨立 text（較大＋粗體），不只靠顏色；wrap 防手機截字。
 * Preview badge 僅一行小字，不搶主資訊。
 */
export function buildExchangeWindowHighlightBox(): FlexComponent {
  const warmBg = '#F4E2C8';
  const warmBorder = REFILL_INTRO_THEME.cta;
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'lg',
    paddingAll: '14px',
    backgroundColor: warmBg,
    cornerRadius: '10px',
    borderColor: warmBorder,
    borderWidth: '2px',
    spacing: 'sm',
    contents: [
      refillIntroText(REFILL_EXCHANGE_WINDOW_COPY.highlightLeadBefore, {
        size: 'sm',
        color: REFILL_INTRO_THEME.ink,
        wrap: true,
      }),
      refillIntroText(REFILL_EXCHANGE_WINDOW_COPY.highlightLeadEmphasis, {
        size: 'xl',
        weight: 'bold',
        color: REFILL_INTRO_THEME.cta,
        wrap: true,
      }),
      refillIntroText(REFILL_EXCHANGE_WINDOW_COPY.highlightLeadAfter, {
        size: 'sm',
        weight: 'bold',
        color: REFILL_INTRO_THEME.ink,
        wrap: true,
      }),
      refillIntroText(REFILL_EXCHANGE_WINDOW_COPY.previewBadge, {
        size: 'xxs',
        color: REFILL_INTRO_THEME.muted,
        wrap: true,
        margin: 'sm',
      }),
    ],
  };
}

/**
 * 測試／Preview／LINE：不打 DB，組出加入前決策 bubble JSON。
 * settings／flavours 參數保留以相容呼叫端；主卡不再展開七口味清單或雙價格格。
 */
export function buildRefillIntroBubblePreview(opts: {
  settings: RefillIntroFlexSettings;
  flavours: RefillIntroFlexFlavour[];
}): Record<string, unknown> {
  void opts;
  const bodyText = REFILL_INTRO_COPY.bodyLines.join('\n');

  const bodyContents: FlexComponent[] = [
    refillIntroText(REFILL_INTRO_COPY.flexTitle, {
      size: 'xl',
      weight: 'bold',
      color: REFILL_INTRO_THEME.ink,
    }),
    refillIntroText(REFILL_INTRO_COPY.headline, {
      size: 'sm',
      color: REFILL_INTRO_THEME.muted,
      margin: 'sm',
    }),
    refillIntroText(bodyText, {
      size: 'sm',
      color: REFILL_INTRO_THEME.ink,
      margin: 'lg',
    }),
    buildExchangeWindowHighlightBox(),
    {
      type: 'button',
      style: 'primary',
      height: 'md',
      color: REFILL_INTRO_THEME.cta,
      margin: 'lg',
      action: {
        type: 'message',
        label: REFILL_INTRO_COPY.ctaJoinLabel,
        text: REFILL_INTRO_COPY.ctaJoinMessage,
      },
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'md',
      color: REFILL_INTRO_THEME.cream,
      action: {
        type: 'message',
        label: REFILL_INTRO_COPY.ctaFlavoursLabel,
        text: REFILL_INTRO_COPY.ctaFlavoursMessage,
      },
    },
    {
      type: 'button',
      style: 'link',
      height: 'sm',
      action: {
        type: 'message',
        label: REFILL_INTRO_COPY.ctaRulesLabel,
        text: REFILL_INTRO_COPY.ctaRulesMessage,
      },
    },
  ];

  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: REFILL_INTRO_THEME.bg },
    },
    body: withJarDialogueBackground(bodyContents),
  };
}
