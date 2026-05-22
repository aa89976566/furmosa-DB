'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VendorDetailPanel } from '@/components/vendors/vendor-detail-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export type VendorListRow = {
  id: string;
  vendorId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  paymentTerms: string | null;
  productCount: number;
  status: string;
};

export function VendorListWorkspace({
  vendors,
  initialVendorId,
}: {
  vendors: VendorListRow[];
  initialVendorId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailRef = useRef<HTMLDivElement>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(
    initialVendorId ?? searchParams.get('v'),
  );

  const vendorIndex = useMemo(() => {
    const map = new Map<string, VendorListRow>();
    for (const vendor of vendors) {
      map.set(vendor.id, vendor);
    }
    return map;
  }, [vendors]);

  const selectedVendor = selectedVendorId ? vendorIndex.get(selectedVendorId) : undefined;

  const buildVendorUrl = useCallback(
    (vendorId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (vendorId) params.set('v', vendorId);
      else params.delete('v');
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const openVendor = useCallback(
    (vendor: VendorListRow) => {
      setSelectedVendorId(vendor.id);
      router.replace(buildVendorUrl(vendor.id), { scroll: false });
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [buildVendorUrl, router],
  );

  const closeDetail = useCallback(() => {
    setSelectedVendorId(null);
    router.replace(buildVendorUrl(null), { scroll: false });
  }, [buildVendorUrl, router]);

  useEffect(() => {
    setSelectedVendorId(searchParams.get('v'));
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>廠商編號</TableHead>
            <TableHead>名稱</TableHead>
            <TableHead>聯絡人</TableHead>
            <TableHead>電話</TableHead>
            <TableHead>付款條件</TableHead>
            <TableHead className="text-right">商品數</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => {
            const selected = vendor.id === selectedVendorId;
            return (
              <TableRow
                key={vendor.id}
                data-state={selected ? 'selected' : undefined}
                className={cn(
                  'cursor-pointer',
                  selected && 'bg-primary/5 hover:bg-primary/10',
                )}
                onClick={() => openVendor(vendor)}
              >
                <TableCell className="font-mono text-xs">{vendor.vendorId}</TableCell>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>{vendor.contactName ?? '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{vendor.phone ?? '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {vendor.paymentTerms ?? '-'}
                </TableCell>
                <TableCell className="text-right">{vendor.productCount}</TableCell>
                <TableCell>
                  <Badge variant={vendor.status === 'active' ? 'success' : 'muted'}>
                    {vendor.status === 'active' ? '啟用' : '停用'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/vendors/${vendor.id}`}>編輯</Link>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedVendorId ? (
        <section
          ref={detailRef}
          className="scroll-mt-6 rounded-xl border-2 border-primary/20 bg-card shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                廠商內容
              </p>
              <h2 className="mt-1 font-mono text-base font-semibold">
                {selectedVendor?.name ?? selectedVendorId}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                在此查看聯絡方式、付款條件與廠商商品。
              </p>
            </div>
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              關閉
            </button>
          </div>
          <div className="p-4">
            <VendorDetailPanel key={selectedVendorId} vendorId={selectedVendorId} />
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          點列表中的廠商名稱或整列，即可在此區開啟廠商內容。
        </div>
      )}
    </div>
  );
}
