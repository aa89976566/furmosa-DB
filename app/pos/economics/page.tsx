import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { loadPosEconomics } from '@/lib/finance/pos-economics';
import { PosShell } from '@/components/pos/pos-shell';
import { formatCents } from '@/lib/finance/money';

export const metadata = { title: '本店銷售與分潤 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

function money(cents: number | null, empty: string) {
  return cents == null ? empty : formatCents(cents);
}

export default async function PosEconomicsPage(props: {
  searchParams?: Promise<{ merchantId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await requireMerchantSession();
  const [account, report] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadPosEconomics(session.merchantId, searchParams?.merchantId),
  ]);

  return (
    <PosShell account={account} wide>
      <main className="space-y-5 px-4 py-6 md:px-6">
        <header>
          <h1 className="text-2xl font-semibold">本店銷售與分潤</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            只顯示 {account.storeName} 的售價、進貨價、可得分潤、庫存與銷售。公司食品成本、包裝成本、貢獻毛利與其他店家不會出現在這裡。
          </p>
        </header>
        <p className="rounded-2xl border border-border bg-card p-4 text-sm">本店換罐數：{report.refillCount}</p>
        {report.rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm">尚無本店商品、庫存或銷售。這不是 0 元業績。</p>
        ) : (
          <ul className="divide-y rounded-2xl border border-border bg-card">
            {report.rows.map((row) => (
              <li key={row.sku} className="space-y-2 p-4">
                <h2 className="font-medium">{row.name}</h2>
                <p className="text-sm text-muted-foreground">{row.sku}</p>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">售價</dt><dd>{money(row.sellingPriceCents, '待補資料')}</dd></div>
                  <div><dt className="text-muted-foreground">進貨價</dt><dd>{row.wholesalePricesCents.length === 0 ? '待補資料' : row.wholesalePricesCents.map((cents) => formatCents(cents)).join('、')}</dd></div>
                  <div><dt className="text-muted-foreground">可得分潤</dt><dd>{money(row.commissionPerUnitCents, '待補資料')}</dd></div>
                  <div><dt className="text-muted-foreground">庫存</dt><dd>{row.stockUnits}</dd></div>
                  <div><dt className="text-muted-foreground">銷售</dt><dd>{row.soldQuantity === 0 ? '尚無銷售' : money(row.salesGrossCents, '待補資料')}</dd></div>
                  <div><dt className="text-muted-foreground">已得分潤</dt><dd>{row.soldQuantity === 0 ? '尚無銷售' : money(row.earnedCommissionCents, '待補資料')}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PosShell>
  );
}
