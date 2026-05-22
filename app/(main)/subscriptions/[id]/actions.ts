'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateSubscriptionSettings(formData: FormData) {
  const subscriptionId = String(formData.get('subscriptionId') ?? '').trim();
  const planId = String(formData.get('planId') ?? '').trim();
  const endDateRaw = String(formData.get('endDate') ?? '').trim();
  const unlimited = formData.get('unlimitedEnd') === 'on';
  const paymentType = String(formData.get('paymentType') ?? '').trim();
  const paymentNoteRaw = String(formData.get('paymentNote') ?? '').trim();

  if (!subscriptionId) throw new Error('缺少訂閱');

  const paymentAllowed = ['full', 'monthly', 'other'] as const;
  if (!paymentAllowed.includes(paymentType as (typeof paymentAllowed)[number])) {
    throw new Error('付款方式無效');
  }

  const paymentNote = paymentType === 'other' && paymentNoteRaw ? paymentNoteRaw : null;

  const existing = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, planId: true },
  });
  if (!existing) throw new Error('訂閱不存在');

  if (!planId) throw new Error('請選擇方案');

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    select: { id: true, isActive: true },
  });
  if (!plan) throw new Error('方案不存在');
  if (!plan.isActive && planId !== existing.planId) {
    throw new Error('請選擇啟用中的方案');
  }

  let endDate: Date | null = null;
  if (!unlimited) {
    if (!endDateRaw) throw new Error('請選擇到期日，或勾選「無限期」');
    const parsed = new Date(endDateRaw);
    if (!Number.isFinite(parsed.getTime())) throw new Error('到期日格式不正確');
    endDate = parsed;
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId,
      endDate: unlimited ? null : endDate,
      paymentType,
      paymentNote,
    },
  });

  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath('/subscriptions');
}
