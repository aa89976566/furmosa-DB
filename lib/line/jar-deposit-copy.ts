/** 毛孩罐庫／換罐紀錄文案 */

import {
  GROOMING_COUPON_POINTS,
  getGroomingCouponDiscountForStore,
} from '@/lib/coupons/constants';

export type JarDepositSnapshot = {
  customerName: string;
  customerCode: string;
  pointsBalance: number;
  jarsDeposited: number;
  pointsEarnedThisTime?: number;
  code?: string;
  recentCodes?: string[];
  petName?: string | null;
  /** 可兌換：點數是否夠換美容折價 */
  canRedeemGrooming?: boolean;
  availableCouponCount?: number;
  /** 綁定門市（系統偵測折價面額用） */
  storeId?: string | null;
  storeName?: string | null;
};

function storeDiscountLine(s: Pick<JarDepositSnapshot, 'storeId' | 'storeName'>): string | null {
  const storeId = s.storeId?.trim();
  if (!storeId) return null;
  const amount = getGroomingCouponDiscountForStore(storeId, s.storeName);
  const store = s.storeName?.trim() || '你綁定的合作門市';
  return `「${store}」可折 ${amount} 元`;
}

export function rewardProgress(
  pointsBalance: number,
  store?: Pick<JarDepositSnapshot, 'storeId' | 'storeName'>,
): {
  towardNext: number;
  needMore: number;
  milestone: number;
  progressLine: string;
} {
  const milestone = GROOMING_COUPON_POINTS;
  const towardNext = pointsBalance % milestone;
  const needMore = towardNext === 0 && pointsBalance > 0 ? 0 : milestone - towardNext;
  const discount = store ? storeDiscountLine(store) : null;
  const progressLine =
    needMore === 0 && pointsBalance > 0
      ? discount
        ? `已滿 ${milestone} 點，可換美容折價——${discount}。`
        : `已滿 ${milestone} 點，可換美容折價。`
      : discount
        ? `離下一張美容折價還差 ${needMore} 點（${towardNext}/${milestone}）· ${discount}`
        : `離下一張美容折價還差 ${needMore} 點（${towardNext}/${milestone}）`;
  return { towardNext, needMore, milestone, progressLine };
}

export function ecoNoteForJarCount(totalJars: number): string | null {
  if (totalJars <= 0) return null;
  if (totalJars === 1) return '第 1 罐記好了。空罐多走這一步，就不只是垃圾。';
  if (totalJars === 2) return '累積 2 罐。不用偉大，穩定回收就夠。';
  if (totalJars < 5) return `累積 ${totalJars} 罐有空罐回到循環。`;
  if (totalJars < 10) return `${totalJars} 罐了。罐庫很實在。`;
  return `${totalJars} 罐，長期隊友級。`;
}

export function formatJarDepositSuccessMessage(s: JarDepositSnapshot): string {
  const { progressLine } = rewardProgress(s.pointsBalance, s);
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

/** 毛孩罐庫：目前點數／累積／可兌換／進度（不含完整歷史清單） */
export function formatVaultStatusMessage(s: JarDepositSnapshot): string {
  const { towardNext, milestone, progressLine, needMore } = rewardProgress(s.pointsBalance, s);
  const who = s.petName ? `${s.petName} 的罐庫` : '毛孩罐庫';
  const discount = storeDiscountLine(s);
  const redeemable =
    s.canRedeemGrooming || (needMore === 0 && s.pointsBalance > 0)
      ? discount
        ? `可兌換：美容折價（滿 10 點）· ${discount}`
        : '可兌換：美容折價（滿 10 點）'
      : `可兌換：還差 ${needMore} 點`;
  const couponLine =
    typeof s.availableCouponCount === 'number'
      ? `手上折價券：${s.availableCouponCount} 張`
      : null;

  const lines = [
    `📒 ${who}`,
    '',
    s.customerName,
    '',
    `目前點數：${s.pointsBalance}`,
    `目前累積：${s.jarsDeposited} 罐`,
    redeemable,
    couponLine,
    `距離下一里程：${towardNext}/${milestone}`,
    progressLine,
  ].filter((x): x is string => Boolean(x));

  if (s.jarsDeposited === 0) {
    lines.push('', '還沒存過罐。罐底 8 碼直接傳上來。');
  } else {
    lines.push('', '要看已輸入序號 →「換罐紀錄」');
  }

  const eco = ecoNoteForJarCount(s.jarsDeposited);
  if (eco) lines.push('', eco);
  return lines.join('\n');
}

/** 換罐紀錄：歷史＋已輸入序號 */
export function formatHistoryStatusMessage(s: JarDepositSnapshot): string {
  const who = s.petName ? `${s.petName} 的換罐紀錄` : '換罐紀錄';
  const lines = [
    `🧾 ${who}`,
    '',
    `累積已換：${s.jarsDeposited} 罐`,
    `目前點數：${s.pointsBalance}`,
    '',
  ];

  if (s.recentCodes && s.recentCodes.length > 0) {
    lines.push('已輸入序號（最近）：');
    for (const code of s.recentCodes) {
      lines.push(`· ${code}`);
    }
    if (s.jarsDeposited > s.recentCodes.length) {
      lines.push('', `（還有更早的，共 ${s.jarsDeposited} 筆）`);
    }
  } else {
    lines.push('還沒有入帳序號。');
    lines.push('罐底 8 碼傳上來就會出現在這。');
  }

  return lines.join('\n');
}

/** @deprecated */
export function formatSavingsStatusMessage(
  s: JarDepositSnapshot,
  opts?: { showJarHint?: boolean },
): string {
  if (opts?.showJarHint === false && s.jarsDeposited === 0) {
    const { progressLine } = rewardProgress(s.pointsBalance, s);
    return [
      '📒 毛孩罐庫',
      '',
      s.customerName,
      '',
      `目前點數：${s.pointsBalance}`,
      `目前累積：${s.jarsDeposited} 罐`,
      progressLine,
    ].join('\n');
  }
  return formatVaultStatusMessage(s);
}

export function formatQuickBalanceMessage(s: JarDepositSnapshot): string {
  const { progressLine } = rewardProgress(s.pointsBalance, s);
  return `${s.customerName}\n罐庫 ${s.pointsBalance} 點 · 已換 ${s.jarsDeposited} 罐\n${progressLine}`;
}
