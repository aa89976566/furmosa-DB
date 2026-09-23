import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicLinkSources = [
  '../line/jar-dialogue-shell.ts',
  '../line/flex-hubs.ts',
  '../line/refill-intro-flex.ts',
  '../campaigns/jiba-two-piece/service.ts',
];

test('公開連結 fallback 使用正式網域，不再導向 Vercel 測試網址', () => {
  for (const path of publicLinkSources) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /https:\/\/hq\.furmosa\.com/);
    assert.doesNotMatch(source, /https:\/\/furmosa-db\.vercel\.app/);
  }
});
