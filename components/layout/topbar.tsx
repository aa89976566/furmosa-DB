import { Suspense } from "react";
import { GlobalSearch } from "@/components/layout/global-search";
import { CompanyProgressBar } from "@/components/layout/company-progress-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ReviewInboxBadge } from "@/components/reviews/review-inbox-badge";
import { OrderNotificationBell } from "@/components/layout/order-notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { getCurrentUser } from "@/lib/auth";

export async function Topbar() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 border-b-2 border-foreground bg-card px-3 py-2 xl:min-h-20 xl:flex-nowrap xl:gap-4 xl:px-6 xl:py-3 group-data-[inventory=true]/shell:min-h-14 group-data-[inventory=true]/shell:flex-nowrap group-data-[inventory=true]/shell:border-b group-data-[inventory=true]/shell:border-border group-data-[inventory=true]/shell:py-2">
      <MobileNav
        reviewBadge={
          <Suspense fallback={null}>
            <ReviewInboxBadge />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <div className="h-10 w-full max-w-md flex-1 rounded-xl bg-muted/40" />
        }
      >
        <GlobalSearch />
      </Suspense>
      <div className="contents group-data-[inventory=true]/shell:hidden"><CompanyProgressBar /></div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
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
