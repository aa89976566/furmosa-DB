# POS Settlement Schema Compatibility Decision

Status: foundation decision only. No migration, no production DB change, no UI work.

## 1. Existing truth that must be preserved

The current Furmosa DB already has a production `Settlement` model and HQ settlement runtime. It is the single settlement header and must remain the canonical settlement record.

Existing settlement facts:
- `Settlement.id` is the FK target.
- `Settlement.settlementId` is the human-readable unique identifier.
- `Settlement.merchantId`, `periodStart`, `periodEnd`, `status`, `paidAt`, `note` already exist.
- `MerchantStockTxn.settlementId` already locks legacy consignment sale rows to a `Settlement`.
- Existing HQ settlement creation performs header creation + `MerchantStockTxn` locking atomically.

Therefore POS must not create a second settlement header model.

## 2. Compatibility problem

The current `Settlement` schema was designed for legacy consignment sale settlement. Its financial summary fields are `Float` and its row lock only covers `MerchantStockTxn`.

POS settlement needs to reconcile more source kinds:
- legacy merchant sale stock transaction
- refill / extra payment (`PaymentOrder`)
- merchant-collected payment facts
- approved restock cost
- coupon / reward subsidy
- future approved adjustment or reversal

Those source tables must remain authoritative. Settlement persistence must snapshot and lock inclusion without creating a second payment or fulfillment truth.

## 3. Chosen compatibility strategy

### 3.1 Keep existing Settlement fields unchanged in the first migration

Do not convert existing `Float` columns in the first POS settlement migration. That is a separate financial-data migration with backfill and regression risk.

Preserve:
- `grossSales`
- `commissionRate`
- `commissionAmount`
- `rewardPayout`
- `shippingFee`
- `merchantOwesUs`
- `payable`

Existing HQ pages and settlement calculations must continue working unchanged.

### 3.2 Add integer POS summary snapshot fields only if runtime requires them

If POS needs persisted net summary values on the header, add nullable integer TWD fields rather than reusing the legacy Float meaning:
- `storePayableTwd Int?`
- `furmosaPayableTwd Int?`
- `netAmountTwd Int?`
- `payer String?` (`STORE | FURMOSA | NONE`)
- `receiver String?` (`STORE | FURMOSA | NONE`)
- `paymentMethod String?`

These must initially be nullable so historical Settlement rows remain valid.

Do not add them unless the runtime implementation demonstrably needs header snapshots; `SettlementItem` remains the authoritative included-line snapshot.

### 3.3 Add one SettlementItem model

`SettlementItem` is the cross-source settlement lock and immutable financial snapshot.

Required conceptual fields:
- `id String @id @default(cuid())`
- `settlementId String`
- `merchantId String`
- `sourceKind String`
- `sourceId String`
- `direction String` (`STORE_TO_FURMOSA | FURMOSA_TO_STORE`)
- `collector String` (`STORE | FURMOSA | NONE`)
- `amountTwd Int`
- `relatedOrderId String?`
- `description String?`
- `occurredAt DateTime`
- `createdAt DateTime @default(now())`

Relations:
- `settlement -> Settlement(id)` with `onDelete: Restrict` preferred for financial history.
- `merchant -> Merchant(id)` with `onDelete: Restrict` preferred for financial history.

Identity / duplicate prevention:
- `@@unique([sourceKind, sourceId])`

Indexes:
- `@@index([settlementId])`
- `@@index([merchantId, occurredAt])`
- `@@index([sourceKind, sourceId])`

Do not create nullable FKs from SettlementItem to every possible source table in v1. `sourceKind + sourceId` is the channel-neutral identity. Runtime must resolve and validate the source server-side before insert.

## 4. Legacy MerchantStockTxn lock compatibility

For legacy merchant sales, during transition both must be written in the same DB transaction:
1. create the `SettlementItem` for the MerchantStockTxn source;
2. set `MerchantStockTxn.settlementId = Settlement.id`.

This preserves every existing HQ query that currently checks `MerchantStockTxn.settlementId IS NULL`.

The two locks must never disagree.

Required invariant:
- if a `SettlementItem(sourceKind='merchant_stock_txn', sourceId=X)` exists, MerchantStockTxn X must reference the same Settlement.

Until legacy consumers are migrated, never remove `MerchantStockTxn.settlementId`.

## 5. Cross-source lock rule

For source tables that do not currently have `settlementId`, do not immediately add settlement columns to every source model.

The v1 lock is the unique `SettlementItem(sourceKind, sourceId)` row.

Before settlement creation, runtime must query SettlementItem for candidate source identities and reject any already present.

The final uniqueness guarantee must be database-enforced, not only checked in application code.

## 6. Transaction boundary

One settlement commit must atomically:
1. re-read all candidate source facts for the authenticated merchant;
2. validate that they are still eligible;
3. check/claim unique source identities;
4. create or update the canonical `Settlement` header;
5. insert all `SettlementItem` immutable snapshots;
6. update `MerchantStockTxn.settlementId` for legacy sale sources;
7. commit.

Any failure rolls back all steps.

## 7. Merchant isolation

The client must never choose `merchantId` for settlement facts.

`merchantId` is resolved from the authenticated merchant session or HQ-authorized context and every source must belong to that merchant/store scope before it can be included.

A source belonging to another merchant must fail before any write.

## 8. Status compatibility

Keep the existing canonical Settlement workflow in the first implementation:
`draft -> reviewing -> approved -> paid`

Do not introduce a competing status vocabulary for POS.

If cancellation is needed later, it requires an explicit correction/reversal policy rather than silently deleting paid financial facts.

Existing `deleteSettlement` behavior must be reviewed before POS settlements use the model; POS cross-source settlements must not be deletable in a way that leaves SettlementItems or source locks inconsistent.

## 9. Money compatibility

- New POS settlement line amounts: integer TWD (`Int`) only.
- Do not add new Float monetary fields.
- Do not convert old Float financial columns in the same migration.
- Conversion of legacy Settlement money columns to integer/Decimal is a separate migration project.

## 10. Gates before schema edit

Before editing `schema.prisma`, implementation must prove these decisions with tests/spec cases:
1. historical Settlement rows remain valid with no new required header fields;
2. existing HQ create/read/status flows compile without changes to their meaning;
3. one source cannot belong to two settlements;
4. a failed multi-source settlement leaves zero SettlementItems and zero new legacy locks;
5. MerchantStockTxn legacy lock and SettlementItem lock always match;
6. Furmosa-collected refill payments cannot become STORE_TO_FURMOSA payable;
7. store-collected facts do become STORE_TO_FURMOSA payable;
8. cross-merchant source inclusion is rejected;
9. paid settlement facts cannot be edited in place;
10. deletion/cancellation behavior is explicitly defined before enabling POS persistence.

## 11. Current recommendation

The schema is compatible with a minimal additive `SettlementItem` migration.

Do not modify the existing Settlement financial Float fields yet.
Do not add a second settlement header.
Do not remove MerchantStockTxn.settlementId.
Do not enable POS write persistence until deletion/correction semantics and transactional source locking are implemented and tested.
