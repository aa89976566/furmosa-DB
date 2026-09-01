import { Suspense } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ReviewInboxBadge } from "@/components/reviews/review-inbox-badge";
import { PawPrint } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r-2 border-foreground bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-foreground bg-primary text-primary-foreground">
          <PawPrint className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-navy">
            Furmosa
          </span>
          <span className="text-[11px] text-muted-foreground">HQ Admin</span>
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
      <div className="border-t border-border/70 px-5 py-4 text-[11px] text-muted-foreground">
        <p>v0.1.0 · MVP</p>
        <p>© Furmosa 2026</p>
      </div>
    </aside>
  );
}
