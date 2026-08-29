import { SidebarNav } from '@/components/layout/sidebar-nav';
import { HQ_RESTOCK_INBOX_PATH } from '@/lib/restock-request/hq-inbox';
import { countHqPendingRestockRequests } from '@/lib/restock-request/hq-inbox-query';

export async function HqSidebarNav() {
  const pending = await countHqPendingRestockRequests();
  return <SidebarNav badges={{ [HQ_RESTOCK_INBOX_PATH]: pending }} />;
}
