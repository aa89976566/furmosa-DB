import { Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { PawPrint } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[232px] shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))] bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-[hsl(var(--sidebar-border))] px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <PawPrint className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold tracking-tight text-navy">
            Furmosa
          </span>
          <span className="text-[11px] text-muted-foreground">HQ Admin</span>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 py-3">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/50" />}>
          <SidebarNav />
        </Suspense>
      </ScrollArea>
      <div className="border-t border-[hsl(var(--sidebar-border))] px-4 py-3 text-[11px] text-muted-foreground">
        <p>v0.1.0 · MVP</p>
        <p>© Furmosa 2026</p>
      </div>
    </aside>
  );
}
