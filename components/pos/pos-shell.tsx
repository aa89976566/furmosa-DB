import { PosBottomNav } from '@/components/pos/bottom-nav';

export function PosShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-24">
      {children}
      <PosBottomNav />
    </div>
  );
}
