import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  birthdayIsoToUtcNoon,
  chineseNumeralToInt,
  isValidCalendarDate,
  parseRegisterBirthday,
  taipeiTodayIso,
} from '../register-birthday';

const NOW = new Date('2026-08-08T04:00:00.000Z'); // Taipei 2026-08-08

describe('chineseNumeralToInt', () => {
  it('逐字與十百結構', () => {
    assert.equal(chineseNumeralToInt('二〇二五'), 2025);
    assert.equal(chineseNumeralToInt('十一'), 11);
    assert.equal(chineseNumeralToInt('二十'), 20);
    assert.equal(chineseNumeralToInt('一百一十四'), 114);
    assert.equal(chineseNumeralToInt('十'), 10);
  });
});

describe('parseRegisterBirthday 接受格式', () => {
  const cases: Array<[string, string]> = [
    ['2025-11-01', '2025-11-01'],
    ['2025-11-1', '2025-11-01'],
    ['2025/11/01', '2025-11-01'],
    ['2025/11/1', '2025-11-01'],
    ['2025年11月1日', '2025-11-01'],
    ['2025年11月1號', '2025-11-01'],
    ['民國114年11月1日', '2025-11-01'],
    ['114年11月1日', '2025-11-01'],
    ['114/11/1', '2025-11-01'],
    ['二〇二五年十一月一日', '2025-11-01'],
    ['民國一百一十四年十一月一日', '2025-11-01'],
    [' 2025 / 11 / 1 ', '2025-11-01'],
    ['2024/02/29', '2024-02-29'],
  ];

  for (const [input, iso] of cases) {
    it(`接受「${input}」→ ${iso}`, () => {
      const r = parseRegisterBirthday(input, NOW);
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.iso, iso);
        assert.equal(r.skipped, false);
      }
    });
  }
});

describe('parseRegisterBirthday 拒絕', () => {
  it('不存在日期', () => {
    for (const input of ['2025/02/29', '2025/13/01', '2025/04/31']) {
      const r = parseRegisterBirthday(input, NOW);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, 'invalid_calendar');
    }
  });

  it('未來日期', () => {
    const r = parseRegisterBirthday('2027-01-01', NOW);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'future');
  });

  it('缺年／模糊／歧義', () => {
    for (const input of [
      '十一月一日',
      '11月1日',
      '11/1',
      '去年十一月一日',
      '下個月',
      '20251101',
    ]) {
      const r = parseRegisterBirthday(input, NOW);
      assert.equal(r.ok, false, input);
    }
  });

  it('略過同義詞', () => {
    for (const input of ['略過', '跳过', 'skip', '不填', '沒有', '不知道']) {
      const r = parseRegisterBirthday(input, NOW);
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.skipped, true);
        assert.equal(r.iso, null);
      }
    }
    const notSkip = parseRegisterBirthday('先略過一下好了', NOW);
    assert.equal(notSkip.ok, false);
  });
});

describe('calendar helpers', () => {
  it('閏年與 iso 正午', () => {
    assert.equal(isValidCalendarDate(2024, 2, 29), true);
    assert.equal(isValidCalendarDate(2025, 2, 29), false);
    assert.equal(taipeiTodayIso(NOW), '2026-08-08');
    const d = birthdayIsoToUtcNoon('2020-05-06');
    assert.ok(d);
    assert.equal(d!.toISOString(), '2020-05-06T12:00:00.000Z');
  });
});
