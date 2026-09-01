import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
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
  const displayStore = storeName ?? account?.storeName;

  return (
    <div className="min-h-screen bg-neutral-100 text-zinc-900 md:h-screen md:overflow-hidden">
      <div className="md:flex md:h-full">
        <InventorySideNav account={account} storeName={displayStore} />
        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col md:h-full md:min-h-0 md:overflow-hidden">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2 md:hidden">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">匠寵店家</p>
              {displayStore ? (
                <p className="truncate text-sm text-zinc-500">{displayStore}</p>
              ) : null}
            </div>
            {account ? <PosAccountMenu account={account} variant="header" /> : null}
          </div>
          <div
            className={
              wide
                ? 'flex min-h-0 flex-1 flex-col overflow-y-auto pb-24 md:pb-0'
                : 'mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto pb-24 md:pb-6'
            }
          >
            {children}
          </div>
        </div>
      </div>
      <InventoryBottomNav />
    </div>
  );
}
