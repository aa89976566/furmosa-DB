'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ShipmentQueueTable,
  type ShipmentQueueRow,
} from '@/components/shipments/shipment-queue-table';
import { ShipmentOrderPanel } from '@/components/shipments/shipment-order-panel';
import { SectionBlock } from '@/components/shared/section-block';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const orderLabel =
    shipment.order?.displayOrderNumber ||
    shipment.order?.orderNumber ||
    shipment.subscriptionShipment?.subscription?.subscriptionNo ||
    shipment.subscriptionShipment?.shipmentNo ||
    shipment.shipmentNumber;
  const partyLabel =
    (shipment.type === 'merchant_restock' ? shipment.merchant?.name.trim() : null) ||
    shipment.recipientName?.trim() ||
    shipment.customer?.name.trim();
  return partyLabel ? `${orderLabel} · ${partyLabel}` : orderLabel;
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
  const firstVisibleSection =
    sections.find((section) => section.shipments.length > 0) ?? sections[0];
  const [activeSectionKey, setActiveSectionKey] = useState(firstVisibleSection?.key ?? '');
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
  const [panelTitle, setPanelTitle] = useState<string | null>(null);
  const activeSection =
    sections.find((section) => section.key === activeSectionKey) ?? firstVisibleSection;

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
      // 只改 URL，不觸發整頁 RSC 重抓 200 筆出貨佇列
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
    if (!sections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(firstVisibleSection?.key ?? '');
    }
  }, [activeSectionKey, firstVisibleSection?.key, sections]);

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
      {sections.length > 1 ? (
        <Tabs value={activeSection?.key} onValueChange={setActiveSectionKey}>
          <div className="overflow-x-auto pb-1">
            <TabsList
              aria-label="出貨階段"
              className="h-auto min-w-full justify-start gap-1 rounded-xl border border-border/70 bg-card p-1.5 sm:min-w-0"
            >
              {sections.map((section) => (
                <TabsTrigger
                  key={section.key}
                  value={section.key}
                  className="min-h-10 flex-1 gap-2 px-3 text-xs sm:min-w-28 sm:flex-none sm:text-sm"
                >
                  <span>{section.title.replace(/\s*\(\d+\)$/, '')}</span>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {section.shipments.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      ) : null}

      {activeSection ? (
        <SectionBlock
          key={activeSection.key}
          tone={activeSection.tone}
          title={activeSection.title}
          description={activeSection.description}
        >
          <ShipmentQueueTable
            shipments={activeSection.shipments}
            onSelectShipment={openShipment}
            selectedShipmentId={selectedShipmentId}
            queueStatus={statusFilter ?? activeSection.key}
            queueType={typeFilter}
            variant={activeSection.tableVariant ?? 'default'}
          />
        </SectionBlock>
      ) : null}

      {!selectedShipmentId ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MousePointerClick className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">尚未選取出貨單</p>
          <p className="max-w-md text-xs text-muted-foreground">
            點列表中的出貨單、訂單／訂閱編號，或整列，即可在此區開啟訂單內容。
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
            className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[1px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="訂單內容"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l-2 border-primary/20 bg-card shadow-2xl"
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
                    {panelTitle ?? '載入出貨單資料…'}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    在此查看品項與運輸資訊；物流狀態請直接在列表更新。
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
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <ShipmentOrderPanel
                key={`${selectedShipmentId}-${panelRefreshKey}`}
                shipmentId={selectedShipmentId}
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
