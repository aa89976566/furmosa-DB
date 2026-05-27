import { getLiffUrlIfConfigured, isLiffConfigured } from '@/lib/line/liff-config';
import { replyLineMessage, type LineReplyMessage } from '@/lib/line/reply';

type FlexButton = {
  type: 'button';
  style: 'primary' | 'secondary' | 'link';
  height: 'sm';
  action:
    | { type: 'uri'; label: string; uri: string }
    | { type: 'message'; label: string; text: string };
};

function uriBtn(label: string, uri: string, style: FlexButton['style'] = 'secondary'): FlexButton {
  return {
    type: 'button',
    style,
    height: 'sm',
    action: { type: 'uri', label, uri },
  };
}

function msgBtn(label: string, text: string): FlexButton {
  return {
    type: 'button',
    style: 'link',
    height: 'sm',
    action: { type: 'message', label, text },
  };
}

/** 對話框內主要操作按鈕（開 LIFF 表單） */
export function buildJarDepositActionBubble(opts: {
  title: string;
  body: string;
  /** 尚未註冊時強調「加入會員」 */
  emphasizeRegister?: boolean;
}) {
  const register = getLiffUrlIfConfigured('register');
  const profile = getLiffUrlIfConfigured('profile');
  const rewards = getLiffUrlIfConfigured('rewards');

  const buttons: FlexButton[] = [];

  if (opts.emphasizeRegister && register) {
    buttons.push(uriBtn('加入會員（填表單）', register, 'primary'));
  } else {
    if (profile) buttons.push(uriBtn('會員資料與存罐紀錄', profile, 'primary'));
    if (rewards) buttons.push(uriBtn('兌換獎勵', rewards, 'secondary'));
    if (!profile && register) buttons.push(uriBtn('加入會員（填表單）', register, 'primary'));
  }

  if (!opts.emphasizeRegister) {
    if (register) buttons.push(uriBtn('更新會員資料', register, 'link'));
  }

  buttons.push(msgBtn('存罐完整說明', '存罐攻略'));

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
          text: opts.title,
          weight: 'bold',
          size: 'lg',
          color: '#1a1a1a',
        },
        {
          type: 'text',
          text: opts.body,
          size: 'sm',
          color: '#555555',
          wrap: true,
        },
        {
          type: 'text',
          text: '存罐：直接在對話框傳 8 位空罐序號即可入帳。',
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
      contents: buttons.slice(0, 4),
    },
  };
}

export function buildJarDepositHubMessages(opts: {
  title: string;
  body: string;
  emphasizeRegister?: boolean;
}): LineReplyMessage[] {
  if (!isLiffConfigured()) {
    return [{ type: 'text', text: `${opts.title}\n\n${opts.body}` }];
  }

  return [
    {
      type: 'flex',
      altText: opts.title,
      contents: buildJarDepositActionBubble(opts),
    },
  ];
}

/** 在對話框回覆：說明文字 + 可點按鈕（開 LIFF） */
export async function replyJarDepositHub(
  replyToken: string,
  opts: { title: string; body: string; emphasizeRegister?: boolean },
) {
  await replyLineMessage(replyToken, buildJarDepositHubMessages(opts));
}
