/**
 * 清單／UI 用遮罩：Ueb6e…f9fd（保留前 5、後 4）
 * 過短字串整段以「…」代替，避免露出完整 userId。
 */
export function maskLineUserId(lineUserId: string): string {
  const id = lineUserId.trim();
  if (!id) return '—';
  if (id.length <= 9) return `${id.slice(0, 1)}…`;
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}

export const LINE_DISPLAY_NAME_FALLBACK = '尚未取得 LINE 名稱';

export function resolveLineDisplayName(
  displayName: string | null | undefined,
): string {
  const name = displayName?.trim();
  return name ? name : LINE_DISPLAY_NAME_FALLBACK;
}
