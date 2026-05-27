import type { LineRewardOption } from '@/lib/line/reward-menu';
import {
  LINE_BTN,
  LINE_MENU_HINT_GUEST,
  LINE_MENU_HINT_REGISTERED,
} from '@/lib/line/line-copy';
import { replyLineMessage, type LineReplyMessage } from '@/lib/line/reply';

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

/** 匠寵主選單：加入會員、金庫、兌換 */
export function buildMainMenuBubble(body: string) {
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '匠寵罐罐存款',
          weight: 'bold',
          size: 'lg',
          color: '#1a1a1a',
        },
        {
          type: 'text',
          text: body,
          size: 'sm',
          color: '#555555',
          wrap: true,
        },
        {
          type: 'text',
          text: '存罐：直接傳 8 位空罐序號即可入帳。',
          size: 'xs',
          color: '#888888',
          wrap: true,
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        pbBtn(LINE_BTN.register, 'jd=reg', 'primary'),
        pbBtn(LINE_BTN.vault, 'jd=vault', 'secondary'),
        pbBtn(LINE_BTN.redeem, 'jd=redeem', 'secondary'),
      ],
    },
  };
}

export function buildMainMenuMessages(opts?: {
  registered?: boolean;
  body?: string;
}): LineReplyMessage[] {
  const defaultBody = opts?.registered ? LINE_MENU_HINT_REGISTERED : LINE_MENU_HINT_GUEST;
  const body = opts?.body ?? defaultBody;
  return [{ type: 'flex', altText: '匠寵罐罐存款', contents: buildMainMenuBubble(body) }];
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
    pbBtn(LINE_BTN.speciesSkip, 'jd=sp&c=none', 'link'),
  ];

  return [
    {
      type: 'flex',
      altText: '選擇毛孩種類',
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '毛孩種類',
              weight: 'bold',
              size: 'md',
            },
            {
              type: 'text',
              text: '請點選一項（在對話框內操作，無需跳轉）',
              size: 'xs',
              color: '#888888',
              wrap: true,
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              margin: 'lg',
              contents: speciesButtons,
            },
          ],
        },
      },
    },
  ];
}

export function buildRegisterConfirmMessages(summary: string): LineReplyMessage[] {
  return [
    {
      type: 'flex',
      altText: '確認會員資料',
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: '確認資料',
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
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            pbBtn(LINE_BTN.confirm, 'jd=reg_ok', 'primary'),
            pbBtn(LINE_BTN.cancel, 'jd=reg_no', 'link'),
          ],
        },
      },
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
        text: '目前沒有可兌換的獎勵，請稍後再試。',
      },
    ];
  }

  const lines = rewards.map((r) => `${r.index}. ${r.rewardName}（${r.pointsRequired} 點）`);
  const pick = rewards
    .slice(0, 4)
    .map((r) => pbBtn(LINE_BTN.redeemItem(r.index), `jd=rd&i=${r.index}`, 'secondary'));

  return [
    {
      type: 'flex',
      altText: LINE_BTN.redeem,
      contents: {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: LINE_BTN.redeem,
              weight: 'bold',
              size: 'lg',
            },
            {
              type: 'text',
              text: `目前罐罐點數：${balance} 點\n\n${lines.join('\n')}`,
              size: 'sm',
              wrap: true,
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: pick,
        },
      },
    },
  ];
}

/** 對話框主選單（三按鈕，postback，不跳 LIFF） */
export async function replyJarDepositHub(
  replyToken: string,
  opts: { title?: string; body: string; emphasizeRegister?: boolean; registered?: boolean },
) {
  await replyLineMessage(
    replyToken,
    buildMainMenuMessages({
      registered: opts.registered,
      body: opts.body || opts.title,
    }),
  );
}

export function parseLinePostbackData(data: string): URLSearchParams {
  return new URLSearchParams(data);
}
