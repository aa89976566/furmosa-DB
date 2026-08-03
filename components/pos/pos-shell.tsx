import { PosBottomNav } from '@/components/pos/bottom-nav';

export function PosShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pos-atmosphere mx-auto min-h-screen w-full max-w-lg pb-28">
      <div className="relative z-[1]">{children}</div>
      <PosBottomNav />
    </div>
  );
}
