'use client';

import Link from 'next/link';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import type { PreviewActionTone } from './preview-action-matrix';

const TONE_CLASS: Record<PreviewActionTone, string> = {
  primary: styles.actionPrimary,
  secondary: styles.actionSecondary,
  danger: styles.actionDanger,
  quiet: styles.actionQuiet,
};

function actionClassName(tone: PreviewActionTone, className?: string): string {
  return [styles.action, TONE_CLASS[tone], 'min-h-[44px]', className].filter(Boolean).join(' ');
}

export function PreviewAction({
  tone,
  disabled,
  type = 'button',
  onClick,
  children,
  className,
  id,
  buttonRef,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  tone: PreviewActionTone;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  id?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <button
      id={id}
      ref={buttonRef}
      type={type}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={actionClassName(tone, className)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PreviewActionLink({
  tone,
  href,
  children,
  className,
}: {
  tone: PreviewActionTone;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={actionClassName(tone, className)}>
      {children}
    </Link>
  );
}
