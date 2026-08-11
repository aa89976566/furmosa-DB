import {
  REFILL_INTRO_COPY,
  REFILL_PLAN_FAQ,
  REFILL_PLAN_RULES,
} from '@/lib/jar-exchange/refill-plan-content';
import {
  getRefillPlanSettings,
  listActiveRefillFlavours,
} from '@/lib/jar-exchange/refill-flavours';
import {
  buildJarDialogueBubble,
} from '@/lib/line/jar-dialogue-shell';
import {
  REFILL_INTRO_THEME,
  buildRefillIntroBubblePreview,
  refillIntroText,
} from '@/lib/line/refill-intro-content';
import type { LineReplyMessage } from '@/lib/line/reply';

export {
  buildExchangeWindowHighlightBox,
  buildRefillIntroBubblePreview,
} from '@/lib/line/refill-intro-content';

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

const INTRO_THEME = REFILL_INTRO_THEME;

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
  return refillIntroText(content, opts);
}

function separator(margin = 'md') {
  return { type: 'separator' as const, margin, color: '#E5DCCE' };
}

/**
 * 換罐計劃 → 介紹：主視覺圖 + 一張完整 Flex（不再拆三則說明泡泡）
 */
export async function buildJarIntroMessages(_opts?: {
  registered?: boolean;
}): Promise<LineReplyMessage[]> {
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
      contents: buildRefillIntroBubblePreview({
        settings,
        flavours,
      }),
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
          text('換罐價錢、空瓶規則、序號集點，一次看完。', {
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
