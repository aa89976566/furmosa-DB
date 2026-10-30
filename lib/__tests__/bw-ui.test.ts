/**
 * HQ 統一語意色彩系統 contract — 不連資料庫。
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { SECTION_TONES, sectionToneStyles } from "../section-tone";

const root = process.cwd();

const CHROMATIC_CLASS =
  /\b(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/;

const BRAND_HEX =
  /#(?:c2410c|C46A2F|3b82f6|10b981|f59e0b|f8f1e8|FFFCF7|fff7ed|71836B|64748b)\b/i;

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walkFiles(p, acc);
      continue;
    }
    if (/\.(tsx?|css|svg|webmanifest)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("HQ 語意色彩系統", () => {
  it("HQ 分區色改由語意 token 管理，不使用散落彩色 class", () => {
    for (const tone of SECTION_TONES) {
      const joined = Object.values(sectionToneStyles[tone]).join(" ");
      assert.equal(
        CHROMATIC_CLASS.test(joined),
        false,
        `${tone} still uses a chromatic Tailwind class: ${joined}`,
      );
    }
  });

  it("HQ CSS 使用統一深綠主色與語意狀態色", () => {
    const css = readRepoFile("app/globals.css");
    for (const token of [
      "--primary: 156 42% 24%",
      "--success: 151 52% 30%",
      "--warning: 38 85% 38%",
      "--info: 203 36% 42%",
      "--destructive: 4 53% 44%",
    ]) {
      assert.ok(css.includes(token), `missing semantic token: ${token}`);
    }
    assert.match(css, /\.pos-theme\s*\{[\s\S]*--primary:\s*156\s+42%\s+24%/);
    assert.match(css, /\.order-theme\s*\{[\s\S]*--primary:\s*156\s+42%\s+24%/);
  });

  it("庫存工作區與其他 POS 頁面共用綠色操作主題", () => {
    const inventory = readRepoFile("components/pos/inventory-workspace.tsx");
    const inventoryNav = readRepoFile("components/pos/inventory-nav.tsx");
    const settlement = readRepoFile("components/pos/settle-workspace.tsx");
    assert.match(inventory, /className="pos-theme min-h-screen/);
    assert.match(inventory, /bg-primary text-primary-foreground/);
    assert.match(inventoryNav, /bg-primary text-primary-foreground/);
    assert.match(settlement, /className="pos-theme flex h-\[100dvh\]/);
    assert.equal(inventoryNav.includes('bg-zinc-900 text-white'), false);
  });

  it("總部／店家畫面沒有舊品牌色碼", () => {
    const dirs = ["app", "components", "features", "public"];
    const hits: string[] = [];
    for (const dir of dirs) {
      for (const file of walkFiles(path.join(root, dir))) {
        const text = readFileSync(file, "utf8");
        if (BRAND_HEX.test(text)) hits.push(path.relative(root, file));
      }
    }
    assert.deepEqual(hits, []);
  });

  it("登入頁維持簡潔文案與既有瀏覽器主題色", () => {
    const login = readRepoFile("app/login/page.tsx");
    assert.equal(login.includes("分色"), false);
    assert.match(login, /黑白層級/);
    const layout = readRepoFile("app/layout.tsx");
    assert.match(layout, /themeColor:\s*'#171717'/);
  });

  it("Tailwind 把預設彩色色盤改成灰階", () => {
    const config = readRepoFile("tailwind.config.ts");
    for (const name of [
      "red",
      "orange",
      "amber",
      "yellow",
      "lime",
      "green",
      "emerald",
      "teal",
      "cyan",
      "sky",
      "blue",
      "indigo",
      "violet",
      "purple",
      "fuchsia",
      "pink",
      "rose",
      "slate",
    ]) {
      assert.match(config, new RegExp(`'${name}'`));
    }
    assert.match(config, /#fafafa/);
    assert.match(config, /#171717/);
  });

  it("換罐工作區只顯示本店 LINE 交易，不提供店員掃碼或輸入序號", () => {
    const refill = readRepoFile("components/pos/refill-workspace.tsx");
    const legacyDetail = readRepoFile("app/pos/refill/[id]/page.tsx");
    assert.match(refill, /會員自己在 LINE 完成序號登錄/);
    assert.match(refill, /本店換罐內容/);
    assert.match(refill, /本店 LINE 交易紀錄/);
    assert.equal(refill.includes("JarSerialPanel"), false);
    assert.equal(refill.includes("掃描罐底"), false);
    assert.equal(refill.includes("手動輸入序號"), false);
    assert.match(legacyDetail, /redirect\('\/pos\/refill'\)/);
  });

  it("補貨處理進度使用可降級的動態時間軸", () => {
    const progress = readRepoFile("components/pos/shipment-progress.tsx");
    const restock = readRepoFile("app/pos/restock/[id]/page.tsx");
    const css = readRepoFile("app/globals.css");
    assert.match(restock, /<ShipmentProgress steps=\{shipmentTimeline\}/);
    assert.match(progress, /aria-current=\{active \? 'step'/);
    assert.match(progress, /下一步：/);
    assert.match(css, /shipment-progress-pulse/);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });

  it("全站共用元件使用清晰邊框、低層陰影，並關閉漸層與毛玻璃", () => {
    const css = readRepoFile("app/globals.css");
    const card = readRepoFile("components/ui/card.tsx");
    const topbar = readRepoFile("components/layout/topbar.tsx");
    const posNav = readRepoFile("components/pos/bottom-nav.tsx");
    const query = readRepoFile("components/pos/query-board.tsx");

    assert.match(css, /box-shadow: 0 1px 2px/);
    assert.doesNotMatch(css, /box-shadow: 4px 4px 0/);
    assert.match(css, /\[class\*="bg-gradient-"\]/);
    assert.match(css, /\[class\*="backdrop-blur"\]/);
    assert.match(card, /border-2 border-foreground/);
    assert.equal(card.includes("shadow-card"), false);
    assert.equal(topbar.includes("backdrop-blur"), false);
    assert.equal(posNav.includes("rounded-full"), false);
    assert.match(query, /overflow-hidden rounded-2xl border border-border/);
    assert.match(query, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(320px,380px\)\]/);
    assert.match(query, /role="dialog" aria-modal="true" aria-label="補貨物流詳情"/);
    assert.match(query, /setDetailOpen\(true\)/);
    assert.equal(query.includes("<Card"), false);
  });
});
