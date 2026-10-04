export type TemperatureProduct = {
  sourceSku?: string | null;
  defaultTemperature?: string | null;
};

const LEGACY_AMBIENT_SOURCE_SKUS = new Set(['CK-05', 'CK-06']);

/**
 * Preserve explicit master-data temperature.
 * Legacy chicken-fillet rows predate default_temperature; they are shelf-stable ambient treats.
 */
export function effectiveProductTemperature(product: TemperatureProduct | null | undefined): string {
  const explicit = product?.defaultTemperature?.trim();
  if (explicit) return explicit;
  const sourceSku = product?.sourceSku?.trim().toUpperCase();
  return sourceSku && LEGACY_AMBIENT_SOURCE_SKUS.has(sourceSku) ? 'ambient' : '';
}
