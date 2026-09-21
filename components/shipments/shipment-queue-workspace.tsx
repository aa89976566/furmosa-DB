'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ShipmentQueueTable,
  type ShipmentQueueRow,
} from '@/components/shipments/shipment-queue-table';
import { ShipmentOrderPanel } from '@/components/shipments/shipment-order-panel';
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
    shipment.recipientName?.trim() ||
    shipment.customer?.name.trim() ||
    shipment.order?.orderNumber ||
    shipment.subscriptionShipment?.subscription?.subscriptionNo ||
    shipment.subscriptionShipment?.shipmentNo ||
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
  const searchParams = useSearchParams();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(
    initialShipmentId ?? searchParams.get('s'),
  );
  const [panelTitle, setPanelTitle] = useState<string | null>(null);

  const shipmentIndex = useMemo(() => {
    const map = new Map<string, ShipmentQueueRow>();
    for (const section of sections) {
      for (const shipment of section.shipments) map.set(shipment.id, shipment);
    }
    return map;
  }, [sections]);

  const selectedShipment = selectedShipmentId ? shipmentIndex.get(selectedShipmentId) : undefined;

  useEffect(() => {
    setPanelTitle(selectedShipment ? getShipmentLabel(selectedShipment) : null);
  }, [selectedShipment, selectedShipmentId]);

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
      window.history.replaceState(null, '', buildQueueUrl(shipment.id));
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

  useEffect(() => {
    if (!selectedShipmentId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedShipmentId]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/80 bg-muted/25 p-3 sm:p-4">
        <div className="flex items-end justify-between gap-3 px-1 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              出貨佇列
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">待處理訂單</h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {sections.reduce((total, section) => total + section.shipments.length, 0)} 筆
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {sections.map((section) => (
            <section key={section.key}>
              <div className="mb-2 px-1">
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{section.description}</p>
              </div>
              <ShipmentQueueTable
                shipments={section.shipments}
                onSelectShipment={openShipment}
                selectedShipmentId={selectedShipmentId}
                queueStatus={statusFilter ?? section.key}
                queueType={typeFilter}
                variant={section.tableVariant ?? 'default'}
                compact
              />
            </section>
          ))}
        </div>
      </section>

      {!selectedShipmentId ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MousePointerClick className="h-5 w-5" />
          </span>
          <p className="text-base font-semibold text-foreground">選取一筆訂單開始作業</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            佇列只用來掃描與選單；完整資訊與出貨操作會集中在右側工作面板。
          </p>
        </div>
      ) : null}

      {selectedShipmentId && typeof document !== 'undefined'
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="關閉訂單內容"
                onClick={closeDetail}
                className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-[1px]"
              />
              <aside
                role="dialog"
                aria-modal="true"
                aria-label="訂單工作台"
                className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-border/80 bg-card shadow-2xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 px-5 py-5 sm:px-7">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        訂單工作台
                      </p>
                      <h2 className="mt-1 font-mono text-xl font-semibold tracking-tight text-foreground">
                        {panelTitle ?? '載入出貨單資料…'}
                      </h2>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        查看品項與收件資料，並在此完成下一個出貨動作。
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
                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
                  <ShipmentOrderPanel
                    key={`${selectedShipmentId}-${panelRefreshKey}`}
                    shipmentId={selectedShipmentId}
                    queueStatus={statusFilter}
                    onTitleChange={setPanelTitle}
                  />
                </div>
              </aside>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
