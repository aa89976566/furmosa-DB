'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { calcSettlement, nextSettlementId } from '@/lib/settlement-calc';
import {
  assertSettlementDeletable,
  settlementStatusUpdateCondition,
  SETTLEMENT_STATUS_RACE_ERROR,
} from '@/lib/settlements/write-settlement';

/**
 * 缺表環境（尚未套用本包 migration）回傳 0，讓 legacy 刪除行為完全不變；
 * 有表則以實際筆數判斷，不靠 rulesVersion 單一欄位。
 */
async function countSettlementSourceItems(settlementId: string): Promise<number> {
  try {
    return await prisma.settlementSourceItem.count({ where: { settlementId } });
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'P2021' || code === 'P2022') return 0;
    throw error;
  }
}

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
    // 條件鎖定 + 筆數斷言：只接受尚未被任何結算鎖住、且屬於本店的流水。
    // 原本無條件 updateMany 會把別張結算已鎖住的流水搶走，兩張結算都少算或重算。
    const txnIds = summary.lines.map((l) => l.txnId);
    const locked = await tx.merchantStockTxn.updateMany({
      where: { id: { in: txnIds }, merchantId, settlementId: null },
      data: { settlementId: s.id },
    });
    if (locked.count !== txnIds.length) {
      throw new Error('有銷售紀錄在送出的同時被其他結算鎖定，整批都沒有建立。請重新整理後再試。');
    }
    return s;
  });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/settlement`);
  revalidatePath('/merchants/settlements');
  revalidatePath('/settlements');
  redirect(`/merchants/settlements/${created.id}`);
}

const STATUS_FLOW = ['draft', 'reviewing', 'approved', 'paid'] as const;

/**
 * 讀目前狀態與版本身份。
 *
 * 缺表／缺欄位環境（尚未套用本包 migration）讀不到 `rulesVersion`，一律當 legacy，
 * 讓舊流程行為與本包前完全相同。
 */
async function loadSettlementStatusContext(
  id: string,
): Promise<{ status: string; rulesVersion: string | null }> {
  try {
    const row = await prisma.settlement.findUnique({
      where: { id },
      select: { status: true, rulesVersion: true },
    });
    if (!row) throw new Error('結算不存在');
    return row;
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code !== 'P2021' && code !== 'P2022') throw error;
    const row = await prisma.settlement.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!row) throw new Error('結算不存在');
    return { status: row.status, rulesVersion: null };
  }
}

export async function updateSettlementStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '');
  if (!id) throw new Error('缺少結算 ID');
  if (!STATUS_FLOW.includes(next as never)) throw new Error('狀態不合法');

  // 已撤回是稽核殘留，不得被推回流程復活。以資料庫條件判斷，不靠 UI 隱藏按鈕。
  // 新版結算另外必須是合法的下一步：只擋 cancelled 等於允許 paid -> draft，
  // 被降回 draft 的新版結算會重新符合 POS 撤回條件，店家就能撤回已撥款的結算。
  const current = await loadSettlementStatusContext(id);
  const condition = settlementStatusUpdateCondition({
    rulesVersion: current.rulesVersion,
    currentStatus: current.status,
    next,
  });

  const moved = await prisma.settlement.updateMany({
    where: { id, ...condition.where },
    data: {
      status: next,
      paidAt: next === 'paid' ? new Date() : undefined,
    },
  });
  if (moved.count !== 1) {
    throw new Error(
      current.rulesVersion == null
        ? '這張結算已被撤回，不能再推進狀態。'
        : SETTLEMENT_STATUS_RACE_ERROR,
    );
  }

  const updated = await prisma.settlement.findUniqueOrThrow({
    where: { id },
    select: { merchantId: true },
  });

  revalidatePath('/merchants/settlements');
  revalidatePath(`/merchants/settlements/${id}`);
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

  // 新版結算帶有來源明細，刪除會連帶破壞帳務稽核。資料庫的 ON DELETE RESTRICT
  // 是最後防線，這裡先給出可讀訊息，並且不依賴 UI 隱藏按鈕。
  const sourceItemCount = await countSettlementSourceItems(id);
  assertSettlementDeletable({ rulesVersion: s.rulesVersion, sourceItemCount });

  await prisma.$transaction(async (tx) => {
    await tx.merchantStockTxn.updateMany({
      where: { settlementId: id },
      data: { settlementId: null },
    });
    await tx.settlement.delete({ where: { id } });
  });

  revalidatePath('/merchants/settlements');
  revalidatePath('/settlements');
  revalidatePath(`/merchants/${s.merchantId}`);
  redirect(`/merchants/${s.merchantId}`);
}
