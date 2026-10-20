import { productLabel } from '@/lib/product-label';

type ShipmentItemSummaryInput = {
  productName: string;
  weightGrams: number | null;
  quantity: number;
  packSize?: number | null;
  packUnit?: string | null;
};

/** 出貨清單只顯示揀貨需要的資訊；組合規格同時換算實際總件數。 */
export function shipmentItemSummary({
  productName,
  weightGrams,
  quantity,
  packSize,
  packUnit,
}: ShipmentItemSummaryInput): string {
  const name = productLabel(productName, weightGrams);
  const unit = packUnit?.trim();

  if (!weightGrams && packSize && packSize > 1 && unit) {
    return `${name} ×${quantity} 組（共 ${quantity * packSize} ${unit}）`;
  }

  return `${name} ×${quantity}`;
}
