import { bulkConsumption, type BulkTier } from './bulk';
import { isMadeToOrderHqProduct } from './shipment-advisory';

export type DemandLine = { quantity: number; weightGrams: number | null; variantKey: string | null;
  product: { id: string; sku: string; unit: string; category: string; inventorySourceProductId: string | null;
    priceTiers: (BulkTier & { bundleComponents: { componentProductId: string; gramsPerPack: number }[] })[] } };
export type DemandGroup = { id: string; references: string[]; items: DemandLine[] };
export type DemandPosting = { reference: string | null; productId: string; quantity: number; reversal: { quantity: number } | null };

/** Advisory only. Posted consumption is already absent from on-hand and must not be counted twice. */
export function outstandingDemand(groups: DemandGroup[], postings: DemandPosting[]) {
  const reserved = new Map<string, number>();
  let complete = true;
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.id)) { complete = false; continue; }
    seen.add(group.id);
    if (!group.items.length) complete = false;
    const demand = new Map<string, number>();
    for (const line of group.items) {
      const p = line.product;
      if (!['staple_food', 'treats', 'freeze_dried', 'health'].includes(p.category) || isMadeToOrderHqProduct(p.sku)) continue;
      try {
        const amount = bulkConsumption(p, line);
        const tiers = p.priceTiers.filter(t => line.variantKey ? t.id === line.variantKey : t.weightGrams === line.weightGrams);
        if (tiers.length !== 1) throw new Error('AMBIGUOUS_TIER');
        const components = tiers[0].bundleComponents;
        if (components.length && components.reduce((sum, c) => sum + c.gramsPerPack, 0) !== tiers[0].weightGrams) throw new Error('INVALID_RECIPE');
        const requirements = components.length ? components.map(c => ({ id: c.componentProductId, amount: c.gramsPerPack * line.quantity })) :
          [{ id: p.inventorySourceProductId ?? p.id, amount }];
        for (const r of requirements) {
          if (!Number.isSafeInteger(r.amount) || r.amount <= 0) throw new Error('INVALID_DEMAND');
          const total = (demand.get(r.id) ?? 0) + r.amount;
          if (!Number.isSafeInteger(total)) throw new Error('INVALID_DEMAND');
          demand.set(r.id, total);
        }
      } catch { complete = false; }
    }
    const refs = new Set(group.references);
    for (const [productId, amount] of demand) {
      const posted = postings.filter(p => p.productId === productId && p.reference && refs.has(p.reference))
        .reduce((sum, p) => sum + Math.max(0, -(p.quantity + (p.reversal?.quantity ?? 0))), 0);
      const total = (reserved.get(productId) ?? 0) + Math.max(0, amount - posted);
      if (!Number.isSafeInteger(total)) complete = false;
      else reserved.set(productId, total);
    }
  }
  return { reserved, complete };
}
