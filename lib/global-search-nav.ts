/** 全站頂欄搜尋一律導向分類結果頁，避免依所在頁面漏掉其他資料類型。 */

export type GlobalSearchListPath = '/search';

export function resolveGlobalSearchListPath(pathname: string): GlobalSearchListPath {
  void pathname;
  return '/search';
}

export function isGlobalSearchListPath(pathname: string): boolean {
  return pathname === '/search';
}

/** 算出下一步 URL。回傳 null 表示與現況相同、不必導航。 */
export function resolveGlobalSearchHref(
  pathname: string,
  currentSearch: string,
  rawQuery: string,
): string | null {
  const trimmed = rawQuery.trim();
  const listPath = resolveGlobalSearchListPath(pathname);
  const onList = pathname === listPath;
  const current = currentSearch
    ? `${pathname}?${currentSearch.replace(/^\?/, '')}`
    : pathname;

  if (!onList && !trimmed) return null;

  const params = onList
    ? new URLSearchParams(currentSearch.replace(/^\?/, ''))
    : new URLSearchParams();
  if (trimmed) params.set('q', trimmed);
  else params.delete('q');
  params.delete('page');

  const query = params.toString();
  const next = query ? `${listPath}?${query}` : listPath;
  return next === current ? null : next;
}
