'use client';

import { useState } from 'react';

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const empty = !value.trim();

  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <button
          type="button"
          className="text-xs underline disabled:no-underline disabled:opacity-50"
          disabled={empty}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? '已複製' : '複製'}
        </button>
      </div>
      <p className="mt-1 break-words text-sm">{empty ? '待補' : value}</p>
    </div>
  );
}
