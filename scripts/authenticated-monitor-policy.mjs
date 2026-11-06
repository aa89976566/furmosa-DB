// This is a browser-side safety boundary, not a replacement for server auth.
export const hqPaths = ['/login', '/dashboard', '/orders', '/reviews', '/products', '/inventory', '/restock-requests'];
export const posPaths = ['/pos/login', '/pos', '/pos/sell', '/pos/stock', '/pos/refill', '/pos/settle', '/pos/restock', '/pos/records'];
const readActions = new Set(['loadRecentNotifications', 'loadUnreadNotifications']);

// Next's production client references include the exported action name. Only
// these two reviewed, no-argument reads may pass the POST boundary. Unknown
// bundles/action formats fail closed; never infer safety from a POST URL.
export function collectReadActionIds(source) {
  const ids = new Set();
  const pattern = /createServerReference\)\("([a-f0-9]{40,64})",[^;\n]{0,250}?,"(loadRecentNotifications|loadUnreadNotifications)"\)/g;
  for (const match of source.matchAll(pattern)) {
    if (readActions.has(match[2])) ids.add(match[1]);
  }
  return ids;
}

export function requestDecision({ url, method, resourceType, headers = {}, body, origin, role, loginOpen, loginUsed, actionIds }) {
  let target;
  try { target = new URL(url); } catch { return 'deny'; }
  if (target.origin !== origin || target.username || target.password) return 'deny';
  const paths = role === 'hq' ? hqPaths : posPaths;
  const path = target.pathname;
  if (method === 'GET') {
    if (headers['next-router-prefetch'] === '1' || headers.purpose === 'prefetch') return 'omit-asset';
    if (paths.includes(path)) return 'read';
    if (path.startsWith('/_next/static/') && ['script', 'stylesheet', 'font'].includes(resourceType)) return 'asset';
    // Images are deliberately omitted: they may point to customer data or
    // external hosts. Their appearance is not part of this monitor's coverage.
    return resourceType === 'image' || resourceType === 'font' ? 'omit-asset' : 'deny';
  }
  const loginPath = role === 'hq' ? '/login' : '/pos/login';
  if (method === 'POST' && loginOpen && !loginUsed && path === loginPath && !target.search) return 'login';
  if (method === 'POST' && role === 'pos' && posPaths.includes(path) && path !== loginPath &&
      actionIds.has(headers['next-action']) && body === '[]') return 'read-action';
  return 'deny';
}
