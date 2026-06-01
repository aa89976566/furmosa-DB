'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

function toNumberOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseShipDaysInput(raw: string): number[] {
  const days = raw
    .split(/[,\s、/]+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 28);
  const unique = Array.from(new Set(days)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : [15];
}

export async function updateSubscriptionPlan(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) throw new Error('缺少方案 id');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('方案名稱為必填');

  const monthlyPrice = toNumberOrNull(formData.get('monthlyPrice'));
  if (monthlyPrice == null || monthlyPrice < 0) throw new Error('每月價格不正確');

  const halfYearPrice = toNumberOrNull(formData.get('halfYearPrice'));
  const halfYearSavings = toNumberOrNull(formData.get('halfYearSavings'));

  const shipmentsPerMonthRaw = toNumberOrNull(formData.get('shipmentsPerMonth')) ?? 1;
  const shipmentsPerMonth = Math.max(1, Math.round(shipmentsPerMonthRaw));

  const shipDays = parseShipDaysInput(String(formData.get('shipDays') ?? ''));

  const tagline = String(formData.get('tagline') ?? '').trim() || null;
  const recommendedFor = String(formData.get('recommendedFor') ?? '').trim() || null;
  const isActive = formData.get('isActive') === 'on';

  // 內容物（平行陣列：contentName[] / contentWeight[]）
  const contentNames = formData.getAll('contentName').map((v) => String(v).trim());
  const contentWeights = formData.getAll('contentWeight').map((v) => String(v).trim());
  const contents = contentNames
    .map((cn, i) => ({ name: cn, weight: contentWeights[i] ?? '' }))
    .filter((c) => c.name.length > 0)
    .map((c) => (c.weight ? { name: c.name, weight: c.weight } : { name: c.name }));

  // 贈品（bonusName[]）
  const bonusNames = formData.getAll('bonusName').map((v) => String(v).trim());
  const bonusItems = bonusNames.filter((b) => b.length > 0).map((b) => ({ name: b }));

  await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      name,
      tagline,
      monthlyPrice,
      halfYearPrice: halfYearPrice ?? null,
      halfYearSavings: halfYearSavings ?? null,
      shipmentsPerMonth,
      shipDays: JSON.stringify(shipDays),
      contents: JSON.stringify(contents),
      bonusItems: bonusItems.length > 0 ? JSON.stringify(bonusItems) : null,
      recommendedFor,
      isActive,
    },
  });

  revalidatePath('/subscriptions/plans');
  revalidatePath('/subscriptions');
}
