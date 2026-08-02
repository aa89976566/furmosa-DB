import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FURMOSA_BRAND_LINKS } from '@/lib/line/brand-links';
import {
  CHAOS_DIALOGUE,
  CHAOS_ITEMS,
  JAR_ENTER_BLOCKED_GUEST,
  JAR_ENTER_HINT_REGISTERED,
  JAR_FLOW_STORY,
  WILD_INTRO,
  WORLD_HUB_LABELS,
  WORLD_HUB_TAGLINE,
  buildHomeItems,
  buildJarHubItems,
  type WorldHubId,
  type WorldMenuItem,
} from '@/lib/line/brand-worlds';
import {
  BRAND_SURFACE,
  GROOMING_THEME,
  WORLD_THEME,
  type WorldTheme,
} from '@/lib/line/card-theme';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
import { LINE_BTN } from '@/lib/line/line-copy';
import type { LineReplyMessage } from '@/lib/line/reply';

/**
 * Flex／LINE 圖片用的公開網址。
 * 避免用短期 Preview deployment host（LINE 抓圖會失敗 → 整段 reply 被拒 → 使用者無反應）。
 */
export function lineAssetUrl(path: string): string {
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

export function cardHeroUrl(heroKey: string): string {
  return lineAssetUrl(`/line/cards/${heroKey}.png`);
}

/** 活動中心／沒梗了：優先輪播 cover，其次活動海報 */
export function eventsCoverUrl(): string {
  const card = join(process.cwd(), 'public/line/cards/chaos-events.png');
  if (existsSync(card)) return cardHeroUrl('chaos-events');
  const poster = join(process.cwd(), 'public/line/events/poster.jpg');
  if (existsSync(poster)) return lineAssetUrl('/line/events/poster.jpg');
  return cardHeroUrl('chaos-events');
}

/** @deprecated 改用 eventsCoverUrl */
export function eventsPosterUrl(): string | null {
  const abs = join(process.cwd(), 'public/line/events/poster.jpg');
  if (!existsSync(abs)) return null;
  return lineAssetUrl('/line/events/poster.jpg');
}

/** 點按鈕後：舊輪播 cover → 圖片，再接對話氣泡（LINE 單次回覆最多 5 則） */
export function buildCoverDialogueMessages(opts: {
  coverUrl: string;
  lines: string[];
  trailing?: LineReplyMessage[];
}): LineReplyMessage[] {
  const texts = opts.lines
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((text): LineReplyMessage => ({ type: 'text', text }));
  const trailing = opts.trailing ?? [];
  // image + ≤3 text + trailing，總數壓在 5
  const room = Math.max(0, 4 - texts.length);
  return [
    {
      type: 'image',
      originalContentUrl: opts.coverUrl,
      previewImageUrl: opts.coverUrl,
    },
    ...texts,
    ...trailing.slice(0, room),
  ];
}

/** 嗷嗚計劃 → 青蛙誰在怕：輪播 cover＋對話（有網址再附進入按鈕） */
export function buildFrogProjectMessages(opts?: {
  registered?: boolean;
  includeHub?: boolean;
}): LineReplyMessage[] {
  const frogUrl = FURMOSA_BRAND_LINKS.frogProject();
  const trailing: LineReplyMessage[] = [];
  if (frogUrl) {
    trailing.push(
      buildButtonMenuFlex({
        altText: '青蛙誰在怕',
        theme: WORLD_THEME.chaos,
        title: '青蛙誰在怕',
        subtitle: '專案在外面，點進去看。',
        items: [
          {
            label: '進入青蛙誰在怕',
            action: { type: 'uri', uri: frogUrl },
            style: 'primary',
          },
        ],
      }),
    );
  }
  return buildCoverDialogueMessages({
    coverUrl: cardHeroUrl('chaos-frog'),
    lines: CHAOS_DIALOGUE.chaos_frog,
    trailing,
  });
}

/** 活動中心 → 沒梗了：輪播 cover＋對話 */
export function buildEventsCenterMessages(opts?: {
  registered?: boolean;
  includeHub?: boolean;
}): LineReplyMessage[] {
  return buildCoverDialogueMessages({
    coverUrl: eventsCoverUrl(),
    lines: CHAOS_DIALOGUE.chaos_events,
  });
}

/** 換罐流程：無圖故事卡（八幕循環） */
export function buildJarFlowStoryMessages(): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  const stepBoxes = JAR_FLOW_STORY.steps.map((step, idx) => ({
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: idx === 0 ? 'lg' : 'md',
    contents: [
      {
        type: 'text',
        text: step.act,
        weight: 'bold',
        size: 'sm',
        color: theme.accent,
        wrap: true,
      },
      {
        type: 'text',
        text: step.beat,
        size: 'sm',
        color: theme.ink,
        wrap: true,
      },
    ],
  }));

  return [
    {
      type: 'flex',
      altText: `${JAR_FLOW_STORY.title}：${JAR_FLOW_STORY.subtitle}`,
      contents: {
        type: 'bubble',
        size: 'mega',
        styles: {
          body: { backgroundColor: theme.card },
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '18px',
          backgroundColor: theme.card,
          contents: [
            {
              type: 'text',
              text: JAR_FLOW_STORY.title,
              weight: 'bold',
              size: 'lg',
              color: theme.ink,
              wrap: true,
            },
            {
              type: 'text',
              text: JAR_FLOW_STORY.subtitle,
              size: 'sm',
              color: theme.muted,
              wrap: true,
              margin: 'sm',
            },
            {
              type: 'separator',
              margin: 'md',
              color: theme.rule,
            },
            ...stepBoxes,
          ],
        },
      },
    },
  ];
}

/** 換罐說明子項：介紹＝主視覺＋完整 Flex；流程＝故事卡；FAQ＝規則 Q&A */
export async function buildJarExplainTopicMessages(
  topic: 'intro' | 'flow' | 'faq',
  opts?: { registered?: boolean },
): Promise<LineReplyMessage[]> {
  if (topic === 'flow') {
    return buildJarFlowStoryMessages();
  }
  // 動態 import 避免 flex-hubs ↔ refill-intro 循環；熱路徑由 handle-event 直接 import
  if (topic === 'faq') {
    const { buildJarFaqFlexMessages } = await import('@/lib/line/refill-intro-flex');
    return buildJarFaqFlexMessages();
  }
  const { buildJarIntroMessages } = await import('@/lib/line/refill-intro-flex');
  return buildJarIntroMessages({ registered: opts?.registered });
}

type CardAction =
  | { type: 'postback'; data: string; displayText?: string }
  | { type: 'uri'; uri: string }
  | { type: 'message'; text: string };

type MenuButtonItem = {
  label: string;
  mark?: string;
  action: CardAction;
  style?: 'primary' | 'secondary' | 'link';
};

function toLineAction(action: CardAction, label: string) {
  const safeLabel = label.slice(0, 20);
  if (action.type === 'postback') {
    return {
      type: 'postback' as const,
      label: safeLabel,
      data: action.data,
      displayText: action.displayText ?? label,
    };
  }
  if (action.type === 'uri') {
    return { type: 'uri' as const, label: safeLabel, uri: action.uri };
  }
  return { type: 'message' as const, label: safeLabel, text: action.text };
}

/** 換罐選單／介紹共用：狗狗邊框底圖 */
const JAR_DOG_FRAME_BG = '/images/refill-plan/dog-frame-bg-tall.jpg';

function withDogFrameShell(
  theme: WorldTheme,
  bodyContents: Record<string, unknown>[],
  footerContents: Record<string, unknown>[],
): Record<string, unknown> {
  const bg = lineAssetUrl(JAR_DOG_FRAME_BG);
  const cream = '#F8F3EA';
  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: cream },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '0px',
      backgroundColor: cream,
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          position: 'relative',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '1px',
              height: '1px',
              contents: [{ type: 'filler' }],
            },
            {
              type: 'image',
              url: bg,
              size: 'full',
              aspectMode: 'cover',
              position: 'absolute',
              gravity: 'center',
              offsetTop: '0px',
              offsetBottom: '0px',
              offsetStart: '0px',
              offsetEnd: '0px',
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              paddingAll: '18px',
              contents: [
                ...bodyContents,
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  margin: 'lg',
                  contents: footerContents,
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * 垂直按鈕選單（取代 carousel）
 * 選項由上往下排在同一則對話氣泡內，不用左右滑。
 */
export function buildButtonMenuFlex(opts: {
  altText: string;
  theme: WorldTheme;
  title?: string;
  subtitle?: string;
  items: MenuButtonItem[];
  /** 換罐計劃：整卡鋪狗狗邊框背景 */
  dogFrame?: boolean;
}): LineReplyMessage {
  const buttons = opts.items.slice(0, 13).map((item) => {
    // 按鈕只留文字，不加 emoji icon
    const label = item.label.trim();
    return {
      type: 'button',
      style: item.style ?? 'secondary',
      height: 'sm',
      color: item.style === 'primary' ? opts.theme.accent : undefined,
      action: toLineAction(item.action, label),
    };
  });

  const bodyContents: Record<string, unknown>[] = [];
  if (opts.title) {
    bodyContents.push({
      type: 'text',
      text: opts.title,
      weight: 'bold',
      size: 'lg',
      color: opts.theme.ink,
      wrap: true,
    });
  }
  if (opts.subtitle) {
    bodyContents.push({
      type: 'text',
      text: opts.subtitle,
      size: 'sm',
      color: opts.theme.muted,
      wrap: true,
      margin: opts.title ? 'sm' : undefined,
    });
  }

  if (opts.dogFrame) {
    return {
      type: 'flex',
      altText: opts.altText,
      contents: withDogFrameShell(opts.theme, bodyContents, buttons),
    };
  }

  return {
    type: 'flex',
    altText: opts.altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: {
        body: { backgroundColor: opts.theme.card },
        footer: { backgroundColor: opts.theme.soft },
      },
      ...(bodyContents.length
        ? {
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              paddingAll: '18px',
              backgroundColor: opts.theme.card,
              contents: bodyContents,
            },
          }
        : {}),
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        backgroundColor: opts.theme.soft,
        contents: buttons,
      },
    },
  };
}

/**
 * @deprecated 輪播大卡已改按鈕選單；保留給少數測試／相容路徑
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
      aspectRatio: '3:2',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      paddingAll: '22px',
      paddingTop: '18px',
      backgroundColor: theme.card,
      contents: [
        {
          type: 'text',
          text: opts.title,
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
          margin: 'sm',
        },
      ],
    },
  };
}

function itemToButton(
  item: WorldMenuItem,
  opts?: { primaryId?: string },
): MenuButtonItem {
  const action: CardAction = item.uri
    ? { type: 'uri', uri: item.uri }
    : item.message
      ? { type: 'message', text: item.message }
      : { type: 'postback', data: `jd=${item.id}`, displayText: item.label };
  const isPrimary = opts?.primaryId === item.id;
  return {
    label: item.label,
    action,
    style: isPrimary ? 'primary' : 'secondary',
  };
}

function menuFromItems(opts: {
  altText: string;
  theme: WorldTheme;
  title?: string;
  subtitle?: string;
  items: WorldMenuItem[];
  primaryId?: string;
  dogFrame?: boolean;
}): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: opts.altText,
    theme: opts.theme,
    title: opts.title,
    subtitle: opts.subtitle,
    items: opts.items.map((item) => itemToButton(item, { primaryId: opts.primaryId })),
    dogFrame: opts.dogFrame,
  });
}

/** 聊天內備援：四格入口 */
export function buildThreeWorldsMenuMessages(opts?: { body?: string }): LineReplyMessage[] {
  const intro = opts?.body ?? '下面四格，想晃哪格點哪格。';
  const worlds: Array<{ id: WorldHubId; label: string }> = [
    { id: 'chaos', label: WORLD_HUB_LABELS.chaos },
    { id: 'jar', label: WORLD_HUB_LABELS.jar },
    { id: 'wild', label: WORLD_HUB_LABELS.wild },
  ];
  return [
    { type: 'text', text: intro },
    buildButtonMenuFlex({
      altText: '匠寵入口',
      theme: WORLD_THEME.chaos,
      title: '匠寵',
      subtitle: '由上往下點，不用左右滑。',
      items: worlds.map((w) => ({
        label: w.label,
        action: {
          type: 'postback',
          data: `jd=hub_${w.id}`,
          displayText: WORLD_HUB_LABELS[w.id],
        },
        style: 'secondary' as const,
      })),
    }),
  ];
}

/** 回家：官網＋IG */
export function buildHomeHubMessages(opts?: { body?: string }): LineReplyMessage[] {
  const links = FURMOSA_BRAND_LINKS;
  const theme = WORLD_THEME.wild;
  const items = buildHomeItems().map((item) => {
    if (item.id === 'wild_web') return { ...item, uri: links.website() };
    if (item.id === 'wild_ig') return { ...item, uri: links.instagram() };
    return item;
  });
  return [
    {
      type: 'text',
      text: opts?.body ?? WILD_INTRO,
    },
    menuFromItems({
      altText: WORLD_HUB_LABELS.wild,
      theme,
      title: WORLD_HUB_LABELS.wild,
      subtitle: WORLD_HUB_TAGLINE.wild,
      items,
      primaryId: 'wild_web',
    }),
  ];
}

/** 預約美容：coming soon（封面＋短文，不塞按鈕選單） */
export const GROOMING_SOON_COPY = `系統還在吹毛。
很快就能直接在這裡約。`;

export function groomingSoonCoverUrl(): string {
  return lineAssetUrl('/line/grooming/soon-cover.jpg');
}

export function buildGroomingSoonMessages(_line?: string): LineReplyMessage[] {
  const cover = groomingSoonCoverUrl();
  return [
    {
      type: 'image',
      originalContentUrl: cover,
      previewImageUrl: cover,
    },
    {
      type: 'text',
      text: GROOMING_SOON_COPY,
    },
  ];
}

export function buildWorldHubMessages(
  hub: WorldHubId,
  opts?: { registered?: boolean; body?: string },
): LineReplyMessage[] {
  const registered = opts?.registered ?? false;
  const theme = WORLD_THEME[hub];

  if (hub === 'jar') {
    // 與一起野放相同：只回選單卡；LIFF 就緒時第三鍵「線上預購換罐」
    const hubCfg = buildJarHubItems(registered, {
      refillLiffUrl: getLiffUrlIfConfigured('refill'),
    });
    const messages: LineReplyMessage[] = [];
    if (opts?.body) {
      messages.push({ type: 'text', text: opts.body });
    }
    messages.push(
      menuFromItems({
        altText: WORLD_HUB_LABELS.jar,
        theme,
        title: WORLD_HUB_LABELS.jar,
        subtitle: WORLD_HUB_TAGLINE.jar,
        items: hubCfg.items,
        primaryId: hubCfg.primaryId || undefined,
        dogFrame: true,
      }),
    );
    return messages;
  }

  if (hub === 'chaos') {
    // 一起野放：只回按鈕卡，不另發開場長文
    const messages: LineReplyMessage[] = [];
    if (opts?.body) {
      messages.push({ type: 'text', text: opts.body });
    }
    messages.push(
      menuFromItems({
        altText: WORLD_HUB_LABELS.chaos,
        theme,
        title: WORLD_HUB_LABELS.chaos,
        subtitle: WORLD_HUB_TAGLINE.chaos,
        items: CHAOS_ITEMS,
      }),
    );
    return messages;
  }

  return buildHomeHubMessages({
    body: opts?.body ?? WILD_INTRO,
  });
}

/** 未開戶擋序號：垂直按鈕 */
export function buildRegisterGateMessages(
  text: string = JAR_ENTER_BLOCKED_GUEST,
): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  return [
    buildButtonMenuFlex({
      altText: '先幫毛孩開戶',
      theme,
      title: '先幫毛孩開戶',
      subtitle: text.replace(/\n/g, ' '),
      items: [
        {
          label: LINE_BTN.registerNow,
          action: {
            type: 'postback',
            data: 'jd=jar_reg&next=enter',
            displayText: LINE_BTN.registerNow,
          },
          style: 'primary',
        },
      ],
    }),
  ];
}

/** 什麼是換罐：相容舊入口；店家已在主選單，這裡不再重複 */
export function buildJarExplainMessages(): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  const sections: WorldMenuItem[] = [
    {
      id: 'jar_explain_intro',
      mark: '',
      label: '什麼是換罐計劃？',
      subtitle: '空罐怎麼變成下一罐，先看這頁。',
      heroKey: 'jar-explain',
      message: '什麼是換罐計劃？',
    },
    {
      id: 'jar_explain_flow',
      mark: '',
      label: '流程',
      subtitle: '從開戶到集點，八小步。',
      heroKey: 'jar-enter',
      message: '流程',
    },
    {
      id: 'jar_faq',
      mark: '',
      label: '毛爸媽常問',
      subtitle: '卡關時翻這頁就好。',
      heroKey: 'jar-faq',
      message: '毛爸媽常問',
    },
  ];
  // 打字「換罐計劃是什麼」仍可進說明；不再重複店家與「點下面按鈕」
  return [
    menuFromItems({
      altText: '換罐說明',
      theme,
      title: '換罐說明',
      subtitle: '想先看哪一段？',
      items: sections,
    }),
  ];
}

export function buildEnterCodePromptMessages(): LineReplyMessage[] {
  const theme = WORLD_THEME.jar;
  return [
    { type: 'text', text: JAR_ENTER_HINT_REGISTERED },
    buildButtonMenuFlex({
      altText: '輸入序號',
      theme,
      title: '輸入序號',
      subtitle: '罐底 8 碼，直接打在對話框就好。',
      items: [
        {
          label: '我的會員',
          action: { type: 'message', text: '我的會員' },
          style: 'secondary',
        },
      ],
    }),
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
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: theme.accent,
            action: {
              type: 'postback',
              label: '🪪 我的會員',
              data: 'jd=jar_vault',
              displayText: '我的會員',
            },
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
