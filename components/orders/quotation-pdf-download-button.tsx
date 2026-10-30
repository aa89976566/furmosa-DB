'use client';

import { useEffect } from 'react';
import { Download } from 'lucide-react';

export function QuotationPdfDownloadButton({ autoStart = false }: { autoStart?: boolean }) {
  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoStart]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 print:hidden"
    >
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      儲存為 PDF
    </button>
  );
}
