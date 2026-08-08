/**
 * 雞霸開箱 — 桌機預覽訊息 fixtures。
 *
 * 刻意不 import flow.ts / reply.ts / flex-hubs.ts（那些會拉進 Prisma、Reply API、fs）。
 * Flex 結構對齊正式 buildButtonMenuFlex（chaos、無 dogFrame）；drift 測試會比對。
 */
import {
  JIBA_PRODUCTS,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_ASK_IG,
  JIBA_ASK_NAME,
  JIBA_ASK_PET,
  JIBA_ASK_PHONE,
  JIBA_ASK_PRODUCT,
  JIBA_ASK_STORE,
  JIBA_INTRO,
  JIBA_LICENSE_ASK,
  JIBA_LICENSE_BODY,
  JIBA_LICENSE_DECLINE,
  JIBA_PRODUCT_PICKED,
  JIBA_RULES,
  JIBA_START_WORK,
  JIBA_SUBMITTED,
  jibaBriefAndUpsell,
  jibaConfirmSummary,
} from '@/lib/campaigns/jiba-two-piece/copy';
import { WORLD_THEME } from '@/lib/line/card-theme';
import type {
  JibaPreviewProductKey,
  PreviewLineMessage,
} from '@/lib/line/campaigns/jiba-unbox/preview-types';

/** 預覽用固定門市候選（不查 DB、不打網路） */
export const JIBA_PREVIEW_MOCK_STORES = [
  {
    storeId: '141391',
    storeName: '板橋新埔門市',
    storeAddress: '新北市板橋區民權路 36 號',
  },
  {
    storeId: '165588',
    storeName: '淡水老街門市',
    storeAddress: '新北市淡水區中正路 15 號',
  },
] as const;

export const JIBA_PREVIEW_MOCK_INPUTS = {
  recipientName: '王小明',
  recipientPhone: '0912345678',
  storeQuery: '板橋新埔',
  pickStoreText: '選門市1',
  instagramHandle: '@preview_furmosa',
  petName: '小黑',
} as const;

/** 同 origin 靜態圖；正式 LINE 會用絕對 CDN URL（見 fidelity gap） */
export const JIBA_PREVIEW_COVER_PATH = '/line/events/jiba-unbox-cover.png';

/** 7-11 查詢連結只作為 Flex action 資料，預覽頁不主動 fetch */
export const JIBA_PREVIEW_STORE_FINDER_URI =
  'https://www.7-11.com.tw/freshfoods/map/index.aspx';

type MenuButtonAction =
  | { type: 'message'; text: string }
  | { type: 'uri'; uri: string }
  | { type: 'postback'; data: string; displayText?: string };

type MenuButtonItem = {
  label: string;
  action: MenuButtonAction;
  style?: 'primary' | 'secondary' | 'link';
};

/**
 * 對齊 lib/line/flex-hubs.ts `buildButtonMenuFlex`（無 dogFrame 分支）。
 * 供預覽與 drift 測試使用；正式 webhook 仍走 flex-hubs。
 */
export function buildPreviewButtonMenuFlex(opts: {
  altText: string;
  title?: string;
  subtitle?: string;
  items: MenuButtonItem[];
  accent?: string;
  soft?: string;
  card?: string;
  ink?: string;
  muted?: string;
}): PreviewLineMessage {
  const theme = {
    accent: opts.accent ?? WORLD_THEME.chaos.accent,
    soft: opts.soft ?? WORLD_THEME.chaos.soft,
    card: opts.card ?? WORLD_THEME.chaos.card,
    ink: opts.ink ?? WORLD_THEME.chaos.ink,
    muted: opts.muted ?? WORLD_THEME.chaos.muted,
  };

  const buttons = opts.items.slice(0, 13).map((item) => {
    const label = item.label.trim();
    return {
      type: 'button',
      style: item.style ?? 'secondary',
      height: 'sm',
      color: item.style === 'primary' ? theme.accent : undefined,
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
      color: theme.ink,
      wrap: true,
    });
  }
  if (opts.subtitle) {
    bodyContents.push({
      type: 'text',
      text: opts.subtitle,
      size: 'sm',
      color: theme.muted,
      wrap: true,
      margin: opts.title ? 'sm' : undefined,
    });
  }

  return {
    type: 'flex',
    altText: opts.altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: {
        body: { backgroundColor: theme.card },
        footer: { backgroundColor: theme.soft },
      },
      ...(bodyContents.length
        ? {
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              paddingAll: '18px',
              backgroundColor: theme.card,
              contents: bodyContents,
            },
          }
        : {}),
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        backgroundColor: theme.soft,
        contents: buttons,
      },
    },
  };
}

function toLineAction(action: MenuButtonAction, label: string) {
  if (action.type === 'message') {
    return { type: 'message' as const, label, text: action.text };
  }
  if (action.type === 'uri') {
    return { type: 'uri' as const, label, uri: action.uri };
  }
  return {
    type: 'postback' as const,
    label,
    data: action.data,
    displayText: action.displayText ?? label,
  };
}

function textWithQr(
  text: string,
  items: { label: string; text: string }[],
): PreviewLineMessage {
  const msg: PreviewLineMessage = { type: 'text', text };
  if (items.length > 0) {
    msg.quickReply = {
      items: items.slice(0, 13).map((i) => ({
        type: 'action',
        action: {
          type: 'message',
          label: i.label.slice(0, 20),
          text: i.text,
        },
      })),
    };
  }
  return msg;
}

export function jibaPreviewIntroChoiceMenu(
  title: string,
  subtitle: string,
): PreviewLineMessage {
  return buildPreviewButtonMenuFlex({
    altText: title,
    title,
    subtitle,
    items: [
      {
        label: '我要參加',
        action: { type: 'message', text: '我要參加' },
        style: 'primary',
      },
      {
        label: '先看看規則',
        action: { type: 'message', text: '先看看規則' },
      },
      {
        label: '這次先不要',
        action: { type: 'message', text: '這次先不要' },
      },
    ],
  });
}

export function jibaPreviewRulesChoiceMenu(): PreviewLineMessage {
  return buildPreviewButtonMenuFlex({
    altText: '開箱規則',
    title: '看完規則了嗎？',
    subtitle: '想繼續的話，點下面按鈕就可以喔。',
    items: [
      {
        label: '這個我可以！',
        action: { type: 'message', text: '這個我可以！' },
        style: 'primary',
      },
      {
        label: '我再想一下',
        action: { type: 'message', text: '我再想一下' },
      },
    ],
  });
}

export function jibaPreviewProductChoiceMenu(): PreviewLineMessage {
  return buildPreviewButtonMenuFlex({
    altText: '選開箱商品',
    title: '選開箱商品',
    subtitle: JIBA_ASK_PRODUCT,
    items: [
      {
        label: JIBA_PRODUCTS.jiba.label,
        action: { type: 'message', text: '選雞霸兩片' },
        style: 'primary',
      },
      {
        label: JIBA_PRODUCTS.frog.label,
        action: { type: 'message', text: '選青蛙凍乾' },
        style: 'secondary',
      },
    ],
  });
}

export function jibaPreviewLicenseFlex(): PreviewLineMessage {
  return buildPreviewButtonMenuFlex({
    altText: '投稿授權同意',
    title: JIBA_LICENSE_ASK,
    subtitle: JIBA_LICENSE_BODY,
    items: [
      {
        label: '我同意',
        action: { type: 'message', text: '我同意' },
        style: 'primary',
      },
      {
        label: '不同意',
        action: { type: 'message', text: '不同意' },
        style: 'secondary',
      },
    ],
  });
}

export function jibaPreviewStoreCandidatesFlex(
  candidates: { storeId: string; storeName: string; storeAddress: string }[],
): PreviewLineMessage {
  const lines = candidates
    .map((c, i) => `${i + 1}. ${c.storeName}${c.storeId ? `（${c.storeId}）` : ''}`)
    .join('\n');
  return buildPreviewButtonMenuFlex({
    altText: '選擇 7-11 門市',
    title: '找到這些 7-11',
    subtitle: `${lines}\n\n點下面按鈕確認；不對就重選或改關鍵字。`,
    items: [
      ...candidates.slice(0, 4).map((c, i) => ({
        label: `${i + 1}.${c.storeName}`.slice(0, 20),
        action: { type: 'message' as const, text: `選門市${i + 1}` },
        style: (i === 0 ? 'primary' : 'secondary') as 'primary' | 'secondary',
      })),
      {
        label: '重選門市',
        action: { type: 'message' as const, text: '重選門市' },
        style: 'link' as const,
      },
      {
        label: '查 7-11 店名',
        action: { type: 'uri' as const, uri: JIBA_PREVIEW_STORE_FINDER_URI },
        style: 'link' as const,
      },
    ],
  });
}

export function jibaPreviewStartBriefFlex(): PreviewLineMessage {
  return buildPreviewButtonMenuFlex({
    altText: '開始填資料',
    title: '看完了嗎？',
    subtitle: '準備好就開始填收件資料，零食才寄得出發喔。',
    items: [
      {
        label: '好，開始填資料',
        action: { type: 'message', text: '好，開始填資料' },
        style: 'primary',
      },
    ],
  });
}

export function buildJibaPreviewIntroMessages(): PreviewLineMessage[] {
  return [
    {
      type: 'image',
      originalContentUrl: JIBA_PREVIEW_COVER_PATH,
      previewImageUrl: JIBA_PREVIEW_COVER_PATH,
    },
    { type: 'text', text: JIBA_INTRO },
    jibaPreviewIntroChoiceMenu('開箱任務', '想一起讓毛孩試試嗎？'),
  ];
}

export function buildJibaPreviewRulesMessages(): PreviewLineMessage[] {
  return [
    { type: 'text', text: JIBA_RULES },
    jibaPreviewRulesChoiceMenu(),
  ];
}

export function buildJibaPreviewProductAskMessages(): PreviewLineMessage[] {
  return [
    { type: 'text', text: JIBA_ASK_PRODUCT },
    jibaPreviewProductChoiceMenu(),
  ];
}

export function buildJibaPreviewBriefMessages(
  productKey: JibaPreviewProductKey,
): PreviewLineMessage[] {
  const key = productKey as JibaProductKey;
  return [
    { type: 'text', text: JIBA_PRODUCT_PICKED[key] },
    { type: 'text', text: jibaBriefAndUpsell(key) },
    jibaPreviewStartBriefFlex(),
  ];
}

export function buildJibaPreviewNameAskMessages(): PreviewLineMessage[] {
  return [
    { type: 'text', text: JIBA_START_WORK },
    { type: 'text', text: JIBA_ASK_NAME },
  ];
}

export function buildJibaPreviewPhoneAskMessages(): PreviewLineMessage[] {
  return [{ type: 'text', text: JIBA_ASK_PHONE }];
}

export function buildJibaPreviewStoreAskMessages(): PreviewLineMessage[] {
  return [
    textWithQr(JIBA_ASK_STORE, [
      { label: '手動輸入門市', text: '手動輸入門市' },
    ]),
  ];
}

export function buildJibaPreviewStoreConfirmMessages(
  candidates: { storeId: string; storeName: string; storeAddress: string }[] = [
    ...JIBA_PREVIEW_MOCK_STORES,
  ],
): PreviewLineMessage[] {
  return [jibaPreviewStoreCandidatesFlex(candidates)];
}

export function buildJibaPreviewIgAskMessages(): PreviewLineMessage[] {
  return [{ type: 'text', text: JIBA_ASK_IG }];
}

export function buildJibaPreviewPetAskMessages(): PreviewLineMessage[] {
  return [textWithQr(JIBA_ASK_PET, [{ label: '略過', text: '略過' }])];
}

export function buildJibaPreviewLicenseMessages(): PreviewLineMessage[] {
  return [jibaPreviewLicenseFlex()];
}

export function buildJibaPreviewConfirmMessages(opts: {
  productKey: JibaPreviewProductKey;
  recipientName: string;
  recipientPhone: string;
  storeName: string;
  instagramHandle: string;
  petName: string | null;
}): PreviewLineMessage[] {
  const summary = jibaConfirmSummary({
    recipientName: opts.recipientName,
    recipientPhone: opts.recipientPhone,
    storeName: opts.storeName,
    instagramHandle: opts.instagramHandle,
    petName: opts.petName,
    productLabel: JIBA_PRODUCTS[opts.productKey].orderLabel,
  });
  return [
    textWithQr(summary, [
      { label: '資料正確，送出', text: '資料正確，送出' },
      { label: '修改收件資料', text: '修改收件資料' },
      { label: '修改門市', text: '修改門市' },
      { label: '先不要送出', text: '先不要送出' },
    ]),
  ];
}

export function buildJibaPreviewSubmittedMessages(): PreviewLineMessage[] {
  return [{ type: 'text', text: JIBA_SUBMITTED }];
}

export function buildJibaPreviewDeclineMessages(): PreviewLineMessage[] {
  return [
    {
      type: 'text',
      text: '好喔，雞霸先幫你放冰箱。下次想參加再開箱任務找我們就好。',
    },
  ];
}

export function buildJibaPreviewLicenseDeclineMessages(): PreviewLineMessage[] {
  return [{ type: 'text', text: JIBA_LICENSE_DECLINE }];
}

export function extractFlexButtonLabels(msg: PreviewLineMessage): string[] {
  if (msg.type !== 'flex') return [];
  const labels: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    const o = node as { type?: string; action?: { label?: string }; contents?: unknown };
    if (o.type === 'button' && o.action?.label) labels.push(o.action.label);
    if (o.contents) walk(o.contents);
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object' && v !== o.contents) walk(v);
    }
  };
  walk(msg.contents);
  return labels;
}
