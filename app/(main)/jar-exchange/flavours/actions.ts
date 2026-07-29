'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { ensureRefillPlanSeeded } from '@/lib/jar-exchange/refill-flavours';

function revalidateRefill() {
  revalidatePath('/jar-exchange/flavours');
  revalidatePath('/jar-exchange/manage');
}

export async function upsertRefillFlavourAction(formData: FormData) {
  await ensureRefillPlanSeeded();
  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const weightGrams = Number(formData.get('weightGrams') ?? 0);
  const sortOrder = Number(formData.get('sortOrder') ?? 0);
  const isActive = formData.get('isActive') === 'on' || formData.get('isActive') === 'true';
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const availableFromRaw = String(formData.get('availableFrom') ?? '').trim();
  const availableUntilRaw = String(formData.get('availableUntil') ?? '').trim();

  if (!code || !name || !Number.isFinite(weightGrams) || weightGrams <= 0) {
    return { ok: false as const, error: '請填口味代碼、名稱與克數' };
  }

  const data = {
    code,
    name,
    weightGrams,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isActive,
    imageUrl,
    availableFrom: availableFromRaw ? new Date(availableFromRaw) : null,
    availableUntil: availableUntilRaw ? new Date(availableUntilRaw) : null,
  };

  if (id) {
    await prisma.refillFlavour.update({ where: { id }, data });
  } else {
    await prisma.refillFlavour.upsert({
      where: { code },
      create: data,
      update: data,
    });
  }
  revalidateRefill();
  return { ok: true as const };
}

export async function setRefillStockAction(formData: FormData) {
  await ensureRefillPlanSeeded();
  const storeId = String(formData.get('storeId') ?? '').trim();
  const flavourId = String(formData.get('flavourId') ?? '').trim();
  const quantity = Math.max(0, Math.floor(Number(formData.get('quantity') ?? 0)));
  const isAvailable =
    formData.get('isAvailable') === 'on' || formData.get('isAvailable') === 'true';
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!storeId || !flavourId) {
    return { ok: false as const, error: '缺少店家或口味' };
  }

  const existing = await prisma.merchantRefillStock.findUnique({
    where: { storeId_flavourId: { storeId, flavourId } },
  });
  const prevQty = existing?.quantity ?? 0;
  const changeQty = quantity - prevQty;

  const row = await prisma.merchantRefillStock.upsert({
    where: { storeId_flavourId: { storeId, flavourId } },
    create: { storeId, flavourId, quantity, isAvailable },
    update: { quantity, isAvailable },
  });

  await prisma.refillStockTxn.create({
    data: {
      storeId,
      flavourId,
      changeQty,
      quantityAfter: row.quantity,
      reason: quantity === 0 || !isAvailable ? 'out_of_stock' : 'adjust',
      note,
    },
  });

  revalidateRefill();
  return { ok: true as const };
}

export async function updateRefillPlanSettingsAction(formData: FormData) {
  await ensureRefillPlanSeeded();
  const heroImageUrl = String(formData.get('heroImageUrl') ?? '').trim() || null;
  const firstJarPrice = Number(formData.get('firstJarPrice') ?? 129);
  const exchangePrice = Number(formData.get('exchangePrice') ?? 99);
  const flavourUpdateNote =
    String(formData.get('flavourUpdateNote') ?? '').trim() || '每兩週更新';

  await prisma.refillPlanSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      heroImageUrl,
      firstJarPrice,
      exchangePrice,
      flavourUpdateNote,
      periodStartedAt: new Date(),
    },
    update: {
      heroImageUrl,
      firstJarPrice,
      exchangePrice,
      flavourUpdateNote,
    },
  });
  revalidateRefill();
  return { ok: true as const };
}

/** 複製本期：把所有店庫存以目前數量再寫一筆 period_copy 紀錄（便於每兩週調整） */
export async function copyRefillPeriodAction() {
  await ensureRefillPlanSeeded();
  const stocks = await prisma.merchantRefillStock.findMany();
  const now = new Date();
  await prisma.refillPlanSettings.update({
    where: { id: 'default' },
    data: { periodStartedAt: now, periodEndedAt: null },
  });
  for (const s of stocks) {
    await prisma.refillStockTxn.create({
      data: {
        storeId: s.storeId,
        flavourId: s.flavourId,
        changeQty: 0,
        quantityAfter: s.quantity,
        reason: 'period_copy',
        note: '複製上一期庫存供調整',
      },
    });
  }
  revalidateRefill();
  return { ok: true as const, count: stocks.length };
}
