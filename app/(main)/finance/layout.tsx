import { FinanceAccessError, requireFinanceAdmin } from '@/lib/finance/guard';
import { FinanceSubnav } from '@/components/finance/finance-subnav';

export const dynamic = 'force-dynamic';

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireFinanceAdmin();
  } catch (error) {
    if (error instanceof FinanceAccessError) {
      return (
        <section className="mx-auto max-w-xl p-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">財務</p>
          <h1 className="mt-2 text-2xl font-semibold text-navy">沒有權限</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{error.message}</p>
        </section>
      );
    }
    throw error;
  }

  return (
    <div>
      <FinanceSubnav />
      {children}
    </div>
  );
}
