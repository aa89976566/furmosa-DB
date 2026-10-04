# FURMOSA OMS SKU normalization

## Goal

One sellable Shopify variant must resolve deterministically to one active HQ price tier.

## Identity contract

- `Product.sku` (`FUR-xxxx`) stays as the legacy HQ internal product key. Do not mass-rename it.
- `Product.sourceSku` is the stable product-family code, e.g. `CK-05`, `FD-11`.
- Canonical sellable SKU:
  - one active tier: `<sourceSku>`
  - weighted multi-tier: `<sourceSku>-<grams>G`
  - unit multi-tier: `<sourceSku>-<unitQty>PC`
- Shopify Variant SKU must equal the canonical sellable SKU.
- Shopify Variant ID is an external binding / secondary identity, not the canonical business key.
- Product title is never a normal new-order identity. Controlled title aliases exist only for legacy snapshots.

## Matcher order

1. Exact active Shopify Variant ID binding, with conflicting SKU fail-closed.
2. Exact unique canonical/stored SKU.
3. Controlled legacy title alias for historical orders only.
4. BLOCK / manual review.

No fuzzy title, price or weight guessing.

## Rollout

### P0
- [x] Add canonical SKU generator.
- [x] Make OMS matcher recognize canonical tier SKU without requiring a DB backfill.
- [x] Normalize chicken fillet Shopify SKU to `CK-05`.
- [x] Normalize proven one-to-one active Shopify variants.
- [x] Add canonical coverage/drift output to OMS mapping audit.
- [x] Make Railway build run Prisma validate, TypeScript, full tests, then Next build.

### P1
- [ ] Reconcile catalog-model mismatches before changing Shopify:
  - duck wing: Shopify 1/3/5/10 pieces vs HQ 1 piece/30g/50g/100g
  - quail: Shopify 1/3/5 pieces vs HQ 1 piece/30g/50g
  - bundles and campaign-only products
- [ ] Persist canonical SKU into HQ ProductPriceTier after production DB migration strategy is verified.
- [ ] Add HQ product-health UI: canonical SKU, Shopify SKU, variant binding, duplicate/missing/drift state.
- [ ] Add CI audit fixture that rejects duplicate active canonical SKUs.

### Acceptance
- Every active ordinary Shopify variant has one unique canonical SKU.
- Every canonical SKU resolves to exactly one active HQ tier.
- Marketing title changes do not affect OMS.
- Recreated Shopify variants still resolve by SKU.
- Historical snapshots remain processable through legacy compatibility.
- Unmapped/ambiguous items never create shipment or deduct inventory.
