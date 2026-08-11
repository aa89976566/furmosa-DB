import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HUMOR_SAMPLE_BODY,
  NEWS_SAMPLE_BODY,
  NEWS_SAMPLE_SOURCE_FACTS,
  NEWS_SAMPLE_SOURCE_URL,
  ONBOARDING_MODE_LABELS,
  getSampleButtons,
  listOnboardingModeOptions,
  listAllContentOptionsForDisplay,
  renderHumorCompletion,
  renderNewsCompletion,
  renderScheduleLeadPhrase,
} from '@/lib/line/morning/domain/optin';
import { buildMorningOptinPreview } from '@/lib/line/morning/optin-preview';
import {
  EVENTS_CENTER_MORNING_SETTINGS_LABEL,
  EVENTS_CENTER_MORNING_SETTINGS_MESSAGE,
  buildEventsCenterMessages,
} from '@/lib/line/flex-hubs';

describe('Sample-first CONSENSUS domain／copy', () => {
  it('onboarding 只兩項：笑個毛／豎起耳朵', () => {
    const opts = listOnboardingModeOptions();
    assert.deepEqual(
      opts.map((o) => o.buttonLabel),
      [ONBOARDING_MODE_LABELS.content_a, ONBOARDING_MODE_LABELS.content_b],
    );
    assert.deepEqual(
      opts.map((o) => o.domainMode),
      ['HUMOR_ONLY', 'NEWS_ONLY'],
    );
  });

  it('full mapping 仍保留 legacy／OFF／FACT（不刪 enum）', () => {
    const all = listAllContentOptionsForDisplay();
    const modes = new Set(all.map((o) => o.domainMode));
    for (const m of [
      'HUMOR_ONLY',
      'NEWS_ONLY',
      'ALTERNATE',
      'NEWS_FIRST_FACT_FALLBACK',
      'NEWS_FIRST_FACT_OR_HUMOR_FALLBACK',
      'OFF',
    ]) {
      assert.ok(modes.has(m as never), m);
    }
  });

  it('HUMOR／NEWS sample body + buttons exact', () => {
    assert.equal(
      getSampleButtons('content_a').map((b) => b.label).join('|'),
      '好，就笑個毛|換成豎起耳朵|先不用',
    );
    assert.equal(
      getSampleButtons('content_b').map((b) => b.label).join('|'),
      '好，我豎起耳朵|換成笑個毛|先不用',
    );
    assert.equal(
      HUMOR_SAMPLE_BODY,
      [
        '早。今天出門前問狗狗：「要不要上班？」',
        '牠立刻把牽繩叼來。',
        '看來牠以為我的工作，是陪牠去公園。',
      ].join('\n'),
    );
    assert.ok(NEWS_SAMPLE_BODY.startsWith('先豎起耳朵，試聽一則台灣毛孩消息：'));
    assert.ok(NEWS_SAMPLE_BODY.includes(NEWS_SAMPLE_SOURCE_URL));
    for (const fact of NEWS_SAMPLE_SOURCE_FACTS) {
      assert.ok(NEWS_SAMPLE_BODY.includes(fact), fact);
    }
    assert.ok(!NEWS_SAMPLE_BODY.includes('今日新聞'));
  });

  it('完成訊息 exact＋語法自然（無每個每天）', () => {
    assert.equal(renderScheduleLeadPhrase('daily'), '之後每天早上');
    assert.equal(renderScheduleLeadPhrase('weekday'), '之後每個平日早上');
    assert.equal(renderScheduleLeadPhrase('weekly'), '之後每週五早上');

    const hDaily = renderHumorCompletion('daily');
    assert.equal(
      hDaily,
      [
        '收到。',
        '之後每天早上，我繞完一圈就來陪你笑個毛。',
        '不講硬到要查答案的梗，也不只聊狗狗。',
        '想換口味或先休息，跟我說「早安設定」就好。',
      ].join('\n'),
    );
    assert.ok(!hDaily.includes('每個每天'));

    const nWeekday = renderNewsCompletion('weekday');
    assert.equal(
      nWeekday,
      [
        '收到。',
        '之後每個平日早上，我會替你豎起耳朵，聽聽毛孩圈有什麼新鮮事。',
        '台灣消息優先，全球值得看的也不漏掉。',
        '沒有可靠內容就不硬湊，想調整時跟我說「早安設定」。',
      ].join('\n'),
    );

    const nWeekly = renderNewsCompletion('weekly');
    assert.ok(nWeekly.includes('之後每週五早上，我會替你豎起耳朵'));
  });

  it('LINE／Preview single-source：HQ preview 引用同一 sample', () => {
    const preview = buildMorningOptinPreview({
      contentActionId: 'content_b',
      frequencyActionId: 'freq_friday',
    });
    assert.equal(preview.contentOptions.length, 2);
    assert.equal(preview.samplePreview, NEWS_SAMPLE_BODY);
    assert.deepEqual(preview.sampleButtons, [
      '好，我豎起耳朵',
      '換成笑個毛',
      '先不用',
    ]);
    assert.ok(preview.successSummary?.includes('每週五早上'));
  });
});

describe('活動中心 canonical 早安設定入口', () => {
  it('events center 含單一 message 按鈕；label/payload 一致', () => {
    const msgs = buildEventsCenterMessages({ registered: true });
    const raw = JSON.stringify(msgs);
    assert.equal(
      EVENTS_CENTER_MORNING_SETTINGS_LABEL,
      EVENTS_CENTER_MORNING_SETTINGS_MESSAGE,
    );
    assert.equal(EVENTS_CENTER_MORNING_SETTINGS_LABEL, '早安設定');
    assert.match(raw, /早安設定/);
    // 恰好一個 message action 指向 早安設定
    const hits = raw.split('"text":"早安設定"').length - 1;
    assert.equal(hits, 1);
  });

  it('無其他 menu 重複渲染相同 label+payload（contract）', () => {
    const brand = readFileSync(
      resolve(process.cwd(), 'lib/line/brand-worlds.ts'),
      'utf8',
    );
    // CHAOS_ITEMS 不含早安設定（避免第二入口）
    assert.equal(/label:\s*'早安設定'/.test(brand), false);
  });
});
