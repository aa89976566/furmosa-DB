import { FURMOSA_BRAND_LINKS } from '@/lib/line/brand-links';
import {
  CHAOS_INTRO,
  CHAOS_ITEMS,
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
    const style: FlexButton['style'] =
      item.id === primaryId ? 'primary' : item.uri ? 'secondary' : 'secondary';
    if (item.uri) return uriBtn(item.label, item.uri, style);
    return pbBtn(item.label, `jd=${item.id}`, style);
  });
}

function hubBubble(opts: {
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
        cornerRadius: '20px',
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

/** Rich Menu 三入口總覽（聊天內備援；底部 Rich Menu 才是主航） */
export function buildThreeWorldsMenuMessages(opts?: { body?: string }): LineReplyMessage[] {
  const body = opts?.body ?? '三個入口，各搞各的。點一個進去逛。';
  const buttons: FlexButton[] = [
    pbBtn(
      `${WORLD_HUB_EMOJI.jar} ${WORLD_HUB_LABELS.jar}`,
      'jd=hub_jar',
      'primary',
    ),
    pbBtn(`${WORLD_HUB_EMOJI.chaos} ${WORLD_HUB_LABELS.chaos}`, 'jd=hub_chaos', 'secondary'),
    pbBtn(`${WORLD_HUB_EMOJI.wild} ${WORLD_HUB_LABELS.wild}`, 'jd=hub_wild', 'secondary'),
  ];
  return [
    hubBubble({
      title: '匠寵',
      body,
      buttons,
      altText: '匠寵選單',
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
    const items = buildJarHubItems(registered);
    const primary = registered ? 'jar_enter' : 'jar_reg';
    return [
      hubBubble({
        title,
        body:
          opts?.body ??
          (registered
            ? '開戶完成。存罐、看罐庫，都在這裡。'
            : '先開戶，才能開始累積罐罐。'),
        buttons: itemButtons(items, primary),
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

const JAR_GATE_DEFAULT = '先幫毛孩開戶，就可以開始累積罐罐囉。';

/** 未開戶擋序號：引導開戶 */
export function buildRegisterGateMessages(text: string = JAR_GATE_DEFAULT): LineReplyMessage[] {
  return [
    hubBubble({
      title: '先開個戶',
      body: text,
      buttons: [pbBtn(LINE_BTN.registerNow, 'jd=jar_reg', 'primary')],
      altText: '先幫毛孩開戶',
    }),
  ];
}

/** 存罐成功慶祝卡（LINE 無法播動畫，用大字＋圓角卡代替） */
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
          pbBtn(`${WORLD_HUB_EMOJI.jar} ${WORLD_HUB_LABELS.jar}`, 'jd=hub_jar', 'link'),
        ],
      },
    },
  };
}
