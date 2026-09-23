import { PosBottomNav, PosSideRail } from '@/components/pos/bottom-nav';
import { PosPageTools } from '@/components/pos/page-tools';
import type { PosAccount } from '@/lib/pos/account';
import { PosShipmentTaskAlert } from '@/components/pos/shipment-task-alert';

export function PosShell({
  children,
  storeName,
  account,
  wide = false,
  showShipmentAlert = false,
}: {
  children: React.ReactNode;
  storeName?: string;
  account?: PosAccount | null;
  wide?: boolean;
  showShipmentAlert?: boolean;
}) {
  return (
    <div className="pos-theme min-h-screen bg-canvas text-foreground">
      <div
        className={
          wide
            ? 'md:grid md:h-screen md:grid-cols-[112px_minmax(0,1fr)] md:gap-3 md:overflow-hidden md:p-3'
            : 'md:grid md:min-h-screen md:grid-cols-[112px_minmax(0,1fr)] md:gap-3 md:p-3'
        }
      >
        <PosSideRail storeName={storeName ?? account?.storeName} />
        <div
          className={
            wide
              ? 'relative flex min-h-screen flex-col pb-24 md:h-full md:min-h-0 md:overflow-hidden md:pb-0'
              : 'relative mx-auto min-h-screen w-full max-w-lg pb-24 md:mx-0 md:max-w-3xl md:pb-6'
          }
        >
          {account ? (
            <header className="flex shrink-0 items-center justify-end border-b border-border/70 bg-card/80 px-3 py-3 backdrop-blur-sm md:grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-5 md:px-6">
              <div className="hidden min-w-0 md:block">
                <p className="text-xs font-medium tracking-wide text-muted-foreground">店家收銀</p>
                <p className="truncate text-lg font-semibold tracking-tight text-foreground">{storeName ?? account.storeName}</p>
              </div>
              {showShipmentAlert && account.merchantId ? (
                <div className="hidden md:block">
                  <PosShipmentTaskAlert merchantId={account.merchantId} compact />
                </div>
              ) : null}
              <PosPageTools account={account} />
            </header>
          ) : null}
          {showShipmentAlert && account?.merchantId ? (
            <div className="md:hidden">
              <PosShipmentTaskAlert merchantId={account.merchantId} />
            </div>
          ) : null}
          {wide ? <div className="min-h-0 flex-1 md:overflow-hidden">{children}</div> : children}
        </div>
      </div>
      <PosBottomNav />
    </div>
  );
}
