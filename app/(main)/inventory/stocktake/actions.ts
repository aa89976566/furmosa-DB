'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseMoneyToCents } from '@/lib/inventory/purchase-cost';
import { applyStocktake } from '@/lib/inventory/stocktake';

export async function submitStocktake(formData: FormData) {
  const productId = String(formData.get('productId') ?? '');
  const eventKey = String(formData.get('eventKey') ?? '') || randomUUID();
  let destination = `/inventory/stocktake/${productId}`;
  try {
    const user = await getCurrentUser();
    if (!user || !['admin','warehouse','finance'].includes(user.role)) throw new Error('你沒有盤點權限');
    await applyStocktake(prisma, {
      eventKey,
      productId,
      warehouseId: String(formData.get('warehouseId') ?? ''),
      afterQuantity: Number(formData.get('afterQuantity')),
      afterTotalCostCents: parseMoneyToCents(formData.get('afterTotalCost'), '盤點後總成本'),
      reason: String(formData.get('reason') ?? ''),
      createdById: user.userId,
    });
    revalidatePath('/inventory'); revalidatePath('/inventory/transactions');
    destination = `/inventory?stocktake=1`;
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    const message = raw && raw.length <= 180 && !raw.includes('Invalid `prisma') ? raw : '盤點失敗，庫存沒有變更';
    destination = `/inventory/stocktake/${productId}?attempt=${encodeURIComponent(eventKey)}&error=${encodeURIComponent(message)}`;
  }
  redirect(destination);
}
