import { MerchantsHubTabs } from '@/components/merchants/merchants-hub-tabs';

export default function MerchantsHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-border/60 bg-surface-raised">
        <div className="px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight">寄賣店家</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            寄賣 / 快閃 / 旗艦 / 合作夥伴 通路管理、庫存與月結
          </p>
        </div>
        <MerchantsHubTabs />
      </div>
      {children}
    </>
  );
}
