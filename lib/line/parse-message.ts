import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';

export type ParsedLineText =
  | { kind: 'jar_code'; code: string }
  | { kind: 'bind'; identifier: string }
  | { kind: 'balance' }
  | { kind: 'help' }
  | { kind: 'unknown'; text: string };

const BIND_RE = /^(?:綁定|绑定|bind)\s*[：:\s]?\s*(.+)$/i;
const BALANCE_RE = /^(?:點數|点数|餘額|余额|balance|查點數)$/i;
const HELP_RE = /^(?:說明|帮助|help|\?|？)$/i;

export function parseLineUserText(raw: string): ParsedLineText {
  const text = raw.trim();
  if (!text) return { kind: 'unknown', text: '' };

  const bind = text.match(BIND_RE);
  if (bind?.[1]) {
    return { kind: 'bind', identifier: bind[1].trim() };
  }

  if (BALANCE_RE.test(text)) return { kind: 'balance' };
  if (HELP_RE.test(text)) return { kind: 'help' };

  const code = normalizeJarCode(text);
  if (code && isValidJarCodeFormat(code)) {
    return { kind: 'jar_code', code };
  }

  return { kind: 'unknown', text };
}

export const LINE_HELP_TEXT = `【匠寵換罐 LINE 服務】

1️⃣ 首次使用請先綁定會員：
綁定 CUST-0001
或：綁定 0912345678

2️⃣ 返航序號（8 位數字）直接傳送即可兌換點數

3️⃣ 查詢點數：傳「點數」

綁定後後台可依您的 LINE ID 對應會員資料。`;
