'use client';
import { useEffect } from 'react';
import { clearRestockDrafts } from '@/lib/pos/restock-draft';

export function ClearRestockDrafts() {
  useEffect(() => { clearRestockDrafts(window.sessionStorage); }, []);
  return null;
}
