'use client';

import { useEffect } from 'react';

const DRAFT_KEY = 'furmosa_pos_restock_draft_v1';

/** Clears unsaved form draft after a successful submit. */
export function ClearDraftOnSuccess() {
  useEffect(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
