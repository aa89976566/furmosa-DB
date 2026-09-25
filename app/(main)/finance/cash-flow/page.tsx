import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MarginText } from '@/components/finance/money-text';
import { saveCashPlan } from '@/app/(main)/finance/actions';
import { isFinanceSchemaMissing, loadFinanceReport } from '@/lib/finance/queries';
import { centsToInputValue } from '@/lib/finance/money';

export const dynamic = 'force-dynamic';

const FIELDS = [
  ['inflow', '預計進帳'],
  ['supplier', '供應商付款'],
  ['packaging', '包材'],
  ['payroll', '薪資'],
  ['ads', '廣告'],
  ['logistics', '物流'],
  ['sampling', '新品打樣'],
] as const;

export default async function FinanceCashFlowPage(props: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  try {
    const report = await loadFinanceReport();
    const below = report.cash.projected.some((week) => week.belowMinimum);
    return (
      <>
        <PageHeader
          tone="finance"
          title="13 週現金流"
          description="只有最高權限管理員可以看。沒有填的格子是待補資料，不會當成 0，淨現金流與期末餘額也會是 —。"
        />
        <form action={saveCashPlan} className="space-y-6 p-4 sm:p-6">
          {searchParams?.error ? <p role="alert" className="rounded-xl border border-border bg-card p-4 text-sm">{searchParams.error}</p> : null}
          {searchParams?.saved ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">已儲存 13 週現金流。</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="rounded-xl border border-border bg-card p-4 text-sm">
              現金餘額
              <input name="openingBalance" defaultValue={centsToInputValue(report.cash.openingBalanceCents)} inputMode="decimal" placeholder="待補" className="mt-2 block h-10 w-full rounded-md border border-border px-3" />
            </label>
            <label className="rounded-xl border border-border bg-card p-4 text-sm">
              最低現金點
              <input name="minimumCash" defaultValue={centsToInputValue(report.cash.minimumCashCents)} inputMode="decimal" placeholder="待補" className="mt-2 block h-10 w-full rounded-md border border-border px-3" />
            </label>
          </div>
          {report.cash.openingBalanceCents == null ? (
            <p className="text-sm text-muted-foreground">現金餘額待補資料，所以每一週的期末餘額都是 —。</p>
          ) : null}
          {below ? <p className="text-sm">有週次的期末餘額低於最低現金點。</p> : null}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>週次</TableHead>
                  {FIELDS.map(([, label]) => <TableHead key={label}>{label}</TableHead>)}
                  <TableHead>每週淨現金流</TableHead>
                  <TableHead>期末餘額</TableHead>
                  <TableHead>最低現金點</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.cash.weeks.map((week, index) => {
                  const projected = report.cash.projected[index];
                  const values = [
                    week.inflowCents,
                    week.supplierPaymentCents,
                    week.packagingCents,
                    week.payrollCents,
                    week.adsCents,
                    week.logisticsCents,
                    week.samplingCents,
                  ];
                  return (
                    <TableRow key={week.weekIndex}>
                      <TableCell className="whitespace-nowrap font-medium">{week.label}</TableCell>
                      {FIELDS.map(([name], fieldIndex) => (
                        <TableCell key={name}>
                          <input
                            name={`${name}-${week.weekIndex}`}
                            defaultValue={centsToInputValue(values[fieldIndex])}
                            inputMode="decimal"
                            aria-label={`${week.label} ${FIELDS[fieldIndex]?.[1]}`}
                            placeholder="待補"
                            className="h-9 w-24 rounded-md border border-border px-2 text-sm"
                          />
                        </TableCell>
                      ))}
                      <TableCell><MarginText cents={projected?.net.ok ? projected.net.cents : null} /></TableCell>
                      <TableCell><MarginText cents={projected?.ending.ok ? projected.ending.cents : null} /></TableCell>
                      <TableCell>
                        {projected?.belowMinimum == null ? '待補資料' : projected.belowMinimum ? '低於最低現金點' : '高於最低現金點'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Button type="submit">儲存 13 週</Button>
          <p className="text-sm leading-6 text-muted-foreground">目前沒有自動產生的現金交易。請只填已經知道的預計數字；不知道就留白。</p>
        </form>
      </>
    );
  } catch (error) {
    if (!isFinanceSchemaMissing(error)) throw error;
    return (
      <>
        <PageHeader tone="finance" title="13 週現金流" description="財務資料表還沒建立。" />
        <p className="p-6 text-sm">待補資料。環境尚未執行財務 migration，這裡不會顯示假的現金餘額。</p>
      </>
    );
  }
}
