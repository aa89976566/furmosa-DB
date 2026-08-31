import type { Store } from './store-search';

export type SearchState = {
  request: number;
  status: 'idle' | 'loading' | 'ready' | 'verifying' | 'error';
  pendingId: string | null;
  stores: Store[];
  selected: Store | null;
  message: string;
};
export const initialSearchState: SearchState = { request: 0, status: 'idle', pendingId: null, stores: [], selected: null, message: '' };
export type SearchAction =
  | { type: 'reset' | 'start'; request: number }
  | { type: 'result'; request: number; stores: Store[] }
  | { type: 'error'; request: number; message: string }
  | { type: 'verify'; request: number; id: string }
  | { type: 'verified'; request: number; store: Store };

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  if (action.type === 'verify') {
    return (state.status === 'ready' || state.status === 'verifying') && state.stores.some(s => s.id === action.id)
      ? { ...state, request: action.request, status: 'verifying', selected: null, pendingId: action.id, message: '' } : state;
  }
  if (action.type === 'reset' || action.type === 'start') {
    return { ...initialSearchState, request: action.request, status: action.type === 'start' ? 'loading' : 'idle' };
  }
  if (action.request !== state.request) return state;
  if (action.type === 'error') return { ...state, status: 'error', stores: [], selected: null, pendingId: null, message: action.message };
  if (action.type === 'verified') {
    if (state.status !== 'verifying' || state.pendingId !== action.store.id) return state;
    return { ...state, status: 'ready', pendingId: null, selected: action.store,
      stores: state.stores.map(s => s.id === action.store.id ? action.store : s) };
  }
  if (action.type === 'result') return { ...state, status: 'ready', stores: action.stores, selected: null, message: '' };
  return state;
}

export function readSelectionResponse(status: number, body: unknown, expectedId: string): Store {
  if (status === 409) throw new Error('這間門市目前無法選取，請重新搜尋。');
  if (status !== 200) readSearchResponse(status, null);
  const store = readSearchResponse(200, { stores: [(body as { store?: unknown } | null)?.store] })[0];
  if (store.id !== expectedId) throw new Error('門市資料不一致，請重新搜尋。');
  return store;
}

// The preview only accepts validated ambient results; never substitute sample stores.
export function readSearchResponse(status: number, body: unknown): Store[] {
  if (status === 401) throw new Error('登入已逾時，請重新登入 HQ 後再試。');
  if (status !== 200) throw new Error('門市資料目前無法查詢，請確認測試設定後再試。');
  const stores = (body as { stores?: unknown } | null)?.stores;
  if (!Array.isArray(stores) || stores.length > 20) throw new Error('門市資料格式不完整，請稍後再試。');
  const ids = new Set<string>();
  return stores.map((store: unknown) => {
    const s = store as Partial<Store> | null;
    if (!s || typeof s.id !== 'string' || !/^[A-Za-z0-9]{1,10}$/.test(s.id) || ids.has(s.id) ||
        typeof s.name !== 'string' || !s.name.trim() || s.name.length > 40 ||
        typeof s.address !== 'string' || !s.address.trim() || s.address.length > 100 || s.serviceType !== 'UNIMART') {
      throw new Error('門市資料格式不完整，請稍後再試。');
    }
    ids.add(s.id);
    return { id: s.id, name: s.name, address: s.address, serviceType: s.serviceType };
  });
}
