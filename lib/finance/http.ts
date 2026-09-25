import { NextResponse } from 'next/server';
import { FinanceAccessError } from '@/lib/finance/guard';
import { isFinanceSchemaMissing, loadFinanceReport, type FinanceReport } from '@/lib/finance/queries';

export async function financeGet(select: (report: FinanceReport) => unknown) {
  try {
    const report = await loadFinanceReport();
    return NextResponse.json(select(report));
  } catch (error) {
    if (error instanceof FinanceAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isFinanceSchemaMissing(error)) {
      return NextResponse.json({ error: '財務資料表尚未建立' }, { status: 503 });
    }
    throw error;
  }
}

export async function financePost(run: () => Promise<{ ok: true } | { ok: false; message: string }>) {
  try {
    const result = await run();
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FinanceAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : '';
    if (message.includes('NEXT_REDIRECT')) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    throw error;
  }
}
