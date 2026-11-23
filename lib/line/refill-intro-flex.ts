import {
  REFILL_INTRO_COPY,
  REFILL_INTRO_PRODUCTS,
  REFILL_PLAN_FAQ,
  REFILL_PLAN_RULES,
} from '@/lib/jar-exchange/refill-plan-content';
import {
  listActiveRefillFlavours,
} from '@/lib/jar-exchange/refill-flavours';
import {
  buildJarDialogueBubble,
  withJarDialogueBackground,
} from '@/lib/line/jar-dialogue-shell';
import type { LineReplyMessage } from '@/lib/line/reply';

/** 介紹 Flex 品牌色（對齊官網／規格） */
const INTRO_THEME = {
  bg: '#FFF9EC',
  ink: '#153A70',
  muted: '#5B7196',
  cta: '#286DB8',
  accent: '#FFD24A',
  cream: '#FFFFFF',
  border: '#8AB9F4',
} as const;

const REFILL_INTRO_HERO_URL =
  'https://hq.furmosa.com/line/refill/intro-products.jpg';

type FlexComponent = Record<string, unknown>;


function text(
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
    color: opts?.color ?? INTRO_THEME.ink,
    margin: opts?.margin,
    align: opts?.align,
    wrap: opts?.wrap ?? true,
  };
}

function separator(margin = 'md') {
  return { type: 'separator' as const, margin, color: '#E5DCCE' };
}

function productRow(product: (typeof REFILL_INTRO_PRODUCTS)[number], index: number) {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    spacing: 'xs',
    margin: index === 0 ? undefined : 'md',
    contents: [
      {
        type: 'box' as const,
        layout: 'horizontal' as const,
        contents: [
          text(product.name, {
            size: 'sm',
            weight: 'bold',
            color: INTRO_THEME.ink,
          }),
          text(product.size, {
            size: 'xs',
            color: INTRO_THEME.muted,
            align: 'end',
            wrap: false,
          }),
        ],
      },
      text(product.description, { size: 'xs', color: INTRO_THEME.muted }),
      ...(index < REFILL_INTRO_PRODUCTS.length - 1 ? [separator('md')] : []),
    ],
  };
}

function buildIntroFlexContents() {
  const bodyContents: FlexComponent[] = [
    text(REFILL_INTRO_COPY.flexTitle, {
      size: 'xl',
      color: INTRO_THEME.ink,
      weight: 'bold',
    }),
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      margin: 'lg',
      paddingAll: '16px',
      backgroundColor: INTRO_THEME.cream,
      cornerRadius: '18px',
      borderColor: INTRO_THEME.border,
      borderWidth: '2px',
      contents: REFILL_INTRO_PRODUCTS.map(productRow),
    },
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: 'lg',
      paddingAll: '14px',
      backgroundColor: INTRO_THEME.accent,
      cornerRadius: '16px',
      contents: [
        text(REFILL_INTRO_COPY.pointsHeadline, { size: 'sm', weight: 'bold' }),
        text(REFILL_INTRO_COPY.pointsReward, { size: 'sm', weight: 'bold' }),
      ],
    },
    text(REFILL_INTRO_COPY.notes.map((note) => `・${note}`).join('\n'), {
      size: 'xxs',
      color: INTRO_THEME.muted,
      margin: 'md',
    }),
  ];

  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: REFILL_INTRO_HERO_URL,
      size: 'full',
      aspectRatio: '4:3',
      aspectMode: 'cover',
    },
    styles: {
      body: { backgroundColor: INTRO_THEME.bg },
      footer: { backgroundColor: INTRO_THEME.bg },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      paddingTop: '0px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'md',
          color: INTRO_THEME.cta,
          action: {
            type: 'message',
            label: REFILL_INTRO_COPY.ctaStart,
            text: '開始換罐',
          },
        },
      ],
    },
  };
}

/**
 * 換罐計畫 → 介紹：真實罐裝主視覺加上規則 Flex；不讀 DB。
 */
export async function buildJarIntroMessages(opts?: {
  registered?: boolean;
}): Promise<LineReplyMessage[]> {
  void opts;

  return [
    {
      type: 'flex',
      altText: REFILL_INTRO_COPY.altText,
      contents: buildIntroFlexContents(),
    },
  ];
}

/** 看本期口味：從 DB 讀取有效口味 */
export async function buildRefillFlavoursListMessages(): Promise<LineReplyMessage[]> {
  const flavours = await listActiveRefillFlavours();
  const lines = [
    REFILL_INTRO_COPY.flavourSectionTitle,
    '',
    ...flavours.map((f) => `・${f.label}`),
    '',
    REFILL_PLAN_RULES.flavourUpdateCadence + '。',
    REFILL_PLAN_RULES.stockDisclaimer + '。',
  ];
  return [
    {
      type: 'flex',
      altText: '本期換罐口味',
      contents: buildJarDialogueBubble({
        bodyContents: [
          text('本期口味', { size: 'lg', weight: 'bold' }),
          text(lines.join('\n'), { size: 'sm', margin: 'md' }),
        ],
        footerContents: [
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
        ],
      }),
    },
  ];
}

/** 常見問題：單一 Flex，不再拆散泡泡 */
export function buildJarFaqFlexMessages(): LineReplyMessage[] {
  const qaBlocks = REFILL_PLAN_FAQ.flatMap((item, idx) => {
    const blocks: Record<string, unknown>[] = [];
    if (idx > 0) blocks.push(separator('md'));
    blocks.push(
      text(`Q：${item.question}`, {
        size: 'sm',
        weight: 'bold',
        margin: idx === 0 ? undefined : 'sm',
      }),
      text(`A：${item.answer}`, {
        size: 'sm',
        color: INTRO_THEME.muted,
        margin: 'xs',
      }),
    );
    return blocks;
  });

  return [
    {
      type: 'flex',
      altText: '換罐計劃常見問題',
      contents: buildJarDialogueBubble({
        bodyContents: [
          text('常見問題', { size: 'lg', weight: 'bold' }),
          text('換罐價格、空罐規則、序號集點一次看完。', {
            size: 'xs',
            color: INTRO_THEME.muted,
            margin: 'sm',
          }),
          ...qaBlocks,
        ],
        footerContents: [
          {
            type: 'button',
            style: 'primary',
            height: 'md',
            color: INTRO_THEME.cta,
            action: {
              type: 'message',
              label: '什麼是換罐計劃？',
              text: '什麼是換罐計劃？',
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
        ],
      }),
    },
  ];
}
