import snapshotData from './legacy-catalog-reference.snapshot.json';

const HARD_STALE_MONTHS = 18;
const VALID_CATEGORIES = new Set([
  'staple_food', 'treats', 'health', 'freeze_dried', 'toys', 'accessories', 'other',
]);

type MasterItem = { name: string; sourceSku: string; category: string };
type RetailReference = { label: string; grams?: number; price: number };
type PriceRow = {
  sourceSku: string;
  name: string;
  vendor?: string;
  unit: string;
  retail: RetailReference[];
};
type PurchaseRow = {
  sourceSku: string;
  name: string;
  vendor: string;
  date: string;
  unit: string;
  costPerUnit: number;
};
type LegacySnapshot = {
  snapshotDate: string;
  masterItems: MasterItem[];
  priceRows: PriceRow[];
  purchaseRows: PurchaseRow[];
};

export type LegacyReferenceReason =
  | 'SNAPSHOT_INVALID'
  | 'SNAPSHOT_FUTURE'
  | 'SNAPSHOT_STALE'
  | 'NO_MATCH'
  | 'NAME_CONFLICT'
  | 'SOURCE_CONFLICT'
  | 'NO_WEIGHT'
  | 'NO_COST'
  | 'COST_FUTURE'
  | 'COST_STALE'
  | 'COST_UNIT_UNSUPPORTED'
  | 'COST_OUTLIER'
  | 'COST_ABOVE_PRICE'
  | 'SPEC_MISMATCH';

export type LegacyCatalogReference = {
  available: boolean;
  snapshotDate: string | null;
  weightGrams: number | null;
  prefill: {
    category: string | null;
    cost: number | null;
  };
  reference: {
    matchedBy: 'exact_product_name' | 'product_title_suffix';
    canonicalName: string;
    sourceSku: string;
    vendor: string | null;
    unit: string | null;
    costDate: string | null;
    costPerGram: number | null;
    legacyRetailPrice: number | null;
    retailReferences: RetailReference[];
  } | null;
  reasons: LegacyReferenceReason[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  const [year, month, day] = value.split('-').map(Number);
  return Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
    ? null
    : parsed;
}

function validateSnapshot(value: unknown): LegacySnapshot | null {
  if (!isRecord(value) || !validDate(value.snapshotDate)) return null;
  if (!Array.isArray(value.masterItems) || !Array.isArray(value.priceRows) || !Array.isArray(value.purchaseRows)) return null;
  const masterItems = value.masterItems.filter((row): row is MasterItem => (
    isRecord(row)
    && typeof row.name === 'string' && row.name.trim().length > 0
    && typeof row.sourceSku === 'string' && row.sourceSku.trim().length > 0
    && typeof row.category === 'string' && VALID_CATEGORIES.has(row.category)
  ));
  const priceRows = value.priceRows.filter((row): row is PriceRow => (
    isRecord(row)
    && typeof row.sourceSku === 'string' && row.sourceSku.trim().length > 0
    && typeof row.name === 'string' && row.name.trim().length > 0
    && typeof row.unit === 'string'
    && (row.vendor == null || typeof row.vendor === 'string')
    && Array.isArray(row.retail)
    && row.retail.every((entry) => isRecord(entry)
      && typeof entry.label === 'string'
      && typeof entry.price === 'number' && Number.isFinite(entry.price) && entry.price > 0
      && (entry.grams == null || (typeof entry.grams === 'number' && Number.isInteger(entry.grams) && entry.grams > 0)))
  ));
  const purchaseRows = value.purchaseRows.filter((row): row is PurchaseRow => (
    isRecord(row)
    && typeof row.sourceSku === 'string' && row.sourceSku.trim().length > 0
    && typeof row.name === 'string' && row.name.trim().length > 0
    && typeof row.vendor === 'string'
    && typeof row.unit === 'string'
    && validDate(row.date) != null
    && typeof row.costPerUnit === 'number' && Number.isFinite(row.costPerUnit)
  ));
  if (masterItems.length !== value.masterItems.length
    || priceRows.length !== value.priceRows.length
    || purchaseRows.length !== value.purchaseRows.length) return null;
  return { snapshotDate: value.snapshotDate as string, masterItems, priceRows, purchaseRows };
}

export function normalizeLegacyProductName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('zh-TW');
}

function codePointLength(value: string) {
  return Array.from(value).length;
}

function hasAtLeastTwoHanCharacters(value: string) {
  return (value.match(/\p{Script=Han}/gu)?.length ?? 0) >= 2;
}

function findMasterNameMatch(masterItems: MasterItem[], wanted: string): {
  rows: MasterItem[];
  normalizedName: string;
  matchedBy: 'exact_product_name' | 'product_title_suffix';
} | LegacyReferenceReason {
  if (!wanted) return 'NO_MATCH';

  const grouped = new Map<string, MasterItem[]>();
  for (const row of masterItems) {
    const normalizedName = normalizeLegacyProductName(row.name);
    if (!normalizedName) continue;
    grouped.set(normalizedName, [...(grouped.get(normalizedName) ?? []), row]);
  }

  const exactRows = grouped.get(wanted);
  if (exactRows) {
    const sourceSkus = new Set(exactRows.map((row) => row.sourceSku.trim().toUpperCase()));
    return sourceSkus.size === 1
      ? { rows: exactRows, normalizedName: wanted, matchedBy: 'exact_product_name' }
      : 'NAME_CONFLICT';
  }

  const suffixes = [...grouped.entries()]
    .filter(([normalizedName]) => (
      hasAtLeastTwoHanCharacters(normalizedName)
      && codePointLength(normalizedName) < codePointLength(wanted)
      && wanted.endsWith(normalizedName)
    ))
    .sort(([left], [right]) => codePointLength(right) - codePointLength(left));
  if (suffixes.length === 0) return 'NO_MATCH';

  const longestLength = codePointLength(suffixes[0]![0]);
  const longest = suffixes.filter(([normalizedName]) => codePointLength(normalizedName) === longestLength);
  if (longest.length !== 1) return 'NAME_CONFLICT';

  const [normalizedName, rows] = longest[0]!;
  const sourceSkus = new Set(rows.map((row) => row.sourceSku.trim().toUpperCase()));
  return sourceSkus.size === 1
    ? { rows, normalizedName, matchedBy: 'product_title_suffix' }
    : 'NAME_CONFLICT';
}

export function parseShopifyVariantWeight(value: string) {
  const normalized = value.normalize('NFKC');
  const hasBundleMarker = /[×*入包組+]/.test(normalized)
    || /(?:^|\s)x(?:\s|$)/i.test(normalized)
    || /\d\s*x\s*\d/i.test(normalized)
    || /(?:公克|克|g)\s*x\s*\d/i.test(normalized);
  if (/\d[.,]\d/.test(normalized) || /\bkg\b/i.test(normalized) || hasBundleMarker) return null;
  const matches = [...normalized.matchAll(/(?<![\d.,])([1-9]\d*)\s*(?:公克|克|g)(?![a-z])/gi)];
  if (matches.length !== 1) return null;
  const grams = Number(matches[0]![1]);
  return Number.isSafeInteger(grams) && grams > 0 ? grams : null;
}

function isOlderThanMonths(date: Date, now: Date, months: number) {
  const targetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  const lastTargetDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth(),
    Math.min(now.getUTCDate(), lastTargetDay),
  ));
  return date < cutoff;
}

function gramUnit(value: string) {
  return ['g', '克', '公克'].includes(value.normalize('NFKC').trim().toLocaleLowerCase('zh-TW'));
}

function blankResult(weightGrams: number | null, reason: LegacyReferenceReason, snapshotDate: string | null = null): LegacyCatalogReference {
  return {
    available: reason !== 'SNAPSHOT_INVALID' && reason !== 'SNAPSHOT_FUTURE',
    snapshotDate,
    weightGrams,
    prefill: { category: null, cost: null },
    reference: null,
    reasons: [reason, ...(weightGrams == null ? ['NO_WEIGHT' as const] : [])],
  };
}

export function resolveLegacyCatalogReference(input: {
  productTitle: string;
  variantTitle: string;
  shopifyPrice: number;
  now?: Date;
  snapshot?: unknown;
}): LegacyCatalogReference {
  const now = input.now ?? new Date();
  const weightGrams = parseShopifyVariantWeight(input.variantTitle);
  const snapshot = validateSnapshot(input.snapshot ?? snapshotData);
  if (!snapshot) return blankResult(weightGrams, 'SNAPSHOT_INVALID');
  const snapshotDate = validDate(snapshot.snapshotDate)!;
  if (snapshotDate > now) return blankResult(weightGrams, 'SNAPSHOT_FUTURE', snapshot.snapshotDate);
  const snapshotStale = isOlderThanMonths(snapshotDate, now, HARD_STALE_MONTHS);

  const wanted = normalizeLegacyProductName(input.productTitle);
  const nameMatch = findMasterNameMatch(snapshot.masterItems, wanted);
  if (typeof nameMatch === 'string') return blankResult(weightGrams, nameMatch, snapshot.snapshotDate);
  const matchingMaster = nameMatch.rows;
  const sourceSkus = [...new Set(matchingMaster.map((row) => row.sourceSku.trim().toUpperCase()))];
  if (sourceSkus.length !== 1) return blankResult(weightGrams, 'NAME_CONFLICT', snapshot.snapshotDate);

  const sourceSku = sourceSkus[0]!;
  const masterNames = [...new Set(snapshot.masterItems
    .filter((row) => row.sourceSku.trim().toUpperCase() === sourceSku)
    .map((row) => normalizeLegacyProductName(row.name)))];
  const masterCategories = [...new Set(snapshot.masterItems
    .filter((row) => row.sourceSku.trim().toUpperCase() === sourceSku)
    .map((row) => row.category))];
  const priceRows = snapshot.priceRows.filter((row) => row.sourceSku.trim().toUpperCase() === sourceSku);
  const purchaseRows = snapshot.purchaseRows.filter((row) => row.sourceSku.trim().toUpperCase() === sourceSku);
  const connectedNames = [...new Set([
    ...masterNames,
    ...priceRows.map((row) => normalizeLegacyProductName(row.name)),
    ...purchaseRows.map((row) => normalizeLegacyProductName(row.name)),
  ])];
  if (masterNames.length !== 1 || masterCategories.length !== 1 || connectedNames.length !== 1 || connectedNames[0] !== nameMatch.normalizedName || priceRows.length > 1) {
    return blankResult(weightGrams, 'SOURCE_CONFLICT', snapshot.snapshotDate);
  }

  const master = matchingMaster[0]!;
  const priceRow = priceRows[0] ?? null;
  const retailReferences = priceRow?.retail ?? [];
  const reference = {
    matchedBy: nameMatch.matchedBy,
    canonicalName: master.name,
    sourceSku,
    vendor: priceRow?.vendor ?? null,
    unit: priceRow?.unit ?? null,
    costDate: null as string | null,
    costPerGram: null as number | null,
    legacyRetailPrice: weightGrams == null
      ? null
      : retailReferences.find((row) => row.grams === weightGrams)?.price ?? null,
    retailReferences,
  };
  const reasons: LegacyReferenceReason[] = [];
  const category = snapshotStale ? null : master.category;
  if (snapshotStale) reasons.push('SNAPSHOT_STALE');
  if (weightGrams == null) reasons.push('NO_WEIGHT');

  let cost: number | null = null;
  if (!snapshotStale && weightGrams != null) {
    const explicitGrams = retailReferences.flatMap((row) => row.grams == null ? [] : [row.grams]);
    if (explicitGrams.length > 0 && !explicitGrams.includes(weightGrams)) {
      reasons.push('SPEC_MISMATCH');
    } else {
      const hasFutureCost = purchaseRows.some((row) => {
        const date = validDate(row.date);
        return date != null && (date > snapshotDate || date > now);
      });
      const validPurchases = purchaseRows
        .filter((row) => {
          const date = validDate(row.date);
          return date != null && date <= snapshotDate && date <= now && row.costPerUnit > 0 && gramUnit(row.unit);
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      if (hasFutureCost) {
        reasons.push('COST_FUTURE');
      } else if (validPurchases.length === 0) {
        reasons.push(purchaseRows.some((row) => !gramUnit(row.unit)) ? 'COST_UNIT_UNSUPPORTED' : 'NO_COST');
      } else {
        const costs = validPurchases.map((row) => row.costPerUnit);
        const latest = validPurchases[0]!;
        reference.costDate = latest.date;
        reference.costPerGram = latest.costPerUnit;
        if (isOlderThanMonths(validDate(latest.date)!, now, HARD_STALE_MONTHS)) {
          reasons.push('COST_STALE');
        } else if (Math.max(...costs) / Math.min(...costs) > 2) {
          reasons.push('COST_OUTLIER');
        } else {
          const packageCost = Number((latest.costPerUnit * weightGrams).toFixed(2));
          if (!Number.isFinite(input.shopifyPrice) || packageCost > input.shopifyPrice) {
            reasons.push('COST_ABOVE_PRICE');
          } else {
            cost = packageCost;
            reference.vendor = latest.vendor || reference.vendor;
          }
        }
      }
    }
  }

  return {
    available: true,
    snapshotDate: snapshot.snapshotDate,
    weightGrams,
    prefill: { category, cost },
    reference,
    reasons,
  };
}
