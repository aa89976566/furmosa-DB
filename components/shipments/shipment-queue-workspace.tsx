'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ShipmentQueueTable,
  type ShipmentQueueRow,
} from '@/components/shipments/shipment-queue-table';
import { ShipmentOrderPanel } from '@/components/shipments/shipment-order-panel';
import { SectionBlock } from '@/components/shared/section-block';
import type { SectionTone } from '@/lib/section-tone';
import { X } from 'lucide-react';

type QueueSection = {
  key: string;
  title: string;
  description: string;
  tone: SectionTone;
  tableVariant?: 'default' | 'subscription';
  shipments: ShipmentQueueRow[];
};

function getShipmentLabel(shipment: ShipmentQueueRow) {
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
  const router = useRouter();
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
      router.replace(buildQueueUrl(shipment.id), { scroll: false });
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [buildQueueUrl, router],
  );

  const closeDetail = useCallback(() => {
    setSelectedShipmentId(null);
    router.replace(buildQueueUrl(null), { scroll: false });
  }, [buildQueueUrl, router]);

  useEffect(() => {
    const shipmentId = searchParams.get('s');
    setSelectedShipmentId(shipmentId);
  }, [searchParams]);

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
            queueStatus={statusFilter ?? section.key}
            variant={section.tableVariant ?? 'default'}
          />
        </SectionBlock>
      ))}

      {selectedShipmentId ? (
        <section
          ref={detailRef}
          className="scroll-mt-6 rounded-xl border-2 border-primary/20 bg-card shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                訂單內容
              </p>
              <h2 className="mt-1 font-mono text-base font-semibold">
                {selectedShipment ? getShipmentLabel(selectedShipment) : selectedShipmentId}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                在此查看品項、運輸資訊，並更新物流狀態（會同步訂單）。
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
            <ShipmentOrderPanel
              key={`${selectedShipmentId}-${panelRefreshKey}`}
              shipmentId={selectedShipmentId}
              queueStatus={statusFilter}
            />
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          點列表中的出貨單、訂單／訂閱編號，或整列，即可在此區開啟訂單內容。
        </div>
      )}
    </div>
  );
}
