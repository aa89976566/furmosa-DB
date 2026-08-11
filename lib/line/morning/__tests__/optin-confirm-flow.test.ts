import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';

import {
  OPTIN_EXPIRED_REPLY,
  OPTIN_INVALID_STAY_HINT,
  OPTIN_STALE_SAMPLE_REPLY,
  HUMOR_FIRST_CONTENT,
  HUMOR_MODE_BRIEF,
  HUMOR_SAMPLE_BODY,
  NEWS_FIRST_CONTENT,
  NEWS_MODE_BRIEF,
  buildOptinPostbackData,
  type MorningOptinDraft,
} from '@/lib/line/morning/domain/optin';
import type { ConfirmLedgerRow } from '@/lib/line/morning/confirm-ledger';
import {
  handleMorningOptinPostback,
  handleMorningPreferenceMessage,
  startMorningPreferenceFlow,
  type PreferenceFlowDeps,
  type ConfirmTxClient,
} from '@/lib/line/morning/preference-flow';
import type { MorningPreferenceRow } from '@/lib/line/morning/preferences';
import type { LineReplyMessage } from '@/lib/line/reply';

type SessionRow = {
  id: string;
  lineUserId: string;
  flow: string;
  step: string;
  payload: string;
  createdAt: Date;
  updatedAt: Date;
};

type Mem = {
  deps: PreferenceFlowDeps;
  replies: LineReplyMessage[][];
  preferenceWrites: number;
  ledgerWrites: number;
  ledgers: ConfirmLedgerRow[];
  sessions: Map<string, SessionRow>;
  prefs: Map<string, MorningPreferenceRow>;
};

function createMemoryDeps(seed?: {
  pref?: Partial<MorningPreferenceRow> | null;
}): Mem {
  const sessions = new Map<string, SessionRow>();
  const prefs = new Map<string, MorningPreferenceRow>();
  const ledgers: ConfirmLedgerRow[] = [];
  const replies: LineReplyMessage[][] = [];
  const counters = { preferenceWrites: 0, ledgerWrites: 0 };
  let nowMs = Date.parse('2026-08-08T08:00:00+08:00');
  let nonceSeq = 0;

  if (seed?.pref) {
    prefs.set('U1', {
      id: 'p1',
      lineUserId: 'U1',
      customerId: 'cust1',
      contentMode: 'unset',
      frequency: 'unset',
      pausedAt: null,
      promptedAt: null,
      ...seed.pref,
    } as MorningPreferenceRow);
  }

  const findLedgerByEventKey = async (eventDedupKey: string) =>
    ledgers.find((l) => l.eventDedupKey === eventDedupKey) ?? null;

  const findLedgersByNonceHash = async (sessionNonceHash: string) =>
    ledgers.filter((l) => l.sessionNonceHash === sessionNonceHash);

  const upsertPreference: PreferenceFlowDeps['upsertPreference'] = async (
    lineUserId,
    data,
  ) => {
    counters.preferenceWrites += 1;
    const prev = prefs.get(lineUserId);
    const next: MorningPreferenceRow = {
      id: prev?.id ?? `p_${lineUserId}`,
      lineUserId,
      customerId:
        data.customerId !== undefined
          ? data.customerId ?? null
          : prev?.customerId ?? 'cust1',
      contentMode: (data.contentMode ??
        prev?.contentMode ??
        'unset') as MorningPreferenceRow['contentMode'],
      frequency: (data.frequency ??
        prev?.frequency ??
        'unset') as MorningPreferenceRow['frequency'],
      pausedAt:
        data.pausedAt !== undefined ? data.pausedAt : prev?.pausedAt ?? null,
      promptedAt:
        data.promptedAt !== undefined
          ? data.promptedAt
          : prev?.promptedAt ?? null,
    };
    prefs.set(lineUserId, next);
    return next;
  };

  const createLedgerSuccess: PreferenceFlowDeps['createLedgerSuccess'] = async (
    input,
  ) => {
    if (ledgers.some((l) => l.eventDedupKey === input.eventDedupKey)) {
      throw new Error('unique_event');
    }
    if (
      ledgers.some(
        (l) =>
          l.sessionNonceHash === input.sessionNonceHash &&
          l.payloadDigest === input.payloadDigest,
      )
    ) {
      throw new Error('unique_nonce_digest');
    }
    counters.ledgerWrites += 1;
    const row: ConfirmLedgerRow = {
      id: `led_${counters.ledgerWrites}`,
      lineUserId: input.lineUserId,
      eventDedupKey: input.eventDedupKey,
      sessionNonceHash: input.sessionNonceHash,
      stepVersion: input.stepVersion,
      payloadDigest: input.payloadDigest,
      preferenceSnapshot: input.preferenceSnapshot,
      successSummary: input.successSummary,
      status: 'SUCCESS',
      createdAt: new Date(nowMs),
      expiresAt: new Date(nowMs + 1000),
    };
    ledgers.push(row);
    return row;
  };

  const getSession: PreferenceFlowDeps['getSession'] = async (lineUserId) =>
    sessions.get(lineUserId) ?? null;

  const clearSession: PreferenceFlowDeps['clearSession'] = async (lineUserId) => {
    sessions.delete(lineUserId);
  };

  const txClient: ConfirmTxClient = {
    upsertPreference,
    createLedgerSuccess,
    findLedgerByEventKey,
    findLedgersByNonceHash,
    getSession,
    clearSession,
  };

  const deps: PreferenceFlowDeps = {
    getSession,
    upsertSession: async (lineUserId, flow, step, payload) => {
      const row: SessionRow = {
        id: `s_${lineUserId}`,
        lineUserId,
        flow,
        step,
        payload: JSON.stringify(payload),
        createdAt: new Date(nowMs),
        updatedAt: new Date(nowMs),
      };
      sessions.set(lineUserId, row);
      return row;
    },
    clearSession,
    getPreference: async (lineUserId) => prefs.get(lineUserId) ?? null,
    upsertPreference,
    findLedgerByEventKey,
    findLedgersByNonceHash,
    createLedgerSuccess,
    reply: async (_token, messages) => {
      replies.push(messages);
    },
    now: () => new Date(nowMs),
    createNonce: () => {
      nonceSeq += 1;
      return createHash('sha256')
        .update(`nonce-${nonceSeq}`)
        .digest('hex')
        .slice(0, 32);
    },
    findCustomerIdByLineUserId: async () => 'cust1',
    runConfirmTransaction: async (fn) => fn(txClient),
  };

  return {
    deps,
    replies,
    get preferenceWrites() {
      return counters.preferenceWrites;
    },
    get ledgerWrites() {
      return counters.ledgerWrites;
    },
    ledgers,
    sessions,
    prefs,
  };
}

function lastText(replies: LineReplyMessage[][]): string {
  const batch = replies[replies.length - 1];
  const t = batch?.find((m) => m.type === 'text');
  return t && t.type === 'text' ? t.text : '';
}

function sessionDraft(sessions: Map<string, SessionRow>): MorningOptinDraft {
  const s = sessions.get('U1');
  assert.ok(s);
  return JSON.parse(s.payload) as MorningOptinDraft;
}

function lastBatch(replies: LineReplyMessage[][]): LineReplyMessage[] {
  return replies[replies.length - 1] ?? [];
}

function textsInBatch(batch: LineReplyMessage[]): string[] {
  return batch
    .filter((m): m is Extract<LineReplyMessage, { type: 'text' }> => m.type === 'text')
    .map((m) => m.text);
}

async function walkToSummary(mem: Mem, mode: 'content_a' | 'content_b' = 'content_a') {
  await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
  let d = sessionDraft(mem.sessions);
  await handleMorningOptinPostback(
    'tok',
    'U1',
    buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'mode',
      actionId: mode,
    }),
    { webhookEventId: `ev-mode-${mode}`, deps: mem.deps },
  );
  d = sessionDraft(mem.sessions);
  assert.equal(mem.sessions.get('U1')?.step, 'brief');
  // CONFIRM 前不得出現完整 sample／first content
  assert.ok(!lastText(mem.replies).includes(HUMOR_SAMPLE_BODY));
  assert.ok(!lastText(mem.replies).includes(HUMOR_FIRST_CONTENT));
  assert.ok(!lastText(mem.replies).includes(NEWS_FIRST_CONTENT.slice(0, 20)));
  await handleMorningOptinPostback(
    'tok',
    'U1',
    buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'brief',
      actionId: 'brief_confirm',
    }),
    { webhookEventId: `ev-brief-${mode}`, deps: mem.deps },
  );
  d = sessionDraft(mem.sessions);
  assert.equal(mem.sessions.get('U1')?.step, 'frequency');
  await handleMorningOptinPostback(
    'tok',
    'U1',
    buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'frequency',
      actionId: 'freq_daily',
    }),
    { webhookEventId: `ev-freq-${mode}`, deps: mem.deps },
  );
  assert.ok(lastText(mem.replies).includes('請確認設定'));
}

describe('Brief-first confirm flow + ConfirmLedger', () => {
  it('confirm 前 0 writes；mode→brief→freq→summary→confirm 恰 1 筆＋first content', async () => {
    const mem = createMemoryDeps();
    await walkToSummary(mem, 'content_a');
    assert.equal(mem.preferenceWrites, 0);
    assert.ok(lastText(mem.replies).includes('笑個毛') || lastText(mem.replies).includes('請確認'));

    const d3 = sessionDraft(mem.sessions);
    const beforeReplies = mem.replies.length;
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d3.nonce,
        version: d3.version,
        step: 'summary',
        actionId: 'confirm',
      }),
      { webhookEventId: 'ev-confirm-1', deps: mem.deps },
    );

    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    assert.equal(mem.prefs.get('U1')?.contentMode, 'jokes');
    assert.equal(mem.prefs.get('U1')?.frequency, 'daily');
    assert.equal(mem.sessions.has('U1'), false);
    assert.equal(mem.replies.length, beforeReplies + 1);
    const batch = textsInBatch(lastBatch(mem.replies));
    assert.equal(batch.length, 2);
    assert.ok(batch[0]!.includes('陪你笑個毛'));
    assert.equal(batch[1], HUMOR_FIRST_CONTENT);
    assert.ok(batch.length <= 5);
  });

  it('豎起耳朵成功 CONFIRM：completion + NEWS first content', async () => {
    const mem = createMemoryDeps();
    await walkToSummary(mem, 'content_b');
    const d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'summary',
        actionId: 'confirm',
      }),
      { webhookEventId: 'ev-confirm-news', deps: mem.deps },
    );
    const batch = textsInBatch(lastBatch(mem.replies));
    assert.equal(batch.length, 2);
    assert.ok(batch[0]!.includes('豎起耳朵'));
    assert.equal(batch[1], NEWS_FIRST_CONTENT);
    assert.equal(mem.prefs.get('U1')?.contentMode, 'news');
  });

  it('brief 步驟只顯示一句 brief（非完整 sample）', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    const d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'mode',
        actionId: 'content_a',
      }),
      { webhookEventId: 'ev-s', deps: mem.deps },
    );
    assert.equal(lastText(mem.replies), HUMOR_MODE_BRIEF);
    assert.notEqual(lastText(mem.replies), HUMOR_SAMPLE_BODY);
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(mem.sessions.get('U1')?.step, 'brief');
  });

  it('stale MODE_SAMPLE：清除 pending → AWAITING_MODE；零下游寫入／內容', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    const d = sessionDraft(mem.sessions);
    // 模擬舊 pending
    await mem.deps.upsertSession('U1', 'morning_prefs', 'sample', {
      ...d,
      contentActionId: 'content_a',
    });
    assert.equal(mem.sessions.get('U1')?.step, 'sample');
    const before = mem.replies.length;
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'sample',
        actionId: 'sample_confirm',
      }),
      { webhookEventId: 'ev-stale-sample', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(mem.ledgerWrites, 0);
    assert.equal(mem.sessions.get('U1')?.step, 'mode');
    assert.equal(mem.replies.length, before + 1);
    const text = lastText(mem.replies);
    assert.ok(text.startsWith(OPTIN_STALE_SAMPLE_REPLY));
    assert.ok(text.includes('想先試哪一種'));
    assert.ok(!text.includes(HUMOR_FIRST_CONTENT));
    assert.ok(!text.includes(HUMOR_SAMPLE_BODY));
  });

  it('(a) 相同 event/replyToken retry：winner 後純 200/no-op，不得再 reply', async () => {
    const mem = createMemoryDeps();
    await walkToSummary(mem, 'content_a');
    const d = sessionDraft(mem.sessions);
    const confirmData = buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'summary',
      actionId: 'confirm',
    });
    await handleMorningOptinPostback('tok', 'U1', confirmData, {
      webhookEventId: 'ev-confirm-same',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    const afterWinner = mem.replies.length;

    await handleMorningOptinPostback('tok', 'U1', confirmData, {
      webhookEventId: 'ev-confirm-same',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    assert.equal(mem.replies.length, afterWinner); // no-op：零额外 reply
  });

  it('(b) 不同 event/replyToken 雙擊：loser 過期狀態、無 first content 重送', async () => {
    const mem = createMemoryDeps();
    await walkToSummary(mem);
    const d = sessionDraft(mem.sessions);
    const data = buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'summary',
      actionId: 'confirm',
    });
    await handleMorningOptinPostback('tok-a', 'U1', data, {
      webhookEventId: 'ev-ok',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);
    const winnerBatch = textsInBatch(lastBatch(mem.replies));
    assert.equal(winnerBatch.length, 2);

    await handleMorningOptinPostback('tok-b', 'U1', data, {
      webhookEventId: 'ev-other',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    const loserBatch = textsInBatch(lastBatch(mem.replies));
    assert.equal(loserBatch.length, 1);
    assert.equal(loserBatch[0], OPTIN_EXPIRED_REPLY);
    assert.ok(!loserBatch[0]!.includes(HUMOR_FIRST_CONTENT));
  });

  it('兩個並行相同 CONFIRM：恰一 winner／ledger／reply composition／first content', async () => {
    const mem = createMemoryDeps();
    await walkToSummary(mem, 'content_a');
    const d = sessionDraft(mem.sessions);
    const data = buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'summary',
      actionId: 'confirm',
    });
    const before = mem.replies.length;
    // 模擬 race：同一 eventKey 並行
    await Promise.all([
      handleMorningOptinPostback('tok', 'U1', data, {
        webhookEventId: 'ev-race',
        deps: mem.deps,
      }),
      handleMorningOptinPostback('tok', 'U1', data, {
        webhookEventId: 'ev-race',
        deps: mem.deps,
      }),
    ]);
    assert.equal(mem.ledgerWrites, 1);
    assert.equal(mem.preferenceWrites, 1);
    const winnerBatches = mem.replies
      .slice(before)
      .filter((b) => textsInBatch(b).some((t) => t.includes('陪你笑個毛')));
    assert.equal(winnerBatches.length, 1);
    assert.equal(textsInBatch(winnerBatches[0]!).filter((t) => t === HUMOR_FIRST_CONTENT).length, 1);
  });

  it('write/commit failure：零 success、零 first content、可安全 retry', async () => {
    const mem = createMemoryDeps();
    await walkToSummary(mem, 'content_a');
    const d = sessionDraft(mem.sessions);
    const failing: PreferenceFlowDeps = {
      ...mem.deps,
      runConfirmTransaction: async () => {
        throw new Error('simulated_commit_failure');
      },
    };
    const before = mem.replies.length;
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'summary',
        actionId: 'confirm',
      }),
      { webhookEventId: 'ev-fail', deps: failing },
    );
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(mem.ledgerWrites, 0);
    assert.equal(mem.sessions.get('U1')?.step, 'summary'); // 可安全 retry
    const afterFail = mem.replies.slice(before);
    for (const batch of afterFail) {
      const texts = textsInBatch(batch);
      assert.ok(!texts.some((t) => t.includes('陪你笑個毛')));
      assert.ok(!texts.includes(HUMOR_FIRST_CONTENT));
    }

    // retry 成功
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'summary',
        actionId: 'confirm',
      }),
      { webhookEventId: 'ev-fail-retry', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    const batch = textsInBatch(lastBatch(mem.replies));
    assert.equal(batch.length, 2);
    assert.equal(batch[1], HUMOR_FIRST_CONTENT);
  });

  it('錯 nonce：0 writes + 過期文案', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    const d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: 'ffffffffffffffffffffffffffffffff',
        version: d.version,
        step: 'mode',
        actionId: 'content_a',
      }),
      { webhookEventId: 'ev-bad', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(lastText(mem.replies), OPTIN_EXPIRED_REPLY);
  });

  it('非法輸入留在目前步驟並重顯（零寫入）', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    assert.equal(mem.sessions.get('U1')?.step, 'mode');
    const handled = await handleMorningPreferenceMessage(
      'tok',
      'U1',
      '今天天氣如何',
      { deps: mem.deps },
    );
    assert.equal(handled, true);
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(mem.sessions.has('U1'), true);
    assert.equal(mem.sessions.get('U1')?.step, 'mode');
    assert.ok(lastText(mem.replies).includes(OPTIN_INVALID_STAY_HINT));
  });

  it('brief_switch 保持同使用者最多一個 pending', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    let d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'mode',
        actionId: 'content_a',
      }),
      { webhookEventId: 'ev-m1', deps: mem.deps },
    );
    d = sessionDraft(mem.sessions);
    assert.equal(d.contentActionId, 'content_a');
    assert.equal(lastText(mem.replies), HUMOR_MODE_BRIEF);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'brief',
        actionId: 'brief_switch',
      }),
      { webhookEventId: 'ev-sw', deps: mem.deps },
    );
    assert.equal(mem.sessions.size, 1);
    d = sessionDraft(mem.sessions);
    assert.equal(d.contentActionId, 'content_b');
    assert.equal(lastText(mem.replies), NEWS_MODE_BRIEF);
    assert.equal(mem.preferenceWrites, 0);
  });

  it('legacy：摘要＋維持零寫入', async () => {
    const mem = createMemoryDeps({
      pref: { contentMode: 'alternate', frequency: 'daily' },
    });
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    assert.equal(mem.sessions.get('U1')?.step, 'legacy');
    const text = lastText(mem.replies);
    assert.ok(text.includes('笑話／新聞交替'));
    assert.ok(text.includes('維持目前設定'));
    assert.equal(mem.preferenceWrites, 0);

    const d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'legacy',
        actionId: 'legacy_keep',
      }),
      { webhookEventId: 'ev-keep', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(mem.ledgerWrites, 0);
    assert.equal(mem.prefs.get('U1')?.contentMode, 'alternate');
  });
});
