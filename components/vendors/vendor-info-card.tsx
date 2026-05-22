'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Building2, ChevronDown } from 'lucide-react';

type VendorInfo = {
  id: string;
  vendorId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerms: string | null;
  notes: string | null;
  status: string;
};

export function VendorInfoCard({ vendor }: { vendor: VendorInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-muted/30"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{vendor.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{vendor.vendorId}</span>
              <Badge variant={vendor.status === 'active' ? 'success' : 'muted'}>
                {vendor.status === 'active' ? '啟用' : '停用'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[vendor.contactName, vendor.phone, vendor.email].filter(Boolean).join(' · ') || '尚無聯絡資料'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div className="border-t bg-muted/10 px-4 py-4">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="聯絡人" value={vendor.contactName ?? '-'} />
            <DetailRow label="電話" value={vendor.phone ?? '-'} />
            <DetailRow label="Email" value={vendor.email ?? '-'} />
            <DetailRow label="地址" value={vendor.address ?? '-'} />
            <DetailRow label="付款條件" value={vendor.paymentTerms ?? '-'} />
            <DetailRow label="狀態" value={vendor.status === 'active' ? '啟用' : '停用'} />
          </dl>
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">備註</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {vendor.notes?.trim() ? vendor.notes : '尚無備註'}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button asChild size="sm" variant="outline">
              <Link href={`/vendors/${vendor.id}`}>開啟廠商完整頁面</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium break-words [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
