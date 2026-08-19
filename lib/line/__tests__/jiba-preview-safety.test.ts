import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  applyJibaPreviewInput,
  createInitialJibaPreviewState,
  runJibaPreviewHappyPath,
} from '@/lib/line/campaigns/jiba-unbox/preview-engine';

const ROOT = process.cwd();

const PREVIEW_SOURCE_FILES = [
  'lib/line/campaigns/jiba-unbox/preview-types.ts',
  'lib/line/campaigns/jiba-unbox/preview-messages.ts',
  'lib/line/campaigns/jiba-unbox/preview-engine.ts',
  'components/line-preview/jiba-unbox-preview.tsx',
  'components/line-preview/preview-message-list.tsx',
  'app/(main)/admin/line-message-preview/page.tsx',
];

const FORBIDDEN_IMPORT_SNIPPETS = [
  "from '@/lib/line/reply'",
  'from "@/lib/line/reply"',
  "from '@/lib/line/push'",
  'from "@/lib/line/push"',
  "from '@/lib/line/handle-event'",
  "from '@/lib/line/campaigns/jiba-unbox/flow'",
  "from '@/lib/prisma'",
  "from '@/lib/line/config'",
  "from '@/lib/line/profile'",
  "from '@/lib/line/liff-config'",
  "from '@/components/liff/",
  "from '@line/liff'",
  'api.line.me',
  'getLineChannelAccessToken',
  'replyLineMessage',
  'pushLineMessages',
  'prisma.',
  'fetch(',
];

describe('jiba preview safety', () => {
  it('預覽原始碼不含 forbidden LINE/DB/network 依賴', () => {
    for (const rel of PREVIEW_SOURCE_FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      for (const bad of FORBIDDEN_IMPORT_SNIPPETS) {
        assert.equal(
          src.includes(bad),
          false,
          `${rel} 不應包含「${bad}」`,
        );
      }
    }
  });

  it('預覽引擎執行時不觸發全域 fetch（若被 stub 攔截）', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = 0;
    globalThis.fetch = (async () => {
      fetchCalled += 1;
      throw new Error('preview must not fetch');
    }) as typeof fetch;
    try {
      runJibaPreviewHappyPath('jiba');
      runJibaPreviewHappyPath('frog');
      let state = createInitialJibaPreviewState();
      state = applyJibaPreviewInput(state, '先看看規則');
      state = applyJibaPreviewInput(state, '這個我可以！');
      assert.equal(state.step, 'ask_product');
      assert.equal(fetchCalled, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('middleware 未把 /admin 列為公開路徑（HQ session 保護）', () => {
    const mw = readFileSync(join(ROOT, 'middleware.ts'), 'utf8');
    assert.match(mw, /decideHqAccess/);
    assert.match(mw, /SESSION_COOKIE_NAME/);
    // /admin/* 不在 PUBLIC_PATHS，也不在 /liff 或 /api/line 放行區
    assert.doesNotMatch(mw, /PUBLIC_PATHS\s*=\s*\[[^\]]*\/admin/);
    assert.match(mw, /pathname\.startsWith\('\/liff'\)/);
    assert.match(mw, /pathname\.startsWith\('\/api\/line'\)/);
  });

  it('nav 有 LINE 訊息預覽入口指向正確路由', () => {
    const nav = readFileSync(join(ROOT, 'lib/nav.ts'), 'utf8');
    assert.match(nav, /\/admin\/line-message-preview/);
    assert.match(nav, /LINE 訊息預覽/);
  });
});
