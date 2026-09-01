'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addRestockCartLine,
  removeRestockCartLine,
  restockCartTotalPieces,
  setRestockCartQty,
  type RestockCartLine,
} from '@/lib/pos/restock-cart';

const STORAGE_KEY = 'furmosa-pos-restock-cart-v1';

type RestockCartContextValue = {
  lines: RestockCartLine[];
  itemCount: number;
  pieceCount: number;
  add: (line: Omit<RestockCartLine, 'quantity'> & { quantity: number }) => void;
  setQty: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const RestockCartContext = createContext<RestockCartContextValue | null>(null);

function readStoredCart(): RestockCartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RestockCartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line) => line?.productId && line.quantity > 0);
  } catch {
    return [];
  }
}

export function RestockCartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<RestockCartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStoredCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const add = useCallback((line: Omit<RestockCartLine, 'quantity'> & { quantity: number }) => {
    setLines((prev) => addRestockCartLine(prev, line));
  }, []);
  const setQty = useCallback((productId: string, quantity: number) => {
    setLines((prev) => setRestockCartQty(prev, productId, quantity));
  }, []);
  const remove = useCallback((productId: string) => {
    setLines((prev) => removeRestockCartLine(prev, productId));
  }, []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      itemCount: lines.length,
      pieceCount: restockCartTotalPieces(lines),
      add,
      setQty,
      remove,
      clear,
    }),
    [add, clear, lines, remove, setQty],
  );

  return <RestockCartContext.Provider value={value}>{children}</RestockCartContext.Provider>;
}

export function useRestockCart() {
  const ctx = useContext(RestockCartContext);
  if (!ctx) throw new Error('useRestockCart must be inside RestockCartProvider');
  return ctx;
}

/** 導航列可選用；沒有補貨車時顯示 0，不強迫每頁都包 Provider。 */
export function useOptionalRestockCartItemCount(): number {
  return useContext(RestockCartContext)?.itemCount ?? 0;
}
