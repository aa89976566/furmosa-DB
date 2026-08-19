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

export type DialogFocusSnapshot = {
  open: boolean;
  titleId: string;
  triggerHeld: boolean;
};

export type DialogFocusPlan = {
  captureTrigger: boolean;
  restoreTrigger: boolean;
  moveFocusToStep: boolean;
  triggerHeld: boolean;
};

export function nextDialogFocusPlan(
  prev: DialogFocusSnapshot,
  next: Pick<DialogFocusSnapshot, 'open' | 'titleId'>,
): DialogFocusPlan {
  const opening = !prev.open && next.open;
  const closing = prev.open && !next.open;
  const stepChange = prev.open && next.open && prev.titleId !== next.titleId;

  return {
    captureTrigger: opening,
    restoreTrigger: closing && prev.triggerHeld,
    moveFocusToStep: opening || stepChange,
    triggerHeld: opening ? true : closing ? false : prev.triggerHeld,
  };
}
