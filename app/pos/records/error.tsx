'use client';

import { useEffect } from 'react';
import { QueryBoard } from '@/components/pos/query-board';
import { RecordsPageFrame } from '@/components/pos/records-page-frame';

export default function PosRecordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pos/records]', error);
  }, [error]);

  return (
    <RecordsPageFrame>
      <QueryBoard items={[]} state="error" onRetry={reset} />
    </RecordsPageFrame>
  );
}
