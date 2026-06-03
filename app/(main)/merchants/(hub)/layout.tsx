import { MerchantsHubTabs } from '@/components/merchants/merchants-hub-tabs';

export default function MerchantsHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-border/60 bg-surface-raised">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight">寄賣</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            寄賣店管理、進貨補貨、庫存與月結 — 訂單來源一律為「寄賣」
          </p>
        </div>
        <MerchantsHubTabs />
      </div>
      {children}
    </>
  );
}
