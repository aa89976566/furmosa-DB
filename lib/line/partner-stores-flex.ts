/**
 * 合作店家：故事性 Flex（不是清單儀表板）。
 * 多店時用 carousel 分區，每卡一個區域故事＋店名。
 */
import { formatLineStorePickerLabel } from '@/lib/coupons/constants';
import type { PartnerStoreView } from '@/lib/stores/partner-stores';
import { inferPartnerStoreRegion } from '@/lib/stores/partner-store-visibility';
import {
  buildJarDialogueBubble,
  withJarDialogueBackground,
} from '@/lib/line/jar-dialogue-shell';
import type { LineReplyMessage } from '@/lib/line/reply';

const THEME = {
  bg: '#F8F3EA',
  ink: '#2E231D',
  muted: '#6B5E52',
  accent: '#C46A2F',
  cream: '#FFFCF7',
  soft: '#EEF6F1',
} as const;

const REGION_ORDER = ['新北據點', '台北據點', '北桃竹據點', '中南部據點', '其他據點'] as const;

const REGION_BEAT: Record<string, string> = {
  新北據點: '下班順路、週末帶毛孩走走，很多據點都在這一帶。',
  台北據點: '市區裡也有願意幫你收空罐、換新口味的店。',
  北桃竹據點: '北北桃竹若你家附近有點名，開戶時選它就對了。',
  中南部據點: '換罐不限北部，毛孩走到哪，空罐也能回來。',
  其他據點: '以下是目前加入換罐計劃的合作美容店。',
};

function text(
  value: string,
  opts?: { size?: string; weight?: string; color?: string; margin?: string },
) {
  return {
    type: 'text' as const,
    text: value,
    wrap: true,
    size: opts?.size ?? 'sm',
    weight: opts?.weight,
    color: opts?.color ?? THEME.ink,
    margin: opts?.margin,
  };
}

function storeRow(name: string) {
  return {
    type: 'box' as const,
    layout: 'horizontal' as const,
    spacing: 'sm',
    contents: [
      {
        type: 'text' as const,
        text: '·',
        size: 'sm',
        color: THEME.accent,
        flex: 0,
      },
      {
        type: 'text' as const,
        text: name,
        size: 'sm',
        color: THEME.ink,
        wrap: true,
        flex: 1,
      },
    ],
  };
}

function introBubble(storeCount: number): Record<string, unknown> {
  return buildJarDialogueBubble({
    bodyContents: [
      text('合作美容店', { size: 'lg', weight: 'bold' }),
      text('空罐回來的地方。', {
        size: 'md',
        weight: 'bold',
        color: THEME.accent,
        margin: 'sm',
      }),
      text(
        `目前有 ${storeCount} 間店願意當換罐據點。\n開戶時選一間你常去的，之後折價券會綁那間用喔。`,
        { color: THEME.muted, margin: 'md' },
      ),
      text('往右滑，依區域看看哪裡離家近～', {
        size: 'xs',
        color: THEME.muted,
        margin: 'md',
      }),
    ],
    footerContents: [
      {
        type: 'button',
        style: 'primary',
        height: 'sm',
        color: THEME.accent,
        action: {
          type: 'message',
          label: '幫毛孩開戶',
          text: '幫毛孩開戶',
        },
      },
    ],
  });
}

function regionBubble(
  region: string,
  stores: PartnerStoreView[],
): Record<string, unknown> {
  const labels = stores.map((s) => formatLineStorePickerLabel(s.name, s.slug));
  // LINE bubble 內容勿過長；單區最多列 8 間
  const shown = labels.slice(0, 8);
  const more = labels.length - shown.length;

  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: THEME.bg },
    },
    body: withJarDialogueBackground([
      text(region, { size: 'md', weight: 'bold' }),
      text(REGION_BEAT[region] ?? REGION_BEAT['其他據點']!, {
        size: 'xs',
        color: THEME.muted,
        margin: 'sm',
      }),
      {
        type: 'separator',
        margin: 'md',
        color: '#E5D9C8',
      },
      {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        margin: 'md',
        contents: shown.map((n) => storeRow(n)),
      },
      ...(more > 0
        ? [
            text(`還有 ${more} 間，開戶選店時會一次看到喔。`, {
              size: 'xs',
              color: THEME.muted,
              margin: 'md',
            }),
          ]
        : []),
    ], { spacing: 'sm' }),
  };
}

/**
 * 合作店清單訊息：開頭故事卡＋分區 carousel。
 * 店很少時仍給故事卡＋一張總覽，避免變冷冰冰 bullet list。
 */
export function buildPartnerStoresMessages(
  stores: PartnerStoreView[],
): LineReplyMessage[] {
  if (stores.length === 0) {
    return [
      {
        type: 'text',
        text: '合作店名單這陣子在整理，晚點再來晃一下，或直接跟我們說你家附近～',
      },
    ];
  }

  const byRegion = new Map<string, PartnerStoreView[]>();
  for (const s of stores) {
    const region = inferPartnerStoreRegion(s.name);
    const list = byRegion.get(region) ?? [];
    list.push(s);
    byRegion.set(region, list);
  }

  const regionBubbles = REGION_ORDER.filter((r) => byRegion.has(r)).map((r) =>
    regionBubble(r, byRegion.get(r)!),
  );

  // carousel 上限 12；保留 1 給 intro
  const maxRegion = 11;
  const bubbles = [introBubble(stores.length), ...regionBubbles.slice(0, maxRegion)];

  return [
    {
      type: 'flex',
      altText: `合作美容店（${stores.length} 間）`,
      contents: {
        type: 'carousel',
        contents: bubbles,
      },
    },
  ];
}
