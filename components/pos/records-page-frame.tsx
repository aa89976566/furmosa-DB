'use client';

import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { PosPageHeader } from '@/components/pos/pos-page-header';
import type { PosAccount } from '@/lib/pos/account';
import { QUERY_RECORDS_DESCRIPTION, QUERY_RECORDS_TITLE } from '@/lib/pos/query-records-view';

export function RecordsPageFrame({
  account,
  children,
}: {
  account?: PosAccount | null;
  children: React.ReactNode;
}) {
  return (
    <RestockCartProvider>
      <div className="min-h-screen overflow-x-hidden bg-neutral-100 text-zinc-900 md:flex md:h-screen md:overflow-hidden">
        <InventorySideNav account={account} />
        <main className="min-w-0 flex-1 md:flex md:h-full md:flex-col md:overflow-hidden">
          <PosPageHeader
            title={QUERY_RECORDS_TITLE}
            description={QUERY_RECORDS_DESCRIPTION}
            account={account}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-28 md:px-6 md:pb-8">
            {children}
          </div>
        </main>
        <InventoryBottomNav />
      </div>
    </RestockCartProvider>
  );
}
