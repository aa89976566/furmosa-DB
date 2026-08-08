/**
 * LineMorningPreferenceConfirmLedger repository
 * - 跨 instance 冪等；禁止 in-memory
 * - dedup 查詢禁止用 expiresAt／now 過濾
 * - 只存 sessionNonceHash，不存 raw nonce／replyToken／訊息正文
 */

import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type LedgerDb =
  | Pick<Prisma.TransactionClient, 'lineMorningPreferenceConfirmLedger'>
  | typeof prisma;

export const CONFIRM_LEDGER_STATUS_SUCCESS = 'SUCCESS' as const;

/** ledger 列保留參考期限（不參與 dedup 過濾；本 PR 不清理） */
export const CONFIRM_LEDGER_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export type ConfirmLedgerPreferenceSnapshot = {
  contentMode: string;
  frequency: string;
};

export type ConfirmLedgerRow = {
  id: string;
  lineUserId: string;
  eventDedupKey: string;
  sessionNonceHash: string;
  stepVersion: number;
  payloadDigest: string;
  preferenceSnapshot: ConfirmLedgerPreferenceSnapshot;
  successSummary: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
};

export function hashOptinSessionNonce(rawNonce: string): string {
  return createHash('sha256').update(rawNonce, 'utf8').digest('hex');
}

function mapRow(row: {
  id: string;
  lineUserId: string;
  eventDedupKey: string;
  sessionNonceHash: string;
  stepVersion: number;
  payloadDigest: string;
  preferenceSnapshot: string;
  successSummary: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}): ConfirmLedgerRow {
  let preferenceSnapshot: ConfirmLedgerPreferenceSnapshot = {
    contentMode: '',
    frequency: '',
  };
  try {
    const parsed = JSON.parse(row.preferenceSnapshot) as ConfirmLedgerPreferenceSnapshot;
    if (
      typeof parsed?.contentMode === 'string' &&
      typeof parsed?.frequency === 'string'
    ) {
      preferenceSnapshot = {
        contentMode: parsed.contentMode,
        frequency: parsed.frequency,
      };
    }
  } catch {
    // keep empty; caller treats mismatch as reject
  }
  return {
    id: row.id,
    lineUserId: row.lineUserId,
    eventDedupKey: row.eventDedupKey,
    sessionNonceHash: row.sessionNonceHash,
    stepVersion: row.stepVersion,
    payloadDigest: row.payloadDigest,
    preferenceSnapshot,
    successSummary: row.successSummary,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

/** 依 eventDedupKey 查詢 — 不用 expiresAt／now */
export async function findConfirmLedgerByEventKey(
  eventDedupKey: string,
  db: LedgerDb = prisma,
): Promise<ConfirmLedgerRow | null> {
  const row = await db.lineMorningPreferenceConfirmLedger.findUnique({
    where: { eventDedupKey },
  });
  return row ? mapRow(row) : null;
}

/** 依 nonce hash 查是否已消費 — 不用 expiresAt／now */
export async function findConfirmLedgersByNonceHash(
  sessionNonceHash: string,
  db: LedgerDb = prisma,
): Promise<ConfirmLedgerRow[]> {
  const rows = await db.lineMorningPreferenceConfirmLedger.findMany({
    where: { sessionNonceHash },
  });
  return rows.map(mapRow);
}

export type CreateConfirmLedgerInput = {
  lineUserId: string;
  eventDedupKey: string;
  sessionNonceHash: string;
  stepVersion: number;
  payloadDigest: string;
  preferenceSnapshot: ConfirmLedgerPreferenceSnapshot;
  successSummary: string;
  now?: Date;
  retentionMs?: number;
};

/**
 * 建立 SUCCESS ledger（應於與 preference upsert 同一 transaction 呼叫）
 * 呼叫端傳入 tx client 時走 interactive transaction。
 */
export async function createConfirmLedgerSuccess(
  input: CreateConfirmLedgerInput,
  db: LedgerDb = prisma,
): Promise<ConfirmLedgerRow> {
  const now = input.now ?? new Date();
  const retention = input.retentionMs ?? CONFIRM_LEDGER_RETENTION_MS;
  const row = await db.lineMorningPreferenceConfirmLedger.create({
    data: {
      lineUserId: input.lineUserId,
      eventDedupKey: input.eventDedupKey,
      sessionNonceHash: input.sessionNonceHash,
      stepVersion: input.stepVersion,
      payloadDigest: input.payloadDigest,
      preferenceSnapshot: JSON.stringify(input.preferenceSnapshot),
      successSummary: input.successSummary,
      status: CONFIRM_LEDGER_STATUS_SUCCESS,
      expiresAt: new Date(now.getTime() + retention),
    },
  });
  return mapRow(row);
}

/** 成功 ledger 是否與本次 confirm 完全一致（可重播） */
export function isIdenticalConfirmSuccess(input: {
  row: ConfirmLedgerRow;
  eventDedupKey: string;
  sessionNonceHash: string;
  stepVersion: number;
  payloadDigest: string;
}): boolean {
  const { row } = input;
  return (
    row.status === CONFIRM_LEDGER_STATUS_SUCCESS &&
    row.eventDedupKey === input.eventDedupKey &&
    row.sessionNonceHash === input.sessionNonceHash &&
    row.stepVersion === input.stepVersion &&
    row.payloadDigest === input.payloadDigest
  );
}
