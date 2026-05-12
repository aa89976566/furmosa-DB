import { prisma } from '@/lib/prisma';

// 寄賣結算的計算來源：
// - 銷售流水：MerchantStockTxn(type='sale')
// - 期間：以 createdAt 為準
// - 預設只算 settlementId IS NULL 的（「未結清」），避免重複結算
//   呈現某張 Settlement 內容時可改 includeSettledIds=[該結算id]

export type SettlementLine = {
  txnId: string;
  txnNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number; // 賣出件數（正數）
  unitPrice: number;
  grossSales: number; // qty × unitPrice
  commissionAmount: number; // 店家分潤
  companyRevenue: number; // 公司實收（不含運費）
  createdAt: Date;
  note: string | null;
  settlementId: string | null; // null=未結清
};

export type SettlementSummary = {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  lines: SettlementLine[];
  totalQuantity: number;
  cashCollected: number; // 店家收的現金 = grossSales
  grossSales: number; // 同 cashCollected，保留向下相容
  commissionAmount: number; // 店家應得分潤
  companyRevenue: number; // 公司實收（在還沒扣運費 / 加補貼前）
  rewardPayout: number; // 換罐補貼（公司付店家）
  shippingFee: number; // 運費（公司補店家／或店家代墊）
  payable: number; // 公司應付店家 = commissionAmount + rewardPayout + shippingFee
  merchantOwesUs: number; // 店家應返公司 = grossSales - commissionAmount - rewardPayout - shippingFee
  effectiveCommissionRate: number;
};

export async function calcSettlement({
  merchantId,
  periodStart,
  periodEnd,
  rewardPayout = 0,
  shippingFee = 0,
  // 預設只算未結清的（settlementId 為 null）
  // 若要呈現某張結算的明細，傳該結算 id 進來，會把它 +null 都納入
  includeSettlementId,
}: {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  rewardPayout?: number;
  shippingFee?: number;
  includeSettlementId?: string | null;
}): Promise<SettlementSummary> {
  const settlementFilter = includeSettlementId
    ? { OR: [{ settlementId: null }, { settlementId: includeSettlementId }] }
    : { settlementId: null };

  const txns = await prisma.merchantStockTxn.findMany({
    where: {
      merchantId,
      type: 'sale',
      createdAt: { gte: periodStart, lte: periodEnd },
      ...settlementFilter,
    },
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const lines: SettlementLine[] = txns.map((t) => {
    const qty = Math.abs(t.quantity);
    const unitPrice = t.unitPrice ?? 0;
    return {
      txnId: t.id,
      txnNumber: t.txnNumber,
      productId: t.productId,
      productName: t.product.name,
      sku: t.product.sku,
      quantity: qty,
      unitPrice,
      grossSales: qty * unitPrice,
      commissionAmount: t.commissionAmount ?? 0,
      companyRevenue: t.companyRevenue ?? 0,
      createdAt: t.createdAt,
      note: t.note,
      settlementId: t.settlementId,
    };
  });

  const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
  const grossSales = lines.reduce((s, l) => s + l.grossSales, 0);
  const commissionAmount = lines.reduce((s, l) => s + l.commissionAmount, 0);
  const companyRevenue = lines.reduce((s, l) => s + l.companyRevenue, 0);
  const payable = commissionAmount + rewardPayout + shippingFee;
  const merchantOwesUs = grossSales - commissionAmount - rewardPayout - shippingFee;
  const effectiveCommissionRate = grossSales > 0 ? commissionAmount / grossSales : 0;

  return {
    merchantId,
    periodStart,
    periodEnd,
    lines,
    totalQuantity,
    cashCollected: grossSales,
    grossSales,
    commissionAmount,
    companyRevenue,
    rewardPayout,
    shippingFee,
    payable,
    merchantOwesUs,
    effectiveCommissionRate,
  };
}

export async function nextSettlementId(periodEnd: Date): Promise<string> {
  const ym = `${periodEnd.getFullYear()}${String(periodEnd.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `SET-${ym}-`;
  const last = await prisma.settlement.findFirst({
    where: { settlementId: { startsWith: prefix } },
    orderBy: { settlementId: 'desc' },
  });
  const nextSeq = last ? Number(last.settlementId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

export function defaultPeriod(today = new Date()): { start: Date; end: Date } {
  const start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}
