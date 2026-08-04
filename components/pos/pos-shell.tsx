import { PosBottomNav } from '@/components/pos/bottom-nav';

export function PosShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {children}
      <PosBottomNav />
    </div>
  );
}
