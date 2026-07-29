import {
  REFILL_INTRO_COPY,
  REFILL_INTRO_STEPS,
  REFILL_PLAN_FAQ,
  REFILL_PLAN_RULES,
} from '@/lib/jar-exchange/refill-plan-content';
import {
  getRefillPlanSettings,
  listActiveRefillFlavours,
  type RefillFlavourView,
  type RefillPlanSettingsView,
} from '@/lib/jar-exchange/refill-flavours';
import type { LineReplyMessage } from '@/lib/line/reply';

/** 與 flex-hubs.lineAssetUrl 相同策略，避免循環依賴 */
function publicAssetUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || '';
  const looksEphemeral =
    /vercel\.app$/i.test(configured) &&
    !/^https:\/\/furmosa-db\.vercel\.app\/?$/i.test(configured);
  const base =
    configured && !looksEphemeral
      ? configured
      : 'https://furmosa-db.vercel.app';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${clean}`;
}

/** 介紹 Flex 品牌色（對齊官網／規格） */
const INTRO_THEME = {
  bg: '#F8F3EA',
  ink: '#2E231D',
  muted: '#6B5E52',
  cta: '#C46A2F',
  accent: '#71836B',
  cream: '#FFFCF7',
  border: '#2E231D',
} as const;

/** 乳牛斑對話框底圖（絕對定位鋪底；LINE box 不支援 background-image） */
const COW_PRINT_BG_PATH = '/images/refill-plan/cow-print-bg.jpg';

type FlexComponent = Record<string, unknown>;

/**
 * 把內容包在乳牛斑背景上。
 * LINE 限制：區塊第一個子元件不能是 absolute，所以先放 filler。
 */
function withCowPrintBackground(
  innerContents: FlexComponent[],
  opts?: { paddingAll?: string; spacing?: string },
): FlexComponent {
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '0px',
    backgroundColor: INTRO_THEME.bg,
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'filler' },
          {
            type: 'image',
            url: publicAssetUrl(COW_PRINT_BG_PATH),
            size: 'full',
            aspectMode: 'cover',
            aspectRatio: '4:7',
            position: 'absolute',
            offsetTop: '0px',
            offsetBottom: '0px',
            offsetStart: '0px',
            offsetEnd: '0px',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: opts?.spacing ?? 'md',
            paddingAll: opts?.paddingAll ?? '18px',
            contents: innerContents,
          },
        ],
      },
    ],
  };
}

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

function priceCell(label: string, price: number) {
  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    flex: 1,
    spacing: 'xs',
    paddingAll: '12px',
    backgroundColor: INTRO_THEME.cream,
    cornerRadius: '8px',
    borderColor: INTRO_THEME.border,
    borderWidth: '1px',
    contents: [
      text(label, { size: 'xs', color: INTRO_THEME.muted }),
      text(`NT$${price}`, {
        size: 'xl',
        weight: 'bold',
        color: INTRO_THEME.cta,
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
    backgroundColor: INTRO_THEME.cream,
    cornerRadius: '999px',
    borderColor: INTRO_THEME.accent,
    borderWidth: '1px',
    contents: [text(label, { size: 'xxs', color: INTRO_THEME.accent, wrap: false })],
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
          text(step.no, {
            size: 'sm',
            weight: 'bold',
            color: INTRO_THEME.accent,
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
          text(step.title, { size: 'sm', weight: 'bold' }),
          text(step.body, { size: 'xs', color: INTRO_THEME.muted }),
        ],
      },
    ],
  };
}

function buildIntroFlexContents(opts: {
  settings: RefillPlanSettingsView;
  flavours: RefillFlavourView[];
  registered: boolean;
}) {
  const { settings, flavours, registered } = opts;
  const bodyText = REFILL_INTRO_COPY.bodyLines.join('\n');
  const flavourLines = flavours.map((f) => `・${f.label}`);
  const startAction = registered
    ? {
        type: 'message' as const,
        label: REFILL_INTRO_COPY.ctaStart,
        text: '兌換序號',
      }
    : {
        type: 'message' as const,
        label: REFILL_INTRO_COPY.ctaStart,
        text: '立即開戶',
      };

  const bodyContents: FlexComponent[] = [
    text(REFILL_INTRO_COPY.flexTitle, {
      size: 'xs',
      color: INTRO_THEME.accent,
      weight: 'bold',
    }),
    text(REFILL_INTRO_COPY.headline, {
      size: 'xl',
      weight: 'bold',
      margin: 'sm',
    }),
    text(bodyText, { size: 'sm', color: INTRO_THEME.ink, margin: 'md' }),
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
    text('怎麼參加', {
      size: 'md',
      weight: 'bold',
      margin: 'md',
    }),
    ...REFILL_INTRO_STEPS.map((s) => stepRow(s)),
    separator('lg'),
    text(REFILL_INTRO_COPY.flavourSectionTitle, {
      size: 'md',
      weight: 'bold',
      margin: 'md',
    }),
    text(REFILL_INTRO_COPY.flavourSectionLead.join('\n'), {
      size: 'xs',
      color: INTRO_THEME.muted,
      margin: 'sm',
    }),
    text(flavourLines.join('\n') || '本期口味準備中', {
      size: 'sm',
      margin: 'md',
    }),
    text(REFILL_PLAN_RULES.stockDisclaimer, {
      size: 'xxs',
      color: INTRO_THEME.muted,
      margin: 'sm',
    }),
    // CTA 併入 body，讓乳牛斑背景連到對話框底部（避免 footer 色塊斷開）
    separator('lg'),
    {
      type: 'button',
      style: 'primary',
      height: 'md',
      color: INTRO_THEME.cta,
      margin: 'md',
      action: startAction,
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'md',
      color: INTRO_THEME.cream,
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
        text: '配合店家',
      },
    },
  ];

  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: INTRO_THEME.bg },
    },
    body: withCowPrintBackground(bodyContents),
  };
}

/**
 * 換罐計劃 → 介紹：主視覺圖 + 一張完整 Flex（不再拆三則說明泡泡）
 */
export async function buildJarIntroMessages(opts?: {
  registered?: boolean;
}): Promise<LineReplyMessage[]> {
  const registered = opts?.registered ?? false;
  const [settings, flavours] = await Promise.all([
    getRefillPlanSettings(),
    listActiveRefillFlavours(),
  ]);
  const heroPath = settings.heroImageUrl.startsWith('/')
    ? settings.heroImageUrl
    : `/${settings.heroImageUrl}`;
  const cover = publicAssetUrl(heroPath);

  return [
    {
      type: 'image',
      originalContentUrl: cover,
      previewImageUrl: cover,
    },
    {
      type: 'flex',
      altText: REFILL_PLAN_RULES.heroAlt,
      contents: buildIntroFlexContents({ settings, flavours, registered }),
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
      contents: {
        type: 'bubble',
        size: 'mega',
        styles: { body: { backgroundColor: INTRO_THEME.bg } },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '18px',
          backgroundColor: INTRO_THEME.bg,
          contents: [
            text('本期口味', { size: 'lg', weight: 'bold' }),
            text(lines.join('\n'), { size: 'sm', margin: 'md' }),
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '12px',
          backgroundColor: INTRO_THEME.bg,
          contents: [
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: {
                type: 'message',
                label: REFILL_INTRO_COPY.ctaStores,
                text: '配合店家',
              },
            },
          ],
        },
      },
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
      contents: {
        type: 'bubble',
        size: 'mega',
        styles: {
          body: { backgroundColor: INTRO_THEME.bg },
          footer: { backgroundColor: INTRO_THEME.bg },
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '18px',
          backgroundColor: INTRO_THEME.bg,
          contents: [
            text('常見問題', { size: 'lg', weight: 'bold' }),
            text('換罐價格、空罐規則、序號集點一次看完。', {
              size: 'xs',
              color: INTRO_THEME.muted,
              margin: 'sm',
            }),
            ...qaBlocks,
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '12px',
          backgroundColor: INTRO_THEME.bg,
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'md',
              color: INTRO_THEME.cta,
              action: {
                type: 'message',
                label: '介紹',
                text: '介紹',
              },
            },
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: {
                type: 'message',
                label: REFILL_INTRO_COPY.ctaStores,
                text: '配合店家',
              },
            },
          ],
        },
      },
    },
  ];
}
