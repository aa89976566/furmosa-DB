import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANIMAL_FACT_DISCLOSURE } from '@/lib/line/morning/domain/types';
import {
  NEWS_ONLY_SOURCE_DISCLOSURE,
  listOnboardingModeOptions,
  listAllContentOptionsForDisplay,
  renderModePrompt,
  buildOptinPostbackData,
  parseOptinPostbackData,
  getContentOption,
  renderOptinSuccessSummary,
  getFrequencyOption,
  ONBOARDING_MODE_LABELS,
} from '@/lib/line/morning/domain/optin';
import { buildMorningOptinPreview } from '@/lib/line/morning/optin-preview';

describe('optin shared parity（sample-first）', () => {
  it('onboarding 兩項；full mapping 含 FACT／OFF／alternate', () => {
    const ids = listOnboardingModeOptions().map((o) => o.actionId);
    assert.deepEqual(ids, ['content_a', 'content_b']);
    const b = getContentOption('content_b')!;
    assert.ok(b.disclosure.includes(NEWS_ONLY_SOURCE_DISCLOSURE));
    assert.equal(b.domainMode, 'NEWS_ONLY');
    const c = getContentOption('content_c')!;
    assert.ok(c.disclosure.includes(ANIMAL_FACT_DISCLOSURE));
    const a = getContentOption('content_a')!;
    assert.ok(a.buttonLabel.includes(ONBOARDING_MODE_LABELS.content_a));
    assert.ok(
      listAllContentOptionsForDisplay().some(
        (o) => o.actionId === 'content_legacy_alternate',
      ),
    );
  });

  it('postback 拒絕 mode／label 欄位；允許 sample actions', () => {
    const data = buildOptinPostbackData({
      nonce: 'a'.repeat(32),
      version: 1,
      step: 'sample',
      actionId: 'sample_confirm',
    });
    const parsed = parseOptinPostbackData(data);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.actionId, 'sample_confirm');
      assert.equal(parsed.step, 'sample');
    }
    const bad = parseOptinPostbackData(`${data}&mode=jokes`);
    assert.equal(bad.ok, false);
  });

  it('HQ preview 與 domain renderer 同源', () => {
    const content = getContentOption('content_a')!;
    const frequency = getFrequencyOption('freq_daily')!;
    const success = renderOptinSuccessSummary({ content, frequency });
    const preview = buildMorningOptinPreview({
      contentActionId: 'content_a',
      frequencyActionId: 'freq_daily',
    });
    assert.equal(preview.successSummary, success);
    assert.equal(preview.contentPrompt, renderModePrompt());
    assert.ok(preview.contentPrompt.includes('笑個毛'));
  });

  it('preference-flow／HQ 不 hardcode sample switch', () => {
    const flow = readFileSync(
      resolve(process.cwd(), 'lib/line/morning/preference-flow.ts'),
      'utf8',
    );
    const hq = readFileSync(
      resolve(process.cwd(), 'lib/line/morning/optin-preview.ts'),
      'utf8',
    );
    assert.ok(flow.includes("from '@/lib/line/morning/domain/optin'"));
    assert.ok(hq.includes("from '@/lib/line/morning/domain/optin'"));
    assert.ok(!/case\s+'content_a'/.test(hq));
  });
});
