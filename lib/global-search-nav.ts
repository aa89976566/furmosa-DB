/**
 * 全站頂欄搜尋導向。
 * 只在「真的會吃 ?q=」的列表頁就地更新；子頁（新增／詳情／編輯）一律導回對應列表。
 */

export type GlobalSearchListPath =
  | '/products'
  | '/orders'
  | '/customers'
  | '/merchants'
  | '/shipments'
  | '/subscriptions'
  | '/jar-exchange/members'
  | '/jar-exchange/manage';

const LIST_PATHS: GlobalSearchListPath[] = [
  '/jar-exchange/members',
  '/jar-exchange/manage',
  '/products',
  '/orders',
  '/customers',
  '/merchants',
  '/shipments',
  '/subscriptions',
];

/** 依目前路徑決定搜尋結果應落在哪個列表 */
export function resolveGlobalSearchListPath(pathname: string): GlobalSearchListPath {
  if (
    pathname === '/jar-exchange/members' ||
    pathname.startsWith('/jar-exchange/members/')
  ) {
    return '/jar-exchange/members';
  }
  if (
    pathname === '/jar-exchange/manage' ||
    pathname.startsWith('/jar-exchange/manage/')
  ) {
    return '/jar-exchange/manage';
  }
  if (pathname.startsWith('/jar-exchange')) {
    return '/jar-exchange/members';
  }
  if (pathname === '/products' || pathname.startsWith('/products/')) {
    return '/products';
  }
  if (pathname === '/orders' || pathname.startsWith('/orders/')) {
    return '/orders';
  }
  if (pathname === '/customers' || pathname.startsWith('/customers/')) {
    return '/customers';
  }
  if (pathname === '/merchants' || pathname.startsWith('/merchants/')) {
    return '/merchants';
  }
  if (pathname === '/shipments' || pathname.startsWith('/shipments/')) {
    return '/shipments';
  }
  if (pathname === '/subscriptions' || pathname.startsWith('/subscriptions/')) {
    return '/subscriptions';
  }
  // 廠商列表本身不吃 q；改搜商品（含廠商名稱）
  if (pathname === '/vendors' || pathname.startsWith('/vendors/')) {
    return '/products';
  }
  return '/orders';
}

export function isGlobalSearchListPath(pathname: string): boolean {
  return (LIST_PATHS as string[]).includes(pathname);
}

/**
 * 算出下一步 URL。回傳 null 表示與現況相同、不必導航。
 */
export function resolveGlobalSearchHref(
  pathname: string,
  currentSearch: string,
  rawQuery: string,
): string | null {
  const trimmed = rawQuery.trim();
  const listPath = resolveGlobalSearchListPath(pathname);
  const onList = pathname === listPath;
  const current =
    currentSearch && currentSearch !== ''
      ? `${pathname}?${currentSearch.replace(/^\?/, '')}`
      : pathname;

  if (!onList) {
    if (!trimmed) return null;
    return `${listPath}?q=${encodeURIComponent(trimmed)}`;
  }

  const params = new URLSearchParams(currentSearch.replace(/^\?/, ''));
  if (trimmed) params.set('q', trimmed);
  else params.delete('q');
  // 換關鍵字時回到第一頁，避免停在空的 page=N
  params.delete('page');

  const query = params.toString();
  const next = query ? `${listPath}?${query}` : listPath;
  return next === current ? null : next;
}
