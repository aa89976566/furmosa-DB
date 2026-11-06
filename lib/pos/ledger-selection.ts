/** Keep the detail panel within the rows the merchant can currently see. */
export function selectVisibleLedgerEntry<T extends { id: string }>(
  rows: T[],
  selectedId: string | null,
): T | null {
  return rows.find((entry) => entry.id === selectedId) ?? rows[0] ?? null;
}
