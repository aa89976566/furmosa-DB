'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  GROOMING_ENTRY_BODY,
  GROOMING_ENTRY_CTA,
  GROOMING_ENTRY_HINT,
  GROOMING_ENTRY_TITLE,
  GROOMING_PREVIEW_HREF,
} from '@/lib/merchant-pos-preview/copy';
import { SettlementPanel } from './settlement-panel';

export function MorePanel() {
  return (
    <section aria-labelledby="more-title" className="min-w-0 space-y-6">
      <div>
        <h2 id="more-title" className="text-xl font-semibold text-navy">
          更多
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">美容服務券與結算摘要都在這裡。</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-lg font-semibold text-navy">{GROOMING_ENTRY_TITLE}</h3>
          <p className="text-sm text-muted-foreground">{GROOMING_ENTRY_BODY}</p>
          <p className="text-sm text-muted-foreground">{GROOMING_ENTRY_HINT}</p>
          <Button asChild className="min-h-[44px] w-full">
            <Link href={GROOMING_PREVIEW_HREF}>{GROOMING_ENTRY_CTA}</Link>
          </Button>
        </CardContent>
      </Card>

      <SettlementPanel />
    </section>
  );
}
