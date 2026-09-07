'use client';

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X, PawPrint } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { cn } from '@/lib/utils';

type TouchPoint = { x: number; y: number };

// iOS 會使用螢幕最左緣作為「返回上一頁」，因此 HQ 從 24px 後才開始偵測選單手勢。
const EDGE_SWIPE_MIN_X = 24;
const EDGE_SWIPE_MAX_X = 72;
const SWIPE_DISTANCE = 64;
const SWIPE_MAX_VERTICAL_DRIFT = 48;

function isHorizontalSwipe(start: TouchPoint, end: TouchPoint, direction: 'left' | 'right') {
  const deltaX = end.x - start.x;
  const deltaY = Math.abs(end.y - start.y);
  const directionalDistance = direction === 'right' ? deltaX : -deltaX;

  return (
    directionalDistance >= SWIPE_DISTANCE &&
    deltaY <= SWIPE_MAX_VERTICAL_DRIFT &&
    Math.abs(deltaX) > deltaY * 1.25
  );
}

export function MobileNav({ reviewBadge }: { reviewBadge?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const drawerTouchStartRef = useRef<TouchPoint | null>(null);
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
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open) return;

    let touchStart: TouchPoint | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX < EDGE_SWIPE_MIN_X || touch.clientX > EDGE_SWIPE_MAX_X) {
        touchStart = null;
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [role="slider"], [data-disable-edge-swipe]')
      ) {
        touchStart = null;
        return;
      }

      touchStart = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (touchStart && touch) {
        const end = { x: touch.clientX, y: touch.clientY };
        if (isHorizontalSwipe(touchStart, end, 'right')) setOpen(true);
      }
      touchStart = null;
    };

    const cancelTouch = () => {
      touchStart = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', cancelTouch, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', cancelTouch);
    };
  }, [open]);

  const handleDrawerTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    drawerTouchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleDrawerTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const start = drawerTouchStartRef.current;
    const touch = event.changedTouches[0];
    drawerTouchStartRef.current = null;
    if (start && touch && isHorizontalSwipe(start, { x: touch.clientX, y: touch.clientY }, 'left')) {
      setOpen(false);
    }
  };

  // 抽屜以 Portal 掛到 document.body，避免被 Topbar 的 backdrop-blur
  // 形成的 containing block 限制住 position: fixed 的定位範圍。
  const drawer = (
    <div
      className={cn(
        'fixed inset-0 z-[60] transition-opacity duration-200 motion-reduce:transition-none md:hidden',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="關閉選單"
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="主要選單"
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleDrawerTouchEnd}
        onTouchCancel={() => {
          drawerTouchStartRef.current = null;
        }}
        className={cn(
          'absolute left-0 top-0 flex h-full w-72 max-w-[82%] touch-pan-y flex-col overflow-hidden border-r border-border/70 bg-card shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none',
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
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="關閉選單"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-3 py-4">
          <div onClick={() => setOpen(false)}>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/50" />}>
              <SidebarNav itemExtras={{ '/reviews': reviewBadge }} />
            </Suspense>
          </div>
        </ScrollArea>

        <div className="border-t border-border/70 px-5 py-4 text-[11px] text-muted-foreground">
          <p>v0.1.0 · MVP</p>
          <p>© Furmosa 2026</p>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="開啟選單"
        aria-controls="mobile-navigation-drawer"
        aria-expanded={open}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
