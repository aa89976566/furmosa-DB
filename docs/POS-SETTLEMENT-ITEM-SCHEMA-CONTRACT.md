# POS Settlement Item Schema Contract

Status: design contract only. No migration, no db push, no runtime write in this step.

## 1. Goal

Use the existing `Settlement` model as the only settlement header in Furmosa DB. Do not create a second `StoreSettlement` system.

Add one unified settlement-line concept so the same settlement can lock heterogeneous financial sources without duplicating their source-of-truth state.

## 2. Existing truth that must remain authoritative

- Merchant consignment sales: `MerchantStockTxn` / existing settlement flow
- Refill order state: `RefillOrder`
- Refill / extra payment state: `PaymentOrder`
- Restock request state: `RestockRequest`
- Grooming / reward coupon state: existing coupon / redemption models
- Existing HQ settlement header: `Settlement`

`SettlementItem` is a settlement snapshot / lock. It must not become a second payment, fulfillment, refill, inventory, coupon, or restock state machine.

## 3. Minimal existing `Settlement` extension

Do not remove legacy fields yet. Add only fields needed for channel-neutral POS settlement.

Proposed additions:

```prisma
model Settlement {
  // existing fields stay unchanged for compatibility

  storePayableTwd    BigInt? // store -> Furmosa total snapshot
  furmosaPayableTwd  BigInt? // Furmosa -> store total snapshot
  netAmountTwd       BigInt? // absolute net amount
  payer              String? // STORE | FURMOSA | NONE
  receiver           String? // STORE | FURMOSA | NONE
  paymentMethod      String? // BANK_TRANSFER | FURMOSA_TO_STORE_TRANSFER | NONE | approved future methods
  schemaVersion      Int     @default(1)

  items SettlementItem[]
}
```

Rules:
- Existing `grossSales`, `commissionAmount`, `merchantOwesUs`, `payable`, etc. remain for the legacy consignment settlement pages until a later migration plan explicitly retires them.
- New POS settlement code must use integer TWD amounts. Do not introduce new Float money fields.
- `payer` and `receiver` are server-computed snapshots, never merchant-editable.
- Payment method may be selected only from a server-side allow-list valid for the computed payer.

## 4. New `SettlementItem`

Proposed contract:

```prisma
model SettlementItem {
  id             String   @id @default(cuid())
  settlementId   String
  merchantId     String

  sourceType     String   // MERCHANT_STOCK_TXN | PAYMENT_ORDER | RESTOCK_REQUEST | GROOMING_COUPON | REWARD_REDEMPTION | ADJUSTMENT
  sourceId       String
  sourceSubKey   String   @default("") // optional stable discriminator when one source can generate >1 financial line

  occurredAt     DateTime
  amountTwd      BigInt
  direction      String   // STORE_TO_FURMOSA | FURMOSA_TO_STORE | NO_SETTLEMENT
  collector      String   // STORE | FURMOSA | NONE
  kind           String   // RESTOCK_COST | STORE_COLLECTION | REFILL_FEE | EMPTY_JAR_SURCHARGE | COUPON_SUBSIDY | REBATE | ADJUSTMENT | REVERSAL

  relatedOrderId String?
  noteSnapshot   String?
  createdAt      DateTime @default(now())

  settlement Settlement @relation(fields: [settlementId], references: [id], onDelete: Restrict)
  merchant   Merchant   @relation(fields: [merchantId], references: [id], onDelete: Restrict)

  @@unique([sourceType, sourceId, sourceSubKey])
  @@index([settlementId])
  @@index([merchantId, occurredAt])
  @@index([sourceType, sourceId])
}
```

## 5. Why `sourceSubKey` exists

Default is empty string. Most source rows map to exactly one settlement item.

It exists only for a source that legitimately produces more than one independent financial obligation. Example: a future source row might produce a principal line and a separately approved reversal line.

Never use random values here. The value must be deterministic and server-defined.

## 6. Source identity and duplicate prevention

The immutable identity is:

`sourceType + sourceId + sourceSubKey`

That tuple must be globally unique across settlement items.

This means the same source financial fact cannot be settled twice, even if:
- the merchant selects overlapping date ranges;
- two requests race;
- the UI is double-clicked;
- a request is retried.

Application checks are not enough; DB unique protection is required.

## 7. Settlement transaction boundary

Creating a settlement must be one DB transaction:

1. Load eligible source facts using current merchant session scope.
2. Recompute all amounts and directions on the server.
3. Check source identities are not already in `SettlementItem`.
4. Create / finalize the `Settlement` header snapshot.
5. Insert all `SettlementItem` rows.
6. Lock legacy `MerchantStockTxn.settlementId` rows where applicable for compatibility.
7. Commit.

If any item conflicts or any write fails, the entire transaction rolls back.

## 8. Direction is not collector

These are intentionally separate.

Examples:

### Customer paid refill online
- collector = FURMOSA
- direction = NO_SETTLEMENT
- kind = REFILL_FEE

It may appear in reconciliation history, but it must not increase the merchant's amount due to Furmosa.

### Store collected money belonging to Furmosa
- collector = STORE
- direction = STORE_TO_FURMOSA
- kind = STORE_COLLECTION or EMPTY_JAR_SURCHARGE

### Furmosa owes store a coupon subsidy
- collector = NONE
- direction = FURMOSA_TO_STORE
- kind = COUPON_SUBSIDY

Never infer settlement direction from a positive/negative UI amount alone.

## 9. Eligibility rules

A `SettlementItem` can only be inserted for a source that is financially final enough for the relevant kind.

Examples:
- `PaymentOrder`: only paid facts create a financial settlement item; failed/pending payments do not.
- `RestockRequest`: only the existing billable/approved state defined by runtime may create a cost item.
- Coupon subsidy: only redeemed/used facts that already satisfy current business rules.
- Unpaid refill: visible in reconciliation but not inserted as a payable settlement item.

Exact eligibility stays in server domain code and tests, not in the client.

## 10. Immutability and correction

After a settlement reaches `paid`:
- item source identity is immutable;
- amount, direction, collector, kind, merchant, and occurredAt are immutable;
- historical rows are never edited to "fix" accounting.

Corrections use a new deterministic reversal / adjustment fact in a later settlement.

Before `paid`, any edit/delete policy must remain compatible with the existing HQ settlement status flow and must never silently release a paid source.

## 11. Compatibility with current legacy settlement

The current HQ settlement code locks `MerchantStockTxn.settlementId`.

During transition:
- keep that lock for merchant stock sales;
- also create a matching `SettlementItem` for the same financial source once the new persistence is enabled;
- do not remove the legacy field in the first migration;
- consistency tests must require both locks to point at the same `Settlement` when both mechanisms apply.

This avoids breaking current merchant settlement pages while POS gains multi-source settlement.

## 12. Required tests before migration is allowed

No migration should be created until these cases are specified and passing against the domain layer:

1. online refill paid to Furmosa -> `NO_SETTLEMENT`, never store payable;
2. store-collected Furmosa money -> `STORE_TO_FURMOSA`;
3. Furmosa subsidy -> `FURMOSA_TO_STORE`;
4. pending / failed payment -> not inserted as settlement payable;
5. same source submitted twice -> rejected by deterministic duplicate protection;
6. two concurrent settlement attempts for same source -> only one succeeds;
7. merchant A cannot settle merchant B source;
8. header totals equal item sums by direction;
9. legacy `MerchantStockTxn.settlementId` and new item stay consistent;
10. paid settlement cannot mutate historical financial facts;
11. correction is a new reversal / adjustment, not an UPDATE to paid history;
12. all new money values are integer TWD.

## 13. Explicit non-goals for this step

- no UI changes;
- no Prisma migration yet;
- no production DB writes;
- no new payment state machine;
- no new refill state machine;
- no duplicate settlement header model;
- no invented merchant wallet / balance feature;
- no unconfirmed fee or commission rule.

## 14. Gate for the next step

The next implementation step may modify `prisma/schema.prisma` only after confirming:

- relation names do not collide with existing `Settlement`, `Merchant`, or transaction relations;
- current Postgres table naming / `@@map` conventions;
- BigInt serialization boundaries in existing server code;
- whether `sourceType` should remain String or use the project's current enum strategy;
- migration can backfill legacy settlement sale locks without duplicating sources.
