import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkLocalDbUrl } from "@/lib/local-db-url";

/**
 * 確認目前環境連的是本機 Postgres（127.0.0.1 / localhost，埠 5432 或 55432）。
 * 正式 / Preview / Supabase 網址一律拒絕。不印出連線字串。
 */

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filename: string): Record<string, string> {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    out[key] = stripQuotes(trimmed.slice(eq + 1).trim());
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
};

function readUrl(name: "DATABASE_URL" | "DIRECT_URL"): string | undefined {
  return fileEnv[name] || process.env[name];
}

function assertLocal(name: "DATABASE_URL" | "DIRECT_URL") {
  const result = checkLocalDbUrl(readUrl(name));
  if (result.ok) return;
  if (result.reason === "missing") {
    fail(`${name} 未設定。請在本機 .env.local 填本機 Postgres 網址。`);
  }
  if (result.reason === "cloud") {
    fail(`${name} 指向雲端資料庫。已停止，以免碰到正式資料。`);
  }
  if (result.reason === "not_local_host") {
    fail(`${name} 不是本機。本機測試只能用 127.0.0.1 或 localhost。`);
  }
  if (result.reason === "wrong_port") {
    fail(`${name} 埠號不是 5432 或 55432。本機測試只能用這兩個埠。`);
  }
  fail(`${name} 不是合法網址。`);
}

assertLocal("DATABASE_URL");
assertLocal("DIRECT_URL");
console.log("本機資料庫網址檢查通過。");
