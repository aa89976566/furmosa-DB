// 從你 Downloads 裡的 4 個 Furmosa CSV/TSV 檔案匯入真實資料。
//
// 注意：你目前匯出的 4 個檔案中，有 3 個是「總覽 / Dashboard 分頁」，
// 不是實際資料分頁。我從這些檔案裡能撈到的真實資料是：
//
//   1) 食品客戶下單 - 營運.csv         → 撈出「商品營收排行」7 個商品
//   2) 換罐計畫 - 潛在續約客戶.csv     → 客戶編號 28/36/41/42/44/54/58 (待補真名)
//   3) 廠商合作分成計算表 - 總覽.csv   → 沒有資料 (僅是各分頁的計數)
//   4) 每週任務 - 週任務.tsv           → 林春蓮 / 王俐婷 / 客戶45號 + 3 筆任務
//
// 真正的「廠商主檔、店家主檔、商品主檔、客戶資料、會員總表」需要你
// 在每個 Google Sheet 切到該分頁、檔案 → 下載 → CSV 後再放進來。

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { formatCustomerId, maxCustomerIdSeq } from '../lib/customers/customer-id';

// 本機 import 走 DIRECT_URL（5432，不經 PgBouncer），避免 connection_limit=1 把大量 upsert 排隊
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});
const DOWNLOADS = '/Users/macbook/Downloads';
const pad = (n: number, width = 4) => String(n).padStart(width, '0');

// ============================================================
// CSV 解析（簡易版：支援 "" 引號 + 跳脫）
// ============================================================
function parseCsv(raw: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\r') {
        // ignore
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function readCsv(filename: string, delimiter = ','): string[][] | null {
  const fp = path.join(DOWNLOADS, filename);
  if (!fs.existsSync(fp)) {
    console.warn(`⚠ 找不到 ${fp}`);
    return null;
  }
  const raw = fs.readFileSync(fp, 'utf8');
  return parseCsv(raw, delimiter);
}

// ============================================================
// 解析「日期」欄位 (5/10 → 今年 5 月 10 日)
// ============================================================
function parseChineseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const now = new Date();
  return new Date(now.getFullYear(), month - 1, day);
}

// ============================================================
// (1) 食品客戶下單 - 營運.csv → 抽出商品營收排行
// ============================================================
async function importProducts() {
  const rows = readCsv('食品客戶下單 - 營運.csv');
  if (!rows) return [];

  // 「商品營收排行」區塊的格式：
  // 排名,產品,營收,
  // 1,胡蘿蔔雞霸,"1,264",
  const productNames: Array<{ name: string; revenue: number }> = [];
  for (const r of rows) {
    if (r.length < 9) continue;
    // 「商品營收排行」區塊位於 col 6/7/8
    const rankStr = r[6];
    const name = r[7];
    const rev = r[8];
    if (!rankStr || !name) continue;
    const rank = Number(rankStr);
    if (!Number.isFinite(rank) || rank < 1 || rank > 99) continue;
    if (name === '產品' || name.length === 0) continue;
    const revenue = Number(String(rev).replace(/[",]/g, '')) || 0;
    productNames.push({ name, revenue });
  }

  console.log(`📦 從 dashboard 讀到 ${productNames.length} 個商品`);

  const created: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < productNames.length; i++) {
    const p = productNames[i];
    // 為了讓系統有真實商品可用，先建一個基本 product
    const product = await prisma.product.upsert({
      where: { sku: `FUR-${pad(i + 1, 4)}` },
      update: {},
      create: {
        productId: `PROD-${pad(i + 1)}`,
        sku: `FUR-${pad(i + 1, 4)}`,
        name: p.name,
        category: p.name.includes('凍乾')
          ? 'freeze_dried'
          : p.name.includes('蔬果')
          ? 'treats'
          : 'treats',
        price: 0, // 先填 0，待你給商品主檔的真實定價
        cost: 0,
        unit: '件',
        reorderPoint: 5,
        status: 'active',
        description: `從營運報表抓到的真實商品名（待補上完整資料）`,
      },
    });
    created.push({ id: product.id, name: product.name });
  }
  return created;
}

// ============================================================
// (2) 換罐計畫 - 潛在續約客戶.csv
// 這個分頁只有編號（28/36/41…），沒有姓名。
// 不要建佔位客戶 — 等使用者匯入「客戶資料」分頁時再用編號補完整資料。
// 我們只把這些編號變成「待補名單」的 Task，讓營運可以追蹤。
// ============================================================
async function importPotentialRenewMembers() {
  const rows = readCsv('換罐計畫 - 潛在續約客戶.csv');
  if (!rows) return;

  const memberNotes = new Map<number, string[]>();
  for (const r of rows) {
    const action = r[0]?.trim() || '';
    if (!action) continue;
    for (const cell of r.slice(1)) {
      const m = cell?.trim().match(/^(\d+)(?:[（(](.+?)[）)])?$/);
      if (m) {
        const id = Number(m[1]);
        if (id > 0 && id < 1000) {
          const notes = memberNotes.get(id) ?? [];
          notes.push(m[2] ? `${action}（${m[2]}）` : action);
          memberNotes.set(id, notes);
        }
      }
    }
  }

  if (memberNotes.size === 0) return;

  const summary = [...memberNotes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, notes]) => `#${id}: ${notes.join(' / ')}`)
    .join('\n');

  console.log(`👥 換罐計畫追單名單：${memberNotes.size} 位客戶（已彙整成一筆任務，不建佔位客戶）`);

  await prisma.task.upsert({
    where: { taskId: 'TASK-RENEW-LIST' },
    update: { description: `潛在續約客戶編號清單：\n${summary}` },
    create: {
      taskId: 'TASK-RENEW-LIST',
      title: `追蹤換罐潛在續約客戶（${memberNotes.size} 位）`,
      description: `潛在續約客戶編號清單：\n${summary}\n\n請在系統「客戶」頁建立或匯入這些客戶的真實姓名後，再來追單。`,
      type: 'customer_service',
      status: 'todo',
      priority: 'medium',
      reference: '[來源] 換罐計畫 - 潛在續約客戶.csv',
    },
  });
}

// ============================================================
// (4) 每週任務 - 週任務.tsv → 抽 customer + 寄賣店 + task + subscription shipment
// ============================================================
async function importWeeklyTasks() {
  const rows = readCsv('每週任務 - 週任務.tsv', '\t');
  if (!rows) return;

  // 標頭：日期 / 清單 / 清單 / 確認肉源 / 送貨 / 名稱 / 電話 / 地址 / 備註
  const dataRows = rows.slice(1).filter((r) => r[0]?.trim());

  // ⚠ 注意：地址欄裡的「XX門市」不是寄賣店家，是客戶取貨的店點。
  //   不再從這裡建寄賣店家。寄賣店家請以 importMerchantsAndRules() 為準。

  // 1. 收集真實客戶（有名稱、地址的）
  const customersNeeded = new Map<
    string,
    { phone: string; address: string; lineName?: string }
  >();
  for (const r of dataRows) {
    const name = r[5]?.trim();
    const phone = r[6]?.trim() ?? '';
    const address = r[7]?.trim() ?? '';
    if (name) {
      const cleanPhone = phone.replace(/^免運\s*/i, '').trim();
      customersNeeded.set(name, {
        phone: cleanPhone,
        address,
        lineName: phone.includes('免運') ? `免運客戶（${name}）` : undefined,
      });
    }
  }

  console.log(`👤 從週任務抓到 ${customersNeeded.size} 位真實客戶（含名稱）`);

  // 建立客戶
  const customerMap = new Map<string, string>(); // name → id
  let custSeq = 100; // 從 100 開始，避免跟 換罐會員 # 衝突
  for (const [name, info] of customersNeeded) {
    const customerId = formatCustomerId(custSeq++);
    const customer = await prisma.customer.upsert({
      where: { customerId },
      update: {},
      create: {
        customerId,
        name,
        type: 'individual',
        phone: info.phone || null,
        address: info.address || null,
        lineDisplay: info.lineName ?? null,
        tags: JSON.stringify(['訂閱會員']),
        notes: `[來源] 每週任務 - 週任務分頁`,
      },
    });
    customerMap.set(name, customer.id);
  }

  // 2. 取得 plan 對照 (豪華組 / 標準組 / 小食組)
  const plans = await prisma.subscriptionPlan.findMany();
  const planByName = new Map(plans.map((p) => [p.name, p]));

  // 3. 建任務 + 訂閱（idempotent：用穩定 ID upsert）
  let createdTasks = 0;
  let createdSubs = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const dateStr = r[0]?.trim() ?? '';
    const planName = r[2]?.trim() ?? '';
    const description = r[3]?.trim() ?? '';
    const name = r[5]?.trim() ?? '';
    const phone = r[6]?.trim() ?? '';
    const address = r[7]?.trim() ?? '';
    const note = r[8]?.trim() ?? '';

    const dueDate = parseChineseDate(dateStr);
    const isShipment = !!planByName.get(planName);

    // 穩定的 task id：以 row index 為基準
    const taskId = `TASK-WK-${pad(i + 1, 3)}`;
    const taskTitle = name
      ? `寄送 ${planName || '訂閱包'} → ${name}`
      : `每週任務：${description.slice(0, 30) || dateStr}`;
    const taskDescription = [
      description && `內容：${description}`,
      name && `客戶：${name}`,
      phone && `電話：${phone}`,
      address && `地址：${address}`,
      note && `備註：${note}`,
    ]
      .filter(Boolean)
      .join('\n');

    await prisma.task.upsert({
      where: { taskId },
      update: {
        title: taskTitle,
        description: taskDescription,
        type: isShipment ? 'shipment' : 'general',
        priority: 'medium',
        dueDate,
        reference: '[來源] 週任務.tsv',
      },
      create: {
        taskId,
        title: taskTitle,
        description: taskDescription,
        type: isShipment ? 'shipment' : 'general',
        status: 'todo',
        priority: 'medium',
        dueDate,
        reference: '[來源] 週任務.tsv',
      },
    });
    createdTasks++;

    // 訂閱合約（per customer + plan，重跑會 update）
    const customerId = name ? customerMap.get(name) : null;
    const plan = planByName.get(planName);
    if (customerId && plan && dueDate) {
      const subscriptionNo = `SUB-WK-${pad(i + 1, 3)}`;
      const startDate = new Date(dueDate);
      startDate.setMonth(startDate.getMonth() - 1);
      const sub = await prisma.subscription.upsert({
        where: { subscriptionNo },
        update: {
          customerId,
          planId: plan.id,
          status: 'active',
          recipientName: name,
          recipientPhone: phone || '0900-000-000',
          shippingAddress: address || '台北市',
          notes: `自週任務匯入：${description}`,
          nextShipmentDate: dueDate,
        },
        create: {
          subscriptionNo,
          customerId,
          planId: plan.id,
          status: 'active',
          billingCycle: 'monthly',
          startDate,
          recipientName: name,
          recipientPhone: phone || '0900-000-000',
          shippingAddress: address || '台北市',
          notes: `自週任務匯入：${description}`,
          nextShipmentDate: dueDate,
        },
      });
      createdSubs++;

      const shipmentNo = `SHIP-WK-${pad(i + 1, 3)}`;
      await prisma.subscriptionShipment.upsert({
        where: { shipmentNo },
        update: {
          scheduledDate: dueDate,
          notes: description,
        },
        create: {
          shipmentNo,
          subscriptionId: sub.id,
          scheduledDate: dueDate,
          status: 'pending',
          notes: description,
        },
      });

      await prisma.customer.update({
        where: { id: customerId },
        data: { hasActiveSubscription: true },
      });
    }
  }

  console.log(`📋 已 upsert ${createdTasks} 筆任務、${createdSubs} 筆訂閱合約`);
}

// ============================================================
// 從截圖手打的「廠商合作分成計算表」資料
//   - 出貨紀錄 (寄到各店的歷史)
//   - 寄賣分成 / 店家商品規則 (商品×店家：建議售價、抽成)
// 等使用者匯出對應分頁 CSV 後，這裡可以改成讀檔。
// 全部都是 idempotent (upsert)，可以安全重跑。
// ============================================================
type CommissionRule = {
  product: string; // 商品名（系統內 product.name）
  merchant: string; // 店家名（系統內 merchant.name）
  suggestedPrice: number;
  commissionMode: 'amount' | 'percent';
  commissionValue: number;
};

const CONSIGNMENT_MERCHANTS: Array<{ name: string; aliases?: string[]; city?: string }> = [
  { name: '淡水妞妞', city: '新北' },
  { name: '犬派' },
  { name: '星汪樂寵', aliases: ['星樂'] },
  { name: '泡泡堂' },
  { name: '柒沐' },
];

// 不再使用、要從系統刪除的舊店家（早期從週任務地址欄誤建的）
const REMOVED_MERCHANTS = ['怡富門市', '延埕門市'];

// 從截圖 2「寄賣分成 / 店家商品規則」抓的：
// 注意：產品 master 不再帶 g 數，g 數記錄在 ShipmentItem / OrderItem 上。
const COMMISSION_RULES: CommissionRule[] = [
  { product: '簡記牛肉地瓜', merchant: '淡水妞妞', suggestedPrice: 160, commissionMode: 'amount', commissionValue: 60 },
  { product: '壕大大雞霸*原味', merchant: '淡水妞妞', suggestedPrice: 89, commissionMode: 'amount', commissionValue: 30 },
  { product: '壕大大雞霸*原味', merchant: '犬派', suggestedPrice: 89, commissionMode: 'percent', commissionValue: 20 },
  { product: '蔬果凍乾', merchant: '泡泡堂', suggestedPrice: 260, commissionMode: 'percent', commissionValue: 20 },
  { product: '雞肉丁凍乾', merchant: '泡泡堂', suggestedPrice: 255, commissionMode: 'percent', commissionValue: 20 },
  { product: '壕大大雞霸*原味', merchant: '泡泡堂', suggestedPrice: 89, commissionMode: 'percent', commissionValue: 20 },
  { product: '壕大大雞霸*原味', merchant: '星汪樂寵', suggestedPrice: 89, commissionMode: 'percent', commissionValue: 20 },
  { product: '簡記牛肉地瓜', merchant: '星汪樂寵', suggestedPrice: 160, commissionMode: 'percent', commissionValue: 20 },
];

// 從截圖 1「出貨紀錄」抓的（寄賣調撥到店家）：
// weightGrams 會記到 MerchantStockTxn → 之後可在 ShipmentItem 顯示 g 數
const SHIPMENT_RECORDS: Array<{
  date: string;
  product: string;
  weightGrams: number | null;
  merchant: string;
  qty: number;
  note?: string;
}> = [
  { date: '2026-03-14', product: '簡記牛肉地瓜', weightGrams: 50, merchant: '淡水妞妞', qty: 10 },
  { date: '2026-03-14', product: '壕大大雞霸*原味', weightGrams: null, merchant: '淡水妞妞', qty: 5 },
  { date: '2026-03-18', product: '簡記牛肉地瓜', weightGrams: 50, merchant: '淡水妞妞', qty: 5 },
  { date: '2026-03-18', product: '壕大大雞霸*原味', weightGrams: null, merchant: '淡水妞妞', qty: 2 },
  { date: '2026-03-31', product: '壕大大雞霸*原味', weightGrams: null, merchant: '犬派', qty: 5 },
  { date: '2026-04-01', product: '壕大大雞霸*原味', weightGrams: null, merchant: '星汪樂寵', qty: 8, note: '0' },
  { date: '2026-04-01', product: '簡記牛肉地瓜', weightGrams: 50, merchant: '星汪樂寵', qty: 5, note: '2' },
  { date: '2026-04-01', product: '壕大大雞霸*原味', weightGrams: null, merchant: '泡泡堂', qty: 5, note: '0' },
  { date: '2026-04-01', product: '雞肉丁凍乾', weightGrams: 50, merchant: '泡泡堂', qty: 3, note: '2' },
  { date: '2026-04-01', product: '蔬果凍乾', weightGrams: 50, merchant: '泡泡堂', qty: 3 },
  { date: '2026-04-17', product: '鴨喉嚨', weightGrams: 30, merchant: '泡泡堂', qty: 3 },
  { date: '2026-04-17', product: '鴨肉蘋果', weightGrams: 30, merchant: '泡泡堂', qty: 3 },
  { date: '2026-04-17', product: '柳葉魚凍乾', weightGrams: 30, merchant: '泡泡堂', qty: 3 },
];

async function importMerchantsAndRules() {
  // 0. 清掉舊的、誤建的門市（不是寄賣店家）
  for (const name of REMOVED_MERCHANTS) {
    const removed = await prisma.merchant.deleteMany({ where: { name } });
    if (removed.count > 0) console.log(`🗑  移除舊店家「${name}」(${removed.count} 筆)`);
  }

  // 1. 寄賣店家（沿用 MER-0010+，避免改 ID 影響既有關聯）
  let merchantSeq = 10;
  const merchantIdByName = new Map<string, string>();
  for (const m of CONSIGNMENT_MERCHANTS) {
    const merchantId = `MER-${pad(merchantSeq++)}`;
    const merchant = await prisma.merchant.upsert({
      where: { merchantId },
      update: {
        name: m.name,
        city: m.city ?? undefined,
      },
      create: {
        merchantId,
        name: m.name,
        type: 'consignment',
        city: m.city ?? null,
        commissionRate: 0.2, // 預設 20%（個別商品仍以 MerchantProductRule 為準）
        status: 'active',
        notes: [
          '[來源] 廠商合作分成計算表',
          m.aliases?.length ? `別名：${m.aliases.join('、')}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
    merchantIdByName.set(m.name, merchant.id);
    for (const alias of m.aliases ?? []) merchantIdByName.set(alias, merchant.id);
  }

  // 2. 商品 — 以「名稱」為主鍵（避免重複建 g 版本）；已存在就 update，缺則用下一個閒置 SKU 建
  const allProductNames = new Set<string>();
  for (const r of COMMISSION_RULES) allProductNames.add(r.product);
  for (const r of SHIPMENT_RECORDS) allProductNames.add(r.product);

  let productSeq = 1;
  const productIdByName = new Map<string, string>();
  for (const name of allProductNames) {
    const cat = name.includes('凍乾')
      ? 'freeze_dried'
      : name.includes('肉地瓜') || name.includes('雞霸')
        ? 'treats'
        : name.includes('喉嚨') || name.includes('蘋果')
          ? 'treats'
          : 'treats';

    const rules = COMMISSION_RULES.filter((r) => r.product === name);
    const defaultPrice = rules.length ? Math.max(...rules.map((r) => r.suggestedPrice)) : 0;

    const existing = await prisma.product.findFirst({ where: { name } });
    if (existing) {
      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: existing.price > 0 ? existing.price : defaultPrice,
        },
      });
      productIdByName.set(name, updated.id);
    } else {
      // 找下一個閒置 SKU
      while (true) {
        const sku = `FUR-${pad(productSeq, 4)}`;
        const taken = await prisma.product.findUnique({ where: { sku } });
        if (!taken) break;
        productSeq++;
      }
      const sku = `FUR-${pad(productSeq, 4)}`;
      const productId = `PROD-${pad(productSeq)}`;
      productSeq++;
      const created = await prisma.product.create({
        data: {
          productId,
          sku,
          name,
          category: cat,
          unit: '件',
          price: defaultPrice,
          cost: 0,
          reorderPoint: 5,
          status: 'active',
          description: '[來源] 廠商合作分成計算表 - 寄賣分成',
        },
      });
      productIdByName.set(name, created.id);
    }
  }

  // 3. 規則 (MerchantProductRule)
  let ruleCount = 0;
  for (const rule of COMMISSION_RULES) {
    const merchantId = merchantIdByName.get(rule.merchant);
    const productId = productIdByName.get(rule.product);
    if (!merchantId || !productId) continue;
    await prisma.merchantProductRule.upsert({
      where: { merchantId_productId: { merchantId, productId } },
      update: {
        suggestedPrice: rule.suggestedPrice,
        commissionMode: rule.commissionMode,
        commissionValue: rule.commissionValue,
      },
      create: {
        merchantId,
        productId,
        suggestedPrice: rule.suggestedPrice,
        commissionMode: rule.commissionMode,
        commissionValue: rule.commissionValue,
        notes: '[來源] 寄賣分成（截圖手打）',
      },
    });
    ruleCount++;
  }

  // 4. 出貨紀錄 → 雙寫
  //    a) InventoryTransaction (transfer)：保留總公司視角的歷史庫存帳
  //    b) MerchantStockTxn (restock) + MerchantStock：店家視角，可即時看店家還剩多少
  const consignWh = await prisma.warehouse.findFirst({ where: { code: 'WH-CONSIGN' } });

  // 重跑時先把舊的出貨紀錄清一次，再依 SHIPMENT_RECORDS 重新寫
  await prisma.merchantStockTxn.deleteMany({
    where: { type: 'restock', note: { contains: '[來源] 出貨紀錄' } },
  });

  // 重置 stock：所有相關 (merchant, product) 先歸零，再依 restock 累加
  for (const merchant of CONSIGNMENT_MERCHANTS) {
    const merchantId = merchantIdByName.get(merchant.name);
    if (!merchantId) continue;
    await prisma.merchantStock.updateMany({
      where: { merchantId },
      data: { quantity: 0, lastRestockAt: null, lastSaleAt: null, lastCountAt: null },
    });
  }

  let shipSeq = 1;
  for (const s of SHIPMENT_RECORDS) {
    const productId = productIdByName.get(s.product);
    if (!productId) continue;
    const merchantId = merchantIdByName.get(s.merchant);
    if (!merchantId) continue;

    const ts = new Date(s.date);
    const merchantTag =
      CONSIGNMENT_MERCHANTS.find((m) => m.name === s.merchant || m.aliases?.includes(s.merchant))
        ?.name ?? s.merchant;

    // (a) InventoryTransaction
    if (consignWh) {
      const txnNumber = `INV-CONSIGN-${pad(shipSeq, 4)}`;
      await prisma.inventoryTransaction.upsert({
        where: { txnNumber },
        update: {
          quantity: s.qty,
          createdAt: ts,
          note: `寄到 ${merchantTag}${s.note ? ` (備註：${s.note})` : ''}`,
        },
        create: {
          txnNumber,
          type: 'transfer',
          productId,
          warehouseId: consignWh.id,
          quantity: s.qty,
          reference: merchantTag,
          note: `寄到 ${merchantTag}${s.note ? ` (備註：${s.note})` : ''}`,
          createdAt: ts,
        },
      });
    }

    // (b) MerchantStock += qty + MerchantStockTxn
    const stock = await prisma.merchantStock.upsert({
      where: { merchantId_productId: { merchantId, productId } },
      update: {
        quantity: { increment: s.qty },
        lastRestockAt: ts,
      },
      create: {
        merchantId,
        productId,
        quantity: s.qty,
        lastRestockAt: ts,
      },
    });

    const stockTxnNumber = `MTXN-IMPORT-${pad(shipSeq, 4)}`;
    await prisma.merchantStockTxn.create({
      data: {
        txnNumber: stockTxnNumber,
        merchantId,
        productId,
        type: 'restock',
        quantity: s.qty,
        balanceAfter: stock.quantity,
        note: `[來源] 出貨紀錄${s.note ? `（備註：${s.note}）` : ''}`,
        createdAt: ts,
      },
    });

    shipSeq++;
  }

  console.log(
    `🏪 寄賣店家 ${CONSIGNMENT_MERCHANTS.length} 家、商品 ${allProductNames.size} 項、規則 ${ruleCount} 筆、出貨/進貨紀錄 ${SHIPMENT_RECORDS.length} 筆（已寫入店家庫存）`,
  );
}

// ============================================================
// 單價表（「商品單價表」分頁：A=廠商、B=SKU…）
// 試算表「廠商訂單」分頁 (gid=81103062) 的 B 欄是「廠商 id」（飽管家／寵物村／Nibo），
// 與單價表 B 欄（SKU）不同，匯入時請勿混用。
// https://docs.google.com/spreadsheets/d/1K1WkNFb3Rqr2JGn1Y0L-VySN2PsmSjrzC0SA3TxTmmA/edit?gid=81103062
// ============================================================
type PriceRow = {
  vendor?: string; // 飽管家 / 匠寵 / Nibo / 寵物村
  sourceSku: string;
  name: string;
  category?: 'treats' | 'health' | 'freeze_dried' | 'staple_food' | 'other';
  cost?: number;
  style?: string;
  unit: string; // 克 / 隻 / 片
  prices: { weightGrams?: number; unitQty?: number; price: number; cost?: number; notes?: string }[];
  isActive?: boolean; // false = 紅色列 (停售)
  notes?: string;
};
const PRICE_LIST: PriceRow[] = [
  // ── 飽管家 ──
  {
    vendor: '飽管家',
    sourceSku: 'DK-01',
    name: '小魚乾',
    category: 'treats',
    cost: 2.8,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 84 },
      { weightGrams: 50, price: 140 },
      { weightGrams: 100, price: 250 },
    ],
    notes: '滷小小三拼 120元',
  },
  {
    vendor: '飽管家',
    sourceSku: 'DK-02',
    name: '鴨喉嚨',
    category: 'treats',
    cost: 3,
    unit: '克',
    prices: [{ weightGrams: 30, price: 105 }],
  },
  {
    vendor: '飽管家',
    sourceSku: 'DK-03',
    name: '鴨肺',
    category: 'treats',
    cost: 3,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 105 },
      { weightGrams: 50, price: 160 },
    ],
  },
  {
    vendor: '飽管家',
    sourceSku: 'DK-05',
    name: '鴨翅',
    category: 'treats',
    cost: 2.8,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 90 },
      { weightGrams: 50, price: 150 },
    ],
  },

  // ── Nibo 零嘴（原 PK 豬系列）──
  {
    vendor: 'Nibo',
    sourceSku: 'PK-01',
    name: '豬蛋蛋',
    category: 'treats',
    cost: 4.5,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 135 },
      { weightGrams: 50, price: 225 },
    ],
  },
  {
    vendor: 'Nibo',
    sourceSku: 'PK-02',
    name: '豬耳朵片',
    category: 'treats',
    cost: 3.2,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 96 },
      { weightGrams: 50, price: 160 },
      { weightGrams: 100, price: 320 },
    ],
  },
  {
    vendor: 'Nibo',
    sourceSku: 'PK-03',
    name: '豬耳朵條',
    category: 'treats',
    cost: 3.5,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 105 },
      { weightGrams: 50, price: 175 },
    ],
  },

  // ── 匠寵・肉乾 ──
  {
    vendor: '匠寵',
    sourceSku: 'DK-04',
    name: '鴨肉蘋果乾',
    category: 'treats',
    cost: 4.2,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 96 },
      { weightGrams: 50, price: 210 },
      { weightGrams: 100, price: 385 },
    ],
  },
  {
    vendor: '匠寵',
    sourceSku: 'BF-02',
    name: '牛肉地瓜乾',
    category: 'treats',
    cost: 3.2,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 96 },
      { weightGrams: 50, price: 160 },
      { weightGrams: 100, price: 300 },
    ],
  },
  {
    vendor: '匠寵',
    sourceSku: 'CK-04',
    name: '雞肉南瓜乾',
    category: 'treats',
    cost: 2.5,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 75 },
      { weightGrams: 50, price: 125 },
      { weightGrams: 100, price: 220 },
    ],
  },
  {
    vendor: '匠寵',
    sourceSku: 'CK-05',
    name: '原味雞霸',
    category: 'treats',
    style: '原味',
    unit: '片',
    prices: [{ unitQty: 1, price: 89 }],
  },
  {
    vendor: '匠寵',
    sourceSku: 'CK-06',
    name: '胡蘿蔔雞霸',
    category: 'treats',
    style: '蔬果',
    unit: '片',
    prices: [{ unitQty: 1, price: 79 }],
  },
  {
    vendor: 'Nibo',
    sourceSku: 'CK-08',
    name: '貓草雞肉薄片',
    category: 'treats',
    cost: 4.2,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 126 },
      { weightGrams: 50, price: 210 },
    ],
  },
  {
    vendor: '匠寵',
    sourceSku: 'CK-07',
    name: '蝶豆花雞肉薄片',
    category: 'treats',
    cost: 4.2,
    isActive: false,
    unit: '片',
    prices: [{ unitQty: 1, price: 89 }],
  },

  // ── 凍乾系列 (FD) ──
  {
    sourceSku: 'FD-01',
    name: '雞肝凍乾',
    category: 'freeze_dried',
    cost: 4,
    unit: '克',
    prices: [{ weightGrams: 30, price: 125 }],
  },
  {
    sourceSku: 'FD-02',
    name: '雞肉丁凍乾',
    category: 'freeze_dried',
    cost: 1.8,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 135 },
      { weightGrams: 50, price: 220 },
    ],
  },
  {
    sourceSku: 'FD-03',
    name: '雞肉串凍乾',
    category: 'freeze_dried',
    cost: 4.8,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 144 },
      { weightGrams: 50, price: 220 },
    ],
  },
  {
    vendor: 'Nibo',
    sourceSku: 'FD-04',
    name: '青蛙凍乾',
    category: 'freeze_dried',
    cost: 70,
    unit: '隻',
    prices: [
      { unitQty: 1, price: 175 },
      { unitQty: 5, price: 325, notes: '5隻特價' },
    ],
  },
  {
    vendor: 'Nibo',
    sourceSku: 'FD-05',
    name: '南瓜凍乾',
    category: 'freeze_dried',
    cost: 1.7,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 120 },
      { weightGrams: 50, price: 195 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-06',
    name: '鵪鶉凍乾',
    category: 'freeze_dried',
    cost: 50,
    unit: '隻',
    prices: [
      { unitQty: 1, price: 75 },
      { weightGrams: 50, price: 330 },
      { weightGrams: 100, price: 520 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-07',
    name: '柳葉魚凍乾',
    category: 'freeze_dried',
    cost: 2.5,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 115 },
      { weightGrams: 50, price: 174 },
      { weightGrams: 100, price: 255 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-08',
    name: '水晶魚凍乾',
    category: 'freeze_dried',
    cost: 2.5,
    unit: '克',
    prices: [
      { weightGrams: 50, price: 195 },
      { weightGrams: 100, price: 300 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-09',
    name: '丁香魚凍乾',
    category: 'freeze_dried',
    cost: 3.2,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 130 },
      { weightGrams: 50, price: 216 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-10',
    name: '牛肉丁凍乾',
    category: 'freeze_dried',
    cost: 3.5,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 150 },
      { weightGrams: 50, price: 245 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-11',
    name: '虱目魚凍乾',
    category: 'freeze_dried',
    cost: 5.7,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 156 },
      { weightGrams: 50, price: 255 },
      { weightGrams: 100, price: 498 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-12',
    name: '混合蔬果凍乾',
    category: 'freeze_dried',
    cost: 1.7,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 156 },
      { weightGrams: 50, price: 280 },
    ],
  },
  {
    vendor: 'Nibo',
    sourceSku: 'FD-13',
    name: '櫛瓜凍乾',
    category: 'freeze_dried',
    cost: 1.7,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 120 },
      { weightGrams: 50, price: 195 },
    ],
  },
  {
    vendor: '寵物村',
    sourceSku: 'FD-14',
    name: '鴨脖凍乾',
    category: 'freeze_dried',
    cost: 3,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 105 },
      { weightGrams: 50, price: 160 },
    ],
  },

  // ── 粉類補品 (PF) ──
  {
    sourceSku: 'PF-01',
    name: '雞肝凍乾粉',
    category: 'health',
    cost: 2.9,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 95 },
      { weightGrams: 50, price: 155 },
    ],
  },
  {
    sourceSku: 'PF-02',
    name: '雞肉紅麴凍乾粉',
    category: 'health',
    cost: 3.6,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 100 },
      { weightGrams: 50, price: 180 },
    ],
  },
  {
    sourceSku: 'PF-03',
    name: '牛腱凍乾粉',
    category: 'health',
    cost: 2.9,
    unit: '克',
    prices: [
      { weightGrams: 30, price: 95 },
      { weightGrams: 50, price: 155 },
    ],
  },
];

// 不同名字但指同個產品（系統現有名 → 單價表名）
const PRICE_NAME_ALIASES: Record<string, string> = {
  簡記牛肉地瓜: '牛肉地瓜乾',
  鴨肉蘋果: '鴨肉蘋果乾',
  鴨肉蘋果乾: '鴨肉蘋果乾',
  '壕大大雞霸*原味': '原味雞霸',
  蔬果凍乾: '混合蔬果凍乾',
  柳葉魚凍乾: '柳葉魚凍乾',
  鴨喉嚨: '鴨喉嚨',
  鴨脖喉: '鴨喉嚨',
  小傢乾: '小魚乾',
  永益魚凍乾: '虱目魚凍乾',
  雞丁凍乾: '雞肉丁凍乾',
  雞肉紅蘿蔔凍乾粉: '雞肉紅麴凍乾粉',
  牛腦凍乾粉: '牛腱凍乾粉',
};

/** 將舊版手打／誤植的廠商名，合併為試算表「廠商訂單」分頁 B 欄用字。 */
async function reconcileLegacyVendorDisplayNames() {
  const pairs: [string, string][] = [
    ['嫁家家', '飽管家'],
    ['脆管家', '飽管家'],
    ['nibo', 'Nibo'],
    ['Nibo', 'Nibo'],
    ['巨爵', '匠寵'],
  ];
  for (const [oldName, newName] of pairs) {
    const src = await prisma.vendor.findFirst({ where: { name: oldName } });
    if (!src) continue;
    const dst = await prisma.vendor.findFirst({ where: { name: newName } });
    if (!dst) {
      await prisma.vendor.update({ where: { id: src.id }, data: { name: newName } });
      continue;
    }
    if (src.id === dst.id) continue;
    await prisma.product.updateMany({ where: { vendorId: src.id }, data: { vendorId: dst.id } });
    await prisma.vendor.delete({ where: { id: src.id } });
  }
}

async function importPriceList() {
  await reconcileLegacyVendorDisplayNames();

  // 1) 先把廠商建好
  const vendorNames = Array.from(
    new Set(PRICE_LIST.map((r) => r.vendor).filter((v): v is string => !!v)),
  );
  let nextVendorSeq = (await prisma.vendor.count()) + 1;
  const vendorIdByName = new Map<string, string>();
  for (const vName of vendorNames) {
    let v = await prisma.vendor.findFirst({ where: { name: vName } });
    if (!v) {
      v = await prisma.vendor.create({
        data: {
          vendorId: `VEND-${pad(nextVendorSeq++, 4)}`,
          name: vName,
          status: 'active',
        },
      });
    }
    vendorIdByName.set(vName, v.id);
  }

  // 2) 用 source SKU / 名稱對應現有產品（不重複建）
  const allProducts = await prisma.product.findMany();
  function findProductByNameOrSku(row: PriceRow) {
    // a) source SKU 匹配
    const bySrcSku = allProducts.find((p) => p.sourceSku === row.sourceSku);
    if (bySrcSku) return bySrcSku;
    // b) 名稱直接匹配
    const byName = allProducts.find((p) => p.name === row.name);
    if (byName) return byName;
    // c) 別名反查
    for (const [systemName, sheetName] of Object.entries(PRICE_NAME_ALIASES)) {
      if (sheetName === row.name) {
        const aliasMatch = allProducts.find((p) => p.name === systemName);
        if (aliasMatch) return aliasMatch;
      }
    }
    return null;
  }

  // 3) Upsert 產品 + price tiers
  let nextProductSeq =
    Math.max(
      0,
      ...allProducts
        .map((p) => p.productId.match(/^PROD-(\d+)$/)?.[1])
        .filter(Boolean)
        .map(Number),
    ) + 1;
  let nextSkuSeq =
    Math.max(
      0,
      ...allProducts
        .map((p) => p.sku.match(/^FUR-(\d+)$/)?.[1])
        .filter(Boolean)
        .map(Number),
    ) + 1;

  let updated = 0;
  let created = 0;
  let tierCount = 0;

  for (const row of PRICE_LIST) {
    const vendorId = row.vendor ? (vendorIdByName.get(row.vendor) ?? null) : null;
    const minPrice = row.prices.length
      ? Math.min(...row.prices.map((t) => t.price))
      : 0;
    const category =
      row.category ??
      (row.sourceSku.startsWith('FD')
        ? 'freeze_dried'
        : row.sourceSku.startsWith('PF')
          ? 'health'
          : 'treats');

    let product = findProductByNameOrSku(row);
    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: {
          name: row.name,
          sourceSku: row.sourceSku,
          vendorId,
          category,
          cost: row.cost ?? product.cost,
          price: minPrice || product.price,
          unit: row.unit,
          style: row.style ?? null,
          notes: row.notes ?? null,
          status: row.isActive === false ? 'inactive' : 'active',
        },
      });
      updated++;
    } else {
      const productId = `PROD-${pad(nextProductSeq++, 4)}`;
      let sku = `FUR-${pad(nextSkuSeq++, 4)}`;
      while (await prisma.product.findUnique({ where: { sku } })) {
        sku = `FUR-${pad(nextSkuSeq++, 4)}`;
      }
      product = await prisma.product.create({
        data: {
          productId,
          sku,
          sourceSku: row.sourceSku,
          name: row.name,
          category,
          unit: row.unit,
          style: row.style ?? null,
          price: minPrice,
          cost: row.cost ?? 0,
          vendorId,
          notes: row.notes ?? null,
          status: row.isActive === false ? 'inactive' : 'active',
        },
      });
      created++;
    }

    // 重設 price tiers（先刪再建，方便重跑）
    await prisma.productPriceTier.deleteMany({ where: { productId: product.id } });
    for (const t of row.prices) {
      await prisma.productPriceTier.create({
        data: {
          productId: product.id,
          weightGrams: t.weightGrams ?? null,
          unit: row.unit,
          unitQty: t.unitQty ?? 1,
          price: t.price,
          cost: t.cost ?? row.cost ?? null,
          notes: t.notes ?? null,
        },
      });
      tierCount++;
    }
  }

  console.log(
    `💰 廠商 ${vendorNames.length} 家、產品 upsert ${updated + created}（更新 ${updated} / 新建 ${created}）、價格組合 ${tierCount} 筆`,
  );
}

// ============================================================
// 待出貨訂單（從「客戶下單」試算表手動 keyin，截圖 v1）
// 來源：Google Sheet「客戶下單」分頁
// ============================================================
const PENDING_ORDERS: Array<{
  orderNumber: string;
  orderedAt: string;
  customer: { name: string; phone: string; type?: 'individual' | 'business' };
  items: Array<{
    name: string;
    sourceSku: string; // 試算表填的 SKU，可空
    weightGrams: number | null;
    unit: string;
    qty: number;
    unitPrice: number; // 0 = 試算表還沒填
  }>;
}> = [
  {
    orderNumber: '2026903929',
    orderedAt: '2026-04-23',
    customer: { name: '蔡岳延', phone: '975375698' },
    items: [
      { name: '原味雞霸', sourceSku: 'CK-05', weightGrams: 1, unit: '片', qty: 3, unitPrice: 89 },
    ],
  },
  {
    orderNumber: '202603028',
    orderedAt: '2026-05-01',
    customer: { name: '板橋流浪狗之家', phone: 'shine', type: 'business' },
    items: [
      {
        name: '雞肉南瓜乾',
        sourceSku: 'CK-04',
        weightGrams: 50,
        unit: '包',
        qty: 5,
        unitPrice: 125,
      },
    ],
  },
  {
    orderNumber: '2026903930',
    orderedAt: '2026-05-02',
    customer: { name: '陳羽柔', phone: '(04)26870347' },
    items: [
      {
        name: '雞肉丁凍乾',
        sourceSku: 'FD-11',
        weightGrams: 30,
        unit: '包',
        qty: 3,
        unitPrice: 156,
      },
      {
        name: '混合蔬果凍乾',
        sourceSku: 'FD-12',
        weightGrams: 30,
        unit: '包',
        qty: 3,
        unitPrice: 156,
      },
      {
        name: '鴨肉蘋果乾',
        sourceSku: 'DK-04',
        weightGrams: 30,
        unit: '包',
        qty: 4,
        unitPrice: 126,
      },
      {
        name: '牛肉地瓜乾',
        sourceSku: 'BF-02',
        weightGrams: 30,
        unit: '包',
        qty: 4,
        unitPrice: 96,
      },
      // 試算表這列尚未填 SKU 與單價（待客戶/出貨人補）
      { name: '牛肉丁凍乾', sourceSku: '', weightGrams: 30, unit: '包', qty: 3, unitPrice: 0 },
      {
        name: '青蛙凍乾',
        sourceSku: 'FD-04',
        weightGrams: 1,
        unit: '支',
        qty: 3,
        unitPrice: 175,
      },
    ],
  },
];

// 試算表上的口語名 ↔ 系統內現有產品名（避免重複建立）
const PRODUCT_NAME_ALIASES: Record<string, string> = {
  鴨肉蘋果乾: '鴨肉蘋果',
  牛肉地瓜乾: '簡記牛肉地瓜',
  混合蔬果凍乾: '蔬果凍乾',
  原味雞霸: '壕大大雞霸*原味',
};

async function importPendingOrders() {
  // 從現有資料找最大序號 + 1（不能用 count + 1，會撞號）
  function maxSeq(values: Array<string | null | undefined>, prefix: string): number {
    let max = 0;
    for (const v of values) {
      if (!v) continue;
      const m = v.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max;
  }
  const allCustomers = await prisma.customer.findMany({ select: { customerId: true } });
  const allProducts = await prisma.product.findMany({ select: { productId: true, sku: true } });
  let nextCustomerSeq = maxCustomerIdSeq(allCustomers.map((c) => c.customerId)) + 1;
  let nextProductSeq = maxSeq(allProducts.map((p) => p.productId), 'PROD') + 1;
  let nextSkuSeq = maxSeq(allProducts.map((p) => p.sku), 'FUR') + 1;

  async function findOrCreateCustomer(c: {
    name: string;
    phone: string;
    type?: 'individual' | 'business';
  }) {
    let cust = await prisma.customer.findFirst({
      where: { OR: [{ phone: c.phone }, { name: c.name }] },
    });
    if (cust) return cust;
    const customerId = formatCustomerId(nextCustomerSeq++);
    return prisma.customer.create({
      data: {
        customerId,
        name: c.name,
        phone: c.phone,
        type: c.type ?? 'individual',
      },
    });
  }

  async function findOrCreateProduct(name: string, fallbackSku: string, unit: string) {
    const canonical = PRODUCT_NAME_ALIASES[name] ?? name;
    const existing = await prisma.product.findFirst({ where: { name: canonical } });
    if (existing) return existing;

    let sku = fallbackSku;
    if (!sku || (await prisma.product.findUnique({ where: { sku } }))) {
      sku = `FUR-${pad(nextSkuSeq++, 4)}`;
      while (await prisma.product.findUnique({ where: { sku } })) {
        sku = `FUR-${pad(nextSkuSeq++, 4)}`;
      }
    }
    const productId = `PROD-${pad(nextProductSeq++, 4)}`;
    return prisma.product.create({
      data: {
        productId,
        sku,
        name: canonical,
        category: 'treats',
        unit,
        price: 0,
        cost: 0,
        status: 'active',
      },
    });
  }

  let createdOrders = 0;
  let createdShipments = 0;

  for (const o of PENDING_ORDERS) {
    const customer = await findOrCreateCustomer(o.customer);
    const orderedAt = new Date(o.orderedAt);

    // 解析商品（含自動建檔）
    const lines = await Promise.all(
      o.items.map(async (it) => {
        const product = await findOrCreateProduct(it.name, it.sourceSku, it.unit);
        return { product, source: it, subtotal: it.qty * it.unitPrice };
      }),
    );

    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);

    // 為了重跑可重建：先刪掉舊的 Order（連同 OrderItem cascade）+ 對應 Shipment
    // 注意：Shipment.orderId 是 SetNull，所以舊跑次刪過 Order 但孤兒 Shipment 可能還在
    //       這裡同時用「可預期的 shipmentNumber」清掉，避免 unique 衝突
    const expectedShipmentNumber = `SHP-IMPORT-${o.orderNumber}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber: o.orderNumber } });
    if (existing) {
      await prisma.shipment.deleteMany({ where: { orderId: existing.id } });
      await prisma.order.delete({ where: { id: existing.id } });
    }
    await prisma.shipment.deleteMany({ where: { shipmentNumber: expectedShipmentNumber } });

    const order = await prisma.order.create({
      data: {
        orderNumber: o.orderNumber,
        source: 'manual',
        status: 'confirmed',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'pending',
        customerId: customer.id,
        subtotal,
        total: subtotal,
        orderedAt,
        note: '匯入自「客戶下單」試算表（未出貨）',
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            sku: l.source.sourceSku || l.product.sku,
            quantity: l.source.qty,
            unitPrice: l.source.unitPrice,
            subtotal: l.subtotal,
            weightGrams: l.source.weightGrams ?? undefined,
            unit: l.source.unit,
          })),
        },
      },
    });
    createdOrders++;

    // 同步建立 pending Shipment（出貨隊列會看到）
    await prisma.shipment.create({
      data: {
        shipmentNumber: expectedShipmentNumber,
        type: 'customer_order',
        status: 'pending',
        customerId: customer.id,
        orderId: order.id,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        createdAt: orderedAt,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            sku: l.source.sourceSku || l.product.sku,
            quantity: l.source.qty,
            weightGrams: l.source.weightGrams ?? undefined,
            unit: l.source.unit,
          })),
        },
      },
    });
    createdShipments++;
  }

  console.log(
    `📦 待出貨訂單 ${createdOrders} 張、Shipment(pending) ${createdShipments} 筆 已建立`,
  );
}

// ============================================================
// 預設倉庫初始庫存（讓商品在系統內可用）
// ============================================================
async function ensureInventory() {
  const products = await prisma.product.findMany();
  const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-MAIN' } });
  if (!warehouse) return;
  for (const p of products) {
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: p.id, warehouseId: warehouse.id },
      },
      update: {},
      create: { productId: p.id, warehouseId: warehouse.id, quantity: 0 },
    });
  }
}

// ============================================================
async function main() {
  if (process.argv.includes('--price-only')) {
    console.log('📥 匯入商品單價表（廠商 / 種類 / 規格售價）...\n');
    await importPriceList();
    console.log('\n✅ 單價表匯入完成');
    return;
  }

  console.log('📥 開始匯入 Furmosa 真實資料...\n');

  console.log('--- (A) 廠商合作分成計算表（截圖）→ 寄賣店、商品、規則、出貨紀錄 ---');
  await importMerchantsAndRules();

  console.log('\n--- (B) 食品客戶下單.csv → dashboard 排行商品（補強名稱） ---');
  await importProducts();

  console.log('\n--- (C) 換罐計畫 → 潛在續約清單（彙整成任務）---');
  await importPotentialRenewMembers();

  console.log('\n--- (D) 每週任務 → 任務 + 真實客戶 + 訂閱 + 從地址抓寄賣店 ---');
  await importWeeklyTasks();

  console.log('\n--- (E) 商品單價表 → cost / 各重量售價 / 廠商 ---');
  await importPriceList();

  console.log('\n--- (F) 客戶下單試算表 → 待出貨訂單 + Shipment(pending) ---');
  await importPendingOrders();

  console.log('\n--- (G) 補建商品庫存（皆為 0）---');
  await ensureInventory();

  console.log('\n📊 匯入結果：');
  console.log(`  - 寄賣店家 (Merchant)            ${await prisma.merchant.count()}`);
  console.log(`  - 商品 (Product)                 ${await prisma.product.count()}`);
  console.log(`  - 商品×店家規則 (Rule)           ${await prisma.merchantProductRule.count()}`);
  console.log(`  - 寄賣店庫存 (MerchantStock)     ${await prisma.merchantStock.count()}`);
  console.log(`  - 寄賣動作流水 (MerchantStockTxn) ${await prisma.merchantStockTxn.count()}`);
  console.log(`  - 庫存異動 (InventoryTxn)        ${await prisma.inventoryTransaction.count()}`);
  console.log(`  - 客戶 (Customer)                ${await prisma.customer.count()}`);
  console.log(`  -   其中訂閱中                  ${await prisma.customer.count({ where: { hasActiveSubscription: true } })}`);
  console.log(`  - 訂閱合約 (Subscription)        ${await prisma.subscription.count()}`);
  console.log(`  - 出貨排程 (Shipment)            ${await prisma.subscriptionShipment.count()}`);
  console.log(`  - 任務 (Task)                    ${await prisma.task.count()}`);
  console.log(`  - 訂單 (Order)                   ${await prisma.order.count()}`);
  console.log(`  -   待出貨 pending             ${await prisma.order.count({ where: { fulfillmentStatus: 'pending' } })}`);
  console.log(`  - 出貨單 (Shipment)              ${await prisma.shipment.count()}`);
  console.log(`  -   pending                    ${await prisma.shipment.count({ where: { status: 'pending' } })}`);

  console.log('\n⚠ 還沒匯入：歷史已出貨訂單、結算紀錄');
  console.log('   等你匯出「歷史訂單」「銷售紀錄」「結清紀錄」分頁後可繼續。');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
