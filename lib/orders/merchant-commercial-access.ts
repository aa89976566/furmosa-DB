import {
  MERCHANT_ORDER_MODES,
  merchantOrderModesForTypes,
  type MerchantOrderMode,
} from './merchant-order-mode.ts';
import type { MerchantType } from '../merchant-types.ts';

export type MerchantCommercialModuleRow = {
  mode: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

export type MerchantCommercialProduct = {
  productCategory: string;
  consignmentEnabled: boolean | null;
  wholesaleEnabled: boolean | null;
  jarExchangeEnabled: boolean | null;
};

export function merchantCommercialModesAt(
  modules: MerchantCommercialModuleRow[],
  legacyTypes: MerchantType[],
  at = new Date(),
): MerchantOrderMode[] {
  if (modules.length === 0) return merchantOrderModesForTypes(legacyTypes);

  const activeModes = new Set(
    modules
      .filter((row) => row.effectiveFrom <= at && (!row.effectiveUntil || row.effectiveUntil >= at))
      .map((row) => row.mode),
  );
  return MERCHANT_ORDER_MODES.filter((mode) => activeModes.has(mode));
}

export function merchantProductAllowsMode(
  product: MerchantCommercialProduct,
  mode: MerchantOrderMode,
) {
  if (mode === 'jar_exchange') {
    return product.productCategory === 'JAR_EXCHANGE' && product.jarExchangeEnabled !== false;
  }
  if (product.productCategory !== 'STANDARD') return false;
  return mode === 'consignment'
    ? product.consignmentEnabled !== false
    : product.wholesaleEnabled !== false;
}
