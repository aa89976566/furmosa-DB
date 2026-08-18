export function isEscapeKey(key: string): boolean {
  return key === 'Escape';
}

export function nextTabIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return 0;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift) return (current - 1 + count) % count;
  return (current + 1) % count;
}

export function canRestoreDialogTrigger(
  trigger: { isConnected?: boolean } | null | undefined,
): boolean {
  return Boolean(trigger && trigger.isConnected);
}
