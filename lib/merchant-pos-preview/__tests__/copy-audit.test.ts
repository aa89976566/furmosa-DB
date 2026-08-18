import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import * as copy from '../copy';
import { SALES, SETTLEMENTS } from '../fixtures';

const FORBIDDEN_VISIBLE = [
  /fixture-only/i,
  /server snapshot/i,
  /伺服器快照/,
  /不重算/,
  /\bHQ\b/,
  /\bledger\b/i,
  /\bsigned\b/i,
];

const REQUIRED = [
  '示意資料',
  '可銷售庫存',
  '補貨單草稿',
  '全部加入補貨單',
  '送出補貨申請（預覽）',
  '門市收款',
  'LINE／綠界線上收款',
  '提出退款申請',
  '總部審核',
  '退款完成',
  '本期結算',
  '下期調整',
  '門市應匯總部',
  '總部應付門市',
  '已鎖定，不可重新開啟',
  '金額以總部結算結果為準',
];

function visibleCopyValues(): string[] {
  const values = Object.values(copy).flatMap((value) => {
    if (typeof value === 'string') return [value];
    if (value && typeof value === 'object') return Object.values(value).filter((item) => typeof item === 'string');
    return [];
  });
  for (const sale of SALES) {
    values.push(sale.channelLabel, sale.statusLabel);
    if (sale.refund) {
      values.push(
        sale.refund.statusLabel,
        sale.refund.note,
        sale.refund.inventoryNote,
        sale.refund.commissionNote,
      );
      if (sale.refund.nextPeriodNote) values.push(sale.refund.nextPeriodNote);
    }
  }
  for (const settlement of SETTLEMENTS) {
    values.push(settlement.statusLabel, settlement.netDirectionLabel, settlement.periodLabel);
    if (settlement.lockNote) values.push(settlement.lockNote);
    for (const row of settlement.ledger) {
      values.push(row.label, row.source, row.note, row.periodRouteLabel, row.payer, row.payee);
    }
  }
  return values.filter((value): value is string => typeof value === 'string');
}

describe('merchant POS preview visible copy audit', () => {
  it('keeps customer-facing copy free of engineering words', () => {
    const joined = visibleCopyValues().join('\n');
    for (const pattern of FORBIDDEN_VISIBLE) {
      assert.equal(pattern.test(joined), false, String(pattern));
    }
  });

  it('keeps the required Taiwan store phrases', () => {
    const joined = visibleCopyValues().join('\n');
    for (const phrase of REQUIRED) {
      assert.equal(joined.includes(phrase), true, phrase);
    }
  });

  it('does not leave engineering words in preview UI source strings', () => {
    const roots = [
      path.join(process.cwd(), 'components/merchant-pos-preview'),
      path.join(process.cwd(), 'lib/merchant-pos-preview'),
    ];
    const files = roots.flatMap((root) =>
      readdirSync(root)
        .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes('.test.'))
        .map((name) => path.join(root, name)),
    );
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const visibleStrings = src.match(/['"`][^'"`]*(?:fixture-only|伺服器快照|不重算|server snapshot)[^'"`]*['"`]/gi) ?? [];
      assert.equal(visibleStrings.length, 0, `${file} ${visibleStrings.join(',')}`);
      assert.equal(/['"`]HQ['"`]/.test(src), false, file);
    }
  });
});
