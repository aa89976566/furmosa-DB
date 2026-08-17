/**
 * 雞霸兩片開箱 — LINE 對話狀態機
 * DB（campaign_applications + conversation_sessions）為唯一真相來源。
 */
import {
  ACTIVE_APP_STATUSES,
  APP_STATUS,
  FLOW_STATE,
  CATNIP_CHICK_HOMEPAGE_URL,
  JIBA_LICENSE_VERSION,
  JIBA_PRODUCTS,
  JIBA_SUPERVISOR_NAME,
  jibaProductKeyFromCollected,
  jibaProductLabelFromCollected,
  parseJibaProductKey,
  type FlowState,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_APPROVED_AWAIT_TRANSFER,
  JIBA_APPROVED_QUEUED,
  JIBA_ASK_IG,
  JIBA_ASK_NAME,
  JIBA_ASK_PET,
  JIBA_ASK_PHONE,
  JIBA_ASK_PRODUCT_PROMPT,
  JIBA_ASK_STORE,
  JIBA_BRIEF_REPROMPT,
  JIBA_FIND_HELPER,
  JIBA_IG_ERROR,
  JIBA_INVITE_DECLINE_REPLY,
  JIBA_INVITE_REPROMPT,
  JIBA_LICENSE_ASK,
  JIBA_LICENSE_DECLINE,
  JIBA_NAME_ERROR,
  JIBA_NAME_RETRY,
  JIBA_PAID,
  JIBA_PAY_LATER,
  JIBA_PENDING_HINT,
  JIBA_PET_ERROR,
  JIBA_PHONE_ERROR,
  JIBA_REJECTED,
  JIBA_RULES,
  JIBA_START_WORK,
  JIBA_STORE_ERROR,
  JIBA_SUBMITTED,
  JIBA_TRANSFER_NOTED,
  JIBA_TRANSFER_REPROMPT,
  JIBA_TRANSFER_UNAVAILABLE,
  JIBA_UPSELL_NOTED,
  JIBA_UPSELL_REPROMPT,
  JIBA_UPSELL_SKIPPED,
  jibaBankInfoText,
  jibaBriefContinueLabel,
  jibaConfirmSummary,
  jibaFieldRetryEscalation,
  jibaLicenseBody,
  jibaProductBrief,
  jibaReturnFieldCopy,
  isJibaBriefContinue,
  isJibaTransferDeclared,
  isJibaUpsellAccept,
  isJibaUpsellSkip,
} from '@/lib/campaigns/jiba-two-piece/copy';
import {
  nextJibaShippingState,
  resolveJibaResumeState,
  shippingSnapshotFrom,
} from '@/lib/campaigns/jiba-two-piece/shipping';
import { ensureJibaCampaignSchema } from '@/lib/campaigns/jiba-two-piece/ensure-schema';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';
import {
  appendConversationMessage,
  approveAndCreatePayment,
  createJibaEnrollment,
  declareJibaShippingPayment,
  findActiveJibaApplication,
  markShippingPaid,
  rejectApplication,
  returnForEdit,
  setConversationState,
  submitForReview,
  syncApplicationFields,
} from '@/lib/campaigns/jiba-two-piece/service';
import {
  assessJibaShippingFee,
  describeJibaShippingCharge,
  nextStateAfterTransfer,
  paymentDeclarationFromCollected,
} from '@/lib/campaigns/jiba-two-piece/payment';
import { requireJibaTransferAccount } from '@/lib/campaigns/jiba-two-piece/transfer-env';
import {
  SEVEN_ELEVEN_STORE_FINDER_URL,
  isStoreLeaveNoise,
  searchStoreCandidates,
} from '@/lib/campaigns/jiba-two-piece/store-search';
import {
  FIELD_MAX_RETRIES,
  isDeclineIntent,
  isJoinIntent,
  normalizeInstagramHandle,
  validPetNameOrSkip,
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
  upsertJibaLineChatSessionIfIdle,
} from '@/lib/line/chat-session';
import { replyLineMessage, type LineReplyMessage } from '@/lib/line/reply';
import { pushLineMessages } from '@/lib/line/push';
import { runAfterReply } from '@/lib/line/defer';
import {
  isJarMenuLeaveText,
  isUnboxLeaveText,
  isWorldNavLeaveText,
} from '@/lib/line/session-leave';
import { isJibaUnboxEntryIntent } from '@/lib/line/campaigns/jiba-unbox/intent';
import {
  jibaInviteMessages,
  jibaProductChoiceMessages,
  jibaTransferMessages,
  jibaUpsellMessages,
} from '@/lib/line/campaigns/jiba-unbox/menus';
import { decideJibaUnboxEntry } from '@/lib/line/campaigns/jiba-unbox/turns';
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

function jibaRulesChoiceMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: '開箱規則',
    theme: WORLD_THEME.chaos,
    title: '看完規則了嗎？',
    subtitle: '想繼續的話，點下面按鈕就可以。',
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


function jibaResumeChoiceMenu(): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: '繼續開箱？',
    theme: WORLD_THEME.chaos,
    title: '發現未完成的開箱申請',
    subtitle: '若你剛做完毛孩開戶，多半是舊的開箱進度。要接著填，還是重新開始？',
    items: [
      {
        label: '接著上次',
        action: { type: 'message', text: '接著上次開箱' },
        style: 'primary',
      },
      {
        label: '重新開始',
        action: { type: 'message', text: '重新開始開箱' },
        style: 'secondary',
      },
    ],
  });
}

/** 授權同意：單一 Flex（按鈕在同一張卡，不再拆成多則文字泡泡） */
function jibaLicenseFlex(productKey?: JibaProductKey): LineReplyMessage {
  return buildButtonMenuFlex({
    altText: '投稿授權同意',
    theme: WORLD_THEME.chaos,
    title: JIBA_LICENSE_ASK,
    subtitle: jibaLicenseBody(productKey),
    items: [
      {
        label: '我同意',
        action: { type: 'message', text: '我同意' },
        style: 'primary',
      },
      {
        label: '不同意',
        action: { type: 'message', text: '不同意' },
        style: 'secondary',
      },
    ],
  });
}

function licenseFlexFromCollected(data: Record<string, unknown>): LineReplyMessage {
  return jibaLicenseFlex(jibaProductKeyFromCollected(data));
}

function jibaBriefContinueMenu(productKey: JibaProductKey): LineReplyMessage {
  const label = jibaBriefContinueLabel(productKey);
  return buildButtonMenuFlex({
    altText: '開始填資料',
    theme: WORLD_THEME.chaos,
    title: productKey === 'catnip' ? '可以請你先了解這次用途嗎？' : '看完這品說明了嗎？',
    subtitle:
      productKey === 'catnip'
        ? '了解後再填收件資訊。素材授權會在後面再請你按一次。'
        : '準備好就開始填收件資訊，零食才寄得出發。',
    items: [
      {
        label,
        action: { type: 'message', text: label },
        style: 'primary',
      },
    ],
  });
}

function jibaStoreCandidatesFlex(
  candidates: { storeId: string; storeName: string; storeAddress: string }[],
): LineReplyMessage {
  const lines = candidates
    .map((c, i) => `${i + 1}. ${c.storeName}${c.storeId ? `（${c.storeId}）` : ''}`)
    .join('\n');
  return buildButtonMenuFlex({
    altText: '選擇 7-11 門市',
    theme: WORLD_THEME.chaos,
    title: '找到這些 7-11',
    subtitle: `${lines}\n\n點下面按鈕確認；不對就重選或改關鍵字。`,
    items: [
      ...candidates.slice(0, 4).map((c, i) => ({
        label: `${i + 1}.${c.storeName}`.slice(0, 20),
        action: { type: 'message' as const, text: `選門市${i + 1}` },
        style: (i === 0 ? 'primary' : 'secondary') as 'primary' | 'secondary',
      })),
      {
        label: '重選門市',
        action: { type: 'message' as const, text: '重選門市' },
        style: 'link' as const,
      },
      {
        label: '查 7-11 店名',
        action: { type: 'uri' as const, uri: SEVEN_ELEVEN_STORE_FINDER_URL },
        style: 'link' as const,
      },
    ],
  });
}

function productLabelFromCollected(data: Record<string, unknown>): string {
  return jibaProductLabelFromCollected(data);
}

function confirmSummaryForApp(
  app: {
    recipientName?: string | null;
    recipientPhone?: string | null;
    storeName?: string | null;
    instagramHandle?: string | null;
    petName?: string | null;
    paymentStatus?: string | null;
  },
  collected: Record<string, unknown>,
): string {
  const fee = assessJibaShippingFee(collected);
  const charge = describeJibaShippingCharge({
    paymentStatus: app.paymentStatus,
    collected,
  });
  const declaration = paymentDeclarationFromCollected(collected);
  return jibaConfirmSummary({
    recipientName: app.recipientName || '',
    recipientPhone: app.recipientPhone || '',
    storeName: app.storeName || '',
    instagramHandle: app.instagramHandle || '',
    petName: app.petName,
    productLabel: productLabelFromCollected(collected),
    shippingFeeDue: fee.due,
    shippingFeeAmount: fee.amount,
    shippingFeeLabel: charge.label,
    shippingFeeKind: charge.kind,
    paymentDeclared: Boolean(declaration) || app.paymentStatus === 'declared',
    declaredPaidAt: declaration?.declaredPaidAt
      ? declaration.declaredPaidAt.replace('T', ' ').slice(0, 16)
      : null,
    transferAccountLast5: declaration?.transferAccountLast5 ?? null,
  });
}

function transferReplyMessages() {
  return jibaTransferMessages(requireJibaTransferAccount());
}

function isLicenseAccept(text: string): boolean {
  return /^(?:我同意|同意)$/i.test(text.trim());
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
    case FLOW_STATE.CAMPAIGN_INTRO:
    case FLOW_STATE.SHOW_RULES:
      return JIBA_INVITE_REPROMPT;
    case FLOW_STATE.ASK_PRODUCT:
      return JIBA_ASK_PRODUCT_PROMPT;
    case FLOW_STATE.SHOW_BRIEF:
      return JIBA_BRIEF_REPROMPT;
    case FLOW_STATE.ASK_RECIPIENT_NAME:
      return JIBA_ASK_NAME;
    case FLOW_STATE.ASK_RECIPIENT_PHONE:
      return JIBA_ASK_PHONE;
    case FLOW_STATE.ASK_STORE:
    case FLOW_STATE.CONFIRM_STORE:
      return JIBA_ASK_STORE;
    case FLOW_STATE.ASK_UPSELL:
      return JIBA_UPSELL_REPROMPT;
    case FLOW_STATE.ASK_TRANSFER:
      return JIBA_TRANSFER_REPROMPT;
    case FLOW_STATE.ASK_INSTAGRAM:
      return JIBA_ASK_IG;
    case FLOW_STATE.ASK_PET_NAME:
      return JIBA_ASK_PET;
    case FLOW_STATE.ASK_CONTENT_LICENSE:
      return JIBA_LICENSE_ASK;
    case FLOW_STATE.SHOW_ORDER_CONFIRMATION:
      return '資料還在確認頁。確認沒問題就回「資料正確，送出」。';
    case FLOW_STATE.PENDING_REVIEW:
      return '還在請小幫手幫你看資料，通過後會再跟你說物流處理費怎麼付。';
    case FLOW_STATE.AWAITING_SHIPPING_PAYMENT:
      return '物流處理費還在等你確認。付完之後，零食就可以出發。';
    case FLOW_STATE.READY_TO_SHIP:
      return JIBA_PAID;
    default:
      return `我們接著上次繼續～傳「查看目前資料」或「找${JIBA_SUPERVISOR_NAME}」都可以。`;
  }
}

async function cancelActiveJibaApplication(
  lineUserId: string,
  reason: string,
): Promise<void> {
  const app = await safeFindActiveJibaApplication(lineUserId);
  if (!app) return;
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
    await setConversationState(app.conversationSession.id, FLOW_STATE.CANCELLED, {
      cancelReason: reason,
    });
  }
  await prisma.statusAuditLog
    .create({
      data: {
        entityType: 'campaign_application',
        entityId: app.id,
        previousStatus: prev,
        newStatus: APP_STATUS.CANCELLED_BY_USER,
        actorType: 'customer',
        applicationId: app.id,
      },
    })
    .catch(() => {});
}

async function replayCurrentJibaStep(
  replyToken: string,
  lineUserId: string,
  state: FlowState,
  app: Awaited<ReturnType<typeof safeFindActiveJibaApplication>>,
): Promise<void> {
  const collected = parseCollected(app?.conversationSession?.collectedDataJson ?? '{}');
  const prompt = promptForState(state);
  switch (state) {
    case FLOW_STATE.CAMPAIGN_INTRO:
      await replyJiba(replyToken, lineUserId, jibaInviteMessages());
      return;
    case FLOW_STATE.SHOW_RULES:
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: JIBA_RULES },
        jibaRulesChoiceMenu(),
      ]);
      return;
    case FLOW_STATE.ASK_PRODUCT:
      await replyJiba(replyToken, lineUserId, jibaProductChoiceMessages());
      return;
    case FLOW_STATE.SHOW_BRIEF: {
      const key = jibaProductKeyFromCollected(collected);
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: jibaProductBrief(key) },
        jibaBriefContinueMenu(key),
      ]);
      return;
    }
    case FLOW_STATE.ASK_UPSELL: {
      const guarded = resolveJibaResumeState(
        FLOW_STATE.ASK_UPSELL,
        shippingSnapshotFrom(app, collected),
        collected,
        app?.paymentStatus,
      );
      if (guarded !== FLOW_STATE.ASK_UPSELL) {
        if (app?.conversationSession) {
          await setConversationState(app.conversationSession.id, guarded);
        }
        await replayCurrentJibaStep(replyToken, lineUserId, guarded, app);
        return;
      }
      await replyJiba(replyToken, lineUserId, jibaUpsellMessages());
      return;
    }
    case FLOW_STATE.ASK_TRANSFER: {
      const guarded = resolveJibaResumeState(
        FLOW_STATE.ASK_TRANSFER,
        shippingSnapshotFrom(app, collected),
        collected,
        app?.paymentStatus,
      );
      if (guarded !== FLOW_STATE.ASK_TRANSFER) {
        if (app?.conversationSession) {
          await setConversationState(app.conversationSession.id, guarded);
        }
        await replayCurrentJibaStep(replyToken, lineUserId, guarded, app);
        return;
      }
      await replyJiba(replyToken, lineUserId, transferReplyMessages());
      return;
    }
    case FLOW_STATE.ASK_CONTENT_LICENSE:
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: prompt },
        licenseFlexFromCollected(collected),
      ]);
      return;
    case FLOW_STATE.CONFIRM_STORE: {
      const candidates = (collected.storeCandidates as
        | { storeId: string; storeName: string; storeAddress: string }[]
        | undefined) ?? [];
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: prompt },
        ...(candidates.length ? [jibaStoreCandidatesFlex(candidates)] : []),
      ]);
      return;
    }
    default:
      await replyJiba(replyToken, lineUserId, [{ type: 'text', text: prompt }]);
  }
}

/** 入口：無進行中 session 才發邀請；已啟動則重播當前步驟 */
export async function startJibaUnboxIntro(
  replyToken: string,
  lineUserId: string,
): Promise<void> {
  try {
    const [active, chat] = await Promise.all([
      findActiveJibaApplication(lineUserId),
      prisma.lineChatSession.findUnique({ where: { lineUserId } }),
    ]);
    const paused = isPausedForRegister(active?.conversationSession?.collectedDataJson);
    const state =
      (active?.conversationSession?.currentState as FlowState | undefined) ??
      (chat?.flow === 'jiba_unbox' ? (chat.step as FlowState) : null);
    const decision = decideJibaUnboxEntry({
      hasApplication: Boolean(active),
      sessionActive: chat?.flow === 'jiba_unbox' || Boolean(active?.conversationSession && !paused),
      pausedForRegister: paused,
      state,
    });

    if (decision.action === 'resume_choice' && active?.conversationSession) {
      await clearJibaPausedForRegister(active.conversationSession.id);
      await upsertJibaLineChatSessionIfIdle(lineUserId, FLOW_STATE.CAMPAIGN_INTRO, {
        applicationId: active.id,
        phase: 'resume_choice',
      });
      await replyJiba(replyToken, lineUserId, [
        {
          type: 'text',
          text: '看到一筆還沒填完的開箱申請。\n若你剛剛是在幫毛孩開戶，那多半不是這次要續辦的。',
        },
        jibaResumeChoiceMenu(),
      ]);
      return;
    }

    if (decision.action === 'replay') {
      if (active?.conversationSession) {
        await clearJibaPausedForRegister(active.conversationSession.id);
        await upsertJibaLineChatSessionIfIdle(lineUserId, decision.state, {
          applicationId: active.id,
          phase: 'replay',
        });
      }
      await replayCurrentJibaStep(replyToken, lineUserId, decision.state, active);
      return;
    }
  } catch (err) {
    console.error('[jiba-unbox] findActiveJibaApplication failed', err);
  }

  await replyJiba(replyToken, lineUserId, jibaInviteMessages());

  runAfterReply(
    upsertJibaLineChatSessionIfIdle(lineUserId, FLOW_STATE.CAMPAIGN_INTRO, {
      phase: 'intro',
    }).catch((err) => console.error('[jiba-unbox] upsertLineChatSession failed', err)),
  );
}

function isPausedForRegister(collectedDataJson: string | null | undefined): boolean {
  try {
    const data = JSON.parse(collectedDataJson || '{}') as { pausedForRegister?: unknown };
    return data.pausedForRegister === true;
  } catch {
    return false;
  }
}

async function findActiveJibaConversationPauseFlag(lineUserId: string): Promise<{
  hasSession: boolean;
  pausedForRegister: boolean;
}> {
  const app = await prisma.campaignApplication.findFirst({
    where: {
      lineUserId,
      status: { in: [...ACTIVE_APP_STATUSES] },
    },
    select: {
      id: true,
      conversationSession: { select: { id: true, collectedDataJson: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!app?.conversationSession) return { hasSession: false, pausedForRegister: false };
  return {
    hasSession: true,
    pausedForRegister: isPausedForRegister(app.conversationSession.collectedDataJson),
  };
}

export async function isJibaUnboxSessionActive(lineUserId: string): Promise<boolean> {
  let chatFlow: string | null = null;
  try {
    const chat = await prisma.lineChatSession.findUnique({ where: { lineUserId } });
    chatFlow = chat?.flow ?? null;
    // 開戶進行中：開箱不得搶暱稱／手機／選店等輸入（即使 campaign session 仍在）
    if (chatFlow === 'register') return false;
  } catch (err) {
    console.error('[jiba-unbox] lineChatSession lookup failed', err);
    return false;
  }
  // 熱路徑不再每次 upsert 活動列；僅用 lineUserId 查進行中申請
  try {
    const { hasSession, pausedForRegister } =
      await findActiveJibaConversationPauseFlag(lineUserId);
    // 開戶期間暫停開箱：選完合作店後也不准搶回對話
    if (pausedForRegister) return false;
    // 介紹頁尚無 campaign 列時，仍依 lineChatSession.jiba_unbox 判定進行中
    if (chatFlow === 'jiba_unbox') return true;
    return hasSession;
  } catch (err) {
    if (isMissingCampaignTableError(err)) return false;
    console.error('[jiba-unbox] campaign lookup failed', err);
    return false;
  }
}

/** 開戶接手：暫停開箱對話，並清掉錯誤的 7-11 門市候選 */
export async function pauseJibaUnboxStoreConfirm(lineUserId: string): Promise<void> {
  try {
    const app = await findActiveJibaApplication(lineUserId);
    const sess = app?.conversationSession;
    if (!sess) return;
    const patch: Record<string, unknown> = {
      pausedForRegister: true,
      storeCandidates: [],
      pendingStoreQuery: null,
    };
    const nextState =
      sess.currentState === FLOW_STATE.CONFIRM_STORE
        ? FLOW_STATE.ASK_STORE
        : (sess.currentState as FlowState);
    await setConversationState(sess.id, nextState, patch);
  } catch (err) {
    if (isMissingCampaignTableError(err)) return;
    console.error('[jiba-unbox] pause for register failed', err);
  }
}

/** 使用者主動回開箱任務時，解除開戶暫停 */
async function clearJibaPausedForRegister(sessionId: string): Promise<void> {
  const sess = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
  if (!sess) return;
  await setConversationState(sess.id, sess.currentState as FlowState, {
    pausedForRegister: false,
  });
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
    await clearJibaPausedForRegister(sid);

    // 已有進行中申請：依目前 state 續接，不重設、不跳步
    if (existing) {
      const collected = parseCollected(app.conversationSession?.collectedDataJson ?? '{}');
      const guarded = resolveJibaResumeState(
        state,
        shippingSnapshotFrom(app, collected),
        collected,
        app.paymentStatus,
      );
      if (guarded !== state) {
        await setConversationState(sid, guarded);
      }
      await replayCurrentJibaStep(replyToken, lineUserId, guarded, app);
      runAfterReply(
        (async () => {
          await upsertJibaLineChatSessionIfIdle(lineUserId, guarded, {
            applicationId: app.id,
          });
          await logCustomer(sid, trimmed, lineMessageId);
          await logBot(sid, `我們接著上次繼續。\n${promptForState(guarded)}`);
        })(),
      );
      return;
    }

    await setConversationState(sid, FLOW_STATE.ASK_PRODUCT);
    await replyJiba(replyToken, lineUserId, jibaProductChoiceMessages());
    runAfterReply(
      (async () => {
        await upsertJibaLineChatSessionIfIdle(lineUserId, FLOW_STATE.ASK_PRODUCT, {
          applicationId: app.id,
        });
        await logCustomer(sid, trimmed, lineMessageId);
        await logBot(sid, JIBA_ASK_PRODUCT_PROMPT);
      })(),
    );
  };

  try {
    // schema 已就緒時為記憶體快取，幾乎零成本
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
          text: '不好意思，開箱系統剛剛有點狀況。再點一次「開箱任務」，或稍後再試一次。',
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

type FieldKey = 'name' | 'phone' | 'store' | 'ig' | 'pet';

function retryKey(field: FieldKey) {
  return `retries_${field}`;
}

/** 欄位驗證失敗：累計重試、溫柔重問；超過上限給找小幫手出口 */
async function replyInvalidField(opts: {
  replyToken: string;
  lineUserId: string;
  sessionId: string;
  state: FlowState;
  field: FieldKey;
  errorText: string;
  retryPrompt: string;
}) {
  const sess = await prisma.conversationSession.findUnique({
    where: { id: opts.sessionId },
  });
  const data = parseCollected(sess?.collectedDataJson ?? '{}');
  const key = retryKey(opts.field);
  const retries = Number(data[key] ?? 0) + 1;
  await setConversationState(opts.sessionId, opts.state, { [key]: retries });

  const helperQr = [
    { label: `找${JIBA_SUPERVISOR_NAME}`, text: `找${JIBA_SUPERVISOR_NAME}` },
  ];

  if (retries >= FIELD_MAX_RETRIES) {
    await logBot(opts.sessionId, jibaFieldRetryEscalation(JIBA_SUPERVISOR_NAME));
    await replyJiba(opts.replyToken, opts.lineUserId, [
      { type: 'text', text: opts.errorText },
      textWithQr(jibaFieldRetryEscalation(JIBA_SUPERVISOR_NAME), helperQr),
    ]);
    return;
  }

  await logBot(opts.sessionId, `${opts.errorText}\n${opts.retryPrompt}`);
  await replyJiba(opts.replyToken, opts.lineUserId, [
    { type: 'text', text: opts.errorText },
    { type: 'text', text: opts.retryPrompt },
  ]);
}

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

  // 進行中 session 重送入口 keyword：重播當前步驟，不重設、不跳步
  if (isJibaUnboxEntryIntent(trimmed)) {
    const appForReplay = await safeFindActiveJibaApplication(lineUserId);
    const chatForReplay = await prisma.lineChatSession.findUnique({
      where: { lineUserId },
    });
    const paused = isPausedForRegister(appForReplay?.conversationSession?.collectedDataJson);
    const state =
      (appForReplay?.conversationSession?.currentState as FlowState | undefined) ??
      (chatForReplay?.flow === 'jiba_unbox'
        ? (chatForReplay.step as FlowState)
        : FLOW_STATE.CAMPAIGN_INTRO);
    const decision = decideJibaUnboxEntry({
      hasApplication: Boolean(appForReplay),
      sessionActive: true,
      pausedForRegister: paused,
      state,
    });
    if (decision.action === 'resume_choice' && appForReplay?.conversationSession) {
      await clearJibaPausedForRegister(appForReplay.conversationSession.id);
      await replyJiba(replyToken, lineUserId, [
        {
          type: 'text',
          text: '看到一筆還沒填完的開箱申請。\n若你剛剛是在幫毛孩開戶，那多半不是這次要續辦的。',
        },
        jibaResumeChoiceMenu(),
      ]);
      return true;
    }
    await replayCurrentJibaStep(
      replyToken,
      lineUserId,
      decision.action === 'replay' ? decision.state : state,
      appForReplay,
    );
    return true;
  }

  // 點了世界導覽／取消類 → 離開開箱
  // 選 7-11 門市時，「介紹」等換罐捷徑不可跳出（否則會誤顯示換罐介紹 Flex）
  const appForLeave = await safeFindActiveJibaApplication(lineUserId);
  const earlyState = (appForLeave?.conversationSession?.currentState as FlowState | undefined) ?? null;
  const inStorePick =
    earlyState === FLOW_STATE.ASK_STORE || earlyState === FLOW_STATE.CONFIRM_STORE;
  if (isWorldNavLeaveText(trimmed)) {
    try {
      await clearLineChatSession(lineUserId);
    } catch (err) {
      console.error('[jiba-unbox] clear session on leave failed', err);
    }
    await pauseJibaUnboxStoreConfirm(lineUserId);
    return false;
  }
  if (isUnboxLeaveText(trimmed)) {
    if (inStorePick && isJarMenuLeaveText(trimmed)) {
      // fall through：當門市雜訊處理
    } else {
      try {
        await clearLineChatSession(lineUserId);
      } catch (err) {
        console.error('[jiba-unbox] clear session on leave failed', err);
      }
      await pauseJibaUnboxStoreConfirm(lineUserId);
      return false;
    }
  }

  // 續辦選擇（入口卡）
  if (/^接著上次開箱$/.test(trimmed)) {
    const app = await safeFindActiveJibaApplication(lineUserId);
    if (!app?.conversationSession) {
      await startJibaUnboxIntro(replyToken, lineUserId);
      return true;
    }
    const state = app.conversationSession.currentState as FlowState;
    await clearJibaPausedForRegister(app.conversationSession.id);
    await upsertJibaLineChatSessionIfIdle(lineUserId, state, {
      applicationId: app.id,
      phase: 'resume',
    });
    const prompt = promptForState(state);
    const collected = parseCollected(app.conversationSession.collectedDataJson);
    if (state === FLOW_STATE.ASK_PRODUCT) {
      await replyJiba(replyToken, lineUserId, jibaProductChoiceMessages());
      return true;
    }
    if (state === FLOW_STATE.CAMPAIGN_INTRO) {
      await replyJiba(replyToken, lineUserId, jibaInviteMessages());
      return true;
    }
    if (state === FLOW_STATE.ASK_UPSELL || state === FLOW_STATE.ASK_TRANSFER) {
      const guarded = resolveJibaResumeState(
        state,
        shippingSnapshotFrom(app, collected),
        collected,
        app.paymentStatus,
      );
      if (guarded !== state) {
        await setConversationState(app.conversationSession.id, guarded);
        await replayCurrentJibaStep(replyToken, lineUserId, guarded, app);
        return true;
      }
      await replyJiba(
        replyToken,
        lineUserId,
        state === FLOW_STATE.ASK_TRANSFER ? transferReplyMessages() : jibaUpsellMessages(),
      );
      return true;
    }
    const resumeGuarded = resolveJibaResumeState(
      state,
      shippingSnapshotFrom(app, collected),
      collected,
      app.paymentStatus,
    );
    if (resumeGuarded !== state) {
      await setConversationState(app.conversationSession.id, resumeGuarded);
      await replayCurrentJibaStep(replyToken, lineUserId, resumeGuarded, app);
      return true;
    }
    await replyJiba(replyToken, lineUserId, [
      { type: 'text', text: '好，我們接著上次繼續。' },
      { type: 'text', text: prompt },
      ...(state === FLOW_STATE.ASK_CONTENT_LICENSE ? [licenseFlexFromCollected(collected)] : []),
      ...(state === FLOW_STATE.SHOW_BRIEF
        ? [jibaBriefContinueMenu(jibaProductKeyFromCollected(collected))]
        : []),
    ]);
    return true;
  }
  if (/^重新開始開箱$/.test(trimmed)) {
    try {
      await cancelActiveJibaApplication(lineUserId, 'restart');
    } catch (err) {
      console.error('[jiba-unbox] restart cancel failed', err);
    }
    await clearLineChatSession(lineUserId);
    await replyJiba(replyToken, lineUserId, jibaInviteMessages());
    runAfterReply(
      upsertJibaLineChatSessionIfIdle(lineUserId, FLOW_STATE.CAMPAIGN_INTRO, {
        phase: 'intro',
      }).catch((err) => console.error('[jiba-unbox] upsert after restart failed', err)),
    );
    return true;
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
            '好，這次先到這裡。之後想參加再跟我們說「開箱任務」就好。',
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
      { type: 'text', text: '好，這次先到這裡。之後想參加再跟我們說「開箱任務」就好。' },
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
        { type: 'text', text: '目前沒有進行中的開箱申請。想參加的話，跟我們說「開箱任務」就可以。' },
      ]);
      return true;
    }
    const summary = confirmSummaryForApp(
      {
        ...app,
        recipientName: app.recipientName || '（未填）',
        recipientPhone: app.recipientPhone || '（未填）',
        storeName: app.storeName || '（未填）',
        instagramHandle: app.instagramHandle || '（未填）',
      },
      parseCollected(app.conversationSession?.collectedDataJson ?? '{}'),
    );
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: summary }]);
    return true;
  }

  const chat = await prisma.lineChatSession.findUnique({ where: { lineUserId } });
  let app = await safeFindActiveJibaApplication(lineUserId);

  // Intro / rules（尚未建立申請）
  if (!app && chat?.flow === 'jiba_unbox') {
    if (/^先看看規則$/.test(trimmed)) {
      await upsertJibaLineChatSessionIfIdle(lineUserId, FLOW_STATE.SHOW_RULES, {
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
        { type: 'text', text: JIBA_INVITE_DECLINE_REPLY },
      ]);
      return true;
    }
    if (isJoinIntent(trimmed) || /^這個我可以！$/.test(trimmed) || /^敢，來吧$/.test(trimmed)) {
      await beginEnrollment(replyToken, lineUserId, trimmed, lineMessageId);
      return true;
    }
    if (chat.step === FLOW_STATE.CAMPAIGN_INTRO || chat.step === FLOW_STATE.SHOW_RULES) {
      await replyJiba(replyToken, lineUserId, jibaInviteMessages());
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

  if (lineMessageId) {
    const already = await prisma.conversationMessage.findFirst({
      where: { sessionId: sid, lineMessageId },
      select: { id: true },
    });
    if (already) {
      return true;
    }
  }

  await logCustomer(sid, trimmed, lineMessageId);

  if (isJibaTransferDeclared(trimmed)) {
    const result = await declareJibaShippingPayment({
      applicationId: app.id,
      lineMessageId,
      actorType: 'customer',
    });
    await logBot(sid, JIBA_TRANSFER_NOTED);
    if (state === FLOW_STATE.ASK_TRANSFER || state === FLOW_STATE.AWAITING_SHIPPING_PAYMENT) {
      if (state === FLOW_STATE.ASK_TRANSFER && !result.app.status.includes('READY')) {
        const next = nextStateAfterTransfer({
          instagramHandle: result.app.instagramHandle,
          petRecorded:
            result.app.petName !== undefined &&
            result.app.petName !== null
              ? true
              : Object.prototype.hasOwnProperty.call(
                  parseCollected(app.conversationSession.collectedDataJson),
                  'petName',
                ),
          licenseAccepted: result.app.licenseAccepted,
        });
        await setConversationState(sid, next);
        await logBot(sid, promptForState(next));
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: JIBA_TRANSFER_NOTED },
          { type: 'text', text: promptForState(next) },
          ...(next === FLOW_STATE.ASK_CONTENT_LICENSE
            ? [licenseFlexFromCollected(parseCollected(app.conversationSession.collectedDataJson))]
            : []),
        ]);
        return true;
      }
    }
    await replyJiba(replyToken, lineUserId, [
      { type: 'text', text: JIBA_TRANSFER_NOTED },
    ]);
    return true;
  }

  if (state === FLOW_STATE.PENDING_REVIEW) {
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_PENDING_HINT }]);
    return true;
  }
  if (state === FLOW_STATE.AWAITING_SHIPPING_PAYMENT) {
    if (/^(?:現在付款|我要轉帳|轉帳資訊)$/.test(trimmed)) {
      const account = requireJibaTransferAccount();
      const info = account ? jibaBankInfoText(account) : JIBA_TRANSFER_UNAVAILABLE;
      await logBot(sid, info);
      await replyJiba(replyToken, lineUserId, [
        ...(account ? transferReplyMessages() : [{ type: 'text' as const, text: info }]),
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
    await replyJiba(replyToken, lineUserId, transferReplyMessages());
    return true;
  }
  if (state === FLOW_STATE.READY_TO_SHIP) {
    await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_PAID }]);
    return true;
  }

  switch (state) {
    case FLOW_STATE.ASK_PRODUCT: {
      if (isDeclineIntent(trimmed)) {
        try {
          await cancelActiveJibaApplication(lineUserId, 'decline_before_product');
        } catch (err) {
          console.error('[jiba-unbox] decline at product cancel failed', err);
        }
        await clearLineChatSession(lineUserId);
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: JIBA_INVITE_DECLINE_REPLY },
        ]);
        return true;
      }
      const productKey = parseJibaProductKey(trimmed);
      if (!productKey) {
        await replyJiba(replyToken, lineUserId, jibaProductChoiceMessages());
        return true;
      }
      const brief = jibaProductBrief(productKey);
      await setConversationState(sid, FLOW_STATE.SHOW_BRIEF, {
        productKey,
        productLabel: JIBA_PRODUCTS[productKey].orderLabel,
        ...(productKey === 'catnip' ? { purposeUrl: CATNIP_CHICK_HOMEPAGE_URL } : {}),
      });
      await logBot(sid, brief);
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: brief },
        jibaBriefContinueMenu(productKey),
      ]);
      return true;
    }
    case FLOW_STATE.SHOW_BRIEF: {
      const sessBrief = await prisma.conversationSession.findUnique({ where: { id: sid } });
      const briefData = parseCollected(sessBrief?.collectedDataJson ?? '{}');
      const briefKey = jibaProductKeyFromCollected(briefData);
      const continueBrief =
        isJibaBriefContinue(trimmed) ||
        isJibaUpsellSkip(trimmed) ||
        isJibaUpsellAccept(trimmed);
      if (!continueBrief) {
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: jibaProductBrief(briefKey) },
          jibaBriefContinueMenu(briefKey),
        ]);
        return true;
      }
      const afterBrief =
        nextJibaShippingState(shippingSnapshotFrom(app, briefData)) ??
        FLOW_STATE.ASK_UPSELL;
      await setConversationState(sid, afterBrief, {
        ...(briefKey === 'catnip'
          ? {
              purposeAcknowledged: true,
              purposeAcknowledgedAt: new Date().toISOString(),
              purposeUrl: CATNIP_CHICK_HOMEPAGE_URL,
            }
          : {}),
      });
      if (afterBrief === FLOW_STATE.ASK_UPSELL) {
        await logBot(sid, JIBA_UPSELL_REPROMPT);
        await replyJiba(replyToken, lineUserId, jibaUpsellMessages());
        return true;
      }
      await logBot(sid, JIBA_START_WORK);
      await logBot(sid, promptForState(afterBrief));
      await replyJiba(replyToken, lineUserId, [
        { type: 'text', text: JIBA_START_WORK },
        { type: 'text', text: promptForState(afterBrief) },
      ]);
      return true;
    }
    case FLOW_STATE.ASK_RECIPIENT_NAME: {
      const name = validRecipientName(trimmed);
      if (!name) {
        await replyInvalidField({
          replyToken,
          lineUserId,
          sessionId: sid,
          state,
          field: 'name',
          errorText: JIBA_NAME_ERROR,
          retryPrompt: JIBA_NAME_RETRY,
        });
        return true;
      }
      await syncApplicationFields(app.id, { recipientName: name });
      await setConversationState(sid, FLOW_STATE.ASK_RECIPIENT_PHONE, {
        recipientName: name,
        retries_name: 0,
      });
      await logBot(sid, JIBA_ASK_PHONE);
      await replyJiba(replyToken, lineUserId, [{ type: 'text', text: JIBA_ASK_PHONE }]);
      return true;
    }
    case FLOW_STATE.ASK_RECIPIENT_PHONE: {
      const phone = validRecipientPhone(trimmed);
      if (!phone) {
        await replyInvalidField({
          replyToken,
          lineUserId,
          sessionId: sid,
          state,
          field: 'phone',
          errorText: JIBA_PHONE_ERROR,
          retryPrompt: '再傳一次手機號碼好嗎？例如：0912345678',
        });
        return true;
      }
      await syncApplicationFields(app.id, { recipientPhone: phone });
      await setConversationState(sid, FLOW_STATE.ASK_STORE, {
        recipientPhone: phone,
        retries_phone: 0,
      });
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
            text: '請輸入「區域＋店名」。\n例如：板橋新埔、淡水老街。',
          },
          buildButtonMenuFlex({
            altText: '查 7-11 店名',
            theme: WORLD_THEME.chaos,
            title: '先查店名也可以',
            subtitle: '去 7-11 門市查詢看店名，再回來貼給我們。',
            items: [
              {
                label: '打開 7-11 門市查詢',
                action: { type: 'uri', uri: SEVEN_ELEVEN_STORE_FINDER_URL },
                style: 'primary',
              },
            ],
          }),
        ]);
        return true;
      }
      if (
        trimmed.length < 2 ||
        isJoinIntent(trimmed) ||
        isDeclineIntent(trimmed) ||
        isStoreLeaveNoise(trimmed)
      ) {
        await replyInvalidField({
          replyToken,
          lineUserId,
          sessionId: sid,
          state,
          field: 'store',
          errorText: JIBA_STORE_ERROR,
          retryPrompt: JIBA_ASK_STORE,
        });
        return true;
      }
      const candidates = searchStoreCandidates(trimmed);
      if (candidates.length === 0) {
        await replyInvalidField({
          replyToken,
          lineUserId,
          sessionId: sid,
          state,
          field: 'store',
          errorText: JIBA_STORE_ERROR,
          retryPrompt: JIBA_ASK_STORE,
        });
        return true;
      }
      await setConversationState(sid, FLOW_STATE.CONFIRM_STORE, {
        storeCandidates: candidates,
        pendingStoreQuery: trimmed,
        retries_store: 0,
      });
      await replyJiba(replyToken, lineUserId, [jibaStoreCandidatesFlex(candidates)]);
      return true;
    }
    case FLOW_STATE.CONFIRM_STORE: {
      if (/^重選門市$/.test(trimmed)) {
        await setConversationState(sid, FLOW_STATE.ASK_STORE);
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: JIBA_ASK_STORE },
          buildButtonMenuFlex({
            altText: '查 7-11 店名',
            theme: WORLD_THEME.chaos,
            title: '選 7-11 門市',
            subtitle: '輸入區域＋店名，或先打開門市查詢。',
            items: [
              {
                label: '打開 7-11 門市查詢',
                action: { type: 'uri', uri: SEVEN_ELEVEN_STORE_FINDER_URL },
                style: 'secondary',
              },
              {
                label: '手動輸入門市',
                action: { type: 'message', text: '手動輸入門市' },
                style: 'primary',
              },
            ],
          }),
        ]);
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
          { type: 'text', text: '請從候選裡選一間，或回「重選門市」。' },
          jibaStoreCandidatesFlex(candidates.length ? candidates : [{ storeId: '', storeName: '重選門市', storeAddress: '' }]),
        ]);
        return true;
      }

      await syncApplicationFields(app.id, {
        storeId: picked.storeId || null,
        storeName: picked.storeName,
        storeAddress: picked.storeAddress,
      });
      await setConversationState(sid, FLOW_STATE.ASK_UPSELL, {
        storeName: picked.storeName,
        storeId: picked.storeId,
        storeAddress: picked.storeAddress,
      });
      await logBot(sid, JIBA_UPSELL_REPROMPT);
      await replyJiba(replyToken, lineUserId, jibaUpsellMessages());
      return true;
    }
    case FLOW_STATE.ASK_UPSELL: {
      const sessUpsell = await prisma.conversationSession.findUnique({ where: { id: sid } });
      const upsellCollected = parseCollected(sessUpsell?.collectedDataJson ?? '{}');
      const upsellGuard = resolveJibaResumeState(
        FLOW_STATE.ASK_UPSELL,
        shippingSnapshotFrom(app, upsellCollected),
      );
      if (upsellGuard !== FLOW_STATE.ASK_UPSELL) {
        await setConversationState(sid, upsellGuard);
        await replayCurrentJibaStep(replyToken, lineUserId, upsellGuard, app);
        return true;
      }
      if (isJibaUpsellSkip(trimmed) || isJibaUpsellAccept(trimmed)) {
        const interested = isJibaUpsellAccept(trimmed);
        const afterUpsell = {
          upsellAsked: true,
          upsellInterest: interested,
          upsellAnsweredAt: new Date().toISOString(),
        };
        const fee = assessJibaShippingFee({ ...upsellCollected, ...afterUpsell });
        if (fee.due) {
          await setConversationState(sid, FLOW_STATE.ASK_TRANSFER, afterUpsell);
          const nextCopy = interested ? JIBA_UPSELL_NOTED : JIBA_UPSELL_SKIPPED;
          await logBot(sid, nextCopy);
          await replyJiba(replyToken, lineUserId, [
            { type: 'text', text: nextCopy },
            ...transferReplyMessages(),
          ]);
          return true;
        }
        await setConversationState(sid, FLOW_STATE.ASK_INSTAGRAM, {
          ...afterUpsell,
          shippingFeeDue: false,
          shippingFeeWaived: true,
          shippingFeeReason: fee.reason,
        });
        const nextCopy = interested ? JIBA_UPSELL_NOTED : JIBA_UPSELL_SKIPPED;
        await logBot(sid, nextCopy);
        await logBot(sid, JIBA_ASK_IG);
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: nextCopy },
          { type: 'text', text: JIBA_ASK_IG },
        ]);
        return true;
      }
      await replyJiba(replyToken, lineUserId, jibaUpsellMessages());
      return true;
    }
    case FLOW_STATE.ASK_TRANSFER: {
      await replyJiba(replyToken, lineUserId, transferReplyMessages());
      return true;
    }
    case FLOW_STATE.ASK_INSTAGRAM: {
      const ig = normalizeInstagramHandle(trimmed);
      if (!ig) {
        await replyInvalidField({
          replyToken,
          lineUserId,
          sessionId: sid,
          state,
          field: 'ig',
          errorText: JIBA_IG_ERROR,
          retryPrompt: '再傳一次 @ 開頭的帳號好嗎？',
        });
        return true;
      }
      await syncApplicationFields(app.id, { instagramHandle: ig });
      await setConversationState(sid, FLOW_STATE.ASK_PET_NAME, {
        instagramHandle: ig,
        retries_ig: 0,
      });
      await logBot(sid, JIBA_ASK_PET);
      await replyJiba(replyToken, lineUserId, [
        textWithQr(JIBA_ASK_PET, [{ label: '略過', text: '略過' }]),
      ]);
      return true;
    }
    case FLOW_STATE.ASK_PET_NAME: {
      const petResult = validPetNameOrSkip(trimmed);
      if (petResult === null) {
        await replyInvalidField({
          replyToken,
          lineUserId,
          sessionId: sid,
          state,
          field: 'pet',
          errorText: JIBA_PET_ERROR,
          retryPrompt: JIBA_ASK_PET,
        });
        return true;
      }
      const pet = petResult === 'skip' ? null : petResult;
      await syncApplicationFields(app.id, { petName: pet });
      await setConversationState(sid, FLOW_STATE.ASK_CONTENT_LICENSE, {
        petName: pet,
        retries_pet: 0,
      });
      await logBot(sid, JIBA_LICENSE_ASK);
      const sessLicense = await prisma.conversationSession.findUnique({ where: { id: sid } });
      await replyJiba(replyToken, lineUserId, [
        licenseFlexFromCollected(parseCollected(sessLicense?.collectedDataJson ?? '{}')),
      ]);
      return true;
    }
    case FLOW_STATE.ASK_CONTENT_LICENSE: {
      const sessLicense = await prisma.conversationSession.findUnique({ where: { id: sid } });
      const licenseCollected = parseCollected(sessLicense?.collectedDataJson ?? '{}');
      if (/^我想再看一次$/.test(trimmed)) {
        await replyJiba(replyToken, lineUserId, [licenseFlexFromCollected(licenseCollected)]);
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
      if (!isLicenseAccept(trimmed)) {
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: '這格要請你點下面按鈕明示同意或不同意。' },
          licenseFlexFromCollected(licenseCollected),
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
      const sessFresh = await prisma.conversationSession.findUnique({ where: { id: sid } });
      const collectedFresh = parseCollected(sessFresh?.collectedDataJson ?? '{}');
      await setConversationState(sid, FLOW_STATE.SHOW_ORDER_CONFIRMATION);
      const summary = confirmSummaryForApp(fresh, collectedFresh);
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
            text: '好，先幫你停在這裡，資料都留著。想送出時再說「資料正確，送出」就可以。',
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
        const sessNeedLicense = await prisma.conversationSession.findUnique({ where: { id: sid } });
        await replyJiba(replyToken, lineUserId, [
          { type: 'text', text: '送出前還差授權同意。' },
          licenseFlexFromCollected(parseCollected(sessNeedLicense?.collectedDataJson ?? '{}')),
        ]);
        return true;
      }
      await submitForReview(app.id);
      await upsertJibaLineChatSessionIfIdle(lineUserId, FLOW_STATE.PENDING_REVIEW, {
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
          text: `這步好像有點卡住了。你可以傳「查看目前資料」或「找${JIBA_SUPERVISOR_NAME}」，我們再幫你看。`,
        },
      ]);
      return true;
  }
}

/** LINE postback：我已轉帳（payload 不可當姓名） */
export async function handleJibaUnboxPostback(
  replyToken: string,
  lineUserId: string,
  data: string,
  webhookEventId?: string,
): Promise<boolean> {
  if (data !== 'jd=jiba_xfer' && !data.includes('jiba_xfer')) return false;
  return handleJibaUnboxMessage(
    replyToken,
    lineUserId,
    '選我已轉帳',
    webhookEventId ? `pb:${webhookEventId}` : undefined,
  );
}

/** 壽司匠通過後一律入出貨列；未申報轉帳另出示轉帳卡，不當作已核帳 */
export async function notifyJibaApproved(applicationId: string, note?: string) {
  const app = await approveAndCreatePayment({
    applicationId,
    note,
    reviewerName: JIBA_SUPERVISOR_NAME,
  });
  const queued = app.status === APP_STATUS.READY_TO_SHIP;
  const copy = queued ? JIBA_APPROVED_QUEUED : JIBA_APPROVED_AWAIT_TRANSFER;
  const session = await prisma.conversationSession.findUnique({
    where: { campaignApplicationId: applicationId },
  });
  if (session) {
    await logBot(session.id, copy, { paymentMethod: 'bank_transfer', queued });
  }
  await upsertJibaLineChatSessionIfIdle(
    app.lineUserId,
    queued ? FLOW_STATE.READY_TO_SHIP : FLOW_STATE.AWAITING_SHIPPING_PAYMENT,
    { applicationId },
  );
  if (queued) {
    await pushLineMessages(app.lineUserId, [{ type: 'text', text: copy }]);
  } else {
    await pushLineMessages(app.lineUserId, [
      { type: 'text', text: copy },
      ...transferReplyMessages(),
    ]);
  }
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
  await upsertJibaLineChatSessionIfIdle(app.lineUserId, nextState, {
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
