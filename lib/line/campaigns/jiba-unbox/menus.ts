import { JIBA_PRODUCTS } from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_ASK_PRODUCT,
  JIBA_INVITE_BODY,
  JIBA_INVITE_DECLINE,
  JIBA_INVITE_JOIN,
  JIBA_INVITE_TITLE,
} from '@/lib/campaigns/jiba-two-piece/copy';
import { WORLD_THEME } from '@/lib/line/card-theme';
import { buildButtonMenuFlex } from '@/lib/line/flex-hubs';
import type { LineReplyMessage } from '@/lib/line/reply';

/** 首則只做參加邀請：兩個按鈕、不選商品、不丟規則 */
export function buildJibaInviteFlex(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: JIBA_INVITE_TITLE,
    theme: WORLD_THEME.chaos,
    title: JIBA_INVITE_TITLE,
    subtitle: JIBA_INVITE_BODY,
    items: [
      {
        label: JIBA_INVITE_JOIN,
        action: { type: 'message', text: JIBA_INVITE_JOIN },
        style: 'primary',
      },
      {
        label: JIBA_INVITE_DECLINE,
        action: { type: 'message', text: JIBA_INVITE_DECLINE },
        style: 'secondary',
      },
    ],
  });
}

/**
 * 三商品單一 Flex。payload 用「選…」前綴，避免被收件姓名驗證吃掉。
 */
export function buildJibaProductChoiceMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: '選開箱商品',
    theme: WORLD_THEME.chaos,
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
      {
        label: JIBA_PRODUCTS.catnip.label,
        action: { type: 'message', text: '選貓草雞肉乾' },
        style: 'secondary',
      },
    ],
  });
}

export function jibaProductButtonLabels(): string[] {
  return [
    JIBA_PRODUCTS.jiba.label,
    JIBA_PRODUCTS.frog.label,
    JIBA_PRODUCTS.catnip.label,
  ];
}

export function jibaProductButtonPayloads(): string[] {
  return ['選雞霸兩片', '選青蛙凍乾', '選貓草雞肉乾'];
}
