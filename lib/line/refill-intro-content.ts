/**
 * 換罐介紹 Flex 純內容組裝（無 Prisma／無 reply）。
 * 供 LINE 回覆與 HQ Preview 共用，避免 Preview bundle 拉進 fs。
 */

import {
  REFILL_INTRO_COPY,
  REFILL_INTRO_STEPS,
  REFILL_PLAN_RULES,
} from '@/lib/jar-exchange/refill-plan-content';
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

function separator(margin = 'md') {
  return { type: 'separator' as const, margin, color: '#E5DCCE' };
}

function priceCell(label: string, price: number) {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    flex: 1,
    spacing: 'xs',
    paddingAll: '12px',
    backgroundColor: REFILL_INTRO_THEME.cream,
    cornerRadius: '8px',
    borderColor: REFILL_INTRO_THEME.border,
    borderWidth: '1px',
    contents: [
      refillIntroText(label, { size: 'xs', color: REFILL_INTRO_THEME.muted }),
      refillIntroText(`NT$${price}`, {
        size: 'xl',
        weight: 'bold',
        color: REFILL_INTRO_THEME.cta,
        margin: 'xs',
      }),
    ],
  };
}

function tagChip(label: string) {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    paddingAll: '6px',
    paddingStart: '10px',
    paddingEnd: '10px',
    backgroundColor: REFILL_INTRO_THEME.cream,
    cornerRadius: '999px',
    borderColor: REFILL_INTRO_THEME.accent,
    borderWidth: '1px',
    contents: [
      refillIntroText(label, {
        size: 'xxs',
        color: REFILL_INTRO_THEME.accent,
        wrap: false,
      }),
    ],
  };
}

function stepRow(step: { no: string; title: string; body: string }) {
  return {
    type: 'box' as const,
    layout: 'horizontal' as const,
    spacing: 'md',
    margin: 'md',
    contents: [
      {
        type: 'box' as const,
        layout: 'vertical' as const,
        width: '36px',
        contents: [
          refillIntroText(step.no, {
            size: 'sm',
            weight: 'bold',
            color: REFILL_INTRO_THEME.accent,
            align: 'center',
          }),
        ],
      },
      {
        type: 'box' as const,
        layout: 'vertical' as const,
        flex: 1,
        spacing: 'xs',
        contents: [
          refillIntroText(step.title, { size: 'sm', weight: 'bold' }),
          refillIntroText(step.body, {
            size: 'xs',
            color: REFILL_INTRO_THEME.muted,
          }),
        ],
      },
    ],
  };
}

/**
 * 加入前「換購期限」醒目區塊。
 * 「30 天內」獨立 text（較大＋粗體），不只靠顏色；wrap 防手機截字。
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
      refillIntroText(REFILL_EXCHANGE_WINDOW_COPY.highlightTitle, {
        size: 'md',
        weight: 'bold',
        color: REFILL_INTRO_THEME.ink,
      }),
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
        color: REFILL_INTRO_THEME.ink,
        wrap: true,
      }),
      refillIntroText(REFILL_EXCHANGE_WINDOW_COPY.highlightNote, {
        size: 'xs',
        color: REFILL_INTRO_THEME.muted,
        wrap: true,
        margin: 'sm',
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

/** 測試／Preview／LINE：不打 DB，組出介紹 bubble JSON */
export function buildRefillIntroBubblePreview(opts: {
  settings: RefillIntroFlexSettings;
  flavours: RefillIntroFlexFlavour[];
}): Record<string, unknown> {
  const { settings, flavours } = opts;
  const bodyText = REFILL_INTRO_COPY.bodyLines.join('\n');
  const flavourLines = flavours.map((f) => `・${f.label}`);
  const startAction = {
    type: 'message' as const,
    label: REFILL_INTRO_COPY.ctaStart,
    text: '開始換罐',
  };

  const bodyContents: FlexComponent[] = [
    refillIntroText(REFILL_INTRO_COPY.flexTitle, {
      size: 'xs',
      color: REFILL_INTRO_THEME.accent,
      weight: 'bold',
    }),
    refillIntroText(REFILL_INTRO_COPY.headline, {
      size: 'xl',
      weight: 'bold',
      margin: 'sm',
    }),
    refillIntroText(bodyText, {
      size: 'sm',
      color: REFILL_INTRO_THEME.ink,
      margin: 'md',
    }),
    buildExchangeWindowHighlightBox(),
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'lg',
      contents: REFILL_INTRO_COPY.tags.map((t) => tagChip(t)),
    },
    separator('lg'),
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      margin: 'lg',
      contents: [
        priceCell('第一罐', settings.firstJarPrice),
        priceCell('帶空罐換新罐', settings.exchangePrice),
      ],
    },
    separator('lg'),
    refillIntroText('怎麼參加', {
      size: 'md',
      weight: 'bold',
      margin: 'md',
    }),
    ...REFILL_INTRO_STEPS.map((s) => stepRow(s)),
    separator('lg'),
    refillIntroText(REFILL_INTRO_COPY.flavourSectionTitle, {
      size: 'md',
      weight: 'bold',
      margin: 'md',
    }),
    refillIntroText(REFILL_INTRO_COPY.flavourSectionLead.join('\n'), {
      size: 'xs',
      color: REFILL_INTRO_THEME.muted,
      margin: 'sm',
    }),
    refillIntroText(flavourLines.join('\n') || '本期口味準備中', {
      size: 'sm',
      margin: 'md',
    }),
    refillIntroText(REFILL_PLAN_RULES.stockDisclaimer, {
      size: 'xxs',
      color: REFILL_INTRO_THEME.muted,
      margin: 'sm',
    }),
    separator('lg'),
    {
      type: 'button',
      style: 'primary',
      height: 'md',
      color: REFILL_INTRO_THEME.cta,
      margin: 'md',
      action: startAction,
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'md',
      color: REFILL_INTRO_THEME.cream,
      action: {
        type: 'message',
        label: REFILL_INTRO_COPY.ctaFlavours,
        text: '看本期口味',
      },
    },
    {
      type: 'button',
      style: 'link',
      height: 'sm',
      action: {
        type: 'message',
        label: REFILL_INTRO_COPY.ctaStores,
        text: '查看合作店',
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
