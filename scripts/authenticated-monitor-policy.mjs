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

/** @param {{url: string, method: string, resourceType: string, headers?: Record<string, string>, body?: string|null, origin: string, role: string, loginOpen?: boolean, loginUsed?: boolean, actionIds: Set<string>}} input */
export function requestDecision({ url, method, resourceType, headers = {}, body = null, origin, role, loginOpen = false, loginUsed = false, actionIds }) {
  let target;
  try { target = new URL(url); } catch { return 'deny'; }
  if (target.username || target.password) return 'deny';
  if (target.origin !== origin) {
    // Still abort excluded images/fonts before transmission; omission is not a
    // functional failure. External scripts, data requests and all writes deny.
    return method === 'GET' && ['image', 'font'].includes(resourceType) ? 'omit-asset' : 'deny';
  }
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

/** @param {{url: string, method: string, resourceType: string, origin: string, role: string}} input */
export function describeMonitorRequest({ url, method, resourceType, origin, role }) {
  let target;
  try { target = new URL(url); } catch { /* describe malformed input without echoing it */ }
  const sameOrigin = target?.origin === origin;
  const paths = role === 'hq' ? hqPaths : posPaths;
  return {
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER',
    resourceType: ['document', 'script', 'stylesheet', 'image', 'font', 'xhr', 'fetch', 'media', 'manifest', 'websocket', 'eventsource', 'texttrack'].includes(resourceType) ? resourceType : 'other',
    destination: sameOrigin ? 'same-origin' : 'other-origin',
    route: sameOrigin && paths.includes(target.pathname) ? target.pathname : 'unlisted',
  };
}
