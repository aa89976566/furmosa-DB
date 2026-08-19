/**
 * 雞霸開箱 — 純記憶體預覽狀態機（無 I/O、無網路、無 DB）。
 */
import {
  JIBA_PREVIEW_MOCK_INPUTS,
  JIBA_PREVIEW_MOCK_STORES,
  buildJibaPreviewBriefMessages,
  buildJibaPreviewConfirmMessages,
  buildJibaPreviewDeclineMessages,
  buildJibaPreviewIgAskMessages,
  buildJibaPreviewIntroMessages,
  buildJibaPreviewLicenseDeclineMessages,
  buildJibaPreviewLicenseMessages,
  buildJibaPreviewNameAskMessages,
  buildJibaPreviewPetAskMessages,
  buildJibaPreviewPhoneAskMessages,
  buildJibaPreviewProductAskMessages,
  buildJibaPreviewRulesMessages,
  buildJibaPreviewStoreAskMessages,
  buildJibaPreviewStoreConfirmMessages,
  buildJibaPreviewSubmittedMessages,
} from '@/lib/line/campaigns/jiba-unbox/preview-messages';
import type {
  JibaPreviewChatItem,
  JibaPreviewProductKey,
  JibaPreviewState,
  JibaPreviewStepId,
  PreviewLineMessage,
} from '@/lib/line/campaigns/jiba-unbox/preview-types';

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

function botItem(messages: PreviewLineMessage[]): JibaPreviewChatItem {
  return { id: nextId('bot'), role: 'bot', messages };
}

function userItem(text: string): JibaPreviewChatItem {
  return {
    id: nextId('user'),
    role: 'user',
    messages: [{ type: 'text', text }],
    userText: text,
  };
}

export function createInitialJibaPreviewState(): JibaPreviewState {
  idSeq = 0;
  return {
    step: 'intro',
    productKey: null,
    transcript: [botItem(buildJibaPreviewIntroMessages())],
    recipientName: '',
    recipientPhone: '',
    storeName: '',
    storeId: '',
    storeAddress: '',
    instagramHandle: '',
    petName: null,
  };
}

export function resetJibaPreviewState(): JibaPreviewState {
  return createInitialJibaPreviewState();
}

export const JIBA_PREVIEW_STEP_LABELS: Record<JibaPreviewStepId, string> = {
  intro: '介紹',
  rules: '規則',
  ask_product: '選商品',
  show_brief: '投稿說明',
  ask_name: '收件人姓名',
  ask_phone: '收件手機',
  ask_store: '輸入門市',
  confirm_store: '確認門市',
  ask_ig: 'Instagram',
  ask_pet: '毛孩名',
  ask_license: '授權同意',
  confirm_order: '確認送出',
  submitted: '已送出（預覽）',
  declined: '已婉拒（預覽）',
};

/** 可點擊的建議動作（依目前步驟） */
export function listJibaPreviewSuggestedActions(state: JibaPreviewState): {
  label: string;
  text: string;
  kind: 'primary' | 'secondary';
}[] {
  switch (state.step) {
    case 'intro':
      return [
        { label: '我要參加', text: '我要參加', kind: 'primary' },
        { label: '先看看規則', text: '先看看規則', kind: 'secondary' },
        { label: '這次先不要', text: '這次先不要', kind: 'secondary' },
      ];
    case 'rules':
      return [
        { label: '這個我可以！', text: '這個我可以！', kind: 'primary' },
        { label: '我再想一下', text: '我再想一下', kind: 'secondary' },
      ];
    case 'ask_product':
      return [
        { label: '選雞霸兩片', text: '選雞霸兩片', kind: 'primary' },
        { label: '選青蛙凍乾', text: '選青蛙凍乾', kind: 'secondary' },
      ];
    case 'show_brief':
      return [
        {
          label: '好，開始填資料',
          text: '好，開始填資料',
          kind: 'primary',
        },
      ];
    case 'ask_name':
      return [
        {
          label: `填入 ${JIBA_PREVIEW_MOCK_INPUTS.recipientName}`,
          text: JIBA_PREVIEW_MOCK_INPUTS.recipientName,
          kind: 'primary',
        },
      ];
    case 'ask_phone':
      return [
        {
          label: `填入 ${JIBA_PREVIEW_MOCK_INPUTS.recipientPhone}`,
          text: JIBA_PREVIEW_MOCK_INPUTS.recipientPhone,
          kind: 'primary',
        },
      ];
    case 'ask_store':
      return [
        {
          label: `搜尋「${JIBA_PREVIEW_MOCK_INPUTS.storeQuery}」`,
          text: JIBA_PREVIEW_MOCK_INPUTS.storeQuery,
          kind: 'primary',
        },
      ];
    case 'confirm_store':
      return [
        {
          label: '選門市1（板橋新埔）',
          text: JIBA_PREVIEW_MOCK_INPUTS.pickStoreText,
          kind: 'primary',
        },
        { label: '重選門市', text: '重選門市', kind: 'secondary' },
      ];
    case 'ask_ig':
      return [
        {
          label: `填入 ${JIBA_PREVIEW_MOCK_INPUTS.instagramHandle}`,
          text: JIBA_PREVIEW_MOCK_INPUTS.instagramHandle,
          kind: 'primary',
        },
      ];
    case 'ask_pet':
      return [
        {
          label: `填入 ${JIBA_PREVIEW_MOCK_INPUTS.petName}`,
          text: JIBA_PREVIEW_MOCK_INPUTS.petName,
          kind: 'primary',
        },
        { label: '略過', text: '略過', kind: 'secondary' },
      ];
    case 'ask_license':
      return [
        { label: '我同意', text: '我同意', kind: 'primary' },
        { label: '不同意', text: '不同意', kind: 'secondary' },
      ];
    case 'confirm_order':
      return [
        { label: '資料正確，送出', text: '資料正確，送出', kind: 'primary' },
        { label: '先不要送出', text: '先不要送出', kind: 'secondary' },
      ];
    default:
      return [];
  }
}

function parseProductKey(text: string): JibaPreviewProductKey | null {
  const t = text.trim();
  if (/^(?:選雞霸兩片|壕大大雞霸兩片|壕大大雞霸|雞霸兩片|雞霸)$/i.test(t)) {
    return 'jiba';
  }
  if (/^(?:選青蛙凍乾|青蛙凍乾一隻|青蛙凍乾|青蛙)$/i.test(t)) {
    return 'frog';
  }
  return null;
}

function append(
  state: JibaPreviewState,
  userText: string,
  next: Partial<JibaPreviewState> & { botMessages: PreviewLineMessage[] },
): JibaPreviewState {
  const { botMessages, ...rest } = next;
  return {
    ...state,
    ...rest,
    transcript: [
      ...state.transcript,
      userItem(userText),
      botItem(botMessages),
    ],
  };
}

/**
 * 套用使用者輸入，回傳新狀態（immutable）。
 * 未知輸入時回覆提示，不寫入任何外部系統。
 */
export function applyJibaPreviewInput(
  state: JibaPreviewState,
  raw: string,
): JibaPreviewState {
  const text = raw.trim();
  if (!text) return state;

  switch (state.step) {
    case 'intro': {
      if (/^先看看規則$/.test(text)) {
        return append(state, text, {
          step: 'rules',
          botMessages: buildJibaPreviewRulesMessages(),
        });
      }
      if (/^(?:這次先不要|不要|先不要|我再想一下)$/i.test(text)) {
        return append(state, text, {
          step: 'declined',
          botMessages: buildJibaPreviewDeclineMessages(),
        });
      }
      if (/^(?:我要參加|要|可以|好|來吧|這個我可以！)$/i.test(text)) {
        return append(state, text, {
          step: 'ask_product',
          botMessages: buildJibaPreviewProductAskMessages(),
        });
      }
      return append(state, text, {
        botMessages: [
          {
            type: 'text',
            text: '（預覽）請點「我要參加／先看看規則／這次先不要」。',
          },
          ...buildJibaPreviewIntroMessages().slice(2),
        ],
      });
    }
    case 'rules': {
      if (/^(?:我再想一下|這次先不要|不要|先不要)$/i.test(text)) {
        return append(state, text, {
          step: 'declined',
          botMessages: buildJibaPreviewDeclineMessages(),
        });
      }
      if (/^(?:這個我可以！|我要參加|可以|好)$/i.test(text)) {
        return append(state, text, {
          step: 'ask_product',
          botMessages: buildJibaPreviewProductAskMessages(),
        });
      }
      return append(state, text, {
        botMessages: [
          { type: 'text', text: '（預覽）請點規則頁按鈕。' },
          ...buildJibaPreviewRulesMessages().slice(1),
        ],
      });
    }
    case 'ask_product': {
      const productKey = parseProductKey(text);
      if (!productKey) {
        return append(state, text, {
          botMessages: [
            { type: 'text', text: '請點下面按鈕選一種喔～' },
            ...buildJibaPreviewProductAskMessages().slice(1),
          ],
        });
      }
      return append(state, text, {
        step: 'show_brief',
        productKey,
        botMessages: buildJibaPreviewBriefMessages(productKey),
      });
    }
    case 'show_brief': {
      if (!/^(?:好，開始填資料|開始填資料|繼續|好)$/i.test(text)) {
        const key = state.productKey ?? 'jiba';
        return append(state, text, {
          botMessages: buildJibaPreviewBriefMessages(key).slice(1),
        });
      }
      return append(state, text, {
        step: 'ask_name',
        botMessages: buildJibaPreviewNameAskMessages(),
      });
    }
    case 'ask_name': {
      return append(state, text, {
        step: 'ask_phone',
        recipientName: text,
        botMessages: buildJibaPreviewPhoneAskMessages(),
      });
    }
    case 'ask_phone': {
      return append(state, text, {
        step: 'ask_store',
        recipientPhone: text,
        botMessages: buildJibaPreviewStoreAskMessages(),
      });
    }
    case 'ask_store': {
      return append(state, text, {
        step: 'confirm_store',
        botMessages: buildJibaPreviewStoreConfirmMessages([
          ...JIBA_PREVIEW_MOCK_STORES,
        ]),
      });
    }
    case 'confirm_store': {
      if (/^重選門市$/.test(text)) {
        return append(state, text, {
          step: 'ask_store',
          botMessages: buildJibaPreviewStoreAskMessages(),
        });
      }
      const store = JIBA_PREVIEW_MOCK_STORES[0];
      return append(state, text, {
        step: 'ask_ig',
        storeId: store.storeId,
        storeName: store.storeName,
        storeAddress: store.storeAddress,
        botMessages: buildJibaPreviewIgAskMessages(),
      });
    }
    case 'ask_ig': {
      return append(state, text, {
        step: 'ask_pet',
        instagramHandle: text.startsWith('@') ? text : `@${text}`,
        botMessages: buildJibaPreviewPetAskMessages(),
      });
    }
    case 'ask_pet': {
      const pet = /^略過$/i.test(text) ? null : text;
      return append(state, text, {
        step: 'ask_license',
        petName: pet,
        botMessages: buildJibaPreviewLicenseMessages(),
      });
    }
    case 'ask_license': {
      if (/^不同意$/.test(text)) {
        return append(state, text, {
          step: 'declined',
          botMessages: buildJibaPreviewLicenseDeclineMessages(),
        });
      }
      if (!/^(?:我同意|同意)$/i.test(text)) {
        return append(state, text, {
          botMessages: [
            {
              type: 'text',
              text: '這格要請你點下面按鈕明示同意或不同意喔。',
            },
            ...buildJibaPreviewLicenseMessages(),
          ],
        });
      }
      const productKey = state.productKey ?? 'jiba';
      return append(state, text, {
        step: 'confirm_order',
        botMessages: buildJibaPreviewConfirmMessages({
          productKey,
          recipientName: state.recipientName || JIBA_PREVIEW_MOCK_INPUTS.recipientName,
          recipientPhone:
            state.recipientPhone || JIBA_PREVIEW_MOCK_INPUTS.recipientPhone,
          storeName: state.storeName || JIBA_PREVIEW_MOCK_STORES[0].storeName,
          instagramHandle:
            state.instagramHandle || JIBA_PREVIEW_MOCK_INPUTS.instagramHandle,
          petName: state.petName,
        }),
      });
    }
    case 'confirm_order': {
      if (/^先不要送出$/.test(text)) {
        return append(state, text, {
          botMessages: [
            {
              type: 'text',
              text: '好喔，先幫你停在這裡，資料都留著。想送出時再說「資料正確，送出」就可以。',
            },
          ],
        });
      }
      if (/^資料正確，送出$/.test(text)) {
        return append(state, text, {
          step: 'submitted',
          botMessages: buildJibaPreviewSubmittedMessages(),
        });
      }
      return append(state, text, {
        botMessages: [
          {
            type: 'text',
            text: '（預覽）請選「資料正確，送出」或「先不要送出」。',
          },
        ],
      });
    }
    case 'submitted':
    case 'declined':
      return append(state, text, {
        botMessages: [
          {
            type: 'text',
            text: '（預覽）此路徑已結束。請按「重設預覽」從頭開始。',
          },
        ],
      });
    default:
      return state;
  }
}

/** 一鍵跑完指定商品路徑（固定 mock），方便對照兩條產品線 */
export function runJibaPreviewHappyPath(
  productKey: JibaPreviewProductKey,
): JibaPreviewState {
  let state = createInitialJibaPreviewState();
  const steps = [
    '我要參加',
    productKey === 'jiba' ? '選雞霸兩片' : '選青蛙凍乾',
    '好，開始填資料',
    JIBA_PREVIEW_MOCK_INPUTS.recipientName,
    JIBA_PREVIEW_MOCK_INPUTS.recipientPhone,
    JIBA_PREVIEW_MOCK_INPUTS.storeQuery,
    JIBA_PREVIEW_MOCK_INPUTS.pickStoreText,
    JIBA_PREVIEW_MOCK_INPUTS.instagramHandle,
    JIBA_PREVIEW_MOCK_INPUTS.petName,
    '我同意',
    '資料正確，送出',
  ];
  for (const input of steps) {
    state = applyJibaPreviewInput(state, input);
  }
  return state;
}

/** 收集 transcript 內全部 bot 訊息（供測試／JSON 檢視） */
export function collectJibaPreviewBotMessages(
  state: JibaPreviewState,
): PreviewLineMessage[] {
  return state.transcript
    .filter((t) => t.role === 'bot')
    .flatMap((t) => t.messages);
}
