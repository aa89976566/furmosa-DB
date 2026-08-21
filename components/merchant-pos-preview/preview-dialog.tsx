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
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PreviewDialog({
  open,
  titleId,
  title,
  onClose,
  presentation = 'dialog',
  children,
}: {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  presentation?: 'dialog' | 'drawer';
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
    <div className={styles.dialogRoot}>
      <div
        className={styles.dialogOverlay}
        onClick={() => onCloseRef.current()}
        {...{ inert: true, 'aria-hidden': true }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={presentation === 'drawer' ? styles.drawerPanel : styles.dialogPanel}
      >
        <div className={styles.dialogHead}>
          <h2
            id={titleId}
            tabIndex={-1}
            data-preview-dialog-title=""
            className={`${styles.dialogTitle} focus-visible:ring-2`}
          >
            {title}
          </h2>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.dialogClose}
            className="min-h-[44px] min-w-[44px]"
            aria-label={CLOSE_DIALOG}
            onClick={() => onCloseRef.current()}
          >
            <span aria-hidden="true">×</span>
          </PreviewAction>
        </div>
        {children}
      </div>
    </div>
  );
}
