export function nextMerchantBusinessId(ids: string[]): string {
  const max = ids.reduce((current, id) => {
    const match = /^MER-(\d+)$/.exec(id.trim());
    if (!match) return current;
    const value = Number(match[1]);
    return Number.isSafeInteger(value) ? Math.max(current, value) : current;
  }, 0);

  return `MER-${String(max + 1).padStart(4, '0')}`;
}

export function isValidMerchantBusinessId(id: string): boolean {
  return /^MER-\d{4,}$/.test(id.trim());
}
