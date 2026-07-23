import { Suspense } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { PwaRegister } from '@/components/layout/pwa-register';

function MainFallback() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-10 w-48 animate-pulse rounded-md bg-muted/60" />
      <div className="h-40 animate-pulse rounded-md bg-muted/40" />
      <div className="h-64 animate-pulse rounded-md bg-muted/30" />
    </div>
  );
}

function TopbarFallback() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-card/90 px-3 sm:px-6">
      <div className="h-8 w-8 animate-pulse rounded-md bg-muted/50" />
      <div className="h-10 max-w-md flex-1 animate-pulse rounded-xl bg-muted/40" />
      <div className="ml-auto h-8 w-24 animate-pulse rounded-md bg-muted/40" />
    </header>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <PwaRegister />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<TopbarFallback />}>
          <Topbar />
        </Suspense>
        <main className="flex-1 overflow-x-hidden bg-canvas">
          <Suspense fallback={<MainFallback />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
