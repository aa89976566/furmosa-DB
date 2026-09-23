'use client';

import { Component, type ReactNode } from 'react';

/** 單列渲染失敗時留下缺漏提示，避免整頁出貨清單被錯誤邊界換掉。 */
export class QueueRowBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[shipments-queue] row render', error);
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            資料缺漏
          </p>
        )
      );
    }
    return this.props.children;
  }
}
