import type { Store } from './store-search';

export type SearchState = {
  request: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  stores: Store[];
  selected: Store | null;
  message: string;
};
export const initialSearchState: SearchState = { request: 0, status: 'idle', stores: [], selected: null, message: '' };
export type SearchAction =
  | { type: 'reset' | 'start'; request: number }
  | { type: 'result'; request: number; stores: Store[] }
  | { type: 'error'; request: number; message: string }
  | { type: 'select'; id: string };

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  if (action.type === 'select') {
    return state.status === 'ready' ? { ...state, selected: state.stores.find(s => s.id === action.id) ?? null } : state;
  }
  if (action.type === 'reset' || action.type === 'start') {
    return { ...initialSearchState, request: action.request, status: action.type === 'start' ? 'loading' : 'idle' };
  }
  if (action.request !== state.request) return state;
  if (action.type === 'error') return { ...state, status: 'error', stores: [], selected: null, message: action.message };
  if (action.type === 'result') return { ...state, status: 'ready', stores: action.stores, selected: null, message: '' };
  return state;
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
