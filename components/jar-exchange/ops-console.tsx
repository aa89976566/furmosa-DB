import Link from 'next/link';
import { JarPanel } from '@/components/jar-exchange/jar-shell';
import { QuickRestockButton } from '@/components/jar-exchange/quick-restock-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  JAR_OPS_LOW_STOCK_THRESHOLD,
  JAR_OPS_TARGET_STOCK,
  type JarOpsConsoleData,
} from '@/lib/jar-exchange/ops';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Gift,
  Package,
  Recycle,
  Truck,
  Wallet,
} from 'lucide-react';

function StatusCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card p-4 shadow-card',
        tone === 'warning' && 'border-warning/40 bg-warning/5',
        tone === 'danger' && 'border-destructive/40 bg-destructive/5',
        tone === 'success' && 'border-success/40 bg-success/5',
        href && 'transition-colors hover:border-primary/30',
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-navy">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function cellClass(status: 'ok' | 'low' | 'out' | 'negative') {
  if (status === 'negative') return 'bg-destructive/20 text-destructive ring-1 ring-destructive/40';
  if (status === 'out') return 'bg-destructive/10 text-destructive';
  if (status === 'low') return 'bg-warning/15 text-warning-foreground';
  return 'bg-muted/30 text-foreground';
}

export function JarOpsConsole({ data }: { data: JarOpsConsoleData }) {
  const { status, products, merchants } = data;

  return (
    <div className="space-y-6">
      {status.negativeStockCellCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              有 {status.negativeStockCellCount} 格庫存已變負數
            </p>
            <p className="mt-0.5 text-xs text-destructive/80">
              多半是存罐入點時店貨不夠。請盤點或一鍵補貨；客人存罐仍會成功給點。
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatusCard
          label="本週存罐"
          value={formatNumber(status.weekJarRedeemCount)}
          hint="序號入點罐數"
          tone="success"
          href="/jar-exchange/manage?tab=codes"
        />
        <StatusCard
          label="本週核銷"
          value={formatNumber(status.weekCouponRedeemCount)}
          hint="美容券已核銷"
          href="/admin/store-report"
        />
        <StatusCard
          label="需補貨格"
          value={formatNumber(status.lowStockCellCount)}
          hint={`缺貨 ${status.outOfStockCellCount} · 負庫存 ${status.negativeStockCellCount}`}
          tone={
            status.negativeStockCellCount > 0 || status.outOfStockCellCount > 0
              ? 'danger'
              : status.lowStockCellCount > 0
                ? 'warning'
                : 'default'
          }
        />
        <StatusCard
          label="在途補貨"
          value={formatNumber(status.inTransitRestockCount)}
          hint="待出貨／運送中"
          href="/shipments?type=merchant_restock"
          tone={status.inTransitRestockCount > 0 ? 'warning' : 'default'}
        />
        <StatusCard
          label="未用序號"
          value={formatNumber(status.unusedJarCodeCount)}
          hint="罐身標籤水位"
          href="/jar-exchange/manage?tab=codes"
        />
        <StatusCard
          label="本月券成本"
          value={formatCurrency(status.monthGroomingCouponCost)}
          hint={`點數發放 ${formatNumber(status.monthJarPointsIssued)}`}
          href="/jar-exchange/manage?tab=rewards"
        />
      </div>

      <JarPanel>
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-navy">店家換罐庫存</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {status.merchantCount} 家換罐店 × {status.productCount} 個換罐商品 · ≤
                {JAR_OPS_LOW_STOCK_THRESHOLD} 可一鍵補到 {JAR_OPS_TARGET_STOCK}
                （需有收件資料；送達後才入庫）
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/merchants/stock?view=levels">全店庫存水位</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/jar-exchange/stores">合作店家／核銷</Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-destructive/60" /> 負庫存
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-destructive/40" /> 缺貨 0
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-warning/50" /> 緊張 1–
              {JAR_OPS_LOW_STOCK_THRESHOLD}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> 正常
            </span>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            <p>尚無換罐商品（類型需為 JAR_EXCHANGE）。</p>
            <Button className="mt-4" variant="outline" size="sm" asChild>
              <Link href="/products">前往產品</Link>
            </Button>
          </div>
        ) : merchants.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            尚無標記為「換罐」的寄賣店家。
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/merchants">前往寄賣</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-muted/20 px-4 py-3 font-medium">店家</th>
                  {products.map((p) => (
                    <th key={p.id} className="px-3 py-3 font-medium">
                      <div className="max-w-[7.5rem] truncate" title={p.name}>
                        {p.name.replace(/^換罐[-－—\s]*/, '') || p.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] font-normal opacity-70">
                        {p.sku}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">一鍵補貨</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {merchants.map((merchant) => (
                  <tr key={merchant.id} className="hover:bg-muted/10">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3">
                      <Link
                        href={`/merchants/${merchant.id}`}
                        className="font-medium text-navy hover:underline"
                      >
                        {merchant.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {merchant.merchantId}
                        </span>
                        {merchant.city ? (
                          <span className="text-[10px] text-muted-foreground">{merchant.city}</span>
                        ) : null}
                        {!merchant.hasShippingProfile ? (
                          <Badge variant="destructive" className="text-[10px]">
                            缺收件資料
                          </Badge>
                        ) : null}
                        {merchant.inTransitCount > 0 ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Truck className="h-3 w-3" />
                            在途 {merchant.inTransitCount}
                          </Badge>
                        ) : null}
                        {merchant.negativeCount > 0 ? (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            負庫存 {merchant.negativeCount}
                          </Badge>
                        ) : merchant.lowOrOutCount > 0 ? (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <AlertTriangle className="h-3 w-3" />
                            需補 {merchant.lowOrOutCount}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {merchant.cells.map((cell) => (
                      <td key={cell.productId} className="px-3 py-2 align-middle">
                        <div
                          className={cn(
                            'flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl px-2 py-1.5',
                            cellClass(cell.status),
                          )}
                        >
                          <span className="font-mono text-base font-semibold tabular-nums">
                            {cell.quantity}
                          </span>
                          {cell.status === 'negative' ? (
                            <span className="text-[10px] font-medium">需盤點</span>
                          ) : null}
                          {cell.suggestedRestockQty > 0 && merchant.hasShippingProfile ? (
                            <QuickRestockButton
                              merchantId={merchant.id}
                              productId={cell.productId}
                              label={`+${cell.suggestedRestockQty}`}
                              variant="outline"
                              size="sm"
                            />
                          ) : null}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex flex-col items-end gap-2">
                        <QuickRestockButton
                          merchantId={merchant.id}
                          label={
                            !merchant.hasShippingProfile
                              ? '先補收件資料'
                              : merchant.totalSuggestedQty > 0
                                ? `補齊低庫存（${merchant.totalSuggestedQty}）`
                                : '無需補貨'
                          }
                          disabled={
                            !merchant.hasShippingProfile || merchant.totalSuggestedQty <= 0
                          }
                        />
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/merchants/${merchant.id}/restock`}>手動進貨</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </JarPanel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/jar-exchange/manage?tab=codes"
          className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-primary/25"
        >
          <Recycle className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-navy">序號與存罐</p>
            <p className="mt-0.5 text-xs text-muted-foreground">產生標籤、查看已入點</p>
          </div>
        </Link>
        <Link
          href="/admin/store-report"
          className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-primary/25"
        >
          <Gift className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-navy">店家核銷報表</p>
            <p className="mt-0.5 text-xs text-muted-foreground">美容券結帳對帳</p>
          </div>
        </Link>
        <Link
          href="/merchants/settlements"
          className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-primary/25"
        >
          <Wallet className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-navy">寄賣結算補貼</p>
            <p className="mt-0.5 text-xs text-muted-foreground">換罐 rewardPayout</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
