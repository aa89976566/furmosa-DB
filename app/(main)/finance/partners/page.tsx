import { PageHeader } from '@/components/shared/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataText, MarginText } from '@/components/finance/money-text';
import { isFinanceSchemaMissing, loadFinanceReport } from '@/lib/finance/queries';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FinancePartnersPage() {
  try {
    const report = await loadFinanceReport();
    return (
      <>
        <PageHeader
          tone="finance"
          title="合作店與換罐中心"
          description="這裡給最高權限管理員看全店。店家自己的 POS 只能看自己的售價、進貨價、可得分潤、庫存與銷售，看不到公司成本與別店。"
        />
        <div className="space-y-6 p-4 sm:p-6">
          {report.partners.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm">尚無合作店。這不是 0 元營收。</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>店家</TableHead>
                    <TableHead>營收</TableHead>
                    <TableHead>分潤</TableHead>
                    <TableHead>換罐數</TableHead>
                    <TableHead>貢獻毛利</TableHead>
                    <TableHead>庫存</TableHead>
                    <TableHead>補貨頻率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.partners.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.code}</p>
                      </TableCell>
                      <TableCell>{store.revenueState === 'empty' ? '尚無銷售' : store.revenueState === 'missing' ? '待補資料' : <DataText cents={store.revenueCents} />}</TableCell>
                      <TableCell>{store.commissionState === 'empty' ? '尚無銷售' : store.commissionState === 'missing' ? '待補資料' : <DataText cents={store.commissionCents} />}</TableCell>
                      <TableCell>{store.refillCount}</TableCell>
                      <TableCell><MarginText cents={store.contributionCents} /></TableCell>
                      <TableCell>{store.stockUnits}</TableCell>
                      <TableCell>
                        {store.everRestocked
                          ? `近 90 天 ${store.restockCount90} 次${store.lastRestockAt ? `，最近 ${formatDate(store.lastRestockAt)}` : ''}`
                          : '待補資料'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            只要店內有任何一筆銷售缺成本、缺品牌實收或缺換罐扣項，整店貢獻毛利就顯示 —，避免用看得到的一部分假裝是完整毛利。換罐數包含已付款與完成的換罐，不含草稿、取消、逾期與付款失敗。
          </p>
        </div>
      </>
    );
  } catch (error) {
    if (!isFinanceSchemaMissing(error)) throw error;
    return (
      <>
        <PageHeader tone="finance" title="合作店與換罐中心" description="財務資料表還沒建立。" />
        <p className="p-6 text-sm">待補資料。環境尚未執行財務 migration。</p>
      </>
    );
  }
}
