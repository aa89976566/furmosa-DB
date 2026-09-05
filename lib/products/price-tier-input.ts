function toNullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toNumber(value: FormDataEntryValue | null, fallback = 0): number {
  if (value == null) return fallback;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: FormDataEntryValue | null, fallback = 0): number {
  if (value == null) return fallback;
  const parsed = parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseTierFields(formData: FormData) {
  const mode = String(formData.get('mode') ?? 'weight');
  const price = toNumber(formData.get('price'));
  if (price <= 0) throw new Error('售價必須大於 0');

  const rawCostString = String(formData.get('tierCost') ?? '').trim();
  const cost = rawCostString === '' ? null : toNumber(formData.get('tierCost'));
  if (cost != null && cost <= 0) {
    throw new Error('成本必須大於 0，或留空待後續補齊');
  }
  const notes = toNullableString(formData.get('notes'));

  if (mode === 'weight') {
    const weightGrams = toInt(formData.get('weightGrams'));
    if (weightGrams <= 0) throw new Error('重量必須大於 0');
    return { weightGrams, unit: 'g', unitQty: 1, price, cost, notes };
  }

  const unit = String(formData.get('unit') ?? '').trim();
  if (!unit) throw new Error('單位為必填（例：隻、片、包）');
  const unitQty = Math.max(1, toInt(formData.get('unitQty'), 1));
  return { weightGrams: null, unit, unitQty, price, cost, notes };
}
