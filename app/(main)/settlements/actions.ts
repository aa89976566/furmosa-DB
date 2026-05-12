'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calcSettlement, nextSettlementId } from '@/lib/settlement-calc';

function parseDate(v: FormDataEntryValue | null, endOfDay = false): Date {
  const s = String(v ?? '').trim();
  if (!s) throw new Error('日期不能為空');
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`日期格式錯誤：${s}`);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59)
    : new Date(y, m - 1, d, 0, 0, 0);
}

// 建立結算 — 撈該期間「未結清」的銷售流水加總，鎖到這張結算上
export async function createSettlement(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const periodStart = parseDate(formData.get('periodStart'));
  const periodEnd = parseDate(formData.get('periodEnd'), true);
  const rewardPayout = Number(formData.get('rewardPayout') ?? 0) || 0;
  const shippingFee = Number(formData.get('shippingFee') ?? 0) || 0;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!merchantId) throw new Error('請選擇店家');
  if (periodEnd < periodStart) throw new Error('結束日期不能早於開始日期');

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error('店家不存在');

  const summary = await calcSettlement({
    merchantId,
    periodStart,
    periodEnd,
    rewardPayout,
    shippingFee,
  });

  if (summary.lines.length === 0) {
    throw new Error('期間內沒有任何「未結清」的銷售紀錄，無法建立結算');
  }

  const settlementId = await nextSettlementId(periodEnd);

  // Atomic：建結算 + 鎖住相關的 sale txn
  const created = await prisma.$transaction(async (tx) => {
    const s = await tx.settlement.create({
      data: {
        settlementId,
        merchantId,
        periodStart,
        periodEnd,
        grossSales: summary.grossSales,
        commissionRate: summary.effectiveCommissionRate,
        commissionAmount: summary.commissionAmount,
        rewardPayout: summary.rewardPayout,
        shippingFee: summary.shippingFee,
        merchantOwesUs: summary.merchantOwesUs,
        payable: summary.payable,
        status: 'draft',
        note,
      },
    });
    await tx.merchantStockTxn.updateMany({
      where: { id: { in: summary.lines.map((l) => l.txnId) } },
      data: { settlementId: s.id },
    });
    return s;
  });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath('/settlements');
  redirect(`/merchants/${merchantId}#settlement-${created.id}`);
}

const STATUS_FLOW = ['draft', 'reviewing', 'approved', 'paid'] as const;

export async function updateSettlementStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '');
  if (!id) throw new Error('缺少結算 ID');
  if (!STATUS_FLOW.includes(next as never)) throw new Error('狀態不合法');

  const updated = await prisma.settlement.update({
    where: { id },
    data: {
      status: next,
      paidAt: next === 'paid' ? new Date() : undefined,
    },
  });

  revalidatePath('/settlements');
  revalidatePath(`/settlements/${id}`);
  revalidatePath(`/merchants/${updated.merchantId}`);
}

// 刪除結算 — 同時把鎖在這張上的 sale txn 釋放回「未結清」
export async function deleteSettlement(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('缺少結算 ID');
  const s = await prisma.settlement.findUnique({ where: { id } });
  if (!s) throw new Error('結算不存在');
  if (s.status === 'paid') throw new Error('已撥款的結算不能刪除');

  await prisma.$transaction(async (tx) => {
    await tx.merchantStockTxn.updateMany({
      where: { settlementId: id },
      data: { settlementId: null },
    });
    await tx.settlement.delete({ where: { id } });
  });

  revalidatePath('/settlements');
  revalidatePath(`/merchants/${s.merchantId}`);
  redirect(`/merchants/${s.merchantId}`);
}
