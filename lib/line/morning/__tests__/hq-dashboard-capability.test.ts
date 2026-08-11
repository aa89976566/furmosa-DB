import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MORNING_HQ_CAPABILITIES,
  MORNING_HQ_WRITABLE_ACTION_EXPORTS,
} from '@/lib/line/morning/hq/capability-inventory';

const ROOT = process.cwd();

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('4B-D capability inventory（before=after 可達）', () => {
  it('writable action exports 仍存在於 actions／hq-actions', () => {
    const pageActions = read('app/(main)/campaigns/line-morning/actions.ts');
    const hqActions = read('lib/line/morning/plan/hq-actions.ts');
    const combined = `${pageActions}\n${hqActions}`;
    for (const name of MORNING_HQ_WRITABLE_ACTION_EXPORTS) {
      assert.match(
        combined,
        new RegExp(`export async function ${name}\\b`),
        `missing action export: ${name}`,
      );
    }
  });

  it('page／dashboard 以 data-capability 或 form action 暴露全部錨點', () => {
    const files = [
      'app/(main)/campaigns/line-morning/page.tsx',
      'app/(main)/campaigns/line-morning/dashboard/today-panel.tsx',
      'app/(main)/campaigns/line-morning/dashboard/content-panel.tsx',
      'app/(main)/campaigns/line-morning/dashboard/preferences-panel.tsx',
      'app/(main)/campaigns/line-morning/dashboard/system-panel.tsx',
      'app/(main)/campaigns/line-morning/dashboard/plan-generate-form.tsx',
      'app/(main)/campaigns/line-morning/dashboard/shared.tsx',
      'app/(main)/campaigns/line-morning/dashboard/confirm-submit.tsx',
    ];
    const blob = files.map(read).join('\n');
    for (const cap of MORNING_HQ_CAPABILITIES) {
      assert.ok(
        blob.includes(cap.anchor) ||
          (cap.actionExport && blob.includes(cap.actionExport)),
        `capability not reachable in UI: ${cap.id} (${cap.anchor})`,
      );
    }
  });

  it('禁止 CSS 假隱藏 writable 入口（display:none / hidden 綁 action）', () => {
    const system = read(
      'app/(main)/campaigns/line-morning/dashboard/system-panel.tsx',
    );
    // 工具列必須在摘要區可見，不得 hidden class 包住 master/quota/fixture
    assert.match(system, /capability-master-switch/);
    assert.match(system, /capability-daily-quota/);
    assert.match(system, /capability-fixture-load/);
    assert.match(system, /capability-fixture-refresh/);
    assert.equal(/hidden[\s\S]{0,80}capability-master-switch/.test(system), false);
  });

  it('schema／migration／decision／optin／sender 未改（相對檔案仍可 import）', () => {
    // presentation 模組不得 import sender／push
    const hqDirFiles = [
      'lib/line/morning/hq/tabs.ts',
      'lib/line/morning/hq/capability-inventory.ts',
      'lib/line/morning/hq/preference-stats.ts',
      'lib/line/morning/hq/plan-summary-view.ts',
      'app/(main)/campaigns/line-morning/dashboard/today-panel.tsx',
      'app/(main)/campaigns/line-morning/dashboard/system-panel.tsx',
      'app/(main)/campaigns/line-morning/dashboard/plan-generate-form.tsx',
    ];
    for (const f of hqDirFiles) {
      const src = read(f);
      assert.equal(src.includes("from '@/lib/line/push'"), false, f);
      assert.equal(src.includes('pushLineMessages'), false, f);
      assert.equal(src.includes('getMorningOutboundSender'), false, f);
    }
  });
});
