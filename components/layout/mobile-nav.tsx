'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, PawPrint } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="開啟選單"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col border-r border-border/70 bg-card shadow-2xl transition-transform duration-200 ease-out',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between gap-3 border-b border-border/70 px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <PawPrint className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-tight text-navy">Furmosa</span>
                <span className="text-[11px] text-muted-foreground">HQ Admin</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="關閉選單"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            <div onClick={() => setOpen(false)}>
              <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/50" />}>
                <SidebarNav />
              </Suspense>
            </div>
          </ScrollArea>

          <div className="border-t border-border/70 px-5 py-4 text-[11px] text-muted-foreground">
            <p>v0.1.0 · MVP</p>
            <p>© Furmosa 2026</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
