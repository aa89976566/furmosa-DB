'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ShipmentQueueTable,
  type ShipmentQueueRow,
} from '@/components/shipments/shipment-queue-table';
import { ShipmentOrderPanel } from '@/components/shipments/shipment-order-panel';
import { SectionBlock } from '@/components/shared/section-block';
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SectionTone } from '@/lib/section-tone';
import { getShipmentDetailPlacementMode } from '@/lib/shipment-queue-products';
import { ClipboardList, MousePointerClick } from 'lucide-react';

export { getShipmentDetailPlacementMode };

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
  typeFilter,
  panelRefreshKey,
  initialShipmentId,
}: {
  sections: QueueSection[];
  statusFilter?: string;
  typeFilter?: string;
  panelRefreshKey: string;
  initialShipmentId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLElement | null>(null);
  const scrollYRef = useRef(0);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(
    initialShipmentId ?? searchParams.get('s'),
  );
  const [listEpoch, setListEpoch] = useState(0);

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

  const openedSnapshotStatus = selectedShipment?.status ?? null;

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
    (shipment: ShipmentQueueRow, triggerEl?: HTMLElement | null) => {
      scrollYRef.current = window.scrollY;
      triggerRef.current =
        triggerEl ??
        (document.querySelector(
          `[data-shipment-open="${shipment.id}"]`,
        ) as HTMLElement | null) ??
        (document.querySelector(
          `[data-shipment-row="${shipment.id}"]`,
        ) as HTMLElement | null);
      setSelectedShipmentId(shipment.id);
      window.history.replaceState(null, '', buildQueueUrl(shipment.id));
    },
    [buildQueueUrl],
  );

  const closeDetail = useCallback(() => {
    setSelectedShipmentId(null);
    window.history.replaceState(null, '', buildQueueUrl(null));
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollYRef.current });
      triggerRef.current?.focus?.();
    });
  }, [buildQueueUrl]);

  const handlePanelMutated = useCallback(() => {
    setListEpoch((value) => value + 1);
    router.refresh();
  }, [router]);

  useEffect(() => {
    setSelectedShipmentId(initialShipmentId ?? searchParams.get('s'));
  }, [initialShipmentId, searchParams]);

  const drawerOpen = Boolean(selectedShipmentId);
  const drawerLabel = selectedShipment
    ? getShipmentLabel(selectedShipment)
    : selectedShipmentId ?? '出貨詳情';

  return (
    <div className="space-y-6" data-shipment-queue-root="true">
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
            queueType={typeFilter}
            variant={section.tableVariant ?? 'default'}
          />
        </SectionBlock>
      ))}

      {!drawerOpen ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center"
          data-shipment-detail-placement="hint"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MousePointerClick className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">尚未選取出貨單</p>
          <p className="max-w-md text-xs text-muted-foreground">
            點列表整列或「查看」，會在右側開啟訂單內容（不會插入列表下方）。
          </p>
        </div>
      ) : null}

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <SheetContent
          side="right"
          aria-labelledby="shipment-drawer-title"
          aria-describedby="shipment-drawer-desc"
          data-shipment-detail-placement="drawer"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus?.();
          }}
        >
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    訂單內容
                  </p>
                  <SheetTitle id="shipment-drawer-title">{drawerLabel}</SheetTitle>
                  <SheetDescription id="shipment-drawer-desc">
                    品項、收件、付款與物流狀態。變更狀態請在下方操作區。
                  </SheetDescription>
                </div>
              </div>
              <SheetCloseButton />
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
            {selectedShipmentId ? (
              <ShipmentOrderPanel
                key={`${selectedShipmentId}-${panelRefreshKey}-${listEpoch}`}
                shipmentId={selectedShipmentId}
                queueStatus={statusFilter}
                listSnapshotStatus={openedSnapshotStatus}
                orderLabel={drawerLabel}
                onMutated={handlePanelMutated}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

