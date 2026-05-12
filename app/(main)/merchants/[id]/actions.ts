'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function nextStockTxnNumber() {
  const prefix = `MTXN-${ymd()}-`;
  const last = await prisma.merchantStockTxn.findFirst({
    where: { txnNumber: { startsWith: prefix } },
    orderBy: { txnNumber: 'desc' },
  });
  const seq = last ? Number(last.txnNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 4)}`;
}

async function nextShipmentNumber() {
  const prefix = `SHP-${ymd()}-`;
  const last = await prisma.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { shipmentNumber: 'desc' },
  });
  const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 4)}`;
}

async function nextOrderNumber() {
  const prefix = `ORD-${ymd()}-`;
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

function commissionFor(rule: { commissionMode: string; commissionValue: number; suggestedPrice: number }, qty: number, unitPrice: number) {
  const perUnit =
    rule.commissionMode === 'percent'
      ? (unitPrice * rule.commissionValue) / 100
      : rule.commissionValue;
  const commission = perUnit * qty;
  const gross = unitPrice * qty;
  return { perUnit, commission, gross, companyRevenue: gross - commission };
}

// ============================================================
// 1. 進貨：建立「待出貨」運送單（不立即動店家庫存）
//    流程：pending → packed → shipped → delivered
//    送達後才實際 +店家庫存（見 markShipmentDelivered）
// ============================================================
export async function restockMerchant(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const carrier = String(formData.get('carrier') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!merchantId) throw new Error('缺少店家');

  const productIds = formData.getAll('productId').map(String);
  const quantities = formData.getAll('quantity').map(String);
  const weights = formData.getAll('weightGrams').map(String);
  const units = formData.getAll('unit').map(String);
  if (productIds.length === 0) throw new Error('沒有選擇商品');

  const items = productIds
    .map((pid, idx) => ({
      productId: pid,
      quantity: Number(quantities[idx]) || 0,
      weightGrams: weights[idx] ? Number(weights[idx]) : null,
      unit: units[idx] || null,
    }))
    .filter((x) => x.productId && x.quantity > 0);

  if (items.length === 0) throw new Error('每筆數量需大於 0');

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error('店家不存在');

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const shipment = await prisma.shipment.create({
    data: {
      shipmentNumber: await nextShipmentNumber(),
      type: 'merchant_restock',
      status: 'pending',
      merchantId,
      recipientName: merchant.contactName ?? merchant.name,
      recipientPhone: merchant.phone,
      recipientAddress: merchant.address,
      carrier,
      notes: note,
      items: {
        create: items.map((it) => {
          const p = productById.get(it.productId);
          if (!p) throw new Error('商品不存在');
          return {
            productId: it.productId,
            productName: p.name,
            sku: p.sku,
            quantity: it.quantity,
            weightGrams: it.weightGrams && it.weightGrams > 0 ? it.weightGrams : null,
            unit: it.unit,
          };
        }),
      },
    },
  });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath('/shipments');
  redirect(`/shipments/${shipment.id}`);
}

// ============================================================
// 2. 盤點：直接設定 productId 的庫存 = newQuantity
// ============================================================
export async function adjustMerchantStock(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const newQuantity = Number(formData.get('newQuantity'));
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!merchantId || !productId) throw new Error('缺少店家或商品');
  if (!Number.isFinite(newQuantity) || newQuantity < 0) throw new Error('庫存數量不合法');

  const existing = await prisma.merchantStock.findUnique({
    where: { merchantId_productId: { merchantId, productId } },
  });
  const before = existing?.quantity ?? 0;
  const delta = newQuantity - before;

  const stock = await prisma.merchantStock.upsert({
    where: { merchantId_productId: { merchantId, productId } },
    update: { quantity: newQuantity, lastCountAt: new Date() },
    create: { merchantId, productId, quantity: newQuantity, lastCountAt: new Date() },
  });
  await prisma.merchantStockTxn.create({
    data: {
      txnNumber: await nextStockTxnNumber(),
      merchantId,
      productId,
      type: 'adjust',
      quantity: delta,
      balanceAfter: stock.quantity,
      note: note ?? `盤點：${before} → ${newQuantity}`,
    },
  });

  revalidatePath(`/merchants/${merchantId}`);
  redirect(`/merchants/${merchantId}?tab=stock`);
}

// ============================================================
// 3. 建立訂單：選商品 → 自動帶該商品的抽成 → 扣店家庫存
// ============================================================
export async function createMerchantSale(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!merchantId) throw new Error('缺少店家');

  const productIds = formData.getAll('productId').map(String);
  const quantities = formData.getAll('quantity').map(String);
  const unitPrices = formData.getAll('unitPrice').map(String);
  const weights = formData.getAll('weightGrams').map(String);
  const units = formData.getAll('unit').map(String);

  const items = productIds
    .map((pid, idx) => ({
      productId: pid,
      quantity: Number(quantities[idx]) || 0,
      unitPrice: Number(unitPrices[idx]) || 0,
      weightGrams: weights[idx] ? Number(weights[idx]) : null,
      unit: units[idx] || null,
    }))
    .filter((x) => x.productId && x.quantity > 0);

  if (items.length === 0) throw new Error('沒有選擇商品');

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error('店家不存在');

  // 拿全部規則
  const rules = await prisma.merchantProductRule.findMany({
    where: { merchantId, productId: { in: items.map((i) => i.productId) } },
  });
  const ruleByProduct = new Map(rules.map((r) => [r.productId, r]));

  // 拿商品資料
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  // 計算
  let subtotal = 0;
  let totalCommission = 0;
  const itemRows = items.map((it) => {
    const product = productById.get(it.productId);
    if (!product) throw new Error('商品不存在');
    const rule = ruleByProduct.get(it.productId);
    const unitPrice = it.unitPrice || rule?.suggestedPrice || product.price;
    const calc = rule
      ? commissionFor(rule, it.quantity, unitPrice)
      : { perUnit: 0, commission: 0, gross: unitPrice * it.quantity, companyRevenue: unitPrice * it.quantity };
    subtotal += calc.gross;
    totalCommission += calc.commission;
    return {
      productId: it.productId,
      productName: product.name,
      sku: product.sku,
      quantity: it.quantity,
      unitPrice,
      perUnitCommission: calc.perUnit,
      commission: calc.commission,
      gross: calc.gross,
      companyRevenue: calc.companyRevenue,
      weightGrams: it.weightGrams && it.weightGrams > 0 ? it.weightGrams : null,
      unit: it.unit,
    };
  });

  const total = subtotal;

  const order = await prisma.order.create({
    data: {
      orderNumber: await nextOrderNumber(),
      source: 'consignment',
      status: 'completed',
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      merchantId,
      subtotal,
      total,
      orderedAt: new Date(),
      shippedAt: new Date(),
      completedAt: new Date(),
      note,
      items: {
        create: itemRows.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          sku: r.sku,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          subtotal: r.gross,
          weightGrams: r.weightGrams,
          unit: r.unit,
        })),
      },
    },
  });

  // 扣庫存 + 寫流水
  for (const r of itemRows) {
    const existing = await prisma.merchantStock.findUnique({
      where: { merchantId_productId: { merchantId, productId: r.productId } },
    });
    const before = existing?.quantity ?? 0;
    const after = before - r.quantity;
    await prisma.merchantStock.upsert({
      where: { merchantId_productId: { merchantId, productId: r.productId } },
      update: { quantity: after, lastSaleAt: new Date() },
      create: { merchantId, productId: r.productId, quantity: after, lastSaleAt: new Date() },
    });
    await prisma.merchantStockTxn.create({
      data: {
        txnNumber: await nextStockTxnNumber(),
        merchantId,
        productId: r.productId,
        type: 'sale',
        quantity: -r.quantity,
        balanceAfter: after,
        unitPrice: r.unitPrice,
        commissionAmount: r.commission,
        companyRevenue: r.companyRevenue,
        orderId: order.id,
        note: `訂單 ${order.orderNumber}`,
      },
    });
  }

  revalidatePath(`/merchants/${merchantId}`);
  redirect(`/merchants/${merchantId}?tab=stock`);
}

// ============================================================
// 3b. 快速登記銷售：店家回報「賣了 N 個」 — 不開訂單，只扣店家庫存 + 寫 sale 流水
//     抽成依現有 MerchantProductRule 自動計算；沒規則的話抽成為 0
// ============================================================
export async function recordMerchantQuickSale(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const quantity = Number(formData.get('quantity'));
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!merchantId || !productId) throw new Error('缺少店家或商品');
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('賣出數量需大於 0');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('商品不存在');

  const rule = await prisma.merchantProductRule.findUnique({
    where: { merchantId_productId: { merchantId, productId } },
  });
  const unitPrice = rule?.suggestedPrice ?? product.price;
  const calc = rule
    ? commissionFor(rule, quantity, unitPrice)
    : { perUnit: 0, commission: 0, gross: unitPrice * quantity, companyRevenue: unitPrice * quantity };

  const existing = await prisma.merchantStock.findUnique({
    where: { merchantId_productId: { merchantId, productId } },
  });
  const before = existing?.quantity ?? 0;
  const after = before - quantity;

  await prisma.merchantStock.upsert({
    where: { merchantId_productId: { merchantId, productId } },
    update: { quantity: after, lastSaleAt: new Date() },
    create: { merchantId, productId, quantity: after, lastSaleAt: new Date() },
  });

  await prisma.merchantStockTxn.create({
    data: {
      txnNumber: await nextStockTxnNumber(),
      merchantId,
      productId,
      type: 'sale',
      quantity: -quantity,
      balanceAfter: after,
      unitPrice,
      commissionAmount: calc.commission,
      companyRevenue: calc.companyRevenue,
      note: note ?? '快速登記銷售',
    },
  });

  revalidatePath(`/merchants/${merchantId}`);
  redirect(`/merchants/${merchantId}`);
}

// ============================================================
// 4. 編輯抽成規則
// ============================================================
export async function upsertMerchantRule(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const suggestedPrice = Number(formData.get('suggestedPrice'));
  const commissionMode = String(formData.get('commissionMode') ?? 'amount');
  const commissionValue = Number(formData.get('commissionValue'));
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!merchantId || !productId) throw new Error('缺少店家或商品');
  if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) throw new Error('建議售價不合法');
  if (!Number.isFinite(commissionValue) || commissionValue < 0) throw new Error('抽成不合法');
  if (!['amount', 'percent'].includes(commissionMode)) throw new Error('抽成方式錯誤');

  await prisma.merchantProductRule.upsert({
    where: { merchantId_productId: { merchantId, productId } },
    update: { suggestedPrice, commissionMode, commissionValue, notes },
    create: { merchantId, productId, suggestedPrice, commissionMode, commissionValue, notes },
  });

  revalidatePath(`/merchants/${merchantId}`);
  redirect(`/merchants/${merchantId}?tab=stock`);
}

export async function deleteMerchantRule(formData: FormData) {
  const ruleId = String(formData.get('ruleId') ?? '');
  const merchantId = String(formData.get('merchantId') ?? '');
  if (!ruleId) throw new Error('缺少規則 ID');

  await prisma.merchantProductRule.delete({ where: { id: ruleId } });
  revalidatePath(`/merchants/${merchantId}`);
  redirect(`/merchants/${merchantId}?tab=stock`);
}
