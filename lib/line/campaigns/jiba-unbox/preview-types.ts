/**
 * 雞霸開箱 — 桌機預覽專用型別（不依賴 lib/line/reply，避免拉進 Reply/Push）。
 */

export type PreviewQuickReplyItem = {
  type: 'action';
  action:
    | { type: 'message'; label: string; text: string }
    | { type: 'uri'; label: string; uri: string };
};

export type PreviewLineMessage = (
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: Record<string, unknown> }
  | {
      type: 'image';
      originalContentUrl: string;
      previewImageUrl: string;
    }
) & {
  quickReply?: { items: PreviewQuickReplyItem[] };
};

export type PreviewFlexMessage = {
  type: 'flex';
  altText: string;
  contents: Record<string, unknown>;
  quickReply?: { items: PreviewQuickReplyItem[] };
};

export type JibaPreviewProductKey = 'jiba' | 'frog';

export type JibaPreviewStepId =
  | 'intro'
  | 'rules'
  | 'ask_product'
  | 'show_brief'
  | 'ask_name'
  | 'ask_phone'
  | 'ask_store'
  | 'confirm_store'
  | 'ask_ig'
  | 'ask_pet'
  | 'ask_license'
  | 'confirm_order'
  | 'submitted'
  | 'declined';

export type JibaPreviewChatItem = {
  id: string;
  role: 'bot' | 'user';
  messages: PreviewLineMessage[];
  /** 使用者訊息時的純文字 */
  userText?: string;
};

export type JibaPreviewState = {
  step: JibaPreviewStepId;
  productKey: JibaPreviewProductKey | null;
  transcript: JibaPreviewChatItem[];
  recipientName: string;
  recipientPhone: string;
  storeName: string;
  storeId: string;
  storeAddress: string;
  instagramHandle: string;
  petName: string | null;
};
