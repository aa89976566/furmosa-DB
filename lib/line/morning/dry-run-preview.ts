/**
 * HQ Preview：單筆 dry-run（測試會員標記；不批次擴張正式會員 consent）
 */

import { createHash } from 'node:crypto';
import {
  ANIMAL_FACT_DISCLOSURE,
} from '@/lib/line/morning/domain/types';
import { toDomainContentMode } from '@/lib/line/morning/domain/consent';
import {
  planOneRecipient,
  type MorningPlanResult,
  type MorningRecipient,
} from '@/lib/line/morning/runner';
import {
  assertMorningSenderUnused,
  getMorningOutboundSender,
} from '@/lib/line/morning/sender-gate';
import { morningTaipeiDate } from '@/lib/line/morning/schedule';
import type { MorningContentMode, MorningFrequency } from '@/lib/line/morning/constants';
import { prisma } from '@/lib/prisma';

export function isMorningPreviewTestMember(lineUserId: string): boolean {
  return /^U_TEST_/i.test(lineUserId.trim());
}

export type MorningDryRunPreviewInput = {
  lineUserId: string;
  contentMode: MorningContentMode;
  frequency?: MorningFrequency;
  /** Asia/Taipei YYYY-MM-DD；用中午 UTC+8 對應 */
  taipeiDate: string;
  /** 必須勾選：確認為 Preview 測試用途 */
  confirmTestPreview: boolean;
};

export type MorningDryRunPreviewResult = {
  testMember: boolean;
  preferenceWritten: boolean;
  domainMode: string;
  plan: MorningPlanResult;
  selectedContentType: string | null;
  skipReason: string | null;
  disclosurePresent: boolean | null;
  sourceSummary: string | null;
  rendererPreview: string | null;
  idempotency: {
    alreadyDelivered: boolean;
    deliveryId: string | null;
    created: boolean | null;
  };
  senderCallCount: number;
  notes: string[];
};

function taipeiDateToNow(taipeiDate: string): Date {
  // 固定落在當日 08:10 Asia/Taipei，便於通過 window（plan 可 enforceWindow=false）
  return new Date(`${taipeiDate}T00:10:00+08:00`);
}

export async function runMorningDryRunPreview(
  input: MorningDryRunPreviewInput,
): Promise<MorningDryRunPreviewResult> {
  const notes: string[] = [];
  const lineUserId = input.lineUserId.trim();
  if (!lineUserId) throw new Error('請填 LINE user id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.taipeiDate)) {
    throw new Error('Taipei date 格式須為 YYYY-MM-DD');
  }
  if (!input.confirmTestPreview) {
    throw new Error('請確認此操作僅供 Preview 測試（禁止替正式會員批次擴張 consent）');
  }

  const testMember = isMorningPreviewTestMember(lineUserId);
  if (!testMember) {
    notes.push(
      '此 LINE ID 未帶 U_TEST_ 前綴：僅做記憶體覆寫 dry-run，不會寫入 preference（避免擴張正式會員 consent）。',
    );
  }

  const domainMode = toDomainContentMode(input.contentMode);
  const frequency = input.frequency ?? 'daily';
  let preferenceWritten = false;

  if (testMember) {
    await prisma.lineMorningPreference.upsert({
      where: { lineUserId },
      create: {
        lineUserId,
        contentMode: input.contentMode,
        frequency,
        pausedAt: null,
        promptedAt: new Date(),
      },
      update: {
        contentMode: input.contentMode,
        frequency,
        pausedAt: null,
      },
    });
    preferenceWritten = true;
    notes.push('已標記為 Preview 測試會員（U_TEST_*）：允許寫入 preference。');
  }

  const preference = {
    id: 'preview',
    lineUserId,
    customerId: null,
    contentMode: input.contentMode,
    frequency,
    pausedAt: null,
    promptedAt: null,
  };

  const recipient: MorningRecipient = {
    lineUserId,
    customerName: testMember ? '【測試】Preview' : null,
    petSpecies: null,
    preference,
  };

  const sender = getMorningOutboundSender({ forceDryRun: true });
  sender.resetCallCount();

  const now = taipeiDateToNow(input.taipeiDate);
  const plan = await planOneRecipient({
    recipient,
    now,
    enforceWindow: false,
    enforceSlot: false,
    markUsed: false,
  });

  assertMorningSenderUnused(sender);

  const rendererPreview = plan.renderedText ?? null;
  let disclosurePresent: boolean | null = null;
  if (plan.contentKind === 'animal_fact' && rendererPreview) {
    disclosurePresent = rendererPreview.includes(ANIMAL_FACT_DISCLOSURE);
  } else if (plan.contentKind) {
    disclosurePresent = false;
  }

  let sourceSummary: string | null = null;
  if (plan.newsFingerprint) {
    sourceSummary = `news contentHash=${plan.newsFingerprint.slice(0, 12)}…`;
  } else if (plan.animalFactId) {
    sourceSummary = `animalFactId=${plan.animalFactId}`;
  } else if (plan.contentId) {
    sourceSummary = `humor contentId=${plan.contentId}`;
  }

  return {
    testMember,
    preferenceWritten,
    domainMode,
    plan,
    selectedContentType: plan.contentKind ?? null,
    skipReason: plan.skipReason ?? null,
    disclosurePresent,
    sourceSummary,
    rendererPreview,
    idempotency: {
      alreadyDelivered: plan.outcome === 'ALREADY',
      deliveryId: plan.deliveryId ?? null,
      created: plan.created ?? null,
    },
    senderCallCount: sender.getCallCount(),
    notes,
  };
}

/** 穩定測試用 fingerprint（非秘密） */
export function previewProbeToken(lineUserId: string, taipeiDate: string): string {
  return createHash('sha256')
    .update(`${lineUserId}|${taipeiDate}|morning-preview`)
    .digest('hex')
    .slice(0, 12);
}

export function defaultPreviewTaipeiDate(now = new Date()): string {
  return morningTaipeiDate(now);
}
