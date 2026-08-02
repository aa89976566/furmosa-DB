'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ShipmentQueueTable,
  type ShipmentQueueRow,
} from '@/components/shipments/shipment-queue-table';
import { ShipmentOrderPanel } from '@/components/shipments/shipment-order-panel';
import { SectionBlock } from '@/components/shared/section-block';
import type { SectionTone } from '@/lib/section-tone';
import { ClipboardList, MousePointerClick, X } from 'lucide-react';

type QueueSection = {
  key: string;
  title: string;
  description: string;
  tone: SectionTone;
  tableVariant?: 'default' | 'subscription';
  shipments: ShipmentQueueRow[];
};

function getShipmentLabel(shipment: ShipmentQueueRow) {
  if (shipment.type === 'merchant_restock' && shipment.merchant?.name) {
    return shipment.merchant.name;
  }
  return (
    shipment.order?.orderNumber ??
    shipment.subscriptionShipment?.subscription?.subscriptionNo ??
    shipment.subscriptionShipment?.shipmentNo ??
    shipment.shipmentNumber
  );
}

export function ShipmentQueueWorkspace({
  sections,
  statusFilter,
  panelRefreshKey,
  initialShipmentId,
}: {
  sections: QueueSection[];
  statusFilter?: string;
  panelRefreshKey: string;
  initialShipmentId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailRef = useRef<HTMLDivElement>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(
    initialShipmentId ?? searchParams.get('s'),
  );

  const shipmentIndex = useMemo(() => {
    const map = new Map<string, ShipmentQueueRow>();
    for (const section of sections) {
      for (const shipment of section.shipments) {
        map.set(shipment.id, shipment);
      }
    }
    return map;
  }, [sections]);

  const selectedShipment = selectedShipmentId
    ? shipmentIndex.get(selectedShipmentId)
    : undefined;

  const buildQueueUrl = useCallback(
    (shipmentId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (shipmentId) params.set('s', shipmentId);
      else params.delete('s');
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const openShipment = useCallback(
    (shipment: ShipmentQueueRow) => {
      setSelectedShipmentId(shipment.id);
      // 只改 URL，不觸發整頁 RSC 重抓 200 筆出貨佇列
      window.history.replaceState(null, '', buildQueueUrl(shipment.id));
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [buildQueueUrl],
  );

  const closeDetail = useCallback(() => {
    setSelectedShipmentId(null);
    window.history.replaceState(null, '', buildQueueUrl(null));
  }, [buildQueueUrl]);

  useEffect(() => {
    setSelectedShipmentId(initialShipmentId ?? searchParams.get('s'));
  }, [initialShipmentId, searchParams]);

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <SectionBlock
          key={section.key}
          tone={section.tone}
          title={section.title}
          description={section.description}
        >
          <ShipmentQueueTable
            shipments={section.shipments}
            onSelectShipment={openShipment}
            selectedShipmentId={selectedShipmentId}
            variant={section.tableVariant ?? 'default'}
          />
        </SectionBlock>
      ))}

      {selectedShipmentId ? (
        <section
          ref={detailRef}
          className="scroll-mt-6 overflow-hidden rounded-xl border-2 border-primary/20 bg-card shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-primary/[0.04] px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  訂單內容
                </p>
                <h2 className="mt-0.5 font-mono text-base font-semibold text-navy">
                  {selectedShipment ? getShipmentLabel(selectedShipment) : selectedShipmentId}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  狀態只在此區更新：標記已寄出／貨物到達（會同步訂單）。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              關閉
            </button>
          </div>
          <div className="p-4 sm:p-5">
            <ShipmentOrderPanel
              key={`${selectedShipmentId}-${panelRefreshKey}`}
              shipmentId={selectedShipmentId}
              queueStatus={statusFilter}
            />
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MousePointerClick className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">尚未選取出貨單</p>
          <p className="max-w-md text-xs text-muted-foreground">
            點上方卡片或整列，在此開啟詳情並更新物流狀態。
          </p>
        </div>
      )}
    </div>
  );
}
