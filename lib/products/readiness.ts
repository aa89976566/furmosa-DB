export type ProductSetupState = 'complete' | 'incomplete' | 'disabled';

export type ProductSetupItem = {
  state: ProductSetupState;
  summary: string;
  actionLabel?: string;
  section: 'variants' | 'commercial';
};

export type ProductReadinessInput = {
  consignmentEnabled: boolean | null;
  wholesaleEnabled: boolean | null;
  defaultConsignmentCommissionMode: string | null;
  defaultConsignmentCommissionValue: number | null;
  priceTiers: Array<{
    status: string;
    sku: string | null;
    shopifySku: string | null;
    defaultWholesaleUnitPrice: number | null;
  }>;
};

export type ProductReadiness = {
  variants: ProductSetupItem;
  consignment: ProductSetupItem;
  wholesale: ProductSetupItem;
  needsAttention: boolean;
};

function validCommission(mode: string | null, value: number | null) {
  if (mode === 'percent') return value != null && value > 0 && value <= 10_000;
  if (mode === 'amount') return value != null && Number.isInteger(value) && value > 0;
  return false;
}

export function deriveProductReadiness(input: ProductReadinessInput): ProductReadiness {
  const activeTiers = input.priceTiers.filter((tier) => tier.status !== 'archived');
  const tierCount = activeTiers.length;
  const boundTierCount = activeTiers.filter((tier) => Boolean(tier.sku?.trim())).length;
  const pricedTierCount = activeTiers.filter(
    (tier) => tier.defaultWholesaleUnitPrice != null && tier.defaultWholesaleUnitPrice > 0,
  ).length;

  const variants: ProductSetupItem = tierCount === 0
    ? {
        state: 'incomplete',
        summary: '尚未建立銷售規格',
        actionLabel: '新增規格',
        section: 'variants',
      }
    : boundTierCount === tierCount
      ? {
          state: 'complete',
          summary: `${tierCount} 個規格皆有 SKU`,
          actionLabel: '修改',
          section: 'variants',
        }
      : {
          state: 'incomplete',
          summary: `缺 ${tierCount - boundTierCount} 個 SKU（${boundTierCount}/${tierCount}）`,
          actionLabel: '補 SKU',
          section: 'variants',
        };

  const consignment: ProductSetupItem = !input.consignmentEnabled
    ? { state: 'disabled', summary: '未啟用', section: 'commercial' }
    : validCommission(
          input.defaultConsignmentCommissionMode,
          input.defaultConsignmentCommissionValue,
        )
      ? {
          state: 'complete',
          summary: '商品預設佣金已設定',
          actionLabel: '修改',
          section: 'commercial',
        }
      : {
          state: 'incomplete',
          summary: '佣金方式或金額未完成',
          actionLabel: '設定佣金',
          section: 'commercial',
        };

  const wholesale: ProductSetupItem = !input.wholesaleEnabled
    ? { state: 'disabled', summary: '未啟用', section: 'commercial' }
    : tierCount === 0
      ? {
          state: 'incomplete',
          summary: '需先建立銷售規格',
          actionLabel: '先新增規格',
          section: 'variants',
        }
      : pricedTierCount === tierCount
        ? {
            state: 'complete',
            summary: `${tierCount}/${tierCount} 個規格已定價`,
            actionLabel: '修改',
            section: 'commercial',
          }
        : {
            state: 'incomplete',
            summary: `${pricedTierCount}/${tierCount} 個規格已定價`,
            actionLabel: '填買斷價',
            section: 'variants',
          };

  return {
    variants,
    consignment,
    wholesale,
    needsAttention: [variants, consignment, wholesale].some(
      (item) => item.state === 'incomplete',
    ),
  };
}
