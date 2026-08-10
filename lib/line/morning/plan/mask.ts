/** 管理 API／HQ：永遠遮罩 LINE user id */

export function maskLineUserId(lineUserId: string): string {
  const id = lineUserId.trim();
  if (id.length <= 6) return 'U***';
  return `${id.slice(0, 3)}…${id.slice(-4)}`;
}
