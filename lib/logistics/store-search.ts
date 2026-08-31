/** Pure search only: no credentials, network calls, orders, or database writes. */
export type Store = {
  id: string;
  name: string;
  address: string;
  serviceType: 'UNIMART' | 'UNIMARTFREEZE';
};
export type Directory = { stores: Store[]; fetchedAt: number };
/** Resolve only from the server directory; never accept the client's name/address. */
export function resolveStore(directory: Directory, id: string, options: {
  temperature: 'ambient' | 'frozen'; now: number; frozenServiceConfirmed: boolean;
}): Store | null {
  if (!/^[A-Za-z0-9]{1,10}$/.test(id)) throw new Error('門市代碼格式錯誤');
  if (!Number.isFinite(directory.fetchedAt) || !Number.isFinite(options.now) ||
      directory.fetchedAt > options.now || options.now - directory.fetchedAt >= 60 * 60 * 1000) {
    throw new Error('門市資料待更新');
  }
  if (options.temperature === 'frozen' && !options.frozenServiceConfirmed) throw new Error('冷凍取貨服務尚未確認');
  const service = options.temperature === 'frozen' ? 'UNIMARTFREEZE' : 'UNIMART';
  const matches = directory.stores.filter(store => store.id === id && store.serviceType === service);
  if (matches.length > 1) throw new Error('門市資料不一致');
  return matches.length === 1 ? { ...matches[0] } : null;
}
export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').replace(/臺/g, '台').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function parseStoreList(payload: unknown, serviceType: Store['serviceType']): Store[] {
  if (!payload || typeof payload !== 'object') throw new Error('門市資料格式錯誤');
  const data = payload as Record<string, unknown>;
  if (data.RtnCode !== 1 || !Array.isArray(data.StoreList)) throw new Error('門市清單取得失敗');
  const stores: Store[] = [];
  const seen = new Map<string, Store>();
  for (const group of data.StoreList) {
    if (!group || group.CvsType !== serviceType) continue;
    if (!Array.isArray(group.StoreInfo)) throw new Error('門市資料格式錯誤');
    for (const row of group.StoreInfo) {
      if (!row || typeof row !== 'object') throw new Error('門市資料格式錯誤');
      const id = row.StoreId, name = row.StoreName, address = row.StoreAddr;
      if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,10}$/.test(id) ||
          typeof name !== 'string' || !name.trim() || name.length > 40 ||
          typeof address !== 'string' || !address.trim() || address.length > 100) {
        throw new Error('門市資料不完整');
      }
      const store = { id, name: name.trim(), address: address.trim(), serviceType };
      const previous = seen.get(id);
      if (previous && (previous.name !== store.name || previous.address !== store.address)) {
        throw new Error('門市代碼重複且資料不一致');
      }
      if (!previous) { seen.set(id, store); stores.push(store); }
    }
  }
  return stores;
}
export function searchStores(directory: Directory, query: string, options: {
  temperature: 'ambient' | 'frozen';
  now: number;
  /** Must be verified for the merchant's actual fulfillment service, not inferred from an API label. */
  frozenServiceConfirmed: boolean;
}): Store[] {
  if (!Number.isFinite(directory.fetchedAt) || !Number.isFinite(options.now) ||
      directory.fetchedAt > options.now || options.now - directory.fetchedAt > 24 * 60 * 60 * 1000) {
    throw new Error('門市資料待更新');
  }
  if (options.temperature === 'frozen' && !options.frozenServiceConfirmed) throw new Error('冷凍取貨服務尚未確認');
  const normalized = normalizeSearch(query);
  if (normalized.length > 80) throw new Error('搜尋內容過長');
  if (normalized.length < 2) return [];
  const terms = normalized.split(' ');
  const service = options.temperature === 'frozen' ? 'UNIMARTFREEZE' : 'UNIMART';
  return directory.stores.filter(store => {
    if (store.serviceType !== service) return false;
    const haystack = normalizeSearch(store.name + ' ' + store.address);
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 20);
}
