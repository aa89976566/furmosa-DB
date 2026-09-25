import {
  FINANCE_CHANNELS,
  structuralChannelShareCents,
  type FinanceChannel,
} from '@/lib/finance/channels';
import {
  contributionMarginCents,
  marginLight,
  productGrossMarginCents,
  refillBrandReceiptCents,
  refillChannelShareCents,
  type MarginLight,
  type MarginThresholds,
  type MissingKind,
} from '@/lib/finance/formula';
import { divideCents, dollarsToCents } from '@/lib/finance/money';

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  price: number;
  foodCostCents: number | null;
  packagingCostCents: number | null;
  status: string;
};

export type ActualRollup = {
  productId: string;
  channel: FinanceChannel;
  quantity: number;
  /** 該通路累計品牌實收（分）。資料不完整時為 null，不可把已加總的一部分當成全數。 */
  receiptCents: number | null;
  /** 累計通路分潤（分）。官網／買斷在有訂單時為 0。未知為 null。 */
  channelShareCents: number | null;
  /** 換罐顧客實付（分）。其他通路為 null。 */
  customerPaidCents: number | null;
};

export type ChannelCostSetting = {
  productId: string;
  channel: FinanceChannel;
  otherDirectCostCents: number | null;
  cleaningCents: number | null;
  transportCents: number | null;
  groupLeaderShareCents: number | null;
  centerShareCents: number | null;
};

export type SkuChannelEconomics = {
  productId: string;
  sku: string;
  name: string;
  status: string;
  channel: FinanceChannel;
  quantity: number;
  sellingPriceCents: number | null;
  foodCostCents: number | null;
  packagingCostCents: number | null;
  unitBrandReceiptCents: number | null;
  unitChannelShareCents: number | null;
  unitOtherDirectCents: number | null;
  grossMarginCents: number | null;
  grossMissing: MissingKind | null;
  contributionCents: number | null;
  contributionMissing: MissingKind | null;
  rateBps: number | null;
  light: MarginLight | null;
  totalBrandReceiptCents: number | null;
  totalChannelShareCents: number | null;
  totalContributionCents: number | null;
};

function settingKey(productId: string, channel: FinanceChannel) {
  return `${productId}:${channel}`;
}

function unitFromTotal(total: number | null, quantity: number): number | null {
  if (total == null || quantity <= 0) return null;
  return divideCents(total, quantity);
}

export function assembleSkuEconomics(input: {
  products: CatalogProduct[];
  actuals: ActualRollup[];
  settings: ChannelCostSetting[];
  thresholds: MarginThresholds;
}): SkuChannelEconomics[] {
  const actualByKey = new Map(input.actuals.map((row) => [settingKey(row.productId, row.channel), row]));
  const settingByKey = new Map(input.settings.map((row) => [settingKey(row.productId, row.channel), row]));
  const rows: SkuChannelEconomics[] = [];

  for (const product of input.products) {
    const sellingPriceCents = dollarsToCents(product.price);
    for (const channel of FINANCE_CHANNELS) {
      const actual = actualByKey.get(settingKey(product.id, channel));
      const setting = settingByKey.get(settingKey(product.id, channel));
      const quantity = actual?.quantity ?? 0;
      const otherDirect = setting?.otherDirectCostCents ?? null;
      let unitReceipt: number | null = null;
      let unitShare: number | null = null;

      if (channel === 'refill') {
        const unitPaid = unitFromTotal(actual?.customerPaidCents ?? null, quantity);
        const deductions = {
          cleaningCents: setting?.cleaningCents ?? null,
          transportCents: setting?.transportCents ?? null,
          groupLeaderShareCents: setting?.groupLeaderShareCents ?? null,
          centerShareCents: setting?.centerShareCents ?? null,
        };
        const receipt = refillBrandReceiptCents({ customerPaidCents: unitPaid, deductions });
        const share = refillChannelShareCents(deductions);
        unitReceipt = receipt.ok ? receipt.cents : null;
        unitShare = share.ok ? share.cents : null;
      } else if (channel === 'group_buy') {
        unitReceipt = null;
        unitShare = null;
      } else if (quantity > 0 && actual?.receiptCents != null) {
        unitReceipt = unitFromTotal(actual.receiptCents, quantity);
        const structural = structuralChannelShareCents(channel);
        if (structural != null) {
          unitShare = structural;
        } else if (actual.channelShareCents != null) {
          unitShare = unitFromTotal(actual.channelShareCents, quantity);
        }
      }

      const gross = productGrossMarginCents({
        sellingPriceCents,
        foodCostCents: product.foodCostCents,
        packagingCostCents: product.packagingCostCents,
      });
      const contribution = contributionMarginCents({
        brandReceiptCents: unitReceipt,
        foodCostCents: product.foodCostCents,
        packagingCostCents: product.packagingCostCents,
        otherDirectCostCents: otherDirect,
      });
      const rate = contribution.rateBps;
      rows.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        status: product.status,
        channel,
        quantity,
        sellingPriceCents,
        foodCostCents: product.foodCostCents,
        packagingCostCents: product.packagingCostCents,
        unitBrandReceiptCents: unitReceipt,
        unitChannelShareCents: unitShare,
        unitOtherDirectCents: otherDirect,
        grossMarginCents: gross.ok ? gross.cents : null,
        grossMissing: gross.ok ? null : gross.missing,
        contributionCents: contribution.margin.ok ? contribution.margin.cents : null,
        contributionMissing: contribution.margin.ok ? null : contribution.margin.missing,
        rateBps: rate,
        light: rate == null ? null : marginLight(rate, input.thresholds),
        totalBrandReceiptCents:
          unitReceipt == null || quantity <= 0 ? null : unitReceipt * quantity,
        totalChannelShareCents:
          unitShare == null || quantity <= 0 ? null : unitShare * quantity,
        totalContributionCents:
          contribution.margin.ok && quantity > 0 ? contribution.margin.cents * quantity : null,
      });
    }
  }

  return rows;
}

export type PartnerActivity = {
  merchantId: string;
  productId: string;
  channel: 'consignment' | 'pos' | 'refill';
  quantity: number;
  grossCents: number | null;
  commissionCents: number | null;
  companyRevenueCents: number | null;
  customerPaidCents: number | null;
};

export type PartnerStoreInput = {
  id: string;
  code: string;
  name: string;
  stockUnits: number;
  restockCount90: number;
  everRestocked: boolean;
  lastRestockAt: Date | null;
  refillCount: number;
};

export type PartnerEconomics = {
  id: string;
  code: string;
  name: string;
  stockUnits: number;
  restockCount90: number;
  everRestocked: boolean;
  lastRestockAt: Date | null;
  refillCount: number;
  revenueCents: number | null;
  revenueState: 'amount' | 'empty' | 'missing';
  commissionCents: number | null;
  commissionState: 'amount' | 'empty' | 'missing';
  contributionCents: number | null;
  contributionMissing: MissingKind | null;
};

export function assemblePartnerEconomics(input: {
  stores: PartnerStoreInput[];
  activity: PartnerActivity[];
  products: CatalogProduct[];
  settings: ChannelCostSetting[];
}): PartnerEconomics[] {
  const productById = new Map(input.products.map((product) => [product.id, product]));
  const settingByKey = new Map(
    input.settings.map((row) => [settingKey(row.productId, row.channel), row]),
  );
  const activityByStore = new Map<string, PartnerActivity[]>();
  for (const line of input.activity) {
    const list = activityByStore.get(line.merchantId) ?? [];
    list.push(line);
    activityByStore.set(line.merchantId, list);
  }

  return input.stores.map((store) => {
    const lines = activityByStore.get(store.id) ?? [];
    if (lines.length === 0) {
      return {
        ...store,
        revenueCents: null,
        revenueState: 'empty',
        commissionCents: null,
        commissionState: 'empty',
        contributionCents: null,
        contributionMissing: 'data',
      };
    }

    let revenue = 0;
    let commission = 0;
    let contribution = 0;
    let revenueMissing = false;
    let commissionMissing = false;
    let contributionMissing: MissingKind | null = null;
    let hasMovement = false;

    for (const line of lines) {
      if (line.quantity <= 0) continue;
      hasMovement = true;
      const product = productById.get(line.productId);
      const setting = settingByKey.get(settingKey(line.productId, line.channel));
      const deductions = {
        cleaningCents: setting?.cleaningCents ?? null,
        transportCents: setting?.transportCents ?? null,
        groupLeaderShareCents: setting?.groupLeaderShareCents ?? null,
        centerShareCents: setting?.centerShareCents ?? null,
      };

      if (line.channel === 'refill') {
        if (line.customerPaidCents == null) revenueMissing = true;
        else revenue += line.customerPaidCents;
        if (deductions.centerShareCents == null) commissionMissing = true;
        else commission += deductions.centerShareCents * line.quantity;
      } else {
        if (line.grossCents == null) revenueMissing = true;
        else revenue += line.grossCents;
        if (line.commissionCents == null) commissionMissing = true;
        else commission += line.commissionCents;
      }

      let unitReceipt: number | null = null;
      let lineMissing: MissingKind | null = null;
      if (!product) {
        lineMissing = 'data';
      } else if (line.channel === 'refill') {
        const unitPaid =
          line.customerPaidCents == null ? null : divideCents(line.customerPaidCents, line.quantity);
        const receipt = refillBrandReceiptCents({ customerPaidCents: unitPaid, deductions });
        if (!receipt.ok) lineMissing = receipt.missing;
        else unitReceipt = receipt.cents;
      } else if (line.companyRevenueCents == null) {
        lineMissing = 'data';
      } else {
        unitReceipt = divideCents(line.companyRevenueCents, line.quantity);
        if (unitReceipt == null) lineMissing = 'data';
      }

      if (lineMissing || unitReceipt == null) {
        contributionMissing = contributionMissing ?? lineMissing ?? 'data';
        continue;
      }
      const margin = contributionMarginCents({
        brandReceiptCents: unitReceipt,
        foodCostCents: product?.foodCostCents ?? null,
        packagingCostCents: product?.packagingCostCents ?? null,
        otherDirectCostCents: setting?.otherDirectCostCents ?? null,
      });
      if (!margin.margin.ok) {
        contributionMissing = contributionMissing ?? margin.margin.missing;
        continue;
      }
      contribution += margin.margin.cents * line.quantity;
    }
    return {
      ...store,
      revenueCents: revenueMissing || !hasMovement ? null : revenue,
      revenueState: !hasMovement ? 'empty' : revenueMissing ? 'missing' : 'amount',
      commissionCents: commissionMissing || !hasMovement ? null : commission,
      commissionState: !hasMovement ? 'empty' : commissionMissing ? 'missing' : 'amount',
      contributionCents: contributionMissing || !hasMovement ? null : contribution,
      contributionMissing: !hasMovement ? 'data' : contributionMissing,
    };
  });
}
