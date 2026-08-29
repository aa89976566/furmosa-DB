import { revalidatePath } from 'next/cache';
import { hqRestockInboxRevalidatePaths } from '@/lib/restock-request/hq-inbox';

export function revalidateHqRestockInbox() {
  for (const path of hqRestockInboxRevalidatePaths()) {
    revalidatePath(path);
    revalidatePath(path, 'layout');
  }
}
