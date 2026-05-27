import { prisma } from '@/lib/prisma';

export type LineRewardOption = {
  index: number;
  id: string;
  rewardCode: string;
  rewardName: string;
  pointsRequired: number;
};

export async function listActiveRewardsForLine(): Promise<LineRewardOption[]> {
  const now = new Date();
  const rows = await prisma.rewardCatalog.findMany({
    where: {
      activeStatus: 'active',
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: 'asc' }, { rewardCode: 'asc' }],
    select: {
      id: true,
      rewardCode: true,
      rewardName: true,
      pointsRequired: true,
    },
  });

  return rows.map((row, i) => ({
    index: i + 1,
    id: row.id,
    rewardCode: row.rewardCode,
    rewardName: row.rewardName,
    pointsRequired: row.pointsRequired,
  }));
}

export function formatRewardMenuText(
  rewards: LineRewardOption[],
  balance?: number,
): string {
  if (rewards.length === 0) {
    return '目前沒有可兌換的獎勵，請稍後再試或聯絡客服。';
  }

  const header =
    balance !== undefined
      ? `【可兌換獎勵】目前點數：${balance} 點\n`
      : '【可兌換獎勵】\n';

  const lines = rewards.map((r) => `${r.index}. ${r.rewardName} — ${r.pointsRequired} 罐罐點數`);

  const redeemHint =
    rewards.length === 1
      ? '兌換請傳：兌換 1'
      : `兌換請傳：對照上方編號，例如「兌換 1」「兌換 2」（共 ${rewards.length} 項）`;

  return `${header}${lines.join('\n')}\n\n${redeemHint}`;
}

export async function resolveRewardFromLineInput(
  input: string,
  rewards?: LineRewardOption[],
): Promise<LineRewardOption | null> {
  const list = rewards ?? (await listActiveRewardsForLine());
  const trimmed = input.trim();

  const index = parseInt(trimmed, 10);
  if (/^\d+$/.test(trimmed)) {
    return list.find((r) => r.index === index) ?? null;
  }

  const byCode = list.find(
    (r) => r.rewardCode.toLowerCase() === trimmed.toLowerCase(),
  );
  return byCode ?? null;
}
