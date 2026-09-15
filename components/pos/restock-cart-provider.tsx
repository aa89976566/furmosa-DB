'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addRestockCartLine,
  removeRestockCartLine,
  restockCartTotalPieces,
  setRestockCartQty,
  type RestockCartLine,
} from '@/lib/pos/restock-cart';

import { readRestockDraft, writeRestockDraft } from '@/lib/pos/restock-draft';

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

export function RestockCartProvider({ merchantId, children }: { merchantId: string; children: React.ReactNode }) {
  return <ScopedRestockCart key={merchantId} merchantId={merchantId}>{children}</ScopedRestockCart>;
}

function ScopedRestockCart({ merchantId, children }: { merchantId: string; children: React.ReactNode }) {
  const [lines, setLines] = useState<RestockCartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readRestockDraft(window.sessionStorage, merchantId));
    setReady(true);
  }, [merchantId]);

  useEffect(() => {
    if (!ready) return;
    writeRestockDraft(window.sessionStorage, merchantId, lines);
  }, [lines, ready, merchantId]);

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
