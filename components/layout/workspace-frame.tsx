'use client';

import { usePathname } from 'next/navigation';

/** Route markers keep workspaces focused without changing other HQ screens. */
export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inventory = pathname === '/inventory';
  const orderWorkbench = pathname === '/orders/new';

  return (
    <div
      className="group/shell flex min-h-screen"
      data-dashboard={pathname === '/dashboard' ? 'true' : undefined}
      data-order-workbench={orderWorkbench ? 'true' : undefined}
      data-inventory={inventory ? 'true' : undefined}
      data-review={pathname === '/reviews' ? 'true' : undefined}
    >
      {children}
    </div>
  );
}
