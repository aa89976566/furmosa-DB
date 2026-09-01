import { Suspense } from "react";
import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ReviewInboxBadge } from "@/components/reviews/review-inbox-badge";
import { OrderNotificationBell } from "@/components/layout/order-notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { getCurrentUser } from "@/lib/auth";
import { HQ_RESTOCK_INBOX_PATH } from "@/lib/restock-request/hq-inbox";
import { countHqPendingRestockRequests } from "@/lib/restock-request/hq-inbox-query";

export async function Topbar() {
  const [user, restockPendingCount] = await Promise.all([
    getCurrentUser(),
    countHqPendingRestockRequests(),
  ]);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b-2 border-foreground bg-card px-3 sm:gap-4 sm:px-6">
      <MobileNav
        badges={{ [HQ_RESTOCK_INBOX_PATH]: restockPendingCount }}
        itemExtras={{
          "/reviews": (
            <Suspense fallback={null}>
              <ReviewInboxBadge />
            </Suspense>
          ),
        }}
      />
      <Suspense
        fallback={
          <div className="h-10 max-w-md flex-1 rounded-xl bg-muted/40" />
        }
      >
        <GlobalSearch />
      </Suspense>
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <ThemeToggle />
        <OrderNotificationBell />
        {user ? (
          <UserMenu name={user.name} email={user.email} role={user.role} />
        ) : (
          <Avatar>
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
        )}
      </div>
    </header>
  );
}
