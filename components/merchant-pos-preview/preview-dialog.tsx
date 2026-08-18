'use client';

import { useEffect, useRef } from 'react';
import { CLOSE_DIALOG } from '@/lib/merchant-pos-preview/copy';
import {
  canRestoreDialogTrigger,
  isEscapeKey,
  nextTabIndex,
} from '@/lib/merchant-pos-preview/a11y';
import { Button } from '@/components/ui/button';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PreviewDialog({
  open,
  titleId,
  title,
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (isEscapeKey(event.key)) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      event.preventDefault();
      const current = nodes.indexOf(document.activeElement as HTMLElement);
      const next = nextTabIndex(current, nodes.length, event.shiftKey);
      nodes[next]?.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (canRestoreDialogTrigger(triggerRef.current)) {
        triggerRef.current?.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-navy/40"
        onClick={onClose}
        {...{ inert: true, 'aria-hidden': true }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-card p-5 shadow-card"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-navy">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] min-w-[44px]"
            onClick={onClose}
          >
            {CLOSE_DIALOG}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
