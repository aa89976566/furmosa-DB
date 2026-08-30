import type { ReactNode } from 'react';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { HQ_RESTOCK_INBOX_PATH } from '@/lib/restock-request/hq-inbox';
import { countHqPendingRestockRequests } from '@/lib/restock-request/hq-inbox-query';

export async function HqSidebarNav({
  itemExtras,
}: {
  itemExtras?: Partial<Record<string, ReactNode>>;
} = {}) {
  const pending = await countHqPendingRestockRequests();
  return (
    <SidebarNav
      badges={{ [HQ_RESTOCK_INBOX_PATH]: pending }}
      itemExtras={itemExtras}
    />
  );
}
