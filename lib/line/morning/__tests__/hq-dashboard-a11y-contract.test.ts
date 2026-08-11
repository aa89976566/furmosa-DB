import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('4B-D a11y／安全 contract', () => {
  it('tablist／tab／tabpanel／focus-visible', () => {
    const nav = read(
      'app/(main)/campaigns/line-morning/dashboard/tab-nav.tsx',
    );
    assert.match(nav, /role="tablist"/);
    assert.match(nav, /role="tab"/);
    assert.match(nav, /aria-selected/);
    assert.match(nav, /ArrowRight/);
    assert.match(nav, /ArrowLeft/);
    assert.match(nav, /Home/);
    assert.match(nav, /End/);
    assert.match(nav, /focus-visible/);

    for (const panel of [
      'today-panel.tsx',
      'content-panel.tsx',
      'preferences-panel.tsx',
      'system-panel.tsx',
    ]) {
      const src = read(
        `app/(main)/campaigns/line-morning/dashboard/${panel}`,
      );
      assert.match(src, /role="tabpanel"/);
    }
  });

  it('confirm modal：Escape／return focus／取消不 submit', () => {
    const src = read(
      'app/(main)/campaigns/line-morning/dashboard/confirm-submit.tsx',
    );
    assert.match(src, /Dialog/);
    assert.match(src, /onEscapeKeyDown|Escape/);
    assert.match(src, /triggerRef\.current\?\.focus/);
    assert.match(src, /取消/);
    assert.match(src, /requestSubmit/);
    assert.match(src, /只影響 Preview/);
  });

  it('無正式送出按鈕；Preview labels；LINE id 遮罩', () => {
    const today = read(
      'app/(main)/campaigns/line-morning/dashboard/today-panel.tsx',
    );
    const shared = read(
      'app/(main)/campaigns/line-morning/dashboard/shared.tsx',
    );
    const system = read(
      'app/(main)/campaigns/line-morning/dashboard/system-panel.tsx',
    );
    const page = read('app/(main)/campaigns/line-morning/page.tsx');
    assert.match(shared, /不會發送 LINE/);
    assert.match(shared, /Preview 驗收/);
    assert.match(today, /PreviewSafetyBadges/);
    assert.equal(/正式送出|真送 LINE|broadcast/i.test(today + shared), false);
    assert.match(system, /maskLineUserId/);
    assert.equal(page.includes('generateMorningPlanPreviewAction'), false);
    // UX wrapper only from form
    assert.match(
      read('app/(main)/campaigns/line-morning/dashboard/plan-generate-form.tsx'),
      /generateMorningPlanPreviewUxAction/,
    );
  });

  it('vercel 無 morning cron；page 無 public auth bypass', () => {
    const vercel = read('vercel.json');
    assert.equal(/line-morning/.test(vercel), false);
    const page = read('app/(main)/campaigns/line-morning/page.tsx');
    assert.match(page, /getCurrentUser/);
    assert.match(page, /admin.*staff|ALLOWED_ROLES/);
  });
});
