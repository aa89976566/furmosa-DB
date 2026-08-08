/**
 * 註冊後內容／頻率偏好收集（不可阻擋註冊／交易流程）
 * Phase 4B-B：5 選 opt-in + signed postback；不預設 mixed；不升級舊 alternate
 */

import {
  clearLineChatSession,
  getLineChatSession,
  upsertLineChatSession,
  type MorningPrefsDraft,
} from '@/lib/line/chat-session';
import {
  CONTENT_MODE_LABELS,
  FREQUENCY_LABELS,
  MORNING_CONTENT_PROMPT,
  MORNING_FREQUENCY_PROMPT,
  MORNING_SETTINGS_MENU,
  MORNING_STOP_CLARIFY,
  morningPausedText,
  morningPreferenceSavedText,
  morningResumedText,
  morningUnsubscribedText,
} from '@/lib/line/morning/copy';
import {
  parseMorningCommand,
  resolveOffInFrequencyStep,
} from '@/lib/line/morning/commands';
import {
  asUpsertContentMode,
  buildMorningOptinQuickReplyItems,
  verifyMorningOptinPostback,
  type MorningOptinStorageMode,
} from '@/lib/line/morning/optin-postback';
import {
  getMorningPreference,
  isPreferenceComplete,
  upsertMorningPreference,
} from '@/lib/line/morning/preferences';
import { replyLineMessage, replyLineText } from '@/lib/line/reply';

export type { MorningPrefsDraft };

async function replyContentPrompt(
  replyToken: string,
  lineUserId: string,
  fromSettings: boolean,
  draft: MorningPrefsDraft,
) {
  const { items, nonce } = buildMorningOptinQuickReplyItems(lineUserId);
  await upsertLineChatSession(lineUserId, 'morning_prefs', 'content_mode', {
    ...draft,
    fromSettings,
    optinNonce: nonce,
  } as MorningPrefsDraft);
  await replyLineMessage(replyToken, [
    {
      type: 'text',
      text: fromSettings ? MORNING_SETTINGS_MENU : MORNING_CONTENT_PROMPT,
      quickReply: { items },
    },
  ]);
}

export type MorningPreferencePromptPayload = {
  text: string;
  quickReplyItems: ReturnType<typeof buildMorningOptinQuickReplyItems>['items'];
  nonce: string;
};

/**
 * 準備偏好 session（可回傳 quick-reply 供合併進既有 replyToken 批次）
 */
export async function startMorningPreferenceFlow(
  replyToken: string | null,
  lineUserId: string,
  opts?: { customerId?: string | null; fromSettings?: boolean; reply?: boolean },
): Promise<MorningPreferencePromptPayload> {
  await upsertMorningPreference(lineUserId, {
    customerId: opts?.customerId ?? null,
    promptedAt: new Date(),
  });
  const fromSettings = opts?.fromSettings ?? false;
  const { items, nonce } = buildMorningOptinQuickReplyItems(lineUserId);
  const draft: MorningPrefsDraft = { fromSettings, optinNonce: nonce };
  await upsertLineChatSession(lineUserId, 'morning_prefs', 'content_mode', draft);
  const text = fromSettings ? MORNING_SETTINGS_MENU : MORNING_CONTENT_PROMPT;
  const payload: MorningPreferencePromptPayload = {
    text,
    quickReplyItems: items,
    nonce,
  };

  if (opts?.reply === false || !replyToken) return payload;
  await replyLineMessage(replyToken, [
    {
      type: 'text',
      text,
      quickReply: { items },
    },
  ]);
  return payload;
}

async function applyContentModeChoice(
  replyToken: string,
  lineUserId: string,
  mode: MorningOptinStorageMode | 'alternate',
  draft: MorningPrefsDraft,
): Promise<void> {
  if (mode === 'off') {
    await upsertMorningPreference(lineUserId, {
      contentMode: 'off',
      frequency: 'off',
      pausedAt: null,
    });
    await clearLineChatSession(lineUserId);
    await replyLineText(
      replyToken,
      morningPreferenceSavedText({
        contentModeLabel: '先不用',
        frequencyLabel: '先不用',
      }),
    );
    return;
  }

  const storageMode =
    mode === 'alternate' ? 'alternate' : asUpsertContentMode(mode);

  await upsertLineChatSession(lineUserId, 'morning_prefs', 'frequency', {
    ...draft,
    contentMode: storageMode,
    optinNonce: undefined,
  });
  await upsertMorningPreference(lineUserId, { contentMode: storageMode });
  await replyLineText(replyToken, MORNING_FREQUENCY_PROMPT);
}

export async function handleMorningPreferenceMessage(
  replyToken: string,
  lineUserId: string,
  text: string,
): Promise<boolean> {
  const session = await getLineChatSession(lineUserId);
  if (!session || session.flow !== 'morning_prefs') return false;

  let draft: MorningPrefsDraft = {};
  try {
    draft = JSON.parse(session.payload) as MorningPrefsDraft;
  } catch {
    draft = {};
  }

  let cmd = parseMorningCommand(text);

  if (cmd.kind === 'bare_stop') {
    await replyLineText(replyToken, MORNING_STOP_CLARIFY);
    return true;
  }
  if (cmd.kind === 'settings') {
    await startMorningPreferenceFlow(replyToken, lineUserId, {
      fromSettings: true,
    });
    return true;
  }
  if (cmd.kind === 'pause') {
    await upsertMorningPreference(lineUserId, { pausedAt: new Date() });
    await clearLineChatSession(lineUserId);
    await replyLineText(replyToken, morningPausedText());
    return true;
  }
  if (cmd.kind === 'resume') {
    await upsertMorningPreference(lineUserId, { pausedAt: null });
    await clearLineChatSession(lineUserId);
    await replyLineText(replyToken, morningResumedText());
    return true;
  }
  if (cmd.kind === 'unsubscribe') {
    await upsertMorningPreference(lineUserId, {
      contentMode: 'off',
      frequency: 'off',
      pausedAt: null,
    });
    await clearLineChatSession(lineUserId);
    await replyLineText(replyToken, morningUnsubscribedText());
    return true;
  }

  if (session.step === 'frequency') {
    cmd = resolveOffInFrequencyStep(cmd);
    if (cmd.kind === 'none' || cmd.kind === 'content_mode') {
      return false;
    }
    if (cmd.kind !== 'frequency') {
      await replyLineText(replyToken, MORNING_FREQUENCY_PROMPT);
      return true;
    }
    const pref = await upsertMorningPreference(lineUserId, {
      frequency: cmd.frequency,
      contentMode: (draft.contentMode as
        | 'jokes'
        | 'news'
        | 'alternate'
        | 'news_first_fact_fallback'
        | 'news_first_fact_or_humor_fallback'
        | 'off'
        | undefined) ?? undefined,
      pausedAt: null,
    });
    await clearLineChatSession(lineUserId);
    await replyLineText(
      replyToken,
      morningPreferenceSavedText({
        contentModeLabel: CONTENT_MODE_LABELS[pref.contentMode] ?? pref.contentMode,
        frequencyLabel: FREQUENCY_LABELS[pref.frequency] ?? pref.frequency,
      }),
    );
    return true;
  }

  if (cmd.kind === 'none') {
    return false;
  }
  if (cmd.kind === 'frequency') {
    await replyContentPrompt(
      replyToken,
      lineUserId,
      Boolean(draft.fromSettings),
      draft,
    );
    return true;
  }
  if (cmd.kind !== 'content_mode') {
    return false;
  }

  await applyContentModeChoice(replyToken, lineUserId, cmd.mode as MorningOptinStorageMode | 'alternate', draft);
  return true;
}

/**
 * 處理 morning opt-in postback（防偽／重播）
 * @returns true 表示已處理（含驗證失敗回覆）
 */
export async function handleMorningOptinPostback(
  replyToken: string,
  lineUserId: string,
  data: string,
): Promise<boolean> {
  if (!data.startsWith('morning=1')) return false;

  const session = await getLineChatSession(lineUserId);
  let draft: MorningPrefsDraft = {};
  if (session?.flow === 'morning_prefs') {
    try {
      draft = JSON.parse(session.payload) as MorningPrefsDraft;
    } catch {
      draft = {};
    }
  }

  const verified = verifyMorningOptinPostback({
    data,
    expectedLineUserId: lineUserId,
    expectedNonce: draft.optinNonce ?? null,
  });

  if (!verified.ok) {
    await replyLineText(
      replyToken,
      verified.reason === 'replay' || verified.reason === 'expired'
        ? '這顆按鈕過期或已用過了。請回「早安設定」重新選一次。'
        : '這次選擇沒通過驗證。請回「早安設定」再選一次。',
    );
    return true;
  }

  // 確保進入偏好流程步驟
  if (!session || session.flow !== 'morning_prefs') {
    await upsertMorningPreference(lineUserId, { promptedAt: new Date() });
    draft = { fromSettings: true };
    await upsertLineChatSession(lineUserId, 'morning_prefs', 'content_mode', draft);
  }

  await applyContentModeChoice(replyToken, lineUserId, verified.mode, draft);
  return true;
}

/**
 * 全域早安指令（非 session）：設定／暫停／恢復／退訂／裸停止
 */
export async function handleMorningGlobalCommand(
  replyToken: string,
  lineUserId: string,
  text: string,
): Promise<boolean> {
  const cmd = parseMorningCommand(text);
  if (cmd.kind === 'none') return false;

  if (cmd.kind === 'bare_stop') {
    await replyLineText(replyToken, MORNING_STOP_CLARIFY);
    return true;
  }
  if (cmd.kind === 'settings') {
    await startMorningPreferenceFlow(replyToken, lineUserId, { fromSettings: true });
    return true;
  }
  if (cmd.kind === 'pause') {
    await upsertMorningPreference(lineUserId, { pausedAt: new Date() });
    await replyLineText(replyToken, morningPausedText());
    return true;
  }
  if (cmd.kind === 'resume') {
    await upsertMorningPreference(lineUserId, { pausedAt: null });
    const pref = await getMorningPreference(lineUserId);
    if (!isPreferenceComplete(pref)) {
      await startMorningPreferenceFlow(replyToken, lineUserId, { fromSettings: true });
      return true;
    }
    await replyLineText(replyToken, morningResumedText());
    return true;
  }
  if (cmd.kind === 'unsubscribe') {
    await upsertMorningPreference(lineUserId, {
      contentMode: 'off',
      frequency: 'off',
      pausedAt: null,
    });
    await replyLineText(replyToken, morningUnsubscribedText());
    return true;
  }

  if (cmd.kind === 'content_mode') {
    if (cmd.mode === 'off') {
      await upsertMorningPreference(lineUserId, {
        contentMode: 'off',
        frequency: 'off',
      });
      await replyLineText(
        replyToken,
        morningPreferenceSavedText({
          contentModeLabel: '先不用',
          frequencyLabel: '先不用',
        }),
      );
      return true;
    }
    await upsertMorningPreference(lineUserId, { contentMode: cmd.mode });
    await upsertLineChatSession(lineUserId, 'morning_prefs', 'frequency', {
      contentMode: cmd.mode,
    });
    await replyLineText(replyToken, MORNING_FREQUENCY_PROMPT);
    return true;
  }
  if (cmd.kind === 'frequency') {
    await upsertMorningPreference(lineUserId, { frequency: cmd.frequency });
    const pref = await getMorningPreference(lineUserId);
    if (!pref || pref.contentMode === 'unset') {
      await startMorningPreferenceFlow(replyToken, lineUserId);
      return true;
    }
    await replyLineText(
      replyToken,
      morningPreferenceSavedText({
        contentModeLabel: CONTENT_MODE_LABELS[pref.contentMode] ?? pref.contentMode,
        frequencyLabel: FREQUENCY_LABELS[cmd.frequency] ?? cmd.frequency,
      }),
    );
    return true;
  }

  return false;
}
