/**
 * ANIMAL_FACT 內容選取（Phase 4B-A）
 * 僅 APPROVED；外部來源欄位由 domain source-contract 驗證。
 */

import { prisma } from '@/lib/prisma';
import {
  emptyHumorSourceFields,
  validateSourceContract,
  type MorningSourceFields,
} from '@/lib/line/morning/domain/source-contract';

export type MorningAnimalFactRow = {
  id: string;
  stableId: string;
  status: string;
  title: string;
  factSummary: string;
  barkLine: string | null;
  petTags: string[];
  provider: string;
  itemId: string;
  canonicalUrl: string;
  licenseType: string;
  licenseUrl: string | null;
  attribution: string;
  contentHash: string;
  sourcePublishedAt: Date | null;
  retrievedAt: Date;
  cooldownDays: number;
  lastUsedAt: Date | null;
};

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function mapAnimalFactRow(row: {
  id: string;
  stableId: string;
  status: string;
  title: string;
  factSummary: string;
  barkLine: string | null;
  petTags: string;
  provider: string;
  itemId: string;
  canonicalUrl: string;
  licenseType: string;
  licenseUrl: string | null;
  attribution: string;
  contentHash: string;
  sourcePublishedAt: Date | null;
  retrievedAt: Date;
  cooldownDays: number;
  lastUsedAt: Date | null;
}): MorningAnimalFactRow {
  return {
    id: row.id,
    stableId: row.stableId,
    status: row.status,
    title: row.title,
    factSummary: row.factSummary,
    barkLine: row.barkLine,
    petTags: parseTags(row.petTags),
    provider: row.provider,
    itemId: row.itemId,
    canonicalUrl: row.canonicalUrl,
    licenseType: row.licenseType,
    licenseUrl: row.licenseUrl,
    attribution: row.attribution,
    contentHash: row.contentHash,
    sourcePublishedAt: row.sourcePublishedAt,
    retrievedAt: row.retrievedAt,
    cooldownDays: row.cooldownDays,
    lastUsedAt: row.lastUsedAt,
  };
}

export function animalFactSourceFields(
  row: MorningAnimalFactRow,
): MorningSourceFields {
  return {
    provider: row.provider,
    itemId: row.itemId,
    canonicalUrl: row.canonicalUrl,
    licenseType: row.licenseType,
    licenseUrl: row.licenseUrl,
    attribution: row.attribution,
    contentHash: row.contentHash,
    sourcePublishedAt: row.sourcePublishedAt,
    retrievedAt: row.retrievedAt,
  };
}

export function isAnimalFactSendable(
  row: MorningAnimalFactRow,
  now: Date = new Date(),
): boolean {
  if (row.status !== 'APPROVED') return false;
  const contract = validateSourceContract('ANIMAL_FACT', animalFactSourceFields(row));
  if (!contract.ok) return false;
  if (!row.lastUsedAt) return true;
  const cooldownMs = row.cooldownDays * 24 * 60 * 60 * 1000;
  return now.getTime() - row.lastUsedAt.getTime() >= cooldownMs;
}

/** 選一則可送的 ANIMAL_FACT；無則 null（不硬塞） */
export async function pickApprovedAnimalFact(opts?: {
  now?: Date;
}): Promise<MorningAnimalFactRow | null> {
  const now = opts?.now ?? new Date();
  const rows = await prisma.lineMorningAnimalFact.findMany({
    where: { status: 'APPROVED' },
    orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
  });
  for (const raw of rows) {
    const row = mapAnimalFactRow(raw);
    if (isAnimalFactSendable(row, now)) return row;
  }
  return null;
}

export async function markAnimalFactUsed(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.lineMorningAnimalFact.update({
    where: { id },
    data: { lastUsedAt: now },
  });
}

/** 型別守衛：HUMOR 不得帶外部來源（供測試／呼叫端） */
export function assertHumorHasNoExternalSource(): MorningSourceFields {
  return emptyHumorSourceFields();
}
