'use client';

import { usePathname } from 'next/navigation';

/** Compact chrome only on the inventory workbench; other HQ screens retain their layout. */
export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const inventory = usePathname() === '/inventory';
  return <div className="group/shell flex min-h-screen" data-inventory={inventory ? 'true' : 'false'}>{children}</div>;
}
