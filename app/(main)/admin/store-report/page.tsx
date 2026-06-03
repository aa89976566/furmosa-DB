import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/format';
import { getStoreRedemptionReport, expireCoupons } from '@/lib/coupons/service';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { BarChart3, Link2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StoreReportPage() {
  await expireCoupons();
  const rows = await getStoreRedemptionReport();
  const totalCount = rows.reduce((s, r) => s + r.redeemedCount, 0);
  const totalAmount = rows.reduce((s, r) => s + r.totalDiscount, 0);

  return (
    <>
      <PageHeader
        tone="supply"
        title="店家核銷報表"
        description="美容院 250 元折價券 · 依店家統計已核銷數量與折抵總額"
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="核銷總張數" value={formatNumber(totalCount)} />
          <StatCard label="折抵總金額" value={formatCurrency(totalAmount)} />
          <StatCard label="合作店家數" value={formatNumber(rows.length)} />
        </div>

        <SectionCard tone="supply" icon={BarChart3} title="各店核銷統計" contentClassName="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店家名稱</TableHead>
                <TableHead>店家代碼</TableHead>
                <TableHead className="text-right">核銷數量</TableHead>
                <TableHead className="text-right">折抵總金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    尚無核銷紀錄
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.storeId}>
                    <TableCell className="font-medium">{r.storeName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.storeId}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(r.redeemedCount)} 張</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(r.totalDiscount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard tone="supply" icon={Link2} title="店家核銷連結（統一入口）" contentClassName="pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            所有合作店家共用同一核銷網址。店員開啟後選擇自己的分店，再輸入優惠碼即可。選擇會記在此裝置的瀏覽器。
          </p>
          <p className="font-mono text-sm break-all rounded-lg border bg-muted/40 px-3 py-3">
            {buildUnifiedStoreRedeemUrl()}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            預選分店範例（板橋）：{buildUnifiedStoreRedeemUrl('zhuwo_banqiao')}
          </p>
        </SectionCard>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
