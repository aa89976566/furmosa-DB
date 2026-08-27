import { PosBottomNav, PosSideRail } from '@/components/pos/bottom-nav';

export function PosShell({
  children,
  storeName,
  wide = false,
}: {
  children: React.ReactNode;
  storeName?: string;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <div
        className={
          wide
            ? 'md:grid md:h-screen md:grid-cols-[88px_minmax(0,1fr)] md:gap-3 md:overflow-hidden md:p-3'
            : 'md:grid md:min-h-screen md:grid-cols-[88px_minmax(0,1fr)] md:gap-3 md:p-3'
        }
      >
        <PosSideRail storeName={storeName} />
        <div
          className={
            wide
              ? 'min-h-screen pb-24 md:h-full md:min-h-0 md:overflow-hidden md:pb-0'
              : 'mx-auto min-h-screen w-full max-w-lg pb-24 md:mx-0 md:max-w-3xl md:pb-6'
          }
        >
          {children}
        </div>
      </div>
      <PosBottomNav />
    </div>
  );
}
