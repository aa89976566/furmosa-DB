/**
 * 雞霸兩片開箱 — LINE 對話狀態機
 * DB（campaign_applications + conversation_sessions）為唯一真相來源。
 */
import {
  APP_STATUS,
  FLOW_STATE,
  JIBA_LICENSE_VERSION,
  JIBA_SUPERVISOR_NAME,
  type FlowState,
} from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_APPROVED,
  JIBA_ASK_IG,
  JIBA_ASK_NAME,
  JIBA_ASK_PET,
  JIBA_ASK_PHONE,
  JIBA_ASK_STORE,
  JIBA_BANK_INFO,
  JIBA_FIND_HELPER,
  JIBA_INTRO,
  JIBA_LICENSE,
  JIBA_LICENSE_DECLINE,
  JIBA_PAID,
  JIBA_PAY_LATER,
  JIBA_PENDING_HINT,
  JIBA_PHONE_ERROR,
  JIBA_REJECTED,
  JIBA_RULES,
  JIBA_START_WORK,
  JIBA_SUBMITTED,
  JIBA_TRANSFER_NOTED,
  jibaConfirmSummary,
  jibaReturnFieldCopy,
} from '@/lib/campaigns/jiba-two-piece/copy';
import { ensureJibaCampaignSchema } from '@/lib/campaigns/jiba-two-piece/ensure-schema';
import {
  appendConversationMessage,
  approveAndCreatePayment,
  createJibaEnrollment,
  findActiveJibaApplication,
  markShippingPaid,
  rejectApplication,
  returnForEdit,
  setConversationState,
  submitForReview,
  syncApplicationFields,
} from '@/lib/campaigns/jiba-two-piece/service';
import { searchStoreCandidates } from '@/lib/campaigns/jiba-two-piece/store-search';
import {
  isDeclineIntent,
  isJoinIntent,
  normalizeInstagramHandle,
  validRecipientName,
  validRecipientPhone,
} from '@/lib/campaigns/jiba-two-piece/validation';
import { WORLD_THEME } from '@/lib/line/card-theme';
import {
  buildButtonMenuFlex,
  lineAssetUrl,
} from '@/lib/line/flex-hubs';
import {
  clearLineChatSession,
  upsertLineChatSession,
} from '@/lib/line/chat-session';
import { replyLineMessage, type LineReplyMessage } from '@/lib/line/reply';
import { pushLineMessages } from '@/lib/line/push';
import { prisma } from '@/lib/prisma';

/** 開箱流程回覆：拆泡後若超過 5 則，其餘 push 接續 */
async function replyJiba(
  replyToken: string,
  lineUserId: string,
  messages: LineReplyMessage[],
) {
  await replyLineMessage(replyToken, messages, { lineUserId });
}

function jibaUnboxCoverUrl(): string {
  return lineAssetUrl('/line/events/jiba-unbox-cover.png');
}

/** 開箱入口／規則頁：封面圖後的垂直選項（每步保留設計好的選擇內容） */
function jibaIntroChoiceMenu(title: string, subtitle: string): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: title,
    theme: WORLD_THEME.chaos,
    title,
    subtitle,
    items: [
      {
        label: '我要參加',
        action: { type: 'message', text: '我要參加' },
        style: 'primary',
      },
      {
        label: '先看看規則',
        action: { type: 'message', text: '先看看規則' },
      },
      {
        label: '這次先不要',
        action: { type: 'message', text: '這次先不要' },
      },
    ],
  });
}

function jibaRulesChoiceMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: '開箱規則',
    theme: WORLD_THEME.chaos,
    title: '看完了？',
    subtitle: '點下面按鈕繼續。',
    items: [
      {
        label: '這個我可以！',
        action: { type: 'message', text: '這個我可以！' },
        style: 'primary',
      },
      {
        label: '我再想一下',
        action: { type: 'message', text: '我再想一下' },
      },
    ],
  });
}

function textWithQr(
  text: string,
  items: { label: string; text: string }[],
): LineReplyMessage {
  const msg: LineReplyMessage = { type: 'text', text };
  if (items.length > 0) {
    msg.quickReply = {
      items: items.slice(0, 13).map((i) => ({
        type: 'action',
        action: {
          type: 'message',
          label: i.label.slice(0, 20),
          text: i.text,
        },
      })),
    };
  }
  return msg;
}

function payAskQuickReplies() {
  return [
    { label: '現在付款', text: '現在付款' },
    { label: `找${JIBA_SUPERVISOR_NAME}`, text: `找${JIBA_SUPERVISOR_NAME}` },
    { label: '稍後再說', text: '稍後再說' },
  ];
}

function bankInfoQuickReplies() {
  return [
    { label: '我已轉帳', text: '我已轉帳' },
    { label: `找${JIBA_SUPERVISOR_NAME}`, text: `找${JIBA_SUPERVISOR_NAME}` },
  ];
}

function isFindHelper(text: string): boolean {
  return /^(?:找壽司匠|找真人|找小幫手)$/.test(text.trim());
}

async function logBot(sessionId: string, text: string, extra?: Record<string, unknown>) {
  await appendConversationMessage({
    sessionId,
    senderType: 'bot',
    text,
    extra,
  });
}

async function logCustomer(sessionId: string, text: string, lineMessageId?: string) {
  await appendConversationMessage({
    sessionId,
    senderType: 'customer',
    text,
    lineMessageId,
  });
}

function promptForState(state: FlowState): string {
  switch (state) {
    case FLOW_STATE.ASK_RECIPIENT_NAME:
      return JIBA_ASK_NAME;
    case FLOW_STATE.ASK_RECIPIENT_PHONE:
      return JIBA_ASK_PHONE;
    case FLOW_STATE.ASK_STORE:
    case FLOW_STATE.CONFIRM_STORE:
      return JIBA_ASK_STORE;
    case FLOW_STATE.ASK_INSTAGRAM:
      return JIBA_ASK_IG;
    case FLOW_STATE.ASK_PET_NAME:
      return JIBA_ASK_PET;
    case FLOW_STATE.ASK_CONTENT_LICENSE:
      return JIBA_LICENSE;
    case FLOW_STATE.SHOW_ORDER_CONFIRMATION:
      return '資料還在確認頁。要送出就回「資料正確，送出」。';
    case FLOW_STATE.PENDING_REVIEW:
      return '還在等主管瞄一眼。通過後會丟運費連結給你。';
    case FLOW_STATE.AWAITING_SHIPPING_PAYMENT:
      return '運費連結還在等你。付完雞霸才出發。';
    case FLOW_STATE.READY_TO_SHIP:
      return JIBA_PAID;
    default:
      return `接著上次。傳「查看目前資料」或「找${JIBA_SUPERVISOR_NAME}」。`;
  }
}

/** 入口：開箱任務 cover + intro（campaign 表未就緒時仍要能開場對話） */
export async function startJibaUnboxIntro(
  replyToken: string,
  lineUserId: string,
): Promise<void> {
  try {
    const active = await findActiveJibaApplication(lineUserId);
    if (active?.conversationSession) {
      const state = active.conversationSession.currentState as FlowState;
      await upsertLineChatSession(lineUserId, 'jiba_unbox', state, {
        applicationId: active.id,
        phase: 'resume',
      });
      const prompt = promptForState(state);
      await replyJiba(replyToken, lineUserId, [
        {
          type: 'text',
          text: `你還有一筆進行中的開箱申請。\n接著上次：`,
        },
        { type: 'text', text: prompt },
      ]);
      return;
    }
  } catch (err) {
    console.error('[jiba-unbox] findActiveJibaApplication failed', err);
  }

  const cover = jibaUnboxCoverUrl();
  await replyJiba(replyToken, lineUserId, [
    {
      type: 'image',
      originalContentUrl: cover,
      previewImageUrl: cover,
    },
    { type: 'text', text: JIBA_INTRO },
    jibaIntroChoiceMenu('開箱任務', '點下面按鈕，由上往下選。'),
  ]);

  try {
    await upsertLineChatSession(lineUserId, 'jiba_unbox', FLOW_STATE.CAMPAIGN_INTRO, {
      phase: 'intro',
    });
  } catch (err) {
    console.error('[jiba-unbox] upsertLineChatSession failed', err);
  }
}

export async function isJibaUnboxSessionActive(lineUserId: string): Promise<boolean> {
  try {
    const chat = await prisma.lineChatSession.findUnique({ where: { lineUserId } });
    if (chat?.flow === 'jiba_unbox') return true;
  } catch (err) {
    console.error('[jiba-unbox] lineChatSession lookup failed', err);
    return false;
  }
  try {
    const app = await findActiveJibaApplication(lineUserId);
    return Boolean(app?.conversationSession);
  } catch (err) {
    console.error('[jiba-unbox] campaign lookup failed', err);
    return false;
  }
}

async function beginEnrollment(
  replyToken: string,
  lineUserId: string,
  trimmed: string,
  lineMessageId?: string,
) {
  const run = async () => {
    const existing = await findActiveJibaApplication(lineUserId);
    const app = existing ?? (await createJibaEnrollment({ lineUserId }));
    const sid = app.conversationSession!.id;
    const state = app.conversationSession!.currentState as FlowState;

    await upsertLineChatSession(lineUserId, 'jiba_unbox', state, {
      applicationId: app.id,
    });
    await logCustomer(sid, trimmed, lineMessageId);

    if (existing && state !== FLOW_STATE.ASK_RECIPIENT_NAME) {
      const prompt = promptForState(state);
      await logBot(sid, `接著上次。\n${prompt}`);
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: '你上次還沒填完，接著來。' },
        { type: 'text', text: prompt },
      ]);
      return;
    }

    await logBot(sid, JIBA_START_WORK);
    await logBot(sid, JIBA_ASK_NAME);
    await replyJiba(replyToken, lineUserId, [
      { type: 'text', text: JIBA_START_WORK },
      { type: 'text', text: JIBA_ASK_NAME },
    ]);
  };

  try {
    await ensureJibaCampaignSchema();
    await run();
  } catch (err) {
    console.error('[jiba-unbox] beginEnrollment failed, retrying after schema ensure', err);
    try {
      await ensureJibaCampaignSchema();
      await run();
    } catch (retryErr) {
      console.error('[jiba-unbox] beginEnrollment retry failed', retryErr);
      await replyJiba(replyToken, lineUserId, [
        {
          type: 'text',
          text: '開箱系統剛剛打了個嗝。再點一次「開箱任務」，或稍後再試。',
        },
      ]);
    }
  }
}

function parseCollected(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 開箱進行中若點其他入口，應離開開箱、交回一般訊息處理 */
const LEAVE_UNBOX_RE =
  /^(?:一起野放|野放一下|預約美容|漂亮一下|換罐計畫|換罐計劃|回家|還有很多故事|野放中|嗷嗚計劃|嗷嗚計畫|活動中心|沒梗了|青蛙誰在怕|清蛙誰在怕|開箱任務|毛孩來開箱)$/;

async function safeFindActiveJibaApplication(lineUserId: string) {
  try {
    return await findActiveJibaApplication(lineUserId);
  } catch (err) {
    console.error('[jiba-unbox] findActiveJibaApplication failed', err);
    return null;
  }
}

/** 處理開箱流程中的文字／Quick Reply */
export async function handleJibaUnboxMessage(
  replyToken: string,
  lineUserId: string,
  text: string,
  lineMessageId?: string,
): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // 點了別的世界／一起野放子鍵 → 離開開箱，讓外層路由接手
  if (LEAVE_UNBOX_RE.test(trimmed)) {
    try {
      await clearLineChatSession(lineUserId);
    } catch (err) {
      console.error('[jiba-unbox] clear session on leave failed', err);
    }
    return false;
  }

  if (/^(取消|重來)$/.test(trimmed)) {
    const app = await safeFindActiveJibaApplication(lineUserId);
    if (app) {
      try {
        const prev = app.status;
        await prisma.campaignApplication.update({
          where: { id: app.id },
          data: { status: APP_STATUS.CANCELLED_BY_USER, shippingQueueStatus: 'NOT_READY' },
        });
        if (app.orderId) {
          await prisma.order.update({
            where: { id: app.orderId },
            data: { status: 'cancelled' },
          });
        }
        if (app.conversationSession) {
          await setConversationState(app.conversationSession.id, FLOW_STATE.CANCELLED);
          await logCustomer(app.conversationSession.id, trimmed, lineMessageId);
          await logBot(
            app.conversationSession.id,
            '好，這次先收工。想參加再說一聲「開箱任務」。',
          );
        }
        await prisma.statusAuditLog.create({
          data: {
            entityType: 'campaign_application',
            entityId: app.id,
            previousStatus: prev,
            newStatus: APP_STATUS.CANCELLED_BY_USER,
            actorType: 'customer',
            applicationId: app.id,
          },
        });
      } catch (err) {
        console.error('[jiba-unbox] cancel cleanup failed', err);
      }
    }
    await clearLineChatSession(lineUserId);
    await replyJiba(replyToken, lineUserId, [
      { type: 'text', text: '好，這次先收工。想參加再說一聲「開箱任務」。' },
    ]);
    return true;
  }

  if (isFindHelper(trimmed)) {
    const app = await safeFindActiveJibaApplication(lineUserId);
    if (app?.conversationSession) {
      try {
        await prisma.conversationSession.update({
          where: { id: app.conversationSession.id },
          data: { operatorTakeover: true },
        });
        await logCustomer(app.conversationSession.id, trimmed, lineMessageId);
        await logBot(app.conversationSession.id, JIBA_FIND_HELPER);
      } catch (err) {
        console.error('[jiba-unbox] find helper log failed', err);
      }
    }
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_FIND_HELPER }]);
    return true;
  }

  if (/^查看目前資料$/.test(trimmed)) {
    const app = await safeFindActiveJibaApplication(lineUserId);
    if (!app) {
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: '目前沒有進行中的開箱申請。' },
      ]);
      return true;
    }
    const summary = jibaConfirmSummary({
      recipientName: app.recipientName || '（未填）',
      recipientPhone: app.recipientPhone || '（未填）',
      storeName: app.storeName || '（未填）',
      instagramHandle: app.instagramHandle || '（未填）',
      petName: app.petName,
    });
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: summary }]);
    return true;
  }

  const chat = await prisma.lineChatSession.findUnique({ where: { lineUserId } });
  let app = await safeFindActiveJibaApplication(lineUserId);

  // Intro / rules（尚未建立申請）
  if (!app && chat?.flow === 'jiba_unbox') {
    if (/^先看看規則$/.test(trimmed)) {
      await upsertLineChatSession(lineUserId, 'jiba_unbox', FLOW_STATE.SHOW_RULES, {
        phase: 'rules',
      });
      const cover = jibaUnboxCoverUrl();
      await replyJiba(replyToken, lineUserId, [
        {
          type: 'image',
          originalContentUrl: cover,
          previewImageUrl: cover,
        },
        { type: 'text', text: JIBA_RULES },
        jibaRulesChoiceMenu(),
      ]);
      return true;
    }
    if (isDeclineIntent(trimmed)) {
      await clearLineChatSession(lineUserId);
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: '好，雞霸先回冰箱。下次想上工再叫我們。' },
      ]);
      return true;
    }
    if (isJoinIntent(trimmed) || /^這個我可以！$/.test(trimmed) || /^敢，來吧$/.test(trimmed)) {
      await beginEnrollment(replyToken, lineUserId, trimmed, lineMessageId);
      return true;
    }
    if (chat.step === FLOW_STATE.CAMPAIGN_INTRO || chat.step === FLOW_STATE.SHOW_RULES) {
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: '這題請用下面按鈕回。要上工、看規則，或這次先不要。' },
        chat.step === FLOW_STATE.SHOW_RULES
          ? jibaRulesChoiceMenu()
          : jibaIntroChoiceMenu('開箱任務', '點下面按鈕，由上往下選。'),
      ]);
      return true;
    }
  }

  // 自然語言參加（無 intro session，但有活動意圖且無進行中申請）
  if (!app && isJoinIntent(trimmed) && chat?.flow !== 'register') {
    // 僅在明確開箱語境（剛看過 intro）才自動開單；此處交給 false 避免誤觸
  }

  if (!app?.conversationSession) {
    return false;
  }

  if (app.conversationSession.operatorTakeover) {
    await logCustomer(app.conversationSession.id, trimmed, lineMessageId);
    return true;
  }

  const sid = app.conversationSession.id;
  const state = app.conversationSession.currentState as FlowState;
  await logCustomer(sid, trimmed, lineMessageId);

  if (state === FLOW_STATE.PENDING_REVIEW) {
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_PENDING_HINT }]);
    return true;
  }
  if (state === FLOW_STATE.AWAITING_SHIPPING_PAYMENT) {
    if (/^(?:現在付款|我要轉帳|轉帳資訊)$/.test(trimmed)) {
      await logBot(sid, JIBA_BANK_INFO);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_BANK_INFO, bankInfoQuickReplies()),
      ]);
      return true;
    }
    if (/^(?:稍後再說|等等再付|先不用)$/.test(trimmed)) {
      await logBot(sid, JIBA_PAY_LATER);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_PAY_LATER, payAskQuickReplies()),
      ]);
      return true;
    }
    if (/^我已轉帳$/.test(trimmed)) {
      await logBot(sid, JIBA_TRANSFER_NOTED);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_TRANSFER_NOTED, [
          { label: `找${JIBA_SUPERVISOR_NAME}`, text: `找${JIBA_SUPERVISOR_NAME}` },
          { label: '再看轉帳資訊', text: '現在付款' },
        ]),
      ]);
      return true;
    }
    await replyJiba(replyToken, lineUserId, [
      textWithQr(JIBA_APPROVED, payAskQuickReplies()),
    ]);
    return true;
  }
  if (state === FLOW_STATE.READY_TO_SHIP) {
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_PAID }]);
    return true;
  }

  switch (state) {
    case FLOW_STATE.ASK_RECIPIENT_NAME: {
      const name = validRecipientName(trimmed);
      if (!name) {
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: '姓名請用 2～20 個字，別只打數字。再試一次？' },
        ]);
        return true;
      }
      await syncApplicationFields(app.id, { recipientName: name });
      await setConversationState(sid, FLOW_STATE.ASK_RECIPIENT_PHONE, {
        recipientName: name,
      });
      await logBot(sid, JIBA_ASK_PHONE);
      await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_ASK_PHONE }]);
      return true;
    }
    case FLOW_STATE.ASK_RECIPIENT_PHONE: {
      const phone = validRecipientPhone(trimmed);
      if (!phone) {
        await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_PHONE_ERROR }]);
        return true;
      }
      await syncApplicationFields(app.id, { recipientPhone: phone });
      await setConversationState(sid, FLOW_STATE.ASK_STORE, { recipientPhone: phone });
      await logBot(sid, JIBA_ASK_STORE);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_ASK_STORE, [
          { label: '手動輸入門市', text: '手動輸入門市' },
        ]),
      ]);
      return true;
    }
    case FLOW_STATE.ASK_STORE: {
      if (/^手動輸入門市$/.test(trimmed)) {
        await replyJiba(replyToken, lineUserId, [
          {
            type: 'text',
            text: '請輸入「門市名稱＋縣市區域」。\n例如：板橋新埔門市。',
          },
        ]);
        return true;
      }
      if (trimmed.length < 2) {
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: '門市名稱再寫清楚一點，例如：板橋新埔門市。' },
        ]);
        return true;
      }
      const candidates = searchStoreCandidates(trimmed);
      await setConversationState(sid, FLOW_STATE.CONFIRM_STORE, {
        storeCandidates: candidates,
        pendingStoreQuery: trimmed,
      });
      const lines = candidates
        .map((c, i) => `${i + 1}. ${c.storeName}${c.storeId ? `（${c.storeId}）` : ''}`)
        .join('\n');
      const qrItems = candidates.slice(0, 4).map((c, i) => ({
        label: `${i + 1}.${c.storeName}`.slice(0, 20),
        text: `選門市${i + 1}`,
      }));
      qrItems.push({ label: '重選', text: '重選門市' });
      await replyJiba(replyToken, lineUserId, [
        textWithQr(
          `找到這些候選。選一間你真的會去的：\n\n${lines}\n\n回「選門市1」或點下面按鈕。\n自由文字不會直接寫進訂單。`,
          qrItems,
        ),
      ]);
      return true;
    }
    case FLOW_STATE.CONFIRM_STORE: {
      if (/^重選門市$/.test(trimmed)) {
        await setConversationState(sid, FLOW_STATE.ASK_STORE);
        await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_ASK_STORE }]);
        return true;
      }
      const sess = await prisma.conversationSession.findUniqueOrThrow({ where: { id: sid } });
      const collected = parseCollected(sess.collectedDataJson);
      const candidates = (collected.storeCandidates as
        | { storeId: string; storeName: string; storeAddress: string }[]
        | undefined) ?? [];

      type Cand = { storeId: string; storeName: string; storeAddress: string };
      let picked: Cand | null = null;
      const pickIdx = (() => {
        const m = trimmed.match(/^選門市\s*(\d+)$/);
        if (!m) return -1;
        return Number(m[1]) - 1;
      })();
      if (pickIdx >= 0 && pickIdx < candidates.length) {
        picked = candidates[pickIdx] ?? null;
      }

      if (!picked && /^就是這間$/.test(trimmed) && candidates.length === 1) {
        picked = candidates[0] ?? null;
      }
      // 允許直接回候選名稱
      if (!picked) {
        picked =
          candidates.find(
            (c) => c.storeName === trimmed || `${c.storeName}（${c.storeId}）` === trimmed,
          ) ?? null;
      }

      if (!picked) {
        await replyJiba(replyToken, lineUserId, [
          textWithQr('請從候選裡選一間，或回「重選門市」。', [
            ...candidates.slice(0, 4).map((c, i) => ({
              label: `${i + 1}.${c.storeName}`.slice(0, 20),
              text: `選門市${i + 1}`,
            })),
            { label: '重選', text: '重選門市' },
          ]),
        ]);
        return true;
      }

      await syncApplicationFields(app.id, {
        storeId: picked.storeId || null,
        storeName: picked.storeName,
        storeAddress: picked.storeAddress,
      });
      await setConversationState(sid, FLOW_STATE.ASK_INSTAGRAM, {
        storeName: picked.storeName,
        storeId: picked.storeId,
      });
      await logBot(sid, JIBA_ASK_IG);
      await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_ASK_IG }]);
      return true;
    }
    case FLOW_STATE.ASK_INSTAGRAM: {
      const ig = normalizeInstagramHandle(trimmed);
      if (!ig) {
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: '請輸入 @ 開頭的 Instagram 帳號。' },
        ]);
        return true;
      }
      await syncApplicationFields(app.id, { instagramHandle: ig });
      await setConversationState(sid, FLOW_STATE.ASK_PET_NAME, { instagramHandle: ig });
      await logBot(sid, JIBA_ASK_PET);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_ASK_PET, [{ label: '略過', text: '略過' }]),
      ]);
      return true;
    }
    case FLOW_STATE.ASK_PET_NAME: {
      const pet = /^(略過|跳过|skip|不填)$/i.test(trimmed) ? null : trimmed.slice(0, 40);
      await syncApplicationFields(app.id, { petName: pet });
      await setConversationState(sid, FLOW_STATE.ASK_CONTENT_LICENSE, { petName: pet });
      await logBot(sid, JIBA_LICENSE);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_LICENSE, [
          { label: '我同意', text: '我同意' },
          { label: '我想再看一次', text: '我想再看一次' },
          { label: '不同意', text: '不同意' },
        ]),
      ]);
      return true;
    }
    case FLOW_STATE.ASK_CONTENT_LICENSE: {
      if (/^我想再看一次$/.test(trimmed)) {
        await replyJiba(replyToken, lineUserId, [
          textWithQr(JIBA_LICENSE, [
            { label: '我同意', text: '我同意' },
            { label: '我想再看一次', text: '我想再看一次' },
            { label: '不同意', text: '不同意' },
          ]),
        ]);
        return true;
      }
      if (/^不同意$/.test(trimmed)) {
        await prisma.campaignApplication.update({
          where: { id: app.id },
          data: {
            status: APP_STATUS.CANCELLED_BY_USER,
            shippingQueueStatus: 'NOT_READY',
            licenseAccepted: false,
          },
        });
        if (app.orderId) {
          await prisma.order.update({
            where: { id: app.orderId },
            data: { status: 'cancelled' },
          });
        }
        await setConversationState(sid, FLOW_STATE.CANCELLED);
        await clearLineChatSession(lineUserId);
        await logBot(sid, JIBA_LICENSE_DECLINE);
        await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_LICENSE_DECLINE }]);
        return true;
      }
      if (!/^我同意$/.test(trimmed)) {
        await replyJiba(replyToken, lineUserId, [
          textWithQr('這格要明示同意或不同意。', [
            { label: '我同意', text: '我同意' },
            { label: '不同意', text: '不同意' },
          ]),
        ]);
        return true;
      }
      await prisma.campaignApplication.update({
        where: { id: app.id },
        data: {
          licenseAccepted: true,
          licenseVersion: JIBA_LICENSE_VERSION,
          licenseAcceptedAt: new Date(),
          licenseSourceMsgId: lineMessageId ?? null,
        },
      });
      const fresh = await prisma.campaignApplication.findUniqueOrThrow({
        where: { id: app.id },
      });
      await setConversationState(sid, FLOW_STATE.SHOW_ORDER_CONFIRMATION);
      const summary = jibaConfirmSummary({
        recipientName: fresh.recipientName || '',
        recipientPhone: fresh.recipientPhone || '',
        storeName: fresh.storeName || '',
        instagramHandle: fresh.instagramHandle || '',
        petName: fresh.petName,
      });
      await logBot(sid, summary);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(summary, [
          { label: '資料正確，送出', text: '資料正確，送出' },
          { label: '修改收件資料', text: '修改收件資料' },
          { label: '修改門市', text: '修改門市' },
          { label: '先不要送出', text: '先不要送出' },
        ]),
      ]);
      return true;
    }
    case FLOW_STATE.SHOW_ORDER_CONFIRMATION: {
      if (/^先不要送出$/.test(trimmed)) {
        await replyJiba(replyToken, lineUserId, [
          {
            type: 'text',
            text: '好，先停在這。資料留著。要送出再說「資料正確，送出」。',
          },
        ]);
        return true;
      }
      if (/^修改收件資料$/.test(trimmed)) {
        await setConversationState(sid, FLOW_STATE.ASK_RECIPIENT_NAME);
        await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_ASK_NAME }]);
        return true;
      }
      if (/^修改門市$/.test(trimmed)) {
        await setConversationState(sid, FLOW_STATE.ASK_STORE);
        await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_ASK_STORE }]);
        return true;
      }
      if (!/^資料正確，送出$/.test(trimmed)) {
        await replyJiba(replyToken, lineUserId, [
          textWithQr('請確認：資料正確送出，或修改某一格。', [
            { label: '資料正確，送出', text: '資料正確，送出' },
            { label: '修改收件資料', text: '修改收件資料' },
            { label: '修改門市', text: '修改門市' },
          ]),
        ]);
        return true;
      }
      if (!app.licenseAccepted) {
        await setConversationState(sid, FLOW_STATE.ASK_CONTENT_LICENSE);
        await replyJiba(replyToken, lineUserId, [
          textWithQr('送出前還差授權同意。', [
            { label: '我同意', text: '我同意' },
            { label: '不同意', text: '不同意' },
          ]),
        ]);
        return true;
      }
      await submitForReview(app.id);
      await upsertLineChatSession(lineUserId, 'jiba_unbox', FLOW_STATE.PENDING_REVIEW, {
        applicationId: app.id,
      });
      await logBot(sid, JIBA_SUBMITTED);
      await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_SUBMITTED }]);
      return true;
    }
    default:
      await replyJiba(replyToken, lineUserId, [
        {
          type: 'text',
          text: `這步有點卡住。傳「查看目前資料」或「找${JIBA_SUPERVISOR_NAME}」。`,
        },
      ]);
      return true;
  }
}

/** 壽司匠通過後：詢問是否轉帳（無線上金流） */
export async function notifyJibaApproved(applicationId: string, note?: string) {
  const app = await approveAndCreatePayment({
    applicationId,
    note,
    reviewerName: JIBA_SUPERVISOR_NAME,
  });
  const session = await prisma.conversationSession.findUnique({
    where: { campaignApplicationId: applicationId },
  });
  if (session) {
    await logBot(session.id, JIBA_APPROVED, { paymentMethod: 'bank_transfer' });
  }
  await upsertLineChatSession(app.lineUserId, 'jiba_unbox', FLOW_STATE.AWAITING_SHIPPING_PAYMENT, {
    applicationId,
  });
  await pushLineMessages(app.lineUserId, [
    textWithQr(JIBA_APPROVED, payAskQuickReplies()),
  ]);
  return app;
}

export async function notifyJibaRejected(
  applicationId: string,
  note: string,
  notifyCustomer = true,
) {
  await rejectApplication({ applicationId, note });
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  if (notifyCustomer) {
    await pushLineMessages(app.lineUserId, [{ type: 'text', text: JIBA_REJECTED }]);
  }
}

export async function notifyJibaReturn(
  applicationId: string,
  fields: string[],
  reasonCode?: string,
  note?: string,
) {
  const labels: Record<string, string> = {
    recipient_name: '收件人姓名',
    recipient_phone: '手機號碼有誤。',
    store: '7-11 門市資料不完整。',
    instagram_handle: 'Instagram 帳號找不到。',
    pet_name: '毛孩名稱',
    license: '內容授權同意',
  };
  const { nextState, field } = await returnForEdit({
    applicationId,
    fields,
    reasonCode,
    note,
  });
  const app = await prisma.campaignApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });
  await upsertLineChatSession(app.lineUserId, 'jiba_unbox', nextState, {
    applicationId,
  });
  const copy = jibaReturnFieldCopy(labels[field] ?? field);
  const session = await prisma.conversationSession.findUnique({
    where: { campaignApplicationId: applicationId },
  });
  if (session) await logBot(session.id, copy, { returnField: field });
  await pushLineMessages(app.lineUserId, [{ type: 'text', text: copy }]);
}

export async function completeJibaPayment(token: string) {
  const app = await prisma.campaignApplication.findUnique({
    where: { paymentToken: token },
  });
  if (!app) return { ok: false as const, error: '找不到付款單' };
  if (app.paymentStatus === 'paid' && app.status === APP_STATUS.READY_TO_SHIP) {
    return { ok: true as const, alreadyPaid: true };
  }
  await markShippingPaid(app.id);
  await pushLineMessages(app.lineUserId, [{ type: 'text', text: JIBA_PAID }]);
  return { ok: true as const, alreadyPaid: false };
}
