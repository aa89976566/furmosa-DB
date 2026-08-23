import { PosBottomNav } from '@/components/pos/bottom-nav';

export function PosShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl bg-[#f6f6f7] pb-24 text-[#191919]">
      {children}
      <PosBottomNav />
    </div>
  );
}
