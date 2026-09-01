import { Suspense } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ReviewInboxBadge } from "@/components/reviews/review-inbox-badge";
import { PawPrint } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
          <PawPrint className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-navy">
            Furmosa
          </span>
          <span className="text-[11px] text-muted-foreground">工作台</span>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-3 py-4">
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
          }
        >
          <SidebarNav itemExtras={{ "/reviews": <ReviewInboxBadge /> }} />
        </Suspense>
      </ScrollArea>
      <div className="border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground">
        <p>Furmosa HQ</p>
      </div>
    </aside>
  );
}
