#!/usr/bin/env node
/**
 * 本機 UI 驗收伺服器：渲染 PR #166 的 QueryBoard + RecordsPageFrame。
 * 不是公開 Next route，不連資料庫。請在專案根目錄執行：
 *   node lib/pos/__tests__/serve-query-board-visual-harness.mjs
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

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'lib/pos/__tests__/query-board-visual-entry.tsx')],
  outfile: path.join(outDir, 'harness.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [
    {
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
    },
  ],
});

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

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>測試 fixture · POS 查詢頁</title>
    <link rel="stylesheet" href="/harness.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="/harness.js"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(outDir, 'index.html'), html);

const iconPath = path.join(root, 'public/icons/icon.svg');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (file === '/icons/icon.svg') {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    fs.createReadStream(iconPath).pipe(res);
    return;
  }
  const map = {
    '/index.html': ['text/html; charset=utf-8', path.join(outDir, 'index.html')],
    '/harness.js': ['text/javascript; charset=utf-8', path.join(outDir, 'harness.js')],
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
  console.log(`測試 fixture harness http://127.0.0.1:${port}/`);
});
