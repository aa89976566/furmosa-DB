'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export function OrderQuickViewShell({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') router.push(closeHref, { scroll: false });
    };
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', close);
    };
  }, [closeHref, router]);

  return <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="訂單快速詳情">
    <Link href={closeHref} scroll={false} aria-label="關閉訂單詳情" className="absolute inset-0 bg-black/35 animate-in fade-in duration-150" />
    <aside className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200 sm:max-w-[34rem]">
      <Link href={closeHref} scroll={false} aria-label="關閉" className="fixed right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm sm:absolute">
        <X className="h-5 w-5" />
      </Link>
      {children}
    </aside>
  </div>;
}
