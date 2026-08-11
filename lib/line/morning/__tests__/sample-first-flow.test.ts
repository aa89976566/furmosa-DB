import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BRIEF_BUTTON_LABELS,
  HUMOR_FIRST_CONTENT,
  HUMOR_MODE_BRIEF,
  HUMOR_SAMPLE_BODY,
  NEWS_FIRST_CONTENT,
  NEWS_MODE_BRIEF,
  NEWS_SAMPLE_BODY,
  NEWS_SAMPLE_SOURCE_FACTS,
  NEWS_SAMPLE_SOURCE_URL,
  ONBOARDING_MODE_LABELS,
  getBriefButtons,
  getFirstContent,
  listOnboardingModeOptions,
  listAllContentOptionsForDisplay,
  renderHumorCompletion,
  renderModeBriefMessage,
  renderNewsCompletion,
  renderScheduleLeadPhrase,
  buildOptinConfirmWinnerTexts,
  getContentOption,
  getFrequencyOption,
} from '@/lib/line/morning/domain/optin';
import { buildMorningOptinPreview } from '@/lib/line/morning/optin-preview';
import {
  EVENTS_CENTER_MORNING_SETTINGS_LABEL,
  EVENTS_CENTER_MORNING_SETTINGS_MESSAGE,
  buildEventsCenterMessages,
} from '@/lib/line/flex-hubs';

describe('Brief-first CONSENSUS domain／copy', () => {
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

  it('兩個 mode brief exact copy＋按鈕', () => {
    assert.equal(HUMOR_MODE_BRIEF, '毛孩笑話，加上一點只有飼主才懂的荒謬日常。');
    assert.equal(
      NEWS_MODE_BRIEF,
      '台灣優先，也會聽聽全球毛孩圈的消息。只帶來源可靠的回來，沒有就不硬湊。',
    );
    assert.equal(renderModeBriefMessage('content_a'), HUMOR_MODE_BRIEF);
    assert.equal(renderModeBriefMessage('content_b'), NEWS_MODE_BRIEF);
    assert.deepEqual(
      getBriefButtons().map((b) => b.label),
      [
        BRIEF_BUTTON_LABELS.confirm,
        BRIEF_BUTTON_LABELS.switch,
        BRIEF_BUTTON_LABELS.pass,
      ],
    );
  });

  it('CONFIRM 前完整 sample 不得作為 brief', () => {
    assert.notEqual(HUMOR_MODE_BRIEF, HUMOR_SAMPLE_BODY);
    assert.notEqual(NEWS_MODE_BRIEF, NEWS_SAMPLE_BODY);
    assert.ok(!HUMOR_MODE_BRIEF.includes('牽繩'));
    assert.ok(!NEWS_MODE_BRIEF.includes('寵物公園'));
  });

  it('first content exact（幽默新文案／新聞沿用 #103 sample）', () => {
    assert.equal(
      HUMOR_FIRST_CONTENT,
      [
        '先來一則，算我今天有上工：',
        '',
        '散步結束，我跟狗說：「回家了。」',
        '牠立刻躺在地上。',
        '',
        '平常叫不動是一回事，',
        '直接變成不動產又是另一回事。',
      ].join('\n'),
    );
    assert.equal(NEWS_FIRST_CONTENT, NEWS_SAMPLE_BODY);
    assert.equal(getFirstContent('content_a'), HUMOR_FIRST_CONTENT);
    assert.equal(getFirstContent('content_b'), NEWS_FIRST_CONTENT);
    assert.ok(NEWS_FIRST_CONTENT.startsWith('先豎起耳朵，試聽一則台灣毛孩消息：'));
    assert.ok(NEWS_FIRST_CONTENT.includes(NEWS_SAMPLE_SOURCE_URL));
    for (const fact of NEWS_SAMPLE_SOURCE_FACTS) {
      assert.ok(NEWS_FIRST_CONTENT.includes(fact), fact);
    }
    assert.ok(!NEWS_FIRST_CONTENT.includes('今日新聞'));
  });

  it('完成訊息 exact＋語法自然（無每個每天）＋活動中心', () => {
    assert.equal(renderScheduleLeadPhrase('daily'), '之後每天早上');
    assert.equal(renderScheduleLeadPhrase('weekday'), '之後每個平日早上');
    assert.equal(renderScheduleLeadPhrase('weekly'), '之後每週五早上');

    const hDaily = renderHumorCompletion('daily');
    assert.equal(
      hDaily,
      [
        '收到。',
        '之後每天早上，我繞完一圈就來陪你笑個毛。',
        '',
        '不講硬到要查答案的梗，也不只聊狗狗。',
        '想換口味或先休息，到活動中心找「早安設定」就好。',
      ].join('\n'),
    );
    assert.ok(!hDaily.includes('每個每天'));

    const nWeekday = renderNewsCompletion('weekday');
    assert.equal(
      nWeekday,
      [
        '收到。',
        '之後每個平日早上，我會替你豎起耳朵，聽聽毛孩圈有什麼新鮮事。',
        '',
        '台灣消息優先，全球值得看的也不漏掉。',
        '沒有可靠內容就不硬湊，想調整時到活動中心找「早安設定」。',
      ].join('\n'),
    );

    const nWeekly = renderNewsCompletion('weekly');
    assert.ok(nWeekly.includes('之後每週五早上，我會替你豎起耳朵'));
  });

  it('winner reply = completion + exactly one first content（≤2）', () => {
    const humor = buildOptinConfirmWinnerTexts({
      content: getContentOption('content_a')!,
      frequency: getFrequencyOption('freq_daily')!,
    });
    assert.equal(humor.messages.length, 2);
    assert.equal(humor.messages[0], humor.successSummary);
    assert.equal(humor.messages[1], HUMOR_FIRST_CONTENT);

    const news = buildOptinConfirmWinnerTexts({
      content: getContentOption('content_b')!,
      frequency: getFrequencyOption('freq_weekdays')!,
    });
    assert.equal(news.messages.length, 2);
    assert.equal(news.messages[1], NEWS_FIRST_CONTENT);
  });

  it('LINE／Preview single-source：HQ preview 引用同一 brief／first content', () => {
    const preview = buildMorningOptinPreview({
      contentActionId: 'content_b',
      frequencyActionId: 'freq_friday',
    });
    assert.equal(preview.contentOptions.length, 2);
    assert.equal(preview.briefPreview, NEWS_MODE_BRIEF);
    assert.deepEqual(preview.briefButtons, [
      '確認此模式',
      '看看另一個',
      '先不用',
    ]);
    assert.equal(preview.firstContentPreview, NEWS_FIRST_CONTENT);
    assert.ok(preview.successSummary?.includes('每週五早上'));
    assert.deepEqual(preview.winnerReplyTexts, [
      preview.successSummary,
      NEWS_FIRST_CONTENT,
    ]);
    // CONFIRM 前 preview 不得把完整 sample 當 brief
    assert.notEqual(preview.briefPreview, NEWS_SAMPLE_BODY);
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
    const hits = raw.split('"text":"早安設定"').length - 1;
    assert.equal(hits, 1);
  });

  it('無其他 menu 重複渲染相同 label+payload（contract）', () => {
    const brand = readFileSync(
      resolve(process.cwd(), 'lib/line/brand-worlds.ts'),
      'utf8',
    );
    assert.equal(/label:\s*'早安設定'/.test(brand), false);
  });
});
