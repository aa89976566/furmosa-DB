import { cn } from '@/lib/utils';

function Pulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted/50', className)} />;
}

/** 通用頁面載入骨架（loading.tsx / Suspense fallback） */
export function PageSkeleton({
  variant = 'list',
  className,
}: {
  variant?: 'list' | 'dashboard' | 'workspace' | 'cards';
  className?: string;
}) {
  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-8 p-6', className)} aria-busy aria-label="載入中">
        <div className="space-y-3">
          <Pulse className="h-8 w-56" />
          <Pulse className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Pulse className="h-40" />
          <Pulse className="h-40" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Pulse key={i} className="h-24" />
          ))}
        </div>
        <Pulse className="h-56" />
      </div>
    );
  }

  if (variant === 'workspace') {
    return (
      <div className={cn('space-y-4 p-4 sm:p-6', className)} aria-busy aria-label="載入中">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Pulse key={i} className="h-9 w-20" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Pulse key={i} className="h-28" />
          ))}
        </div>
        <Pulse className="h-72" />
        <Pulse className="h-48" />
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className={cn('space-y-4 p-4 sm:p-6', className)} aria-busy aria-label="載入中">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Pulse key={i} className="h-24" />
          ))}
        </div>
        <Pulse className="h-10 w-full max-w-md" />
        <Pulse className="h-80" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 p-6', className)} aria-busy aria-label="載入中">
      <Pulse className="h-10 w-48" />
      <Pulse className="h-40" />
      <Pulse className="h-64" />
    </div>
  );
}

export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy aria-label="載入中">
      <Pulse className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Pulse key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
