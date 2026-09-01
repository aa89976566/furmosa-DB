/**
 * 總部 HQ 與店家 POS 黑白 UI contract — 不連資料庫。
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

describe("黑白 UI", () => {
  it("HQ 分區色沒有彩色 class", () => {
    for (const tone of SECTION_TONES) {
      const joined = Object.values(sectionToneStyles[tone]).join(" ");
      assert.equal(
        CHROMATIC_CLASS.test(joined),
        false,
        `${tone} still uses a chromatic Tailwind class: ${joined}`,
      );
    }
  });

  it("CSS 變數都是無彩度", () => {
    const css = readRepoFile("app/globals.css");
    const matches = [...css.matchAll(/--([a-z-]+):\s*\d+\s+(\d+)%/g)];
    assert.ok(matches.length > 8, "expected HSL CSS variables");
    for (const match of matches) {
      assert.equal(match[2], "0", `--${match[1]} saturation should be 0`);
    }
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

  it("登入頁不再用分色文案，theme color 是黑", () => {
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

  it("換罐工作區使用單一黑白任務台與平面清單", () => {
    const refill = readRepoFile("components/pos/refill-workspace.tsx");
    assert.match(refill, /border-2 border-zinc-900/);
    assert.match(refill, /shadow-\[8px_8px_0_#171717\]/);
    assert.match(refill, /divide-y divide-neutral-200/);
    assert.equal(refill.includes("shadow-sm"), false);
  });
});
