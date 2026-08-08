import { prisma } from '@/lib/prisma';
import type { MorningPetTag } from '@/lib/line/morning/constants';

export type MorningContentRow = {
  id: string;
  stableId: string;
  kind: string;
  status: string;
  body: string;
  petTags: string[];
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

export function mapContentRow(row: {
  id: string;
  stableId: string;
  kind: string;
  status: string;
  body: string;
  petTags: string;
  cooldownDays: number;
  lastUsedAt: Date | null;
}): MorningContentRow {
  return {
    id: row.id,
    stableId: row.stableId,
    kind: row.kind,
    status: row.status,
    body: row.body,
    petTags: parseTags(row.petTags),
    cooldownDays: row.cooldownDays,
    lastUsedAt: row.lastUsedAt,
  };
}

export function isContentSendable(
  row: MorningContentRow,
  now: Date = new Date(),
): boolean {
  if (row.status !== 'APPROVED') return false;
  if (!row.lastUsedAt) return true;
  const cooldownMs = row.cooldownDays * 24 * 60 * 60 * 1000;
  return now.getTime() - row.lastUsedAt.getTime() >= cooldownMs;
}

export async function listMorningContents(opts?: {
  status?: string;
  take?: number;
}): Promise<MorningContentRow[]> {
  const rows = await prisma.lineMorningContent.findMany({
    where: opts?.status ? { status: opts.status } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: opts?.take ?? 100,
  });
  return rows.map(mapContentRow);
}

/**
 * 選一則 APPROVED 且通過 cooldown 的笑話。
 * 耗盡 → null（呼叫端 skip，不硬塞重複）。
 */
export async function pickApprovedJoke(opts?: {
  preferredTags?: MorningPetTag[];
  now?: Date;
}): Promise<MorningContentRow | null> {
  const now = opts?.now ?? new Date();
  const rows = await prisma.lineMorningContent.findMany({
    where: { status: 'APPROVED', kind: 'joke' },
    orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
  });
  const mapped = rows.map(mapContentRow).filter((r) => isContentSendable(r, now));
  if (mapped.length === 0) return null;

  const tags = (opts?.preferredTags ?? []).filter(
    (t): t is Exclude<MorningPetTag, 'general'> => t !== 'general',
  );
  if (tags.length) {
    const tagged = mapped.find((r) => r.petTags.some((t) => (tags as string[]).includes(t)));
    if (tagged) return tagged;
  }
  return mapped[0] ?? null;
}

export async function markContentUsed(contentId: string, at: Date = new Date()) {
  await prisma.lineMorningContent.update({
    where: { id: contentId },
    data: { lastUsedAt: at },
  });
}
