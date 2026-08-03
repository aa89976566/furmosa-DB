'use client';

import { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const drawer = (
    <div
      className={cn(
        'fixed inset-0 z-[60] transition-opacity duration-200 md:hidden',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <aside
        className={cn(
          'absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col overflow-hidden border-r border-border bg-card shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-border px-5">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-ink">Furmosa</span>
            <span className="text-[11px] text-muted-foreground">HQ Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="關閉選單"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-3 py-4">
          <div onClick={() => setOpen(false)}>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/50" />}>
              <SidebarNav />
            </Suspense>
          </div>
        </ScrollArea>

        <div className="border-t border-border px-5 py-4 text-[11px] text-muted-foreground">
          <p>v0.1.0 · MVP</p>
          <p>© Furmosa 2026</p>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="開啟選單"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
