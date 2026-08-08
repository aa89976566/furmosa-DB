/**
 * 暱稱驗證／清理／安全顯示（復用 Customer.name，不另建 preferredName）
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_TAG = /<[^>]*>/g;
const SCRIPTISH = /javascript:|data:text\/html|on\w+\s*=/gi;

export type NameValidation =
  | { ok: true; cleaned: string; safeDisplay: string }
  | { ok: false; error: string };

/** 清理暱稱：去 HTML／控制字元，限制長度 */
export function sanitizeDisplayName(raw: string): string {
  return raw
    .replace(HTML_TAG, '')
    .replace(SCRIPTISH, '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** 安全顯示：再跳脫可能被當 HTML 插入的字元（LINE 文字氣泡本身不渲染 HTML，但 admin 預覽會） */
export function escapeForSafeDisplay(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateAndCleanName(raw: string): NameValidation {
  const cleaned = sanitizeDisplayName(raw);
  if (!cleaned || cleaned.length < 1) {
    return { ok: false, error: '暱稱請填 1–80 字。' };
  }
  if (cleaned.length > 80) {
    return { ok: false, error: '暱稱請填 1–80 字。' };
  }
  // 全是符號／空白類
  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    return { ok: false, error: '暱稱請包含至少一個字或數字喔。' };
  }
  return {
    ok: true,
    cleaned,
    safeDisplay: escapeForSafeDisplay(cleaned),
  };
}

export function hasUsableCustomerName(name: string | null | undefined): boolean {
  if (!name) return false;
  return validateAndCleanName(name).ok;
}
