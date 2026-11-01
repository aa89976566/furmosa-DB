type RestockSelectable = {
  id: string;
  restockProgress?: unknown;
};

export function selectVisibleRestockProgress<T extends RestockSelectable>(
  visibleItems: T[],
  selectedId: string,
): T | null {
  return visibleItems.find((item) => item.id === selectedId && item.restockProgress)
    ?? visibleItems.find((item) => item.restockProgress)
    ?? null;
}
