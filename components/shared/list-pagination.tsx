import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ListPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  prevHref,
  nextHref,
  label = '筆',
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
  label?: string;
}) {
  if (totalCount <= pageSize && totalPages <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        共 {totalCount} {label}
      </p>
    );
  }

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        第 {from}–{to} {label}／共 {totalCount} {label}
        <span className="ml-2 text-muted-foreground/80">
          （{page}/{totalPages} 頁）
        </span>
      </p>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={prevHref} prefetch>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              上一頁
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            上一頁
          </Button>
        )}
        {nextHref ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref} prefetch>
              下一頁
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            下一頁
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
