'use client';

import { usePathname } from 'next/navigation';

/** Compact chrome only on the inventory workbench; other HQ screens retain their layout. */
export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inventory = pathname === '/inventory';
  const orderWorkbench = pathname === '/orders/new';
  return <div className="group/shell flex min-h-screen" data-order-workbench={orderWorkbench ? 'true' : 'false'} data-inventory={inventory ? 'true' : 'false'}>{children}</div>;
}
