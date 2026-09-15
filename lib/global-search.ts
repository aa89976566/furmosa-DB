export const GLOBAL_SEARCH_MAX_LENGTH = 80;

export function normalizeGlobalSearchQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').trim().slice(0, GLOBAL_SEARCH_MAX_LENGTH);
}

export type SearchSectionState<T> =
  | { status: 'ok'; items: T[] }
  | { status: 'error'; items: [] };

/** 單一分類失敗時保留其他搜尋結果，並只記錄不含搜尋內容的診斷資訊。 */
export async function loadSearchSection<T>(
  section: string,
  load: () => Promise<T[]>,
  report: (section: string, errorName: string, errorCode?: string) => void = (name, errorName, errorCode) => {
    console.error('[global-search]', { section: name, errorName, errorCode });
  },
): Promise<SearchSectionState<T>> {
  try {
    return { status: 'ok', items: await load() };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '') || undefined
      : undefined;
    report(section, errorName, code);
    return { status: 'error', items: [] };
  }
}
