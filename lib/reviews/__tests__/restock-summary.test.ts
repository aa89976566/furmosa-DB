import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { restockReviewSummary } from '@/lib/reviews/inbox';

const pageSource = readFileSync(
  new URL('../../../app/(main)/reviews/page.tsx', import.meta.url),
  'utf8',
);
const inboxSource = readFileSync(new URL('../inbox.ts', import.meta.url), 'utf8');

const mobileSection = pageSource.slice(
  pageSource.indexOf('space-y-3 md:hidden'),
  pageSource.indexOf('hidden overflow-x-auto'),
);
const desktopSection = pageSource.slice(pageSource.indexOf('hidden overflow-x-auto'));

const BUBBLE_ITEMS = [
  { name: '原味雞霸', quantity: 4 },
  { name: '豬耳朵條', quantity: 3 },
  { name: '雞肉南瓜乾', quantity: 3 },
  { name: '鴨喉嚨', quantity: 4 },
] as const;

describe('restockReviewSummary', () => {
  it('泡泡堂 4 品項：title「原味雞霸 等 4 項」，四行完整且無 moreLabel', () => {
    const result = restockReviewSummary({
      itemCount: 4,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [...BUBBLE_ITEMS],
    });
    assert.equal(result.title, '原味雞霸 等 4 項');
    assert.deepEqual(result.lines, [
      '原味雞霸 × 4',
      '豬耳朵條 × 3',
      '雞肉南瓜乾 × 3',
      '鴨喉嚨 × 4',
    ]);
    assert.equal(result.moreLabel, undefined);
  });

  it('itemCount=4、items 只有 3 筆：仍顯示「等 4 項」與「…另 1 項」', () => {
    const result = restockReviewSummary({
      itemCount: 4,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: BUBBLE_ITEMS.slice(0, 3),
    });
    assert.equal(result.title, '原味雞霸 等 4 項');
    assert.deepEqual(result.lines, [
      '原味雞霸 × 4',
      '豬耳朵條 × 3',
      '雞肉南瓜乾 × 3',
    ]);
    assert.equal(result.moreLabel, '…另 1 項');
  });

  it('單品 quantity=4：title「原味雞霸 × 4」，lines 與 moreLabel 都是 undefined', () => {
    const result = restockReviewSummary({
      itemCount: 1,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [{ name: '原味雞霸', quantity: 4 }],
    });
    assert.equal(result.title, '原味雞霸 × 4');
    assert.equal(result.lines, undefined);
    assert.equal(result.moreLabel, undefined);
  });

  it('9 項只列 6 行與「…另 3 項」', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      name: `品項${index + 1}`,
      quantity: index + 1,
    }));
    const result = restockReviewSummary({
      itemCount: 9,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items,
    });
    assert.equal(result.title, '品項1 等 9 項');
    assert.equal(result.lines?.length, 6);
    assert.deepEqual(result.lines, [
      '品項1 × 1',
      '品項2 × 2',
      '品項3 × 3',
      '品項4 × 4',
      '品項5 × 5',
      '品項6 × 6',
    ]);
    assert.equal(result.moreLabel, '…另 3 項');
  });

  it('AUTO_REPLENISH 空 items：清理多行備註並截至 40 字；空白備註無 subtitleExtra', () => {
    const longNote = '第一行備註\n\n第二行還有   更多說明，用來確認會壓成單空白並截到四十個字元限制之後的內容';
    const withNote = restockReviewSummary({
      itemCount: 0,
      requestType: 'AUTO_REPLENISH',
      merchantNote: longNote,
      items: [],
    });
    const expectedNote = longNote.replace(/\s+/g, ' ').trim().slice(0, 40);
    assert.equal(withNote.title, '請幫我配');
    assert.equal(withNote.subtitleExtra, expectedNote);
    assert.equal(withNote.subtitleExtra?.length, 40);
    assert.ok(!withNote.subtitleExtra?.includes('\n'));
    assert.deepEqual(withNote.lines, ['店家未列品項，請看店家備註']);
    assert.equal(withNote.moreLabel, undefined);
    assert.ok(!JSON.stringify(withNote).includes(' · '));

    const nullNote = restockReviewSummary({
      itemCount: 0,
      requestType: 'AUTO_REPLENISH',
      merchantNote: null,
      items: [],
    });
    assert.equal(nullNote.subtitleExtra, undefined);
    assert.deepEqual(nullNote.lines, ['店家未列品項，請看店家備註']);

    const blankNote = restockReviewSummary({
      itemCount: 0,
      requestType: 'AUTO_REPLENISH',
      merchantNote: '  \n\t  ',
      items: [],
    });
    assert.equal(blankNote.subtitleExtra, undefined);
    assert.ok(!JSON.stringify(blankNote).includes(' · '));
  });

  it('SELF_SELECT 0 item：警告 title／line', () => {
    const result = restockReviewSummary({
      itemCount: 0,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [],
    });
    assert.equal(result.title, '補貨申請（無品項）');
    assert.deepEqual(result.lines, ['此申請沒有品項，請開啟明細確認']);
    assert.equal(result.moreLabel, undefined);
  });

  it('itemCount=3 但 items 空：title「補貨申請 等 3 項」，不 throw、不含 undefined', () => {
    const result = restockReviewSummary({
      itemCount: 3,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [],
    });
    assert.equal(result.title, '補貨申請 等 3 項');
    assert.equal(result.lines, undefined);
    assert.equal(result.moreLabel, undefined);
    assert.ok(!result.title.includes('undefined'));
    assert.ok(!JSON.stringify(result).includes('undefined'));
  });

  it('quantity null：單品 title 只有品名；多品對應 line 只有品名', () => {
    const single = restockReviewSummary({
      itemCount: 1,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [{ name: '原味雞霸', quantity: null }],
    });
    assert.equal(single.title, '原味雞霸');
    assert.ok(!single.title.includes('×'));
    assert.ok(!single.title.includes('null'));

    const multi = restockReviewSummary({
      itemCount: 2,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [
        { name: '原味雞霸', quantity: 4 },
        { name: '豬耳朵條', quantity: null },
      ],
    });
    assert.equal(multi.title, '原味雞霸 等 2 項');
    assert.deepEqual(multi.lines, ['原味雞霸 × 4', '豬耳朵條']);
    assert.equal(multi.lines?.[1], '豬耳朵條');
    assert.ok(!multi.lines?.[1]?.includes('×'));
    assert.ok(!multi.lines?.[1]?.includes('null'));
  });

  it('空白品名：多品不產生空白 line；單品空品名 title「補貨申請」', () => {
    const multi = restockReviewSummary({
      itemCount: 3,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [
        { name: '  ', quantity: 2 },
        { name: '原味雞霸', quantity: 4 },
        { name: '', quantity: 1 },
      ],
    });
    assert.equal(multi.title, '原味雞霸 等 3 項');
    assert.deepEqual(multi.lines, ['原味雞霸 × 4']);
    assert.ok(multi.lines?.every((line) => line.trim().length > 0));

    const singleEmpty = restockReviewSummary({
      itemCount: 1,
      requestType: 'SELF_SELECT',
      merchantNote: null,
      items: [{ name: '   ', quantity: 4 }],
    });
    assert.equal(singleEmpty.title, '補貨申請');
    assert.equal(singleEmpty.lines, undefined);
    assert.equal(singleEmpty.moreLabel, undefined);
  });
});

describe('reviews page source assertions', () => {
  it('page.tsx 手機與桌機各渲染 lines／moreLabel', () => {
    assert.match(mobileSection, /item\.lines/);
    assert.match(mobileSection, /item\.moreLabel/);
    assert.match(desktopSection, /item\.lines/);
    assert.match(desktopSection, /item\.moreLabel/);
  });

  it('兩處皆保有 min-w-0 truncate、shrink-0 tabular-nums 與指定容器 class', () => {
    for (const section of [mobileSection, desktopSection]) {
      assert.match(section, /min-w-0 truncate/);
      assert.match(section, /shrink-0 tabular-nums/);
      assert.match(section, /mt-1 space-y-0\.5 text-xs text-muted-foreground/);
      assert.match(section, /flex items-baseline justify-between gap-3/);
      assert.match(section, /mt-0\.5 text-xs text-muted-foreground/);
    }
  });

  it('loadPendingRestocks 使用指定 subtitle 組裝', () => {
    assert.match(
      inboxSource,
      /\[row\.merchant\.name, summary\.subtitleExtra\]\s*\.filter\(Boolean\)\s*\.join\(' · '\)/,
    );
  });
});
