import { PosBottomNav, PosSideRail } from '@/components/pos/bottom-nav';
import { PosAccountMenu } from '@/components/pos/account-menu';
import type { PosAccount } from '@/lib/pos/account';

export function PosShell({
  children,
  storeName,
  account,
  wide = false,
}: {
  children: React.ReactNode;
  storeName?: string;
  account?: PosAccount | null;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-canvas text-foreground">
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
              ? 'relative min-h-screen pb-24 md:h-full md:min-h-0 md:overflow-hidden md:pb-0'
              : 'relative mx-auto min-h-screen w-full max-w-lg pb-24 md:mx-0 md:max-w-3xl md:pb-6'
          }
        >
          {account ? (
            <div className="absolute right-3 top-3 z-30 md:right-4 md:top-4">
              <PosAccountMenu account={account} />
            </div>
          ) : null}
          {children}
        </div>
      </div>
      <PosBottomNav />
    </div>
  );
}
