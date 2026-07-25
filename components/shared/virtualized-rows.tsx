'use client';

import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

/** 手機／卡片列表虛擬化 */
export function VirtualCardList<T>({
  items,
  estimateSize,
  renderItem,
  getKey,
  className,
  maxHeight = 640,
  overscan = 6,
}: {
  items: T[];
  estimateSize: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
  className?: string;
  maxHeight?: number;
  overscan?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  if (items.length <= 24) {
    return (
      <div className={cn('space-y-3', className)}>
        {items.map((item, index) => (
          <div key={getKey ? getKey(item, index) : index}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-y-auto', className)}
      style={{ maxHeight }}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]!;
          return (
            <div
              key={getKey ? getKey(item, row.index) : row.key}
              className="absolute left-0 top-0 w-full pb-3"
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {renderItem(item, row.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
