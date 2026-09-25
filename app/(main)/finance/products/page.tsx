import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataText, MarginLightMark, MarginText, RateText } from '@/components/finance/money-text';
import { saveProductCosts, saveThresholds } from '@/app/(main)/finance/actions';
import { FINANCE_CHANNELS, FINANCE_CHANNEL_LABEL, isFinanceChannel } from '@/lib/finance/channels';
import { isFinanceSchemaMissing, loadFinanceReport } from '@/lib/finance/queries';
import { centsToInputValue, formatRateBps } from '@/lib/finance/money';

export const dynamic = 'force-dynamic';

export default async function FinanceProductsPage(props: {
  searchParams?: Promise<{ channel?: string; saved?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const channel = isFinanceChannel(searchParams?.channel ?? '') ? searchParams?.channel ?? 'website' : 'website';
  try {
    const report = await loadFinanceReport();
    const rows = report.rows.filter((row) => row.channel === channel);
    return (
      <>
        <PageHeader
          tone="finance"
          title="商品毛利"
          description="售價來自商品目錄。品牌實收與通路分潤只使用已經發生的訂單或銷售；成本空白會顯示待補成本，不會用 0 計算。"
        />
        <div className="space-y-6 p-4 sm:p-6">
          <StatusNote saved={searchParams?.saved} error={searchParams?.error} />
          <div className="flex gap-2 overflow-x-auto">
            {FINANCE_CHANNELS.map((item) => (
              <Link
                key={item}
                href={`/finance/products?channel=${item}`}
                className={item === channel ? 'rounded-full bg-foreground px-3 py-1.5 text-sm text-background' : 'rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'}
                aria-current={item === channel ? 'page' : undefined}
              >
                {FINANCE_CHANNEL_LABEL[item]}
              </Link>
            ))}
          </div>
          <form action={saveThresholds} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
            <input type="hidden" name="channel" value={channel} />
            <label className="text-sm">
              綠燈至少
              <input name="green" defaultValue={(report.thresholds.greenMinBps / 100).toString()} inputMode="decimal" className="mt-1 block h-9 w-24 rounded-md border border-border px-2" aria-label="綠燈門檻百分比" />
            </label>
            <label className="text-sm">
              黃燈至少
              <input name="yellow" defaultValue={(report.thresholds.yellowMinBps / 100).toString()} inputMode="decimal" className="mt-1 block h-9 w-24 rounded-md border border-border px-2" aria-label="黃燈門檻百分比" />
            </label>
            <Button type="submit">儲存門檻</Button>
            <p className="text-sm text-muted-foreground">
              目前 {formatRateBps(report.thresholds.greenMinBps)} 以上綠燈，{formatRateBps(report.thresholds.yellowMinBps)} 到未滿綠燈為黃燈，更低為紅燈。
              {report.thresholdsStored ? '' : ' 資料庫還沒有門檻列，儲存後才會寫入正式設定。'}
            </p>
          </form>
          {rows.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm">尚無商品。這不是 0 元毛利。</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>售價</TableHead>
                    <TableHead>食品成本</TableHead>
                    <TableHead>包裝成本</TableHead>
                    <TableHead>產品毛利</TableHead>
                    <TableHead>品牌實收</TableHead>
                    <TableHead>通路分潤</TableHead>
                    <TableHead>貢獻毛利</TableHead>
                    <TableHead>貢獻毛利率</TableHead>
                    <TableHead>燈號</TableHead>
                    <TableHead>數量</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell className="font-medium">{row.sku}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell><DataText cents={row.sellingPriceCents} /></TableCell>
                      <TableCell colSpan={2}>
                        <form action={saveProductCosts} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="productId" value={row.productId} />
                          <input type="hidden" name="channel" value={channel} />
                          <input name="foodCost" defaultValue={centsToInputValue(row.foodCostCents)} inputMode="decimal" aria-label={`${row.sku} 食品成本`} placeholder="待補" className="h-9 w-24 rounded-md border border-border px-2 text-sm" />
                          <input name="packagingCost" defaultValue={centsToInputValue(row.packagingCostCents)} inputMode="decimal" aria-label={`${row.sku} 包裝成本`} placeholder="待補" className="h-9 w-24 rounded-md border border-border px-2 text-sm" />
                          <Button type="submit" size="sm" variant="outline">儲存成本</Button>
                        </form>
                      </TableCell>
                      <TableCell><MarginText cents={row.grossMarginCents} /></TableCell>
                      <TableCell><DataText cents={row.unitBrandReceiptCents} /></TableCell>
                      <TableCell><DataText cents={row.unitChannelShareCents} /></TableCell>
                      <TableCell><MarginText cents={row.contributionCents} /></TableCell>
                      <TableCell><RateText bps={row.rateBps} /></TableCell>
                      <TableCell><MarginLightMark light={row.light} /></TableCell>
                      <TableCell>{row.quantity > 0 ? row.quantity : '尚無交易'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            金額是單件。空白成本不會被當成 0。團購目前沒有交易資料，所以品牌實收會是待補資料。換罐要另外填清洗、運輸、團主分潤與中心店分潤，請到通路損益頁。
          </p>
        </div>
      </>
    );
  } catch (error) {
    if (!isFinanceSchemaMissing(error)) throw error;
    return <SchemaMissing title="商品毛利" />;
  }
}

function StatusNote({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <p role="alert" className="rounded-xl border border-border bg-card p-4 text-sm">{error}</p>;
  if (saved) return <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">已儲存。空白欄位仍代表待補，沒有被改成 0。</p>;
  return null;
}

function SchemaMissing({ title }: { title: string }) {
  return (
    <>
      <PageHeader tone="finance" title={title} description="財務資料表還沒建立。" />
      <p className="p-6 text-sm leading-6">待補資料。這份環境還沒有執行財務 migration，所以不會顯示用 0 算出來的毛利。</p>
    </>
  );
}
