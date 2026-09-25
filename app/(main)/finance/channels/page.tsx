import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataText, MarginLightMark, MarginText, RateText } from '@/components/finance/money-text';
import { saveChannelCost } from '@/app/(main)/finance/actions';
import { FINANCE_CHANNEL_LABEL, FINANCE_CHANNELS } from '@/lib/finance/channels';
import { isFinanceSchemaMissing, loadFinanceReport } from '@/lib/finance/queries';
import { centsToInputValue, formatCents } from '@/lib/finance/money';

export const dynamic = 'force-dynamic';

export default async function FinanceChannelsPage(props: {
  searchParams?: Promise<{ sku?: string; saved?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  try {
    const report = await loadFinanceReport();
    const selected = report.products.find((product) => product.sku === searchParams?.sku) ?? report.products[0];
    const rows = selected ? report.rows.filter((row) => row.productId === selected.id) : [];
    const costs = new Map(report.channelCosts.filter((row) => row.productId === selected?.id).map((row) => [row.channel, row]));
    return (
      <>
        <PageHeader
          tone="finance"
          title="通路損益"
          description="同一個 SKU 並排比較六個通路。沒有交易的通路保持待補資料，不會拿別的通路或進貨價來代算。"
        />
        <div className="space-y-6 p-4 sm:p-6">
          {searchParams?.error ? <p role="alert" className="rounded-xl border border-border bg-card p-4 text-sm">{searchParams.error}</p> : null}
          {searchParams?.saved ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">已儲存這個 SKU 的通路成本。</p> : null}
          {report.products.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-5 text-sm">尚無商品可比較。</p>
          ) : (
            <form method="get" className="flex flex-wrap items-end gap-3" role="search">
              <label className="text-sm">
                SKU
                <select name="sku" defaultValue={selected?.sku} className="mt-1 block h-10 min-w-52 rounded-md border border-border bg-card px-2">
                  {report.products.map((product) => (
                    <option key={product.id} value={product.sku}>{product.sku} {product.name}</option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="outline">比較</Button>
            </form>
          )}
          {selected ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>通路</TableHead>
                    <TableHead>數量</TableHead>
                    <TableHead>單件品牌實收</TableHead>
                    <TableHead>單件通路分潤</TableHead>
                    <TableHead>單件貢獻毛利</TableHead>
                    <TableHead>貢獻毛利率</TableHead>
                    <TableHead>燈號</TableHead>
                    <TableHead>累計品牌實收</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.channel}>
                      <TableCell className="font-medium">{FINANCE_CHANNEL_LABEL[row.channel]}</TableCell>
                      <TableCell>{row.quantity > 0 ? row.quantity : '尚無交易'}</TableCell>
                      <TableCell><DataText cents={row.unitBrandReceiptCents} /></TableCell>
                      <TableCell><DataText cents={row.unitChannelShareCents} /></TableCell>
                      <TableCell><MarginText cents={row.contributionCents} /></TableCell>
                      <TableCell><RateText bps={row.rateBps} /></TableCell>
                      <TableCell><MarginLightMark light={row.light} /></TableCell>
                      <TableCell><DataText cents={row.totalBrandReceiptCents} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {FINANCE_CHANNELS.map((channel) => {
                const setting = costs.get(channel);
                return (
                  <form key={channel} action={saveChannelCost} className="space-y-3 rounded-xl border border-border bg-card p-4">
                    <h2 className="text-base font-semibold">{FINANCE_CHANNEL_LABEL[channel]}的直接成本</h2>
                    <input type="hidden" name="productId" value={selected.id} />
                    <input type="hidden" name="sku" value={selected.sku} />
                    <input type="hidden" name="channel" value={channel} />
                    <label className="block text-sm">
                      其他直接變動成本（每件）
                      <input name="otherDirectCost" defaultValue={centsToInputValue(setting?.otherDirectCostCents)} inputMode="decimal" placeholder="待補" className="mt-1 block h-9 w-full rounded-md border border-border px-2" />
                    </label>
                    {channel === 'refill' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">清洗<input name="cleaning" defaultValue={centsToInputValue(setting?.cleaningCents)} inputMode="decimal" placeholder="待補" className="mt-1 block h-9 w-full rounded-md border border-border px-2" /></label>
                        <label className="text-sm">運輸<input name="transport" defaultValue={centsToInputValue(setting?.transportCents)} inputMode="decimal" placeholder="待補" className="mt-1 block h-9 w-full rounded-md border border-border px-2" /></label>
                        <label className="text-sm">團主分潤<input name="groupLeaderShare" defaultValue={centsToInputValue(setting?.groupLeaderShareCents)} inputMode="decimal" placeholder="待補" className="mt-1 block h-9 w-full rounded-md border border-border px-2" /></label>
                        <label className="text-sm">中心店分潤<input name="centerShare" defaultValue={centsToInputValue(setting?.centerShareCents)} inputMode="decimal" placeholder="待補" className="mt-1 block h-9 w-full rounded-md border border-border px-2" /></label>
                      </div>
                    ) : null}
                    <Button type="submit" size="sm">儲存{FINANCE_CHANNEL_LABEL[channel]}</Button>
                  </form>
                );
              })}
            </div>
          ) : null}
          <aside className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
            <p>官網已記錄、但尚未分攤到 SKU 的公司運費：{formatCents(report.recordedShippingCents)}（{report.shippingOrderCount} 張官網或 Shopify 訂單）。這個數字不計入上面的貢獻毛利，因為無法知道要分到哪一個 SKU。訂單欄位預設是 0，所以 0 不代表已經確認沒有運費。</p>
            <p>尚未歸入這六個通路的 LINE、訂閱、手動訂單：{report.unassignedOrders.orderCount} 張，商品金額 {formatCents(report.unassignedOrders.receiptCents)}。它們不會被算進官網。</p>
            <p>團購沒有獨立交易資料，這一列會維持待補資料。</p>
          </aside>
        </div>
      </>
    );
  } catch (error) {
    if (!isFinanceSchemaMissing(error)) throw error;
    return (
      <>
        <PageHeader tone="finance" title="通路損益" description="財務資料表還沒建立。" />
        <p className="p-6 text-sm">待補資料。環境尚未執行財務 migration。</p>
      </>
    );
  }
}
