# POS Foundation Final Audit

Status: final pre-implementation decision. This closes the foundation phase for the Furmosa merchant POS settlement persistence. No UI decision is made here.

## Final decisions

### 1. Canonical settlement header

Reuse the existing `Settlement` model. There will be no `StoreSettlement` or parallel settlement header.

### 2. Universal obligation lock

Add one `SettlementItem` model in v1. It represents only financial obligations that participate in settlement between the merchant/store and Furmosa.

`SettlementItem` is not a payment ledger and not a second source-of-truth state machine.

### 3. Naming: `sourceKind`

Use `sourceKind` consistently in v1.

Reason: the POS domain already uses the word `kind` for financial/domain classification and this avoids mixing `sourceType` and `sourceKind` across docs/runtime.

Allowed initial source kinds are server-defined strings, for example:
- `merchant_stock_txn`
- `payment_order`
- `restock_request`
- `grooming_coupon`
- `reward_redemption`
- `adjustment`
- `reversal`

The client never submits an arbitrary source kind.

### 4. No `sourceSubKey` in v1

Do not add `sourceSubKey` in the first migration.

Each current authoritative source row that becomes settleable maps to at most one settlement obligation. If a future domain genuinely creates multiple independently settleable obligations from one row, that domain must first expose stable child facts or a dedicated deterministic financial fact rather than adding random discriminators to settlement code.

Database duplicate protection in v1 is:

`@@unique([sourceKind, sourceId])`

### 5. Money storage: Prisma `Int` TWD

Use integer Taiwan dollars in Prisma `Int` for new settlement fields/items.

Reason:
- current refill/payment/restock POS paths already use integer TWD semantics;
- Taiwan-dollar merchant settlement amounts are far below PostgreSQL/Prisma 32-bit `Int` limits for this system;
- using `BigInt` would introduce avoidable JSON/React/server-action serialization work in the current Next.js runtime;
- existing legacy `Settlement` Float columns remain compatibility debt and are not converted in this migration.

If business scale approaches the Int ceiling, money storage must be migrated deliberately across all financial domains rather than only this table.

### 6. Historical Settlement rows: no backfill in v1

Do not synthesize `SettlementItem` rows for historical legacy Settlement records in the first migration.

Historical rows remain legacy settlements with zero items and continue to be rendered by the existing HQ settlement runtime.

New multi-source POS settlement persistence is enabled only for settlements created after the new runtime is deployed.

This preserves old accounting meaning and avoids inventing historical source identities that were never captured.

### 7. `NO_SETTLEMENT` rows are reconciliation-only

Do not persist `SettlementItem` for facts whose financial direction is `NO_SETTLEMENT`.

Examples:
- customer paid refill online directly to Furmosa;
- a paid fact already fully owned/collected by Furmosa and creating no merchant obligation.

These remain visible in the POS reconciliation/query projection, but are not locked into a merchant settlement because there is no inter-party obligation to settle.

This keeps `SettlementItem` semantics precise: every row changes either `STORE_TO_FURMOSA` or `FURMOSA_TO_STORE` totals.

### 8. Direction and collector remain separate

Persist both on `SettlementItem`:
- `direction`: `STORE_TO_FURMOSA | FURMOSA_TO_STORE`
- `collector`: `STORE | FURMOSA | NONE`

Direction is server-computed from authoritative facts. Collector is evidence of who actually collected/holds the money. Neither is merchant-editable.

### 9. Prisma relation naming

Use explicit, non-colliding relations:

- `Settlement.items SettlementItem[]`
- `SettlementItem.settlement Settlement`
- `Merchant.settlementItems SettlementItem[]`
- `SettlementItem.merchant Merchant`

No relation is added from every source table to SettlementItem in v1.

Do not add `@@map` solely for style. Follow the existing canonical `Settlement` table naming in the first additive migration and keep Prisma/table identity simple. If a repository-wide naming migration is desired, do it separately.

### 10. Minimal v1 SettlementItem schema contract

Conceptually:

```prisma
model SettlementItem {
  id             String   @id @default(cuid())
  settlementId   String
  merchantId     String
  sourceKind     String
  sourceId       String
  occurredAt     DateTime
  amountTwd      Int
  direction      String
  collector      String
  kind           String
  relatedOrderId String?
  noteSnapshot   String?
  createdAt      DateTime @default(now())

  settlement Settlement @relation(fields: [settlementId], references: [id], onDelete: Restrict)
  merchant   Merchant   @relation(fields: [merchantId], references: [id], onDelete: Restrict)

  @@unique([sourceKind, sourceId])
  @@index([settlementId])
  @@index([merchantId, occurredAt])
  @@index([sourceKind, sourceId])
}
```

### 11. Header extensions are deferred

Do not add `storePayableTwd`, `furmosaPayableTwd`, `netAmountTwd`, `payer`, `receiver`, or `paymentMethod` to `Settlement` in the first schema action unless implementation tests prove a persisted header snapshot is required.

For v1, directional totals can be deterministically derived from immutable SettlementItems. Avoid expanding the legacy header until runtime needs it.

### 12. Cancellation / delete / reversal

Canonical lifecycle remains:

`draft -> reviewing -> approved -> paid`

with `draft -> cancelled` and `reviewing -> draft`.

Rules:
- draft cancellation releases all new item locks and matching legacy MerchantStockTxn locks atomically, then marks header cancelled;
- reviewing -> draft keeps the frozen source set and locks;
- approved/paid cannot be cancelled or physically deleted;
- approved/paid corrections are new reversal/next-period adjustment facts;
- legacy physical delete may exist only for settlements with zero SettlementItems until HQ runtime is migrated.

### 13. Migration / rollback strategy

First migration is additive only:
- create `SettlementItem` table/model;
- add inverse relation fields in Prisma only;
- no backfill;
- no change to existing Settlement columns;
- no change to MerchantStockTxn columns.

Rollback before runtime rollout: drop the new table/migration only.

Rollback after production has written SettlementItems is not a blind DROP. New POS settlement writes must first be disabled, records exported/audited, and runtime reverted. Financial history must not be discarded merely to roll code back.

### 14. Required implementation tests

Before enabling POS settlement writes:

1. same `(sourceKind, sourceId)` cannot appear twice;
2. concurrent claims of the same source result in only one successful settlement;
3. source merchant must equal authenticated/HQ-authorized settlement merchant;
4. `NO_SETTLEMENT` facts create no SettlementItem;
5. store-collected Furmosa money becomes `STORE_TO_FURMOSA`;
6. Furmosa subsidy becomes `FURMOSA_TO_STORE`;
7. header directional totals equal sums derived from items;
8. legacy MerchantStockTxn lock and SettlementItem point to the same Settlement when applicable;
9. failed transaction leaves no partial item/header/legacy lock changes;
10. draft cancellation releases locks atomically;
11. paid facts cannot be mutated/deleted;
12. legacy Settlement flows with zero SettlementItems continue to work.

## Foundation verdict

No remaining schema-design blocker exists for the first implementation action.

The next action is allowed to edit `prisma/schema.prisma` only to add the minimal `SettlementItem` model and inverse relation fields. It must not create a migration, change runtime, change UI, backfill data, or alter existing financial columns in the same action.
