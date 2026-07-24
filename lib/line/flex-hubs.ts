import { FURMOSA_BRAND_LINKS } from '@/lib/line/brand-links';
import {
  CHAOS_INTRO,
  CHAOS_ITEMS,
  JAR_ENTER_BLOCKED_GUEST,
  JAR_ENTER_HINT_REGISTERED,
  WORLD_HUB_EMOJI,
  WORLD_HUB_LABELS,
  WORLD_HUB_TAGLINE,
  WILD_INTRO,
  buildJarHubItems,
  buildWildItems,
  type WorldHubId,
  type WorldMenuItem,
} from '@/lib/line/brand-worlds';
import { BRAND_SURFACE, WORLD_THEME, type WorldTheme } from '@/lib/line/card-theme';
import { LINE_BTN } from '@/lib/line/line-copy';
import type { LineReplyMessage } from '@/lib/line/reply';

/** Flex 卡片圖：部署後的公開網址 */
export function lineAssetUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://furmosa-db.vercel.app';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${clean}`;
}

function cardHeroUrl(heroKey: string): string {
  return lineAssetUrl(`/line/cards/${heroKey}.png`);
}

type CardAction =
  | { type: 'postback'; data: string; displayText?: string }
  | { type: 'uri'; uri: string }
  | { type: 'message'; text: string };

/**
 * 單張可點卡片（整卡一個 CTA，非灰底按鈕列）
 * 視覺：白底、留白、手繪 hero、圓角。
 */
export function buildActionCard(opts: {
  theme: WorldTheme;
  mark: string;
  title: string;
  subtitle: string;
  heroKey: string;
  action: CardAction;
  ctaLabel?: string;
  emphasized?: boolean;
}): Record<string, unknown> {
  const { theme } = opts;
  const action =
    opts.action.type === 'postback'
      ? {
          type: 'postback' as const,
          data: opts.action.data,
          displayText: opts.action.displayText ?? opts.title,
        }
      : opts.action.type === 'uri'
        ? { type: 'uri' as const, uri: opts.action.uri }
        : { type: 'message' as const, text: opts.action.text };

  return {
    type: 'bubble',
    size: 'mega',
    action,
    styles: {
      body: { backgroundColor: theme.card },
    },
    hero: {
      type: 'image',
      url: cardHeroUrl(opts.heroKey),
      size: 'full',
      aspectRatio: '20:10',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      backgroundColor: theme.card,
      contents: [
        {
          type: 'text',
          text: `${opts.mark}  ${opts.title}`,
          weight: 'bold',
          size: 'xl',
          color: theme.ink,
          wrap: true,
        },
        {
          type: 'text',
          text: opts.subtitle,
          size: 'sm',
          color: theme.muted,
          wrap: true,
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'lg',
          contents: [
            {
              type: 'text',
              text: opts.ctaLabel ?? '打開',
              size: 'sm',
              color: theme.accent,
              weight: 'bold',
              flex: 0,
            },
            {
              type: 'text',
              text: '→',
              size: 'lg',
              color: theme.accent,
              align: 'end',
            },
          ],
        },
      ],
    },
  };
}

function carouselFlex(altText: string, bubbles: Record<string, unknown>[]): LineReplyMessage {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: bubbles.slice(0, 12),
    },
  };
}

function itemToCard(
  item: WorldMenuItem,
  theme: WorldTheme,
  opts?: { primaryId?: string; ctaLabel?: string },
): Record<string, unknown> {
  const action: CardAction = item.uri
    ? { type: 'uri', uri: item.uri }
    : { type: 'postback', data: `jd=${item.id}`, displayText: item.label };
  return buildActionCard({
    theme,
    mark: item.mark,
    title: item.label,
    subtitle: item.subtitle,
    heroKey: item.heroKey,
    action,
    ctaLabel: opts?.primaryId === item.id ? '開始' : opts?.ctaLabel ?? '打開',
    emphasized: opts?.primaryId === item.id,
  });
}

/** 聊天內備援：三張世界大卡 carousel */
export function buildThreeWorldsMenuMessages(opts?: { body?: string }): LineReplyMessage[] {
  const intro = opts?.body ?? '三個入口。點一張卡進去。';
  const worlds: Array<{ id: WorldHubId; heroKey: string }> = [
    { id: 'jar', heroKey: 'world-jar' },
    { id: 'chaos', heroKey: 'world-chaos' },
    { id: 'wild', heroKey: 'world-wild' },
  ];
  const bubbles = worlds.map((w) =>
    buildActionCard({
      theme: WORLD_THEME[w.id],
      mark: WORLD_HUB_EMOJI[w.id],
      title: WORLD_HUB_LABELS[w.id],
      subtitle: WORLD_HUB_TAGLINE[w.id],
      heroKey: w.heroKey,
      action: { type: 'postback', data: `jd=hub_${w.id}`, displayText: WORLD_HUB_LABELS[w.id] },
      ctaLabel: '進入',
    }),
  );
  return [{ type: 'text', text: intro }, carouselFlex('匠寵三世界', bubbles)];
}

export function buildWorldHubMessages(
  hub: WorldHubId,
  opts?: { registered?: boolean; body?: string },
): LineReplyMessage[] {
  const registered = opts?.registered ?? false;
  const theme = WORLD_THEME[hub];
  const title = `${WORLD_HUB_EMOJI[hub]} ${WORLD_HUB_LABELS[hub]}`;

  if (hub === 'jar') {
    const hubCfg = buildJarHubItems(registered);
    const bubbles = hubCfg.items.map((item) =>
      itemToCard(item, theme, { primaryId: hubCfg.primaryId }),
    );
    return [
      { type: 'text', text: opts?.body ?? `${title}\n${hubCfg.body}` },
      carouselFlex(WORLD_HUB_LABELS.jar, bubbles),
    ];
  }

  if (hub === 'chaos') {
    const bubbles = CHAOS_ITEMS.map((item) => itemToCard(item, theme, { ctaLabel: '看這張' }));
    return [
      { type: 'text', text: opts?.body ?? `${title}\n${CHAOS_INTRO}` },
      carouselFlex(WORLD_HUB_LABELS.chaos, bubbles),
    ];
  }

  const links = FURMOSA_BRAND_LINKS;
  const wild = buildWildItems().map((item) => {
    if (item.id === 'wild_web') return { ...item, uri: links.website() };
    if (item.id === 'wild_ig') return { ...item, uri: links.instagram() };
    if (item.id === 'wild_threads') return { ...item, uri: links.threads() };
    if (item.id === 'wild_fb') return { ...item, uri: links.facebook() };
    if (item.id === 'wild_news') return { ...item, uri: links.news() };
    return item;
  });
  const bubbles = wild.map((item) => itemToCard(item, theme, { ctaLabel: '前往' }));
  return [
    { type: 'text', text: opts?.body ?? `${title}\n${WILD_INTRO}` },
    carouselFlex(WORLD_HUB_LABELS.wild, bubbles),
  ];
}

/** 未開戶擋序號：單一大卡＋唯一 CTA */
export function buildRegisterGateMessages(
  text: string = JAR_ENTER_BLOCKED_GUEST,
): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  const card = buildActionCard({
    theme,
    mark: '🐾',
    title: '先幫毛孩開戶',
    subtitle: text.replace(/\n/g, ' '),
    heroKey: 'gate',
    action: {
      type: 'postback',
      data: 'jd=jar_reg&next=enter',
      displayText: LINE_BTN.registerNow,
    },
    ctaLabel: LINE_BTN.registerNow,
    emphasized: true,
  });
  return [carouselFlex('先幫毛孩開戶', [card])];
}

/** 什麼是換罐：四張說明卡 */
export function buildJarExplainMessages(): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  const sections: WorldMenuItem[] = [
    {
      id: 'jar_explain_intro',
      mark: '♻️',
      label: '介紹',
      subtitle: '空罐為什麼值得記一筆。',
      heroKey: 'jar-explain',
    },
    {
      id: 'jar_explain_flow',
      mark: '🔁',
      label: '流程',
      subtitle: '開戶 → 傳碼 → 進罐庫。',
      heroKey: 'jar-enter',
    },
    {
      id: 'jar_stores',
      mark: '🏪',
      label: '合作店家',
      subtitle: '折價綁哪間店。',
      heroKey: 'jar-stores',
    },
    {
      id: 'jar_faq',
      mark: '❓',
      label: '常見問題',
      subtitle: '卡關時翻這頁。',
      heroKey: 'jar-faq',
    },
  ];
  const bubbles = sections.map((item) => itemToCard(item, theme, { ctaLabel: '閱讀' }));
  return [
    { type: 'text', text: '♻️ 什麼是換罐\n挑一張卡看。' },
    carouselFlex('什麼是換罐', bubbles),
  ];
}

export function buildEnterCodePromptMessages(): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  const card = buildActionCard({
    theme,
    mark: '🔢',
    title: '輸入序號',
    subtitle: JAR_ENTER_HINT_REGISTERED.replace(/\n/g, ' '),
    heroKey: 'jar-enter',
    action: { type: 'message', text: '毛孩罐庫' },
    ctaLabel: '傳 8 碼即可',
  });
  return [
    { type: 'text', text: JAR_ENTER_HINT_REGISTERED },
    carouselFlex('輸入序號', [card]),
  ];
}

/** 存罐成功慶祝卡 */
export function buildJarSuccessFlex(opts: {
  code: string;
  pointsEarned: number;
  pointsBalance: number;
  jarsDeposited: number;
  progressLine: string;
}): LineReplyMessage {
  const theme = WORLD_THEME.jar;
  return {
    type: 'flex',
    altText: `存罐成功 +${opts.pointsEarned}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: { body: { backgroundColor: theme.card } },
      hero: {
        type: 'image',
        url: cardHeroUrl('jar-vault'),
        size: 'full',
        aspectRatio: '20:10',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '罐進去了 ✨',
            weight: 'bold',
            size: 'xl',
            color: theme.accent,
          },
          {
            type: 'text',
            text: `序號 ${opts.code}  →  +${opts.pointsEarned}`,
            size: 'sm',
            color: theme.ink,
            wrap: true,
          },
          {
            type: 'separator',
            margin: 'md',
            color: theme.rule,
          },
          {
            type: 'text',
            text: `罐庫 ${opts.pointsBalance} 點　累積 ${opts.jarsDeposited} 罐`,
            size: 'sm',
            color: theme.ink,
            wrap: true,
            margin: 'md',
          },
          {
            type: 'text',
            text: opts.progressLine,
            size: 'xs',
            color: theme.muted,
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        backgroundColor: theme.soft,
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            action: {
              type: 'postback',
              data: 'jd=jar_vault',
              displayText: '毛孩罐庫',
            },
            contents: [
              {
                type: 'text',
                text: '🦴 毛孩罐庫',
                weight: 'bold',
                color: theme.accent,
                size: 'md',
              },
              { type: 'text', text: '→', align: 'end', color: theme.accent },
            ],
          },
        ],
      },
    },
  };
}

/** @deprecated 舊灰底泡泡；保留給少數相容路徑 */
export function hubBubble(opts: {
  title: string;
  body: string;
  buttons: unknown[];
  altText: string;
}): LineReplyMessage {
  return {
    type: 'flex',
    altText: opts.altText,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: opts.title, weight: 'bold', wrap: true },
          { type: 'text', text: opts.body, size: 'sm', wrap: true, color: BRAND_SURFACE.muted },
        ],
      },
    },
  };
}
