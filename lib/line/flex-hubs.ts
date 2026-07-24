import { FURMOSA_BRAND_LINKS } from '@/lib/line/brand-links';
import {
  CHAOS_INTRO,
  CHAOS_ITEMS,
  JAR_ENTER_BLOCKED_GUEST,
  JAR_ENTER_HINT_REGISTERED,
  WORLD_HUB_EMOJI,
  WORLD_HUB_LABELS,
  WILD_INTRO,
  buildJarHubItems,
  type WorldHubId,
  type WorldMenuItem,
} from '@/lib/line/brand-worlds';
import { LINE_BTN } from '@/lib/line/line-copy';
import type { LineReplyMessage } from '@/lib/line/reply';

type FlexButton = {
  type: 'button';
  style: 'primary' | 'secondary' | 'link';
  height: 'sm';
  action:
    | { type: 'postback'; label: string; data: string; displayText?: string }
    | { type: 'uri'; label: string; uri: string }
    | { type: 'message'; label: string; text: string };
};

function pbBtn(
  label: string,
  data: string,
  style: FlexButton['style'] = 'secondary',
): FlexButton {
  return {
    type: 'button',
    style,
    height: 'sm',
    action: { type: 'postback', label, data, displayText: label },
  };
}

function uriBtn(label: string, uri: string, style: FlexButton['style'] = 'secondary'): FlexButton {
  return {
    type: 'button',
    style,
    height: 'sm',
    action: { type: 'uri', label, uri },
  };
}

function itemButtons(items: WorldMenuItem[], primaryId?: string): FlexButton[] {
  return items.map((item) => {
    const style: FlexButton['style'] = item.id === primaryId ? 'primary' : 'secondary';
    if (item.uri) return uriBtn(item.label, item.uri, style);
    return pbBtn(item.label, `jd=${item.id}`, style);
  });
}

export function hubBubble(opts: {
  title: string;
  body: string;
  buttons: FlexButton[];
  altText: string;
}): LineReplyMessage {
  return {
    type: 'flex',
    altText: opts.altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: {
        body: { backgroundColor: '#FFF8F1' },
        footer: { backgroundColor: '#FFF8F1', separator: true, separatorColor: '#E8D9C8' },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: opts.title,
            weight: 'bold',
            size: 'lg',
            color: '#1F1A14',
            wrap: true,
          },
          {
            type: 'text',
            text: opts.body,
            size: 'sm',
            color: '#5C5346',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: opts.buttons,
      },
    },
  };
}

/** 聊天內備援：仍只給三世界，絕不回到六宮格功能列 */
export function buildThreeWorldsMenuMessages(opts?: { body?: string }): LineReplyMessage[] {
  const body = opts?.body ?? '首頁只有三個世界。點一個進去。';
  const buttons: FlexButton[] = [
    pbBtn(`${WORLD_HUB_EMOJI.jar} ${WORLD_HUB_LABELS.jar}`, 'jd=hub_jar', 'primary'),
    pbBtn(`${WORLD_HUB_EMOJI.chaos} ${WORLD_HUB_LABELS.chaos}`, 'jd=hub_chaos', 'secondary'),
    pbBtn(`${WORLD_HUB_EMOJI.wild} ${WORLD_HUB_LABELS.wild}`, 'jd=hub_wild', 'secondary'),
  ];
  return [
    hubBubble({
      title: '匠寵',
      body,
      buttons,
      altText: '匠寵三世界',
    }),
  ];
}

export function buildWorldHubMessages(
  hub: WorldHubId,
  opts?: { registered?: boolean; body?: string },
): LineReplyMessage[] {
  const registered = opts?.registered ?? false;
  const emoji = WORLD_HUB_EMOJI[hub];
  const title = `${emoji} ${WORLD_HUB_LABELS[hub]}`;

  if (hub === 'jar') {
    const hubCfg = buildJarHubItems(registered);
    return [
      hubBubble({
        title,
        body: opts?.body ?? hubCfg.body,
        buttons: itemButtons(hubCfg.items, hubCfg.primaryId),
        altText: WORLD_HUB_LABELS.jar,
      }),
    ];
  }

  if (hub === 'chaos') {
    return [
      hubBubble({
        title,
        body: opts?.body ?? CHAOS_INTRO,
        buttons: itemButtons(CHAOS_ITEMS),
        altText: WORLD_HUB_LABELS.chaos,
      }),
    ];
  }

  const wildItems: WorldMenuItem[] = [
    { id: 'wild_web', label: '官網', uri: FURMOSA_BRAND_LINKS.website() },
    { id: 'wild_ig', label: 'Instagram', uri: FURMOSA_BRAND_LINKS.instagram() },
    { id: 'wild_threads', label: 'Threads', uri: FURMOSA_BRAND_LINKS.threads() },
    { id: 'wild_fb', label: 'Facebook', uri: FURMOSA_BRAND_LINKS.facebook() },
    { id: 'wild_news', label: '最新消息', uri: FURMOSA_BRAND_LINKS.news() },
    { id: 'wild_stores', label: '合作店家' },
    { id: 'wild_story', label: '品牌故事' },
  ];

  return [
    hubBubble({
      title,
      body: opts?.body ?? WILD_INTRO,
      buttons: itemButtons(wildItems),
      altText: WORLD_HUB_LABELS.wild,
    }),
  ];
}

/**
 * 未開戶擋序號：只有「立即開戶」一顆鈕。
 * next=enter → 開戶完成後自動回到輸入序號提示。
 */
export function buildRegisterGateMessages(
  text: string = JAR_ENTER_BLOCKED_GUEST,
): LineReplyMessage[] {
  return [
    hubBubble({
      title: '先開個戶',
      body: text,
      buttons: [pbBtn(LINE_BTN.registerNow, 'jd=jar_reg&next=enter', 'primary')],
      altText: '先幫毛孩開戶',
    }),
  ];
}

/** 什麼是換罐：介紹＋流程＋導去店家／FAQ（兩次點擊內） */
export function buildJarExplainMessages(): LineReplyMessage[] {
  return [
    hubBubble({
      title: '什麼是換罐',
      body: '空罐記一筆，毛孩多一點福利。下面分開看。',
      buttons: [
        pbBtn('介紹', 'jd=jar_explain_intro', 'primary'),
        pbBtn('流程', 'jd=jar_explain_flow', 'secondary'),
        pbBtn('合作店家', 'jd=jar_stores', 'secondary'),
        pbBtn('常見問題', 'jd=jar_faq', 'secondary'),
      ],
      altText: '什麼是換罐',
    }),
  ];
}

export function buildEnterCodePromptMessages(): LineReplyMessage[] {
  return [
    {
      type: 'text',
      text: JAR_ENTER_HINT_REGISTERED,
    },
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
  return {
    type: 'flex',
    altText: `存罐成功 +${opts.pointsEarned}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      styles: {
        body: { backgroundColor: '#E8F5E9' },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '罐進去了 ✨',
            weight: 'bold',
            size: 'xl',
            color: '#1B5E20',
          },
          {
            type: 'text',
            text: `序號 ${opts.code}  →  +${opts.pointsEarned}`,
            size: 'sm',
            color: '#33691E',
            wrap: true,
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#A5D6A7',
          },
          {
            type: 'text',
            text: `罐庫點數 ${opts.pointsBalance}　累積 ${opts.jarsDeposited} 罐`,
            size: 'sm',
            color: '#1F1A14',
            wrap: true,
            margin: 'md',
          },
          {
            type: 'text',
            text: opts.progressLine,
            size: 'xs',
            color: '#5C5346',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          pbBtn('毛孩罐庫', 'jd=jar_vault', 'secondary'),
          pbBtn('換罐紀錄', 'jd=jar_history', 'link'),
        ],
      },
    },
  };
}
