import { PREVIEW_BANNER } from '@/lib/grooming-voucher-preview/copy';
import { cn } from '@/lib/utils';

export function PreviewBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="status"
      className={cn(
        'border-b border-amber-200/80 bg-amber-50 text-amber-950',
        compact ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-6',
      )}
    >
      <p className="text-center text-xs font-semibold tracking-wide sm:text-sm">
        {PREVIEW_BANNER}
      </p>
    </div>
  );
}
