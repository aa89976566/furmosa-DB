import { PosBottomNav } from '@/components/pos/bottom-nav';

export function PosShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f7] text-[#191919]">
      <PosBottomNav />
      <main className="min-h-screen pb-24 md:pl-[232px] md:pb-0">
        {children}
      </main>
    </div>
  );
}
