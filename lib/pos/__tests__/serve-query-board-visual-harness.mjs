#!/usr/bin/env node
/**
 * 本機 UI 驗收伺服器：渲染 PR #166 的 QueryBoard + RecordsPageFrame。
 * 不是公開 Next route，不連資料庫。
 *
 * 產品預覽（截圖用，無測試控制）：
 *   node lib/pos/__tests__/serve-query-board-visual-harness.mjs
 *   http://127.0.0.1:4173/?scenario=populated
 *   http://127.0.0.1:4173/?scenario=empty
 *   http://127.0.0.1:4173/?scenario=no_matches
 *   http://127.0.0.1:4173/?scenario=populated&scroll=end
 *
 * 測試控制（不要截進產品畫面）：
 *   http://127.0.0.1:4173/lab
 *
 * 可選環境變數：QUERY_BOARD_VISUAL_PORT、QUERY_BOARD_SCENARIO、QUERY_BOARD_Q、QUERY_BOARD_SCROLL
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = path.join('/tmp', 'query-board-visual-harness');
const shimDir = path.join(root, 'lib/pos/__tests__/visual-harness/shims');
const port = Number(process.env.QUERY_BOARD_VISUAL_PORT || 4173);
const defaults = {
  scenario: process.env.QUERY_BOARD_SCENARIO || '',
  q: process.env.QUERY_BOARD_Q || '',
  scroll: process.env.QUERY_BOARD_SCROLL || '',
};

fs.mkdirSync(outDir, { recursive: true });

function resolveSource(base) {
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.js`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return base;
}

const shims = {
  'next/link': path.join(shimDir, 'next-link.tsx'),
  'next/navigation': path.join(shimDir, 'next-navigation.ts'),
  '@/app/pos/actions': path.join(shimDir, 'pos-actions.ts'),
};

const aliasPlugin = {
  name: 'pos-visual-aliases',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (shims[args.path]) return { path: shims[args.path] };
      if (args.path.startsWith('@/')) {
        return { path: resolveSource(path.join(root, args.path.slice(2))) };
      }
      return undefined;
    });
  },
};

async function bundle(entry, outfile) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [aliasPlugin],
  });
}

await bundle(
  path.join(root, 'lib/pos/__tests__/query-board-visual-entry.tsx'),
  path.join(outDir, 'preview.js'),
);
await bundle(
  path.join(root, 'lib/pos/__tests__/query-board-visual-lab-entry.tsx'),
  path.join(outDir, 'lab.js'),
);

const cssOut = path.join(outDir, 'harness.css');
const tw = spawnSync(
  path.join(root, 'node_modules/.bin/tailwindcss'),
  [
    '-c',
    path.join(root, 'lib/pos/__tests__/visual-harness/tailwind.config.ts'),
    '-i',
    path.join(root, 'app/globals.css'),
    '-o',
    cssOut,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (tw.status !== 0) {
  console.error(tw.stdout || '');
  console.error(tw.stderr || '');
  process.exit(tw.status || 1);
}

const defaultsJson = JSON.stringify(defaults);
const previewHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>查詢紀錄 · Furmosa 店家</title>
    <link rel="stylesheet" href="/harness.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    <style>
      :root { --font-sans: Inter, system-ui, sans-serif; }
    </style>
  </head>
  <body class="min-h-screen bg-background font-sans antialiased">
    <script>window.__QUERY_BOARD_HARNESS_DEFAULTS__ = ${defaultsJson};</script>
    <div id="root"></div>
    <script src="/preview.js"></script>
  </body>
</html>
`;

const labHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>查詢頁 visual lab</title>
    <link rel="stylesheet" href="/harness.css" />
  </head>
  <body class="min-h-screen bg-background font-sans antialiased">
    <div id="root"></div>
    <script src="/lab.js"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(outDir, 'index.html'), previewHtml);
fs.writeFileSync(path.join(outDir, 'lab.html'), labHtml);

const iconPath = path.join(root, 'public/icons/icon.svg');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (file === '/lab') file = '/lab.html';
  if (file === '/icons/icon.svg') {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    fs.createReadStream(iconPath).pipe(res);
    return;
  }
  const map = {
    '/index.html': ['text/html; charset=utf-8', path.join(outDir, 'index.html')],
    '/lab.html': ['text/html; charset=utf-8', path.join(outDir, 'lab.html')],
    '/preview.js': ['text/javascript; charset=utf-8', path.join(outDir, 'preview.js')],
    '/lab.js': ['text/javascript; charset=utf-8', path.join(outDir, 'lab.js')],
    '/harness.css': ['text/css; charset=utf-8', path.join(outDir, 'harness.css')],
  };
  const hit = map[file];
  if (!hit) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }
  res.setHeader('Content-Type', hit[0]);
  fs.createReadStream(hit[1]).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${port}`;
  console.log(`產品預覽 ${base}/?scenario=populated`);
  console.log(`產品預覽 ${base}/?scenario=empty`);
  console.log(`產品預覽 ${base}/?scenario=no_matches`);
  console.log(`產品預覽 ${base}/?scenario=populated&scroll=end`);
  console.log(`測試控制 ${base}/lab`);
});
