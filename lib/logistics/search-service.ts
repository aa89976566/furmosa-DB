import { resolveStore, searchStores, type Directory, type Store } from './store-search';

/** Instance-local cache for an authenticated preview, not a production distributed cache. */
export function createSearchService(deps: {
  load: (service: Store['serviceType']) => Promise<Directory>;
  now: () => number;
  enabled: () => boolean;
  frozenConfirmed: () => boolean;
}) {
  const cache = new Map<Store['serviceType'], Directory>();
  const pending = new Map<Store['serviceType'], Promise<Directory>>();
  const retryAfter = new Map<Store['serviceType'], number>();
  return async function search(authenticated: boolean, query: string, temperature: string, storeId?: string) {
    if (!authenticated) return { status: 401, body: { error: '請先登入 HQ' } };
    if (!deps.enabled()) return { status: 503, body: { error: '門市搜尋測試尚未啟用' } };
    if (!['ambient', 'frozen'].includes(temperature) || query.length > 80) {
      return { status: 400, body: { error: '請確認搜尋條件' } };
    }
    if (storeId !== undefined && !/^[A-Za-z0-9]{1,10}$/.test(storeId)) {
      return { status: 400, body: { error: '請重新選擇門市' } };
    }
    if (temperature === 'frozen' && !deps.frozenConfirmed()) {
      return { status: 503, body: { error: '冷凍取貨服務尚待確認' } };
    }
    if (storeId === undefined && query.trim().length < 2) return { status: 200, body: { stores: [] } };
    const service = temperature === 'frozen' ? 'UNIMARTFREEZE' : 'UNIMART';
    try {
      let directory = cache.get(service);
      const now = deps.now();
      if (!directory || now < directory.fetchedAt || now - directory.fetchedAt >= 60 * 60 * 1000) {
        if ((retryAfter.get(service) ?? 0) > now) throw new Error();
        let loading = pending.get(service);
        if (!loading) {
          loading = Promise.resolve().then(() => deps.load(service)).then(value => {
            if (!value.stores.length || !Number.isFinite(value.fetchedAt) || value.fetchedAt > deps.now() || deps.now() - value.fetchedAt >= 60 * 60 * 1000) throw new Error();
            cache.set(service, value); retryAfter.delete(service); return value;
          }).catch(() => {
            retryAfter.set(service, deps.now() + 30000); throw new Error();
          }).finally(() => pending.delete(service));
          pending.set(service, loading);
        }
        directory = await loading;
      }
      if (storeId !== undefined) {
        const store = resolveStore(directory, storeId, {
          temperature: temperature as 'ambient' | 'frozen', now: deps.now(), frozenServiceConfirmed: deps.frozenConfirmed(),
        });
        return store
          ? { status: 200, body: { store, fetchedAt: directory.fetchedAt } }
          : { status: 409, body: { error: '這間門市目前無法選取，請重新搜尋。' } };
      }
      return { status: 200, body: { stores: searchStores(directory, query, {
        temperature: temperature as 'ambient' | 'frozen', now: deps.now(), frozenServiceConfirmed: deps.frozenConfirmed(),
      }), fetchedAt: directory.fetchedAt } };
    } catch {
      return { status: 503, body: { error: '門市資料暫時無法查詢，請稍後再試' } };
    }
  };
}
