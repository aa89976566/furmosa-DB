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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <PwaRegister />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden bg-canvas">
          <Suspense fallback={<MainFallback />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
