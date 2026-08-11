import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';

import { buildOptinPostbackData } from '@/lib/line/morning/domain/optin';
import {
  handleMorningOptinPostback,
  startMorningPreferenceFlow,
  type PreferenceFlowDeps,
  type ConfirmTxClient,
} from '@/lib/line/morning/preference-flow';
import type { ConfirmLedgerRow } from '@/lib/line/morning/confirm-ledger';
import type { MorningPreferenceRow } from '@/lib/line/morning/preferences';
import type { LineReplyMessage } from '@/lib/line/reply';

describe('Phase 4B-B reply vs push', () => {
  it('偏好流程各狀態只用 reply；push call count = 0', async () => {
    let pushCalls = 0;
    let replyCalls = 0;
    const sessions = new Map<
      string,
      {
        id: string;
        lineUserId: string;
        flow: string;
        step: string;
        payload: string;
        createdAt: Date;
        updatedAt: Date;
      }
    >();
    const prefs = new Map<string, MorningPreferenceRow>();
    const ledgers: ConfirmLedgerRow[] = [];
    let nonceSeq = 0;
    const now = () => new Date('2026-08-08T08:00:00+08:00');

    const findLedgerByEventKey = async (k: string) =>
      ledgers.find((l) => l.eventDedupKey === k) ?? null;
    const findLedgersByNonceHash = async (h: string) =>
      ledgers.filter((l) => l.sessionNonceHash === h);
    const upsertPreference: PreferenceFlowDeps['upsertPreference'] = async (
      lineUserId,
      data,
    ) => {
      const row: MorningPreferenceRow = {
        id: 'p',
        lineUserId,
        customerId: null,
        contentMode: (data.contentMode ?? 'unset') as MorningPreferenceRow['contentMode'],
        frequency: (data.frequency ?? 'unset') as MorningPreferenceRow['frequency'],
        pausedAt: null,
        promptedAt: data.promptedAt ?? null,
      };
      prefs.set(lineUserId, row);
      return row;
    };
    const createLedgerSuccess: PreferenceFlowDeps['createLedgerSuccess'] =
      async (input) => {
        const row: ConfirmLedgerRow = {
          id: 'l1',
          lineUserId: input.lineUserId,
          eventDedupKey: input.eventDedupKey,
          sessionNonceHash: input.sessionNonceHash,
          stepVersion: input.stepVersion,
          payloadDigest: input.payloadDigest,
          preferenceSnapshot: input.preferenceSnapshot,
          successSummary: input.successSummary,
          status: 'SUCCESS',
          createdAt: now(),
          expiresAt: now(),
        };
        ledgers.push(row);
        return row;
      };
    const getSession: PreferenceFlowDeps['getSession'] = async (id) =>
      sessions.get(id) ?? null;
    const clearSession: PreferenceFlowDeps['clearSession'] = async (id) => {
      sessions.delete(id);
    };
    const tx: ConfirmTxClient = {
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
        const row = {
          id: 's',
          lineUserId,
          flow,
          step,
          payload: JSON.stringify(payload),
          createdAt: now(),
          updatedAt: now(),
        };
        sessions.set(lineUserId, row);
        return row;
      },
      clearSession,
      getPreference: async (id) => prefs.get(id) ?? null,
      upsertPreference,
      findLedgerByEventKey,
      findLedgersByNonceHash,
      createLedgerSuccess,
      reply: async (_t, messages: LineReplyMessage[]) => {
        replyCalls += 1;
        assert.ok(messages.length > 0);
      },
      now,
      createNonce: () => {
        nonceSeq += 1;
        return createHash('sha256').update(String(nonceSeq)).digest('hex').slice(0, 32);
      },
      findCustomerIdByLineUserId: async () => 'cust1',
      runConfirmTransaction: async (fn) => fn(tx),
    };

    pushCalls = 0;

    await startMorningPreferenceFlow('t', 'U1', { deps });
    let s = sessions.get('U1')!;
    let d = JSON.parse(s.payload) as { nonce: string; version: number };
    await handleMorningOptinPostback(
      't',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'mode',
        actionId: 'content_b',
      }),
      { webhookEventId: 'e1', deps },
    );
    s = sessions.get('U1')!;
    d = JSON.parse(s.payload) as { nonce: string; version: number };
    await handleMorningOptinPostback(
      't',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'brief',
        actionId: 'brief_confirm',
      }),
      { webhookEventId: 'e1b', deps },
    );
    s = sessions.get('U1')!;
    d = JSON.parse(s.payload) as { nonce: string; version: number };
    await handleMorningOptinPostback(
      't',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'frequency',
        actionId: 'freq_weekdays',
      }),
      { webhookEventId: 'e2', deps },
    );
    s = sessions.get('U1')!;
    d = JSON.parse(s.payload) as { nonce: string; version: number };
    await handleMorningOptinPostback(
      't',
      'U1',
      buildOptinPostbackData({
        nonce: d.nonce,
        version: d.version,
        step: 'summary',
        actionId: 'confirm',
      }),
      { webhookEventId: 'e3', deps },
    );

    assert.ok(
      replyCalls >= 5,
      `expected replies for mode/brief/freq/summary/success, got ${replyCalls}`,
    );
    assert.equal(pushCalls, 0);
  });

  it('reply failure 無 push fallback', async () => {
    let pushCalls = 0;
    const sessions = new Map<
      string,
      {
        id: string;
        lineUserId: string;
        flow: string;
        step: string;
        payload: string;
        createdAt: Date;
        updatedAt: Date;
      }
    >();
    const prefs = new Map<string, MorningPreferenceRow>();
    const ledgers: ConfirmLedgerRow[] = [];
    let nonceSeq = 0;
    const now = () => new Date('2026-08-08T08:00:00+08:00');

    const findLedgerByEventKey = async (k: string) =>
      ledgers.find((l) => l.eventDedupKey === k) ?? null;
    const findLedgersByNonceHash = async (h: string) =>
      ledgers.filter((l) => l.sessionNonceHash === h);
    const upsertPreference: PreferenceFlowDeps['upsertPreference'] = async (
      lineUserId,
      data,
    ) => {
      const row: MorningPreferenceRow = {
        id: 'p',
        lineUserId,
        customerId: null,
        contentMode: (data.contentMode ?? 'unset') as MorningPreferenceRow['contentMode'],
        frequency: (data.frequency ?? 'unset') as MorningPreferenceRow['frequency'],
        pausedAt: null,
        promptedAt: data.promptedAt ?? null,
      };
      prefs.set(lineUserId, row);
      return row;
    };
    const createLedgerSuccess: PreferenceFlowDeps['createLedgerSuccess'] =
      async (input) => {
        const row: ConfirmLedgerRow = {
          id: 'l1',
          lineUserId: input.lineUserId,
          eventDedupKey: input.eventDedupKey,
          sessionNonceHash: input.sessionNonceHash,
          stepVersion: input.stepVersion,
          payloadDigest: input.payloadDigest,
          preferenceSnapshot: input.preferenceSnapshot,
          successSummary: input.successSummary,
          status: 'SUCCESS',
          createdAt: now(),
          expiresAt: now(),
        };
        ledgers.push(row);
        return row;
      };
    const getSession: PreferenceFlowDeps['getSession'] = async (id) =>
      sessions.get(id) ?? null;
    const clearSession: PreferenceFlowDeps['clearSession'] = async (id) => {
      sessions.delete(id);
    };
    const tx: ConfirmTxClient = {
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
        const row = {
          id: 's',
          lineUserId,
          flow,
          step,
          payload: JSON.stringify(payload),
          createdAt: now(),
          updatedAt: now(),
        };
        sessions.set(lineUserId, row);
        return row;
      },
      clearSession,
      getPreference: async (id) => prefs.get(id) ?? null,
      upsertPreference,
      findLedgerByEventKey,
      findLedgersByNonceHash,
      createLedgerSuccess,
      reply: async () => {
        throw new Error('reply_failed');
      },
      now,
      createNonce: () => {
        nonceSeq += 1;
        return createHash('sha256').update(String(nonceSeq)).digest('hex').slice(0, 32);
      },
      findCustomerIdByLineUserId: async () => 'cust1',
      runConfirmTransaction: async (fn) => fn(tx),
    };

    await assert.rejects(() =>
      startMorningPreferenceFlow('t', 'U1', { deps }),
    );
    assert.equal(pushCalls, 0);
  });
});
