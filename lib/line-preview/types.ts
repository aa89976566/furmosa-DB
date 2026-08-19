/**
 * HQ LINE 桌機預覽共用型別（不依賴 reply/push，避免誤接 live 發送）。
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

export type PreviewFlexMessage = Extract<PreviewLineMessage, { type: 'flex' }>;

export type PreviewChatItem = {
  id: string;
  role: 'bot' | 'user';
  messages: PreviewLineMessage[];
};
