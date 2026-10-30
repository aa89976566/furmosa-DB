'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyDeliveryButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copy} className="h-auto px-2 py-1 font-semibold text-primary">
      {copied ? '已複製' : '複製'}
    </Button>
  );
}
