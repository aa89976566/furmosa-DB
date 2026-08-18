'use client';

import { useEffect, useRef } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import { CLOSE_DIALOG } from '@/lib/merchant-pos-preview/copy';
import {
  canRestoreDialogTrigger,
  isEscapeKey,
  nextDialogFocusPlan,
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
  const onCloseRef = useRef(onClose);
  const prevRef = useRef({ open: false, titleId, triggerHeld: false });
  onCloseRef.current = onClose;

  useEffect(() => {
    const plan = nextDialogFocusPlan(prevRef.current, { open, titleId });

    if (plan.captureTrigger) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    }

    if (plan.restoreTrigger && canRestoreDialogTrigger(triggerRef.current)) {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }

    prevRef.current = {
      open,
      titleId,
      triggerHeld: plan.triggerHeld,
    };

    if (!open) return;

    const panel = panelRef.current;
    if (plan.moveFocusToStep) {
      const stepTitle = panel?.querySelector<HTMLElement>('[data-preview-dialog-title]');
      stepTitle?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isEscapeKey(event.key)) {
        event.preventDefault();
        onCloseRef.current();
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
    };
  }, [open, titleId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-navy/40"
        onClick={() => onCloseRef.current()}
        {...{ inert: true, 'aria-hidden': true }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-card shadow-card ${styles.dialogPanel}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id={titleId}
            tabIndex={-1}
            data-preview-dialog-title=""
            className="text-lg font-semibold text-navy outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          >
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => onCloseRef.current()}
          >
            {CLOSE_DIALOG}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
