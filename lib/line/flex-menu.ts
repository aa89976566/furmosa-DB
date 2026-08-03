import { formatRedeemButtonLabel, type LineRewardOption } from '@/lib/line/reward-menu';
import { formatLineStorePickerLabel } from '@/lib/coupons/constants';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { buildThreeWorldsMenuMessages } from '@/lib/line/flex-hubs';
import { buildJarDialogueBubble } from '@/lib/line/jar-dialogue-shell';
import { LINE_BTN, LINE_STORE_PROMPT } from '@/lib/line/line-copy';
import type { LineReplyMessage } from '@/lib/line/reply';

type FlexButton = {
  type: 'button';
  style: 'primary' | 'secondary' | 'link';
  height: 'sm';
  action:
    | { type: 'postback'; label: string; data: string; displayText?: string }
    | { type: 'message'; label: string; text: string };
};

function pbBtn(label: string, data: string, style: FlexButton['style'] = 'secondary'): FlexButton {
  return {
    type: 'button',
    style,
    height: 'sm',
    action: { type: 'postback', label, data, displayText: label },
  };
}

/**
 * 聊天內備援主選單＝三世界入口。
 * 底部 Rich Menu 才是主航；此處避免再塞舊「會員中心」式按鈕。
 */
export function buildMainMenuBubble(
  body: string,
  _opts?: { registered?: boolean; showJarHint?: boolean },
) {
  const msgs = buildThreeWorldsMenuMessages({ body });
  const flex = msgs.find((m) => m.type === 'flex');
  if (flex?.type === 'flex') return flex.contents;
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: body, wrap: true }],
    },
  };
}

export function buildMainMenuMessages(opts?: {
  registered?: boolean;
  body?: string;
  showJarHint?: boolean;
  showRegisterHint?: boolean;
}): LineReplyMessage[] {
  const registered = opts?.registered ?? false;
  const showRegisterHint = opts?.showRegisterHint ?? !registered;
  const defaultBody = registered
    ? '下面有四格：野放、美容、換罐、回家。想去哪裡點哪裡就好～'
    : showRegisterHint
      ? '第一次來的話，先點「換罐計劃」幫毛孩開戶，之後會更順喔。'
      : '點下面按鈕就可以繼續囉。';
  return buildThreeWorldsMenuMessages({ body: opts?.body ?? defaultBody });
}

export async function buildStorePickerMessages(): Promise<LineReplyMessage[]> {
  const stores = await listPartnerStoresFromDb();
  const storeButtons: FlexButton[] = stores.map((s) =>
    pbBtn(formatLineStorePickerLabel(s.name, s.slug), `jd=store&c=${s.slug}`),
  );

  return [
    {
      type: 'flex',
      altText: '選擇美容合作店',
      contents: buildJarDialogueBubble({
        spacing: 'md',
        bodyContents: [
          {
            type: 'text',
            text: '選合作店',
            weight: 'bold',
            size: 'md',
            color: '#1F1A14',
          },
          {
            type: 'text',
            text: LINE_STORE_PROMPT,
            size: 'xs',
            color: '#5C5346',
            wrap: true,
          },
        ],
        footerContents: storeButtons,
      }),
    },
  ];
}

export function buildSpeciesPickerMessages(): LineReplyMessage[] {
  const speciesButtons: FlexButton[] = [
    pbBtn('犬', 'jd=sp&c=dog'),
    pbBtn('貓', 'jd=sp&c=cat'),
    pbBtn('兔', 'jd=sp&c=rabbit'),
    pbBtn('鼠兔類', 'jd=sp&c=small_mammal'),
    pbBtn('鳥／爬蟲', 'jd=sp&c=bird_reptile'),
    pbBtn('水族', 'jd=sp&c=fish'),
    pbBtn('其他', 'jd=sp&c=other'),
  ];

  return [
    {
      type: 'flex',
      altText: '選擇毛孩種類',
      contents: buildJarDialogueBubble({
        spacing: 'md',
        bodyContents: [
          {
            type: 'text',
            text: '毛孩種類',
            weight: 'bold',
            size: 'md',
          },
          {
            type: 'text',
            text: '點一個就好，不用跳轉。',
            size: 'xs',
            color: '#888888',
            wrap: true,
          },
        ],
        footerContents: speciesButtons,
      }),
    },
  ];
}

export function buildRegisterConfirmMessages(summary: string): LineReplyMessage[] {
  return [
    {
      type: 'flex',
      altText: '確認開戶資料',
      contents: buildJarDialogueBubble({
        spacing: 'md',
        bodyContents: [
          {
            type: 'text',
            text: '這樣對嗎？',
            weight: 'bold',
            size: 'lg',
          },
          {
            type: 'text',
            text: summary,
            size: 'sm',
            wrap: true,
          },
        ],
        footerContents: [
          pbBtn(LINE_BTN.confirm, 'jd=reg_ok', 'primary'),
          pbBtn(LINE_BTN.cancel, 'jd=reg_no', 'link'),
        ],
      }),
    },
  ];
}

export function buildRedeemPickerMessages(
  rewards: LineRewardOption[],
  balance: number,
): LineReplyMessage[] {
  if (rewards.length === 0) {
    return [
      {
        type: 'text',
        text: '現在沒有可換的東西，晚點再來晃。',
      },
    ];
  }

  const pick = rewards.slice(0, 4).map((r) => {
    const label = formatRedeemButtonLabel(r);
    return pbBtn(label, `jd=rd&i=${r.index}`, 'secondary');
  });

  return [
    {
      type: 'flex',
      altText: LINE_BTN.redeem,
      contents: buildJarDialogueBubble({
        spacing: 'md',
        bodyContents: [
          {
            type: 'text',
            text: LINE_BTN.redeem,
            weight: 'bold',
            size: 'lg',
          },
          {
            type: 'text',
            text: `目前罐庫點數：${balance}`,
            size: 'sm',
            wrap: true,
          },
        ],
        footerContents: pick,
      }),
    },
  ];
}

export function parseLinePostbackData(data: string): URLSearchParams {
  return new URLSearchParams(data);
}

export { buildThreeWorldsMenuMessages, buildWorldHubMessages } from '@/lib/line/flex-hubs';
