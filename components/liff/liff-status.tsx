'use client';

type Props = {
  message: string;
  variant?: 'info' | 'success' | 'error';
};

export function LiffStatus({ message, variant = 'info' }: Props) {
  const styles = {
    info: 'border-border/80 bg-muted/30 text-foreground',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    error: 'border-destructive/30 bg-destructive/5 text-destructive',
  }[variant];

  return (
    <div className={`rounded-xl border p-4 text-sm ${styles}`} role="status">
      {message}
    </div>
  );
}
