import {
  JIBA_PRODUCT_ACTION_TEXT,
  JIBA_PRODUCT_BUTTON_LABEL,
} from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_ASK_PRODUCT_ALT_TEXT,
  JIBA_ASK_PRODUCT_PROMPT,
  JIBA_ASK_PRODUCT_TITLE,
  JIBA_INVITE_ALT_TEXT,
  JIBA_INVITE_BODY,
  JIBA_INVITE_DECLINE,
  JIBA_INVITE_JOIN,
  JIBA_INVITE_TITLE,
  JIBA_UPSELL_ACCEPT,
  JIBA_UPSELL_ALT_TEXT,
  JIBA_UPSELL_BODY,
  JIBA_UPSELL_SKIP,
  JIBA_UPSELL_TITLE,
} from '@/lib/campaigns/jiba-two-piece/copy';
import { WORLD_THEME } from '@/lib/line/card-theme';
import { buildButtonMenuFlex } from '@/lib/line/flex-hubs';
import type { LineReplyMessage } from '@/lib/line/reply';

/** 首則邀請：單一決策，必須在「我要參加」前寫清 60 元物流處理費 */
export function jibaInviteMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: JIBA_INVITE_ALT_TEXT,
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

export function jibaInviteMessages(): LineReplyMessage[] {
  return [jibaInviteMenu()];
}

/** 三商品 Flex 按鈕；payload 為「選…」避免被姓名欄誤收 */
export function jibaProductChoiceMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: JIBA_ASK_PRODUCT_ALT_TEXT,
    theme: WORLD_THEME.chaos,
    title: JIBA_ASK_PRODUCT_TITLE,
    subtitle: JIBA_ASK_PRODUCT_PROMPT,
    items: [
      {
        label: JIBA_PRODUCT_BUTTON_LABEL.jiba,
        action: { type: 'message', text: JIBA_PRODUCT_ACTION_TEXT.jiba },
        style: 'primary',
      },
      {
        label: JIBA_PRODUCT_BUTTON_LABEL.frog,
        action: { type: 'message', text: JIBA_PRODUCT_ACTION_TEXT.frog },
        style: 'secondary',
      },
      {
        label: JIBA_PRODUCT_BUTTON_LABEL.catnip,
        action: { type: 'message', text: JIBA_PRODUCT_ACTION_TEXT.catnip },
        style: 'secondary',
      },
    ],
  });
}

export function jibaProductChoiceMessages(): LineReplyMessage[] {
  return [jibaProductChoiceMenu()];
}

/** 運送資訊齊備後的加購詢問：單一 Flex */
export function jibaUpsellMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: JIBA_UPSELL_ALT_TEXT,
    theme: WORLD_THEME.chaos,
    title: JIBA_UPSELL_TITLE,
    subtitle: JIBA_UPSELL_BODY,
    items: [
      {
        label: JIBA_UPSELL_SKIP,
        action: { type: 'message', text: JIBA_UPSELL_SKIP },
        style: 'primary',
      },
      {
        label: JIBA_UPSELL_ACCEPT,
        action: { type: 'message', text: JIBA_UPSELL_ACCEPT },
        style: 'secondary',
      },
    ],
  });
}

export function jibaUpsellMessages(): LineReplyMessage[] {
  return [jibaUpsellMenu()];
}
