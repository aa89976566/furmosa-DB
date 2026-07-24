/** 毛孩罐庫／存罐文案 */

import { GROOMING_COUPON_POINTS } from '@/lib/coupons/constants';

export type JarDepositSnapshot = {
  customerName: string;
  customerCode: string;
  pointsBalance: number;
  jarsDeposited: number;
  pointsEarnedThisTime?: number;
  code?: string;
  /** 最近入帳序號（新→舊），未來可擴成完整清單 */
  recentCodes?: string[];
  petName?: string | null;
};

export function rewardProgress(pointsBalance: number): {
  towardNext: number;
  needMore: number;
  milestone: number;
  progressLine: string;
} {
  const milestone = GROOMING_COUPON_POINTS;
  const towardNext = pointsBalance % milestone;
  const needMore = towardNext === 0 && pointsBalance > 0 ? 0 : milestone - towardNext;
  const progressLine =
    needMore === 0 && pointsBalance > 0
      ? `已滿 ${milestone} 點可換美容折價，去換罐計畫晃一下。`
      : `離下一張美容折價還差 ${needMore} 點（進度 ${towardNext}/${milestone}）`;
  return { towardNext, needMore, milestone, progressLine };
}

/** 依累積罐數給一句話，不灌 CO₂ 假數據 */
export function ecoNoteForJarCount(totalJars: number): string | null {
  if (totalJars <= 0) return null;
  if (totalJars === 1) {
    return '第 1 罐記好了。空罐多走這一步，就不只是垃圾。';
  }
  if (totalJars === 2) {
    return '累積 2 罐。不用偉大，穩定回收就夠。';
  }
  if (totalJars < 5) {
    return `累積 ${totalJars} 罐有空罐回到循環。`;
  }
  if (totalJars < 10) {
    return `${totalJars} 罐了。罐庫很實在。`;
  }
  return `${totalJars} 罐，長期隊友級。`;
}

export function formatJarDepositSuccessMessage(s: JarDepositSnapshot): string {
  const { progressLine } = rewardProgress(s.pointsBalance);
  const lines = [
    '罐進去了 ✨',
    s.code ? `序號 ${s.code} → +${s.pointsEarnedThisTime ?? 0}` : null,
    `罐庫點數：${s.pointsBalance}`,
    `累積已換：${s.jarsDeposited} 罐`,
    progressLine,
    '',
    s.petName ? `${s.petName} 的罐庫更新了` : s.customerName,
  ].filter((line) => line !== null);

  const eco = ecoNoteForJarCount(s.jarsDeposited);
  if (eco) lines.push('', eco);

  return lines.join('\n');
}

export function formatVaultStatusMessage(s: JarDepositSnapshot): string {
  const { towardNext, milestone, progressLine } = rewardProgress(s.pointsBalance);
  const who = s.petName ? `${s.petName} 的罐庫` : '毛孩罐庫';
  const lines = [
    `📒 ${who}`,
    '',
    s.customerName,
    '',
    `目前罐庫點數：${s.pointsBalance}`,
    `累積已換：${s.jarsDeposited} 罐`,
    `距離下一里程：${towardNext}/${milestone}`,
    progressLine,
  ];

  if (s.recentCodes && s.recentCodes.length > 0) {
    lines.push('', '最近入帳序號：');
    for (const code of s.recentCodes.slice(0, 5)) {
      lines.push(`· ${code}`);
    }
  } else if (s.jarsDeposited === 0) {
    lines.push('', '還沒存過罐。罐底 8 碼直接傳上來。');
  }

  const eco = ecoNoteForJarCount(s.jarsDeposited);
  if (eco) lines.push('', eco);

  return lines.join('\n');
}

/** @deprecated 使用 formatVaultStatusMessage */
export function formatSavingsStatusMessage(
  s: JarDepositSnapshot,
  opts?: { showJarHint?: boolean },
): string {
  if (opts?.showJarHint === false && s.jarsDeposited === 0) {
    const { progressLine } = rewardProgress(s.pointsBalance);
    return [
      '📒 毛孩罐庫',
      '',
      s.customerName,
      '',
      `目前罐庫點數：${s.pointsBalance}`,
      `累積已換：${s.jarsDeposited} 罐`,
      progressLine,
    ].join('\n');
  }
  return formatVaultStatusMessage(s);
}

export function formatQuickBalanceMessage(s: JarDepositSnapshot): string {
  const { progressLine } = rewardProgress(s.pointsBalance);
  return `${s.customerName}\n罐庫 ${s.pointsBalance} 點 · 已換 ${s.jarsDeposited} 罐\n${progressLine}`;
}
