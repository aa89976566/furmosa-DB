import { unstable_noStore as noStore } from 'next/cache';
import { countReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';

export async function ReviewInboxBadge() {
  noStore();
  try {
    const total = reviewInboxTotal(await countReviewInbox());
    if (total <= 0) return null;
    return (
      <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold text-primary">
        {total > 99 ? '99+' : total}
      </span>
    );
  } catch {
    return null;
  }
}
