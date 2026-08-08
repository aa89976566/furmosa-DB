/**
 * 註冊後內容／頻率偏好收集（不可阻擋註冊／交易流程）
 */

import {
  clearLineChatSession,
  getLineChatSession,
  upsertLineChatSession,
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
  getMorningPreference,
  isPreferenceComplete,
  upsertMorningPreference,
} from '@/lib/line/morning/preferences';
import { replyLineText } from '@/lib/line/reply';

export type MorningPrefsDraft = {
  contentMode?: string;
  /** 設定選單模式：先改內容再改頻率 */
  fromSettings?: boolean;
};

export async function startMorningPreferenceFlow(
  replyToken: string | null,
  lineUserId: string,
  opts?: { customerId?: string | null; fromSettings?: boolean; reply?: boolean },
) {
  await upsertMorningPreference(lineUserId, {
    customerId: opts?.customerId ?? null,
    promptedAt: new Date(),
  });
  await upsertLineChatSession(lineUserId, 'morning_prefs', 'content_mode', {
    fromSettings: opts?.fromSettings ?? false,
  } as MorningPrefsDraft);

  if (opts?.reply === false || !replyToken) return;
  await replyLineText(
    replyToken,
    opts?.fromSettings ? MORNING_SETTINGS_MENU : MORNING_CONTENT_PROMPT,
  );
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
    // 非頻率答案：不阻擋序號／開箱等，交回一般路由
    if (cmd.kind === 'none' || cmd.kind === 'content_mode') {
      return false;
    }
    if (cmd.kind !== 'frequency') {
      await replyLineText(replyToken, MORNING_FREQUENCY_PROMPT);
      return true;
    }
    const pref = await upsertMorningPreference(lineUserId, {
      frequency: cmd.frequency,
      contentMode:
        (draft.contentMode as 'jokes' | 'news' | 'alternate' | 'off' | undefined) ??
        undefined,
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

  // content_mode step：無法辨識則放行（不可阻擋輸入序號等 intent）
  if (cmd.kind === 'none') {
    return false;
  }
  if (cmd.kind === 'frequency') {
    // 使用者直接丟頻率：先記住，仍要求選內容
    await replyLineText(replyToken, MORNING_CONTENT_PROMPT);
    return true;
  }
  if (cmd.kind !== 'content_mode') {
    return false;
  }

  if (cmd.mode === 'off') {
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
    return true;
  }

  await upsertLineChatSession(lineUserId, 'morning_prefs', 'frequency', {
    ...draft,
    contentMode: cmd.mode,
  });
  await upsertMorningPreference(lineUserId, { contentMode: cmd.mode });
  await replyLineText(replyToken, MORNING_FREQUENCY_PROMPT);
  return true;
}

/**
 * 全域早安指令（非 session）：設定／暫停／恢復／退訂／裸停止
 * 回傳 true 表示已處理。
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

  // 直接設定內容／頻率（快捷）
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
    await startMorningPreferenceFlow(replyToken, lineUserId, { reply: false });
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
