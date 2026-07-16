'use server';

import { prisma } from '@/lib/prisma';
import { CARRIER_711, resolve711PickupFromForm } from '@/lib/carrier-cvs';
import {
  resolveStockMovementReason,
} from '@/lib/merchant-stock-movement';
import { parseMerchantCommissionPercent } from '@/lib/merchant-commission';
import {
  autoFillMerchantCommissionRulesForMerchant,
  upsertSuggestedMerchantRule,
} from '@/lib/merchant-auto-commission';
import { merchantSuggestedUnitPrice } from '@/lib/merchant-product-catalog';
import {
  findTier,
  hasMultipleTierOptions,
  noteWithSpec,
  parseTierIdFromForm,
  tierSpecLabel,
  unitPriceForTierSale,
  type MerchantProductTierOption,
} from '@/lib/merchant-product-tier';
import {
  LEGACY_MERCHANT_STOCK_TIER_ID,
  merchantStockUniqueWhere,
  resolveTierIdFromWeightGrams,
} from '@/lib/merchant-stock-key';
import { saleAmountsForQty } from '@/lib/merchant-settlement-sales';
import { nextStockTxnNumber, reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import { revalidatePath } from 'next/cache';
import { parseMerchantIndustry } from '@/lib/merchant-industry';
import { persistMerchantTypes } from '@/lib/merchant-types-persist';
import { createRestockOrderWithShipment } from '@/lib/merchant-restock-order';
import { parseRestockShippingFromForm } from '@/lib/orders/parse-restock-form';
import { shipmentItemsFingerprint } from '@/lib/shipment-queue-filters';
import {
  parseMerchantTypesFromForm,
  primaryMerchantType,
} from '@/lib/merchant-types';
import { redirect } from 'next/navigation';
import { syncPartnerStoreForJarExchangeMerchant } from '@/lib/stores/sync-merchant-stores';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toNullableField(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function stockSpecLabel(
  tiers: MerchantProductTierOption[],
  tierId: string,
  tier: MerchantProductTierOption | null,
) {
  if (tier) return tierSpecLabel(tier);
  if (tierId === LEGACY_MERCHANT_STOCK_TIER_ID && hasMultipleTierOptions(tiers)) {
    return '未分規格';
  }
  return null;
}

// ============================================================
// 0. 店家運輸／地址（進貨時自動帶入出貨單）
// ============================================================
export async function updateMerchantShipping(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  if (!merchantId) throw new Error('缺少店家');

  const preferredCarrier = toNullableField(formData.get('preferredCarrier'));
  let pickupStoreName = toNullableField(formData.get('pickupStoreName'));
  const contactName = toNullableField(formData.get('contactName'));
  const phone = toNullableField(formData.get('phone'));
  const email = toNullableField(formData.get('email'));
  const city = toNullableField(formData.get('city'));
  let address = toNullableField(formData.get('address'));

  const industryRaw = String(formData.get('industry') ?? '').trim();
  if (industryRaw && !parseMerchantIndustry(industryRaw)) {
    throw new Error('店家產業錯誤');
  }
  const industry = parseMerchantIndustry(industryRaw);

  const types = parseMerchantTypesFromForm(formData);
  if (types.length === 0) throw new Error('請至少選擇一種類型');

  if (preferredCarrier === CARRIER_711) {
    if (!pickupStoreName) throw new Error('請填寫 7-11 門市名稱');
    address = null;
  } else if (preferredCarrier === '黑貓') {
    pickupStoreName = null;
    if (!address) throw new Error('請填寫黑貓收件地址');
  }

  await prisma.$executeRaw`
    UPDATE "Merchant"
    SET
      "industry" = ${industry},
      "contactName" = ${contactName},
      "phone" = ${phone},
      "email" = ${email},
      "city" = ${city},
      "preferredCarrier" = ${preferredCarrier},
      "pickupStoreName" = ${pickupStoreName},
      "address" = ${address}
    WHERE "id" = ${merchantId}
  `;

  await persistMerchantTypes(prisma, merchantId, types);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, merchantId: true, name: true, status: true },
  });
  if (merchant) {
    await syncPartnerStoreForJarExchangeMerchant(prisma, merchant, types);
  }

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/restock`);
  revalidatePath('/merchants/restock');
  revalidatePath('/jar-exchange/stores');
  revalidatePath('/store-redeem');
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
// 1. 進貨：建立「待出貨」運送單；標記「已寄出」或「貨物到達」時寫入店家庫存（冪等）
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

  const itemsFingerprint = shipmentItemsFingerprint(
    items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
  );
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const recentPending = await prisma.shipment.findMany({
    where: {
      merchantId,
      type: 'merchant_restock',
      status: { in: ['pending', 'packed'] },
      createdAt: { gte: recentCutoff },
    },
    include: { items: { select: { productId: true, quantity: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const duplicate = recentPending.find(
    (s) => shipmentItemsFingerprint(s.items) === itemsFingerprint,
  );
  if (duplicate) {
    revalidatePath('/orders');
    revalidatePath('/shipments');
    if (duplicate.orderId) redirect(`/orders/${duplicate.orderId}`);
    redirect(`/shipments?s=${duplicate.id}`);
  }

  const pickup711 = resolve711PickupFromForm(formData, carrier);
  const shipping = parseRestockShippingFromForm(formData, carrier);
  const profileName = merchant.contactName ?? merchant.name;
  const profilePhone = merchant.phone;
  const profileAddress = merchant.address;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const { order, shipment } = await createRestockOrderWithShipment({
    merchantId,
    items,
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    recipientName: pickup711?.recipientName ?? profileName,
    recipientPhone: pickup711?.recipientPhone ?? profilePhone,
    recipientAddress: pickup711?.recipientAddress ?? profileAddress,
    carrier,
    notes: note,
    paymentStatus: shipping.paymentStatus,
    shippingFeeType: shipping.shippingFeeType,
    shippingMethod: shipping.shippingMethod,
    shippingFee: shipping.shippingFee,
    companyShippingCost: shipping.companyShippingCost,
    discount: shipping.discount,
    total: shipping.total,
    cvsBrand: shipping.cvsBrand,
  });

  for (const product of products) {
    await upsertSuggestedMerchantRule(prisma, merchantId, product);
  }

  revalidatePath('/orders');
  revalidatePath(`/orders/${order.id}`);
  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath('/merchants');
  revalidatePath('/shipments');
  redirect(`/shipments?s=${shipment.id}`);
}

// ============================================================
// 2. 登記庫存異動：寫庫存快照 + 一筆有原因的流水（僅「現場售出」計分潤）
// ============================================================
export async function adjustMerchantStock(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const newQuantity = Number(formData.get('newQuantity'));
  const note = String(formData.get('note') ?? '').trim() || null;
  const returnTo = String(formData.get('returnTo') ?? '').trim();
  if (!merchantId || !productId) throw new Error('缺少店家或商品');
  if (!Number.isFinite(newQuantity) || newQuantity < 0) throw new Error('庫存數量不合法');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { priceTiers: { orderBy: { price: 'asc' } } },
  });
  if (!product) throw new Error('商品不存在');

  const tiers: MerchantProductTierOption[] = product.priceTiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    notes: tier.notes,
  }));
  const tierId = parseTierIdFromForm(formData, tiers);
  const tier = findTier(tiers, tierId);
  const specLabel = stockSpecLabel(tiers, tierId, tier);

  const stockWhere = merchantStockUniqueWhere(merchantId, productId, tierId);
  const existing = await prisma.merchantStock.findUnique({ where: stockWhere });
  const before = existing?.quantity ?? 0;
  const delta = newQuantity - before;
  if (delta === 0) throw new Error('數量沒有變化');

  const reasonMeta = resolveStockMovementReason(
    delta,
    String(formData.get('reason') ?? ''),
  );
  if (reasonMeta.value === 'damage' && !note) {
    throw new Error('盤損／報廢請填寫備註');
  }

  const stock = await prisma.merchantStock.upsert({
    where: stockWhere,
    update: {
      quantity: newQuantity,
      lastCountAt: new Date(),
      ...(reasonMeta.txnType === 'sale' ? { lastSaleAt: new Date() } : {}),
      ...(reasonMeta.txnType === 'restock' ? { lastRestockAt: new Date() } : {}),
    },
    create: {
      merchantId,
      productId,
      tierId,
      quantity: newQuantity,
      lastCountAt: new Date(),
      ...(reasonMeta.txnType === 'sale' ? { lastSaleAt: new Date() } : {}),
      ...(reasonMeta.txnType === 'restock' ? { lastRestockAt: new Date() } : {}),
    },
  });

  const baseNote =
    note ??
    noteWithSpec(
      specLabel,
      `${reasonMeta.label}：${before} → ${newQuantity}`,
    );

  let commissionAmount: number | null = null;
  let txnId: string;

  if (reasonMeta.countsAsSale) {
    const soldQty = Math.abs(delta);
    const rule = await prisma.merchantProductRule.findUnique({
      where: { merchantId_productId: { merchantId, productId } },
    });
    const unitPrice = unitPriceForTierSale(tiers, tierId, {
      suggestedPrice: rule?.suggestedPrice ?? null,
      hasMerchantRule: !!rule,
      fallbackPrice: product.price,
    });
    const amounts = saleAmountsForQty(product, rule ?? undefined, soldQty, unitPrice);
    commissionAmount = amounts.commissionAmount;
    const txn = await prisma.merchantStockTxn.create({
      data: {
        txnNumber: await nextStockTxnNumber(prisma),
        merchantId,
        productId,
        type: 'sale',
        quantity: -soldQty,
        balanceAfter: stock.quantity,
        unitPrice: amounts.unitPrice,
        commissionAmount: amounts.commissionAmount,
        companyRevenue: amounts.companyRevenue,
        note: baseNote,
      },
    });
    txnId = txn.id;
  } else {
    const txn = await prisma.merchantStockTxn.create({
      data: {
        txnNumber: await nextStockTxnNumber(prisma),
        merchantId,
        productId,
        type: reasonMeta.txnType,
        quantity: delta,
        balanceAfter: stock.quantity,
        note: baseNote,
      },
    });
    txnId = txn.id;
  }

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/products`);
  revalidatePath(`/merchants/${merchantId}/rule`);
  revalidatePath(`/merchants/${merchantId}/adjust`);
  revalidatePath('/merchants/adjust');
  revalidatePath(`/merchants/${merchantId}/settlement`);
  revalidatePath('/merchants/settlements');
  revalidatePath('/merchants');

  const summaryParts = [
    product.name + (specLabel ? `（${specLabel}）` : ''),
    delta < 0 ? `−${Math.abs(delta)} 件` : `+${delta} 件`,
    reasonMeta.label,
  ];
  if (commissionAmount != null && commissionAmount > 0) {
    summaryParts.push(`店家分潤 NT$${Math.round(commissionAmount)}`);
  }
  const summary = `已記錄：${summaryParts.join('・')}`;
  const softResult = { ok: true as const, txnId, merchantId, tierId, summary };

  if (String(formData.get('softRefresh') ?? '') === '1') {
    return softResult;
  }
  redirect(returnTo || `/merchants/${merchantId}/products`);
}

/** 表單用：永遠 void（相容 server action form），完成後 redirect */
export async function adjustMerchantStockForm(formData: FormData): Promise<void> {
  formData.delete('softRefresh');
  void (await adjustMerchantStock(formData));
}

/** 5 秒內撤銷上一筆庫存異動（未結算流水才可） */
export async function undoMerchantStockMovement(formData: FormData) {
  const txnId = String(formData.get('txnId') ?? '').trim();
  const tierIdRaw = String(formData.get('tierId') ?? '');
  if (!txnId) throw new Error('缺少異動編號');

  const txn = await prisma.merchantStockTxn.findUnique({ where: { id: txnId } });
  if (!txn) throw new Error('找不到異動紀錄');
  if (txn.settlementId) throw new Error('此筆已納入結算，無法撤銷');

  const reverseDelta = -txn.quantity;
  const stockWhere = merchantStockUniqueWhere(txn.merchantId, txn.productId, tierIdRaw);
  const existing = await prisma.merchantStock.findUnique({ where: stockWhere });
  const nextQty = Math.max(0, (existing?.quantity ?? 0) + reverseDelta);

  await prisma.merchantStock.upsert({
    where: stockWhere,
    update: { quantity: nextQty, lastCountAt: new Date() },
    create: {
      merchantId: txn.merchantId,
      productId: txn.productId,
      tierId: tierIdRaw,
      quantity: nextQty,
      lastCountAt: new Date(),
    },
  });
  await prisma.merchantStockTxn.delete({ where: { id: txnId } });

  revalidatePath(`/merchants/${txn.merchantId}`);
  revalidatePath(`/merchants/${txn.merchantId}/products`);
  revalidatePath(`/merchants/${txn.merchantId}/adjust`);
  revalidatePath('/merchants/adjust');
  revalidatePath(`/merchants/${txn.merchantId}/settlement`);
  revalidatePath('/merchants');
  return { ok: true as const };
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
    include: {
      priceTiers: { orderBy: { price: 'asc' } },
    },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  // 計算
  let subtotal = 0;
  let totalCommission = 0;
  const itemRows = items.map((it) => {
    const product = productById.get(it.productId);
    if (!product) throw new Error('商品不存在');
    const rule = ruleByProduct.get(it.productId);
    const unitPrice = it.unitPrice || merchantSuggestedUnitPrice(product, rule);
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

  const saleTxnNumbers = await reserveStockTxnNumbers(prisma, itemRows.length);
  for (let i = 0; i < itemRows.length; i++) {
    const r = itemRows[i];
    const product = productById.get(r.productId);
    if (!product) continue;
    const tierId = resolveTierIdFromWeightGrams(product.priceTiers, r.weightGrams);
    const stockWhere = merchantStockUniqueWhere(merchantId, r.productId, tierId);
    const existing = await prisma.merchantStock.findUnique({ where: stockWhere });
    const before = existing?.quantity ?? 0;
    const after = before - r.quantity;
    await prisma.merchantStock.upsert({
      where: stockWhere,
      update: { quantity: after, lastSaleAt: new Date() },
      create: {
        merchantId,
        productId: r.productId,
        tierId,
        quantity: after,
        lastSaleAt: new Date(),
      },
    });
    await prisma.merchantStockTxn.create({
      data: {
        txnNumber: saleTxnNumbers[i],
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
  revalidatePath(`/merchants/${merchantId}/products`);
  redirect(`/merchants/${merchantId}/products`);
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

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      priceTiers: { orderBy: { price: 'asc' } },
    },
  });
  if (!product) throw new Error('商品不存在');

  const tiers: MerchantProductTierOption[] = product.priceTiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    notes: tier.notes,
  }));
  const tierId = parseTierIdFromForm(formData, tiers);
  const tier = findTier(tiers, tierId);
  const specLabel = stockSpecLabel(tiers, tierId, tier);

  const rule = await prisma.merchantProductRule.findUnique({
    where: { merchantId_productId: { merchantId, productId } },
  });
  const unitPrice = unitPriceForTierSale(tiers, tierId, {
    suggestedPrice: rule?.suggestedPrice ?? null,
    hasMerchantRule: !!rule,
    fallbackPrice: product.price,
  });
  const calc = rule
    ? commissionFor(rule, quantity, unitPrice)
    : { perUnit: 0, commission: 0, gross: unitPrice * quantity, companyRevenue: unitPrice * quantity };

  const stockWhere = merchantStockUniqueWhere(merchantId, productId, tierId);
  const existing = await prisma.merchantStock.findUnique({ where: stockWhere });
  const before = existing?.quantity ?? 0;
  const after = before - quantity;

  await prisma.merchantStock.upsert({
    where: stockWhere,
    update: { quantity: after, lastSaleAt: new Date() },
    create: {
      merchantId,
      productId,
      tierId,
      quantity: after,
      lastSaleAt: new Date(),
    },
  });

  await prisma.merchantStockTxn.create({
    data: {
      txnNumber: await nextStockTxnNumber(prisma),
      merchantId,
      productId,
      type: 'sale',
      quantity: -quantity,
      balanceAfter: after,
      unitPrice,
      commissionAmount: calc.commission,
      companyRevenue: calc.companyRevenue,
      note: note ?? noteWithSpec(specLabel, '快速登記銷售'),
    },
  });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/adjust`);
  revalidatePath('/merchants/adjust');
  revalidatePath(`/merchants/${merchantId}/settlement`);
  revalidatePath('/merchants/settlements');
  revalidatePath('/merchants');
  redirect(`/merchants/adjust?merchantId=${merchantId}`);
}

// ============================================================
// 4. 分潤規則：手動 upsert ／依品名自動填寫（肉乾 20%、凍乾 30%）
// ============================================================
export async function autoFillMerchantCommissionRules(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  if (!merchantId) throw new Error('缺少店家');

  await autoFillMerchantCommissionRulesForMerchant(prisma, merchantId);

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/products`);
  revalidatePath(`/merchants/${merchantId}/rule`);
  revalidatePath(`/merchants/${merchantId}/adjust`);
  redirect(`/merchants/${merchantId}/products`);
}

export async function upsertMerchantRule(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const suggestedPrice = Number(formData.get('suggestedPrice'));
  const commissionPercent = parseMerchantCommissionPercent(formData);
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!merchantId || !productId) throw new Error('缺少店家或商品');
  if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) throw new Error('建議售價不合法');

  await prisma.merchantProductRule.upsert({
    where: { merchantId_productId: { merchantId, productId } },
    update: {
      suggestedPrice,
      commissionMode: 'percent',
      commissionValue: commissionPercent,
      notes,
    },
    create: {
      merchantId,
      productId,
      suggestedPrice,
      commissionMode: 'percent',
      commissionValue: commissionPercent,
      notes,
    },
  });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/products`);
  revalidatePath(`/merchants/${merchantId}/rule`);
  redirect(`/merchants/${merchantId}/products`);
}

export async function deleteMerchantRule(formData: FormData) {
  const ruleId = String(formData.get('ruleId') ?? '');
  const merchantId = String(formData.get('merchantId') ?? '');
  if (!ruleId) throw new Error('缺少規則 ID');

  await prisma.merchantProductRule.delete({ where: { id: ruleId } });
  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/products`);
  revalidatePath(`/merchants/${merchantId}/rule`);
  redirect(`/merchants/${merchantId}/products`);
}

// ============================================================
// 4b. 刪除寄賣商品：移除此店此商品的庫存列與分潤規則
//     （歷史流水 MerchantStockTxn 保留，供結算與報表追溯）
// ============================================================
export async function removeMerchantProduct(formData: FormData) {
  const merchantId = String(formData.get('merchantId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '').trim();
  if (!merchantId || !productId) throw new Error('缺少店家或商品');

  // 有尚未結算的銷售流水時，禁止刪除，以免漏結帳款
  const unsettledSale = await prisma.merchantStockTxn.findFirst({
    where: { merchantId, productId, type: 'sale', settlementId: null },
    select: { id: true },
  });
  if (unsettledSale) {
    throw new Error('此商品仍有未結算的銷售紀錄，請先完成結算後再刪除。');
  }

  await prisma.merchantProductRule.deleteMany({ where: { merchantId, productId } });
  await prisma.merchantStock.deleteMany({ where: { merchantId, productId } });

  revalidatePath(`/merchants/${merchantId}`);
  revalidatePath(`/merchants/${merchantId}/products`);
  redirect(redirectTo || `/merchants/${merchantId}/products`);
}
