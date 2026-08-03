import { Suspense } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center px-5">
        <div className="flex flex-col leading-tight">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            Furmosa
          </span>
          <span className="text-[11px] tracking-wide text-muted-foreground">總部工作台</span>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/50" />}>
          <SidebarNav />
        </Suspense>
      </ScrollArea>
      <div className="border-t border-border px-5 py-4 text-[11px] text-muted-foreground">
        <p>匠寵 · HQ</p>
      </div>
    </aside>
  );
}
