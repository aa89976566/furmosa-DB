import { revalidatePath } from 'next/cache';
import {
  hqRestockInboxRevalidatePaths,
  hqRestockReviewRevalidatePaths,
} from '@/lib/restock-request/hq-inbox';

export function revalidateHqRestockInbox() {
  for (const path of hqRestockInboxRevalidatePaths()) {
    revalidatePath(path);
    revalidatePath(path, 'layout');
  }
}

export function revalidateAfterHqRestockReview(requestId: string) {
  revalidateHqRestockInbox();
  for (const path of hqRestockReviewRevalidatePaths(requestId)) {
    revalidatePath(path);
  }
}
