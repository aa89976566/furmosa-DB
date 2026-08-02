/** 側欄連結是否為目前頁（支援 ?tab= 等 query） */
export function isNavItemActive(
  pathname: string,
  searchParams: URLSearchParams,
  href: string,
): boolean {
  if (href === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  const qIdx = href.indexOf('?');
  const path = qIdx >= 0 ? href.slice(0, qIdx) : href;
  // 換罐計劃總覽：只匹配精確路徑，避免吃掉 /jar-exchange/members 等子頁
  if (path === '/jar-exchange') {
    return pathname === '/jar-exchange';
  }
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (qIdx < 0) return true;

  const expected = new URLSearchParams(href.slice(qIdx + 1));
  if (path === '/jar-exchange/manage') {
    const currentTab = searchParams.get('tab') ?? 'codes';
    const expectedTab = expected.get('tab') ?? 'codes';
    return currentTab === expectedTab;
  }

  for (const [key, val] of expected.entries()) {
    if (searchParams.get(key) !== val) return false;
  }
  return true;
}
