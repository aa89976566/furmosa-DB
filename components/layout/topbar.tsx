import { Suspense } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/layout/global-search';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { getCurrentUser } from '@/lib/auth';

export async function Topbar() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-card/90 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      <MobileNav />
      <Suspense fallback={<div className="h-10 max-w-md flex-1 rounded-xl bg-muted/40" />}>
        <GlobalSearch />
      </Suspense>
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="hidden rounded-xl sm:inline-flex"
          aria-label="通知"
        >
          <Bell className="h-4 w-4" />
        </Button>
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
