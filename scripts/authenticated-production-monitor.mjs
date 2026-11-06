import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { requestDecision, collectReadActionIds, describeMonitorRequest } from './authenticated-monitor-policy.mjs';
import { createRouteBoundary } from './authenticated-monitor-routes.mjs';

const targets = JSON.parse(readFileSync(new URL('../config/deployment-targets.json', import.meta.url), 'utf8'));

// Fixed diagnostic codes only; never serialize DOM, product names or exception text.
export async function checkPosSearch(page) {
  if (await page.getByText('這間店還沒有可結帳的寄賣商品。', { exact: true }).isVisible()) {
    throw new Error('POS_CATALOG_EMPTY');
  }
  const search = page.getByRole('textbox', { name: '搜尋商品', exact: true });
  try { await search.waitFor({ state: 'visible' }); }
  catch { throw new Error('POS_SEARCH_UNAVAILABLE'); }
  try {
    await search.fill('___monitor_no_match___');
    await page.getByText('沒有符合的商品，試試別的分類或關鍵字。', { exact: true }).waitFor({ state: 'visible' });
  } catch { throw new Error('POS_SEARCH_FILTER_FAILED'); }
  finally { await search.fill('').catch(() => {}); }
  try {
    await page.getByRole('button', { name: /^加入 / }).first().waitFor({ state: 'visible' });
  } catch { throw new Error('POS_SEARCH_RESET_FAILED'); }
}

export async function runAuthenticatedMonitor({ chromium, credentials, origin = targets.production.origin }) {
  const ciDatabase = 'postgresql://ci:ci@127.0.0.1:5432/ci';
  const isolatedCi = origin === 'http://localhost:3000' && process.env.CI === 'true' &&
    process.env.DATABASE_URL === ciDatabase && process.env.DIRECT_URL === ciDatabase;
  if (origin !== targets.production.origin && !isolatedCi) throw new Error('INVALID_TARGET');
  /** @type {{checkedAt: string, origin: string, ok: boolean, coverage: string, requestBlocks: Array<{role: string, reason: string, method: string, resourceType: string, destination: string, route: string}>, results: Array<{check: string, status: string, code?: string, latencyMs?: number}>}} */
  const report = { checkedAt: new Date().toISOString(), origin, ok: false,
    coverage: 'authenticated read-only UI; no production checkout, approval, coupon lookup, notification acknowledgement, delivery or settlement submission',
    requestBlocks: [], results: [] };
  // Never serialize credentials, cookies, HTML, response bodies, exception text,
  // screenshots, traces, HAR, downloads or storageState.
  if (!credentials.hqUser || !credentials.hqPassword || !credentials.posUser || !credentials.posPassword) {
    report.results.push({ check: 'configuration', status: 'blocked', code: 'MONITOR_CREDENTIALS_MISSING' });
    return report;
  }
  const browser = await chromium.launch();
  try {
    for (const role of ['hq', 'pos']) {
      // Separate contexts: never mix HQ and merchant sessions. One viewport
      // each bounds production load; full device coverage remains isolated CI.
      const context = await browser.newContext({ viewport: role === 'hq' ? { width: 1440, height: 1000 } : { width: 393, height: 851 },
        serviceWorkers: 'block', acceptDownloads: false });
      let loginOpen = false;
      let loginUsed = false;
      let unsafe = false;
      const actionIds = new Set();
      function noteBlocked(route, reason) {
        unsafe = true;
        const request = route.request();
        const entry = { role, reason, ...describeMonitorRequest({ url: request.url(), method: request.method(), resourceType: request.resourceType(), origin, role }) };
        // At most 10 fixed-enum diagnostics per role; never include full URLs,
        // hosts, queries, action IDs, request bodies, headers or exception text.
        const entries = report.requestBlocks.filter(item => item.role === role);
        if (entries.length < 10 && !entries.some(item => JSON.stringify(item) === JSON.stringify(entry))) report.requestBlocks.push(entry);
      }
      const boundary = createRouteBoundary(async route => {
        const request = route.request();
        const decision = requestDecision({ url: request.url(), method: request.method(), resourceType: request.resourceType(),
          headers: request.headers(), body: request.postData(), origin, role, loginOpen, loginUsed, actionIds });
        if (decision === 'login') loginUsed = true;
        if (decision === 'deny' || decision === 'omit-asset') {
          if (decision === 'deny') noteBlocked(route, 'policy');
          return route.abort('blockedbyclient');
        }
        if (decision === 'asset' && request.resourceType() === 'script') {
          // Register only named no-argument reads before the browser executes
          // the unmodified same-origin bundle. Never evaluate downloaded code.
          const response = await route.fetch({ maxRedirects: 0, timeout: 15_000 });
          if (response.status() !== 200) { noteBlocked(route, 'asset-fetch'); return route.abort(); }
          const body = await response.body();
          for (const id of collectReadActionIds(body.toString('utf8'))) actionIds.add(id);
          return route.fulfill({ response, body });
        }
        return route.continue();
      }, route => { noteBlocked(route, 'route-error'); });
      await context.route('**/*', boundary.handle);
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.setDefaultNavigationTimeout(30_000);
      let current = `${role}-login`;
      async function healthy() {
        if (unsafe) throw new Error('REQUEST_BLOCKED');
        if (await page.getByText(/Application error|發生錯誤|訂單統計暫時無法取得/).count()) throw new Error('RENDERED_ERROR');
      }
      async function visit(path, heading) {
        current = `${role}:${path}`;
        const start = performance.now();
        const response = await page.goto(new URL(path, origin).href);
        if (!response?.ok() || new URL(page.url()).pathname !== path) throw new Error('PAGE_UNAVAILABLE');
        await page.getByRole('heading', { name: heading, exact: true }).waitFor({ state: 'visible' });
        await healthy();
        report.results.push({ check: current, status: 'pass', latencyMs: Math.round(performance.now() - start) });
      }
      try {
        const loginPath = role === 'hq' ? '/login' : '/pos/login';
        await page.goto(new URL(loginPath, origin).href);
        await page.getByLabel(role === 'hq' ? 'Email' : '帳號', { exact: true }).fill(credentials[`${role}User`]);
        await page.getByLabel('密碼', { exact: true }).fill(credentials[`${role}Password`]);
        loginOpen = true;
        await page.getByRole('button', { name: '登入', exact: true }).click();
        await page.getByRole('heading', { name: role === 'hq' ? '營運首頁' : '店內商品', exact: true }).waitFor({ state: 'visible' });
        loginOpen = false;
        if (!loginUsed) throw new Error('LOGIN_NOT_VERIFIED');
        await healthy();
        report.results.push({ check: current, status: 'pass' });
        if (role === 'hq') {
          for (const [path, heading] of [['/orders', '訂單'], ['/reviews', '待審核'], ['/products', '產品管理'], ['/inventory', '庫存總覽'], ['/restock-requests', '補貨申請']]) {
            await visit(path, heading);
            if (path === '/orders') {
              const stages = page.getByRole('navigation', { name: '訂單工作階段' });
              await stages.getByRole('link', { name: /^全部訂單\s*\d+/ }).waitFor({ state: 'visible' });
              await healthy();
            }
          }
        } else {
          current = 'pos:search-controls';
          await checkPosSearch(page);
          await healthy();
          report.results.push({ check: current, status: 'pass' });
          for (const [path, heading] of [['/pos/stock', '庫存'], ['/pos/refill', '換罐計畫'], ['/pos/restock', '寄賣叫貨'], ['/pos/records', '紀錄'], ['/pos/settle', '對帳']]) await visit(path, heading);
          current = 'pos:ledger-tab';
          await page.getByRole('button', { name: '交易流水', exact: true }).click();
          await page.getByText('查看流水、換罐收款與優惠券補貼明細', { exact: true }).waitFor({ state: 'visible' });
          await healthy();
          report.results.push({ check: current, status: 'pass' });
        }
      } catch (error) {
        const safeCodes = new Set(['REQUEST_BLOCKED', 'RENDERED_ERROR', 'PAGE_UNAVAILABLE', 'LOGIN_NOT_VERIFIED', 'POS_CATALOG_EMPTY', 'POS_SEARCH_UNAVAILABLE', 'POS_SEARCH_FILTER_FAILED', 'POS_SEARCH_RESET_FAILED']);
        report.results.push({ check: current, status: 'fail', code: safeCodes.has(error?.message) ? error.message : 'UI_CHECK_FAILED' });
      } finally {
        // Keep the request guard installed through close. Never unroute a live
        // authenticated context, which could briefly permit unguarded writes.
        try { await context.close(); }
        finally { await boundary.settle(); }
        if (unsafe) report.results.push({ check: `${role}:request-boundary`, status: 'fail', code: 'UNREVIEWED_REQUEST_BLOCKED' });
      }
    }
  } finally { await browser.close(); }
  report.ok = report.results.length > 0 && report.results.every(result => result.status === 'pass');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let report;
  try {
    const { chromium } = await import('@playwright/test');
    report = await runAuthenticatedMonitor({ chromium, credentials: {
      hqUser: process.env.MONITOR_HQ_USER, hqPassword: process.env.MONITOR_HQ_PASSWORD,
      posUser: process.env.MONITOR_POS_USER, posPassword: process.env.MONITOR_POS_PASSWORD,
    }});
  } catch { report = { ok: false, checkedAt: new Date().toISOString(), results: [{ check: 'runner', status: 'fail', code: 'RUNNER_FAILED' }] }; }
  writeFileSync('production-authenticated-probe.json', `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}
