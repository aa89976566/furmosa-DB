/** 方案 B：罐罐存款 — 累積換罐與務實環保文案（不假掰） */

export type JarDepositSnapshot = {
  customerName: string;
  customerCode: string;
  pointsBalance: number;
  jarsDeposited: number;
  pointsEarnedThisTime?: number;
  code?: string;
};

/** 依累積罐數給一句話，不灌 CO₂ 假數據 */
export function ecoNoteForJarCount(totalJars: number): string | null {
  if (totalJars <= 0) return null;
  if (totalJars === 1) {
    return '第 1 罐記錄完成了。空罐多走這一步，就不只是垃圾。';
  }
  if (totalJars === 2) {
    return '累積 2 罐。不用做很偉大，穩定回收就夠了。';
  }
  if (totalJars < 5) {
    return `累積 ${totalJars} 罐有空罐回到循環，比直接丟掉多一點意義。`;
  }
  if (totalJars < 10) {
    return `${totalJars} 罐了。小金庫很實在，環境也多謝您。`;
  }
  return `${totalJars} 罐，長期隊友級。匠寵會好好用這些空罐，不浪費。`;
}

export function formatJarDepositSuccessMessage(s: JarDepositSnapshot): string {
  const lines = [
    '✅ 存罐成功！',
    s.code ? `序號 ${s.code} → +${s.pointsEarnedThisTime ?? 0} 罐罐點數` : null,
    `毛孩小金庫：${s.pointsBalance} 點`,
    `累積已換：${s.jarsDeposited} 罐`,
    '',
    s.customerName,
  ].filter((line) => line !== null);

  const eco = ecoNoteForJarCount(s.jarsDeposited);
  if (eco) lines.push('', eco);

  lines.push('', '傳「小金庫」看完整記錄 · 傳「獎勵」看能換什麼');
  return lines.join('\n');
}

export function formatSavingsStatusMessage(s: JarDepositSnapshot): string {
  const lines = [
    '🏦 毛孩小金庫',
    '',
    s.customerName,
    `(${s.customerCode})`,
    '',
    `罐罐點數：${s.pointsBalance} 點`,
    `累積已換：${s.jarsDeposited} 罐`,
  ];

  const eco = ecoNoteForJarCount(s.jarsDeposited);
  if (eco) {
    lines.push('', eco);
  } else if (s.jarsDeposited === 0) {
    lines.push('', '還沒存過罐。傳 8 位序號就能開始記帳 🐾');
  }

  lines.push('', '傳「獎勵」看兌換項目');
  return lines.join('\n');
}

export function formatQuickBalanceMessage(s: JarDepositSnapshot): string {
  return `${s.customerName}（${s.customerCode}）\n罐罐點數：${s.pointsBalance} 點 · 已換 ${s.jarsDeposited} 罐\n\n傳「小金庫」看完整記錄`;
}
