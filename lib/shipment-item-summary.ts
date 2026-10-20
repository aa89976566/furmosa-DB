import { productLabel } from '@/lib/product-label';

type ShipmentItemSummaryInput = {
  productName: string;
  weightGrams: number | null;
  quantity: number;
  packSize?: number | null;
  packUnit?: string | null;
  variantLabel?: string | null;
};

/** 出貨清單只顯示揀貨需要的資訊；組合規格同時換算實際總件數。 */
export function shipmentItemSummary({
  productName,
  weightGrams,
  quantity,
  packSize,
  packUnit,
  variantLabel,
}: ShipmentItemSummaryInput): string {
  const variant = variantLabel?.trim();
  const name = `${productLabel(productName, weightGrams)}${variant ? `・${variant}` : ''}`;
  const unit = packUnit?.trim();

  if (variant) return `${name} ×${quantity} 組`;

  if (!weightGrams && packSize && packSize > 1 && unit) {
    return `${name} ×${quantity} 組（共 ${quantity * packSize} ${unit}）`;
  }

  return `${name} ×${quantity}`;
}
