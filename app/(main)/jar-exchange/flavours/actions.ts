'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  ensureRefillPlanSeeded,
  invalidateRefillPlanCache,
} from '@/lib/jar-exchange/refill-flavours';
import {
  ensureJarProductForFlavour,
  linkProductToFlavour,
} from '@/lib/jar-exchange/catalogue-sync';
import {
  refillAdminSyncNote,
  syncMerchantStockAbsolute,
} from '@/lib/jar-exchange/refill-inventory';
import { resolveMerchantForStore } from '@/lib/stores/store-merchant-link';

function revalidateRefill() {
  invalidateRefillPlanCache();
  revalidatePath('/jar-exchange/flavours');
  revalidatePath('/jar-exchange/manage');
  revalidatePath('/pos/restock');
  revalidatePath('/pos/refill');
  revalidatePath('/products');
  revalidatePath('/restock-requests');
}

export async function upsertRefillFlavourAction(formData: FormData): Promise<void> {
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
  const productIdRaw = String(formData.get('productId') ?? '').trim();

  if (!code || !name || !Number.isFinite(weightGrams) || weightGrams <= 0) {
    return;
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

  let flavourId = id;
  if (id) {
    await prisma.refillFlavour.update({ where: { id }, data });
  } else {
    const row = await prisma.refillFlavour.upsert({
      where: { code },
      create: data,
      update: data,
    });
    flavourId = row.id;
  }

  if (productIdRaw) {
    await linkProductToFlavour({ productId: productIdRaw, flavourId });
  } else {
    await ensureJarProductForFlavour({
      id: flavourId,
      code,
      name,
      weightGrams,
      sortOrder: data.sortOrder,
    });
  }

  revalidateRefill();
}

export async function setRefillStockAction(formData: FormData): Promise<void> {
  await ensureRefillPlanSeeded();
  const storeId = String(formData.get('storeId') ?? '').trim();
  const flavourId = String(formData.get('flavourId') ?? '').trim();
  const quantity = Math.max(0, Math.floor(Number(formData.get('quantity') ?? 0)));
  const isAvailable =
    formData.get('isAvailable') === 'on' || formData.get('isAvailable') === 'true';
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!storeId || !flavourId) {
    return;
  }

  const flavour = await prisma.refillFlavour.findUnique({
    where: { id: flavourId },
    select: { id: true, productId: true, code: true, name: true, weightGrams: true },
  });
  if (!flavour) return;

  let productId = flavour.productId;
  if (!productId) {
    const ensured = await ensureJarProductForFlavour({
      id: flavour.id,
      code: flavour.code,
      name: flavour.name,
      weightGrams: flavour.weightGrams,
    });
    productId = ensured.productId;
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.merchantRefillStock.findUnique({
      where: { storeId_flavourId: { storeId, flavourId } },
    });
    const prevQty = existing?.quantity ?? 0;
    const changeQty = quantity - prevQty;

    const row = await tx.merchantRefillStock.upsert({
      where: { storeId_flavourId: { storeId, flavourId } },
      create: { storeId, flavourId, quantity, isAvailable },
      update: { quantity, isAvailable },
    });

    await tx.refillStockTxn.create({
      data: {
        storeId,
        flavourId,
        changeQty,
        quantityAfter: row.quantity,
        reason: quantity === 0 || !isAvailable ? 'out_of_stock' : 'adjust',
        note,
      },
    });

    // 雙寫：口味庫存 → MerchantStock（可對應時）
    const merchant = await resolveMerchantForStore(storeId, tx);
    if (merchant && productId) {
      await syncMerchantStockAbsolute({
        tx,
        merchantId: merchant.id,
        productId,
        quantity: isAvailable ? quantity : 0,
        note: note
          ? `${refillAdminSyncNote(storeId)} ${note}`
          : refillAdminSyncNote(storeId),
      });
    }
  });

  revalidateRefill();
}

export async function updateRefillPlanSettingsAction(formData: FormData): Promise<void> {
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
}

/** 複製本期：把所有店庫存以目前數量再寫一筆 period_copy 紀錄（便於每兩週調整） */
export async function copyRefillPeriodAction(): Promise<void> {
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
}

/** 一鍵把尚未連結的口味對齊成商品主檔 */
export async function syncJarCatalogueAction(): Promise<void> {
  await ensureRefillPlanSeeded();
  revalidateRefill();
}
