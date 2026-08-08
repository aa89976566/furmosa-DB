import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';

import {
  OPTIN_EXPIRED_REPLY,
  NEWS_ONLY_SOURCE_DISCLOSURE,
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
      customerId: null,
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
          : prev?.customerId ?? null,
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

describe('Phase 4B-B confirm flow + ConfirmLedger', () => {
  it('confirm 前 preference 0 writes；完整 content→freq→summary→confirm 一次 write', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    assert.equal(mem.preferenceWrites, 0);
    assert.ok(lastText(mem.replies).includes(NEWS_ONLY_SOURCE_DISCLOSURE));

    const d1 = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d1.nonce,
        version: d1.version,
        step: 'content',
        actionId: 'content_a',
      }),
      { webhookEventId: 'ev-content', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 0);

    const d2 = sessionDraft(mem.sessions);
    assert.equal(mem.sessions.get('U1')?.step, 'frequency');
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d2.nonce,
        version: d2.version,
        step: 'frequency',
        actionId: 'freq_daily',
      }),
      { webhookEventId: 'ev-freq', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 0);
    assert.ok(lastText(mem.replies).includes('設定摘要'));

    const d3 = sessionDraft(mem.sessions);
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
    assert.equal(mem.sessions.has('U1'), false, 'confirm 後清 session');
    assert.ok(!mem.ledgers[0]!.successSummary.includes(d3.nonce));
    assert.equal(
      mem.ledgers[0]!.sessionNonceHash,
      createHash('sha256').update(d3.nonce, 'utf8').digest('hex'),
    );
  });

  it('相同 event redelivery：0 additional writes + byte-stable 重播', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    let d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'content',
        actionId: 'content_e',
      }),
      { webhookEventId: 'ev-e', deps: mem.deps },
    );
    d = sessionDraft(mem.sessions);
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
    const summary = lastText(mem.replies);
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);

    await handleMorningOptinPostback('tok2', 'U1', confirmData, {
      webhookEventId: 'ev-confirm-same',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    assert.equal(lastText(mem.replies), summary);
    assert.ok(!lastText(mem.replies).includes(OPTIN_EXPIRED_REPLY));
  });

  it('錯 nonce／歷史按鈕：0 writes + 過期文案', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    const d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: 'ffffffffffffffffffffffffffffffff',
        version: d.version,
        step: 'content',
        actionId: 'content_a',
      }),
      { webhookEventId: 'ev-bad', deps: mem.deps },
    );
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(lastText(mem.replies), OPTIN_EXPIRED_REPLY);
  });

  it('已消費 nonce + 不同 event：0 writes + 過期', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    let d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'content',
        actionId: 'content_a',
      }),
      { webhookEventId: 'ev-c1', deps: mem.deps },
    );
    d = sessionDraft(mem.sessions);
    await handleMorningOptinPostback(
      'tok',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'frequency',
        actionId: 'freq_off',
      }),
      { webhookEventId: 'ev-f1', deps: mem.deps },
    );
    d = sessionDraft(mem.sessions);
    const data = buildOptinPostbackData({
      nonce: d.nonce,
      version: d.version,
      step: 'summary',
      actionId: 'confirm',
    });
    await handleMorningOptinPostback('tok', 'U1', data, {
      webhookEventId: 'ev-ok',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);

    await handleMorningOptinPostback('tok', 'U1', data, {
      webhookEventId: 'ev-other',
      deps: mem.deps,
    });
    assert.equal(mem.preferenceWrites, 1);
    assert.equal(mem.ledgerWrites, 1);
    assert.equal(lastText(mem.replies), OPTIN_EXPIRED_REPLY);
  });

  it('自由文字中止：清 draft、0 preference writes', async () => {
    const mem = createMemoryDeps();
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    const handled = await handleMorningPreferenceMessage(
      'tok',
      'U1',
      '今天天氣如何',
      { deps: mem.deps },
    );
    assert.equal(handled, true);
    assert.equal(mem.preferenceWrites, 0);
    assert.equal(mem.sessions.has('U1'), false);
  });

  it('legacy alternate 顯示沿用；B 無 fallback 文案', async () => {
    const mem = createMemoryDeps({
      pref: { contentMode: 'alternate', frequency: 'daily' },
    });
    await startMorningPreferenceFlow('tok', 'U1', { deps: mem.deps });
    const text = lastText(mem.replies);
    assert.ok(text.includes('沿用原設定：笑話／新聞交替'));
    assert.ok(text.includes(NEWS_ONLY_SOURCE_DISCLOSURE));
    assert.ok(text.includes('絕不改發'));
  });
});
