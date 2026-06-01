'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// 更新「此訂閱專屬」的盒內內容物與贈品（覆寫方案預設）
export async function updateSubscriptionContents(formData: FormData) {
  const subscriptionId = String(formData.get('subscriptionId') ?? '').trim();
  if (!subscriptionId) throw new Error('缺少訂閱');

  const existing = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true },
  });
  if (!existing) throw new Error('訂閱不存在');

  // 「恢復為方案預設」：清掉覆寫
  if (formData.get('reset') === 'on') {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { customContents: null, customBonus: null },
    });
    revalidatePath(`/subscriptions/${subscriptionId}`);
    return;
  }

  const contentNames = formData.getAll('contentName').map((v) => String(v).trim());
  const contentWeights = formData.getAll('contentWeight').map((v) => String(v).trim());
  const contents = contentNames
    .map((cn, i) => ({ name: cn, weight: contentWeights[i] ?? '' }))
    .filter((c) => c.name.length > 0)
    .map((c) => (c.weight ? { name: c.name, weight: c.weight } : { name: c.name }));

  const bonusNames = formData.getAll('bonusName').map((v) => String(v).trim());
  const bonus = bonusNames.filter((b) => b.length > 0).map((b) => ({ name: b }));

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      customContents: JSON.stringify(contents),
      customBonus: bonus.length > 0 ? JSON.stringify(bonus) : null,
    },
  });

  revalidatePath(`/subscriptions/${subscriptionId}`);
}

// 更新訂閱備註
export async function updateSubscriptionNotes(formData: FormData) {
  const subscriptionId = String(formData.get('subscriptionId') ?? '').trim();
  if (!subscriptionId) throw new Error('缺少訂閱');

  const existing = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true },
  });
  if (!existing) throw new Error('訂閱不存在');

  const notesRaw = String(formData.get('notes') ?? '').trim();

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { notes: notesRaw || null },
  });

  revalidatePath(`/subscriptions/${subscriptionId}`);
}

// 更新收件資料（收件人 / 收件電話 / 收件地址）
export async function updateSubscriptionRecipient(formData: FormData) {
  const subscriptionId = String(formData.get('subscriptionId') ?? '').trim();
  if (!subscriptionId) throw new Error('缺少訂閱');

  const existing = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true },
  });
  if (!existing) throw new Error('訂閱不存在');

  const recipientName = String(formData.get('recipientName') ?? '').trim();
  const recipientPhone = String(formData.get('recipientPhone') ?? '').trim();
  const shippingAddress = String(formData.get('shippingAddress') ?? '').trim();

  if (!recipientName) throw new Error('請填寫收件人');
  if (!recipientPhone) throw new Error('請填寫收件電話');
  if (!shippingAddress) throw new Error('請填寫收件地址');

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { recipientName, recipientPhone, shippingAddress },
  });

  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath('/subscriptions');
}

// 更新訂閱統計欄位（開始日 / 到期日 / 下次出貨 / 付款）
export async function updateSubscriptionStats(formData: FormData) {
  const subscriptionId = String(formData.get('subscriptionId') ?? '').trim();
  if (!subscriptionId) throw new Error('缺少訂閱');

  const existing = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true },
  });
  if (!existing) throw new Error('訂閱不存在');

  const startDateRaw = String(formData.get('startDate') ?? '').trim();
  if (!startDateRaw) throw new Error('請填寫開始日');
  const startDate = new Date(startDateRaw);
  if (!Number.isFinite(startDate.getTime())) throw new Error('開始日格式不正確');

  const unlimited = formData.get('unlimitedEnd') === 'on';
  let endDate: Date | null = null;
  if (!unlimited) {
    const endRaw = String(formData.get('endDate') ?? '').trim();
    if (!endRaw) throw new Error('請選擇到期日，或勾選「無限期」');
    const parsed = new Date(endRaw);
    if (!Number.isFinite(parsed.getTime())) throw new Error('到期日格式不正確');
    endDate = parsed;
  }

  const nextRaw = String(formData.get('nextShipmentDate') ?? '').trim();
  let nextShipmentDate: Date | null = null;
  if (nextRaw) {
    const parsed = new Date(nextRaw);
    if (!Number.isFinite(parsed.getTime())) throw new Error('下次出貨日格式不正確');
    nextShipmentDate = parsed;
  }

  const paymentType = String(formData.get('paymentType') ?? '').trim();
  const paymentAllowed = ['full', 'monthly', 'other'] as const;
  if (!paymentAllowed.includes(paymentType as (typeof paymentAllowed)[number])) {
    throw new Error('付款方式無效');
  }
  const paymentNoteRaw = String(formData.get('paymentNote') ?? '').trim();
  const paymentNote = paymentType === 'other' && paymentNoteRaw ? paymentNoteRaw : null;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      startDate,
      endDate,
      nextShipmentDate,
      paymentType,
      paymentNote,
    },
  });

  revalidatePath(`/subscriptions/${subscriptionId}`);
  revalidatePath('/subscriptions');
}

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
