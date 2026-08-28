# POS Settlement Persistence Decision

Status: foundation decision for Furmosa DB POS. This document does not change production runtime, Prisma schema, migrations, or UI.

## Decision

Furmosa DB already has a production `Settlement` model and settlement runtime for merchant consignment sales. POS settlement MUST reuse that settlement header. Do not introduce a parallel `StoreSettlement` header/model.

The missing persistence layer is a universal settlement-item table that can lock heterogeneous money movements into one settlement without moving source-of-truth ownership away from their existing domain tables.

## Existing production truth

Current `Settlement` already stores merchant, period, gross/commission/payable amounts, status and paidAt. Existing HQ settlement creation is atomic with locking of `MerchantStockTxn.settlementId`.

Existing consignment calculation uses `MerchantStockTxn(type='sale')` as its financial source and assumes merchant-collected sales cash.

Existing POS ledger projection additionally reads real facts from domains such as:

- refill/payment (`RefillOrder`, `PaymentOrder`)
- merchant restock (`RestockRequest` and approved quantities/cost)
- coupon / reward redemption
- merchant-stock sale facts

Therefore POS settlement is broader than the legacy consignment-only settlement calculation.

## Canonical architecture

### 1. Header

Reuse `Settlement` as the one canonical settlement header.

The header represents one frozen accounting period for one merchant. It must eventually be able to snapshot, in integer TWD:

- merchant/store payable to Furmosa
- Furmosa payable to merchant/store
- net amount
- payer (`STORE` / `FURMOSA` / `NONE`)
- receiver (`STORE` / `FURMOSA` / `NONE`)
- approved payment method
- lifecycle status

Legacy fields must remain readable until existing HQ settlement pages and reports are migrated. Do not silently reinterpret old rows.

### 2. Settlement item

Add one universal settlement-item model (working name `SettlementItem`; final Prisma name to be confirmed in schema task).

Each item is an immutable financial snapshot belonging to exactly one `Settlement` and exactly one merchant.

Required concepts:

- settlementId (FK to canonical `Settlement`)
- merchantId
- sourceKind
- sourceId
- sourceSubId when the source can contain multiple financial lines
- occurredAt
- amountTwd as integer
- direction: `STORE_TO_FURMOSA` / `FURMOSA_TO_STORE`
- transactionKind
- relatedOrderId when applicable
- display snapshot / note sufficient for historical rendering
- createdAt

The tuple identifying a source financial fact must be unique so the same money movement cannot be settled twice.

Do not use a single nullable FK to one domain table as the only locking mechanism because a POS settlement can contain PaymentOrder, coupon/reward, restock and merchant-sale sources together.

### 3. Source-of-truth ownership

SettlementItem is a frozen settlement snapshot, not a replacement transaction ledger.

The original fact remains authoritative:

- ECPay/LINE payment state -> existing Payment/PaymentOrder facts
- refill fulfillment -> RefillOrder/JarCode/audit facts
- restock approval/cost -> RestockRequest domain
- coupon/reward redemption -> existing redemption domain
- consignment/POS sale -> existing sale/merchant-stock facts (and future POS sale facts when they are formally landed)

Settlement must never create a second payment or fulfillment state machine.

### 4. Collection and money direction

Collection channel and settlement direction are different concepts.

Examples:

- customer paid refill online to Furmosa: collector = FURMOSA, direction = NO_SETTLEMENT for the merchant
- merchant collected cash on behalf of Furmosa: collector = STORE, direction = STORE_TO_FURMOSA
- approved coupon subsidy owed by Furmosa to store: direction = FURMOSA_TO_STORE
- approved restock/consignment charge owed by store: direction = STORE_TO_FURMOSA

The server resolves these from real source facts. Merchant client must not submit or override collector, direction, amount, merchantId or settlement inclusion.

### 5. Atomic settlement creation

One database transaction must:

1. resolve authenticated merchant and requested period
2. reload eligible source facts from authoritative tables
3. classify each fact server-side
4. reject any source already referenced by an existing SettlementItem
5. calculate both directions and net result
6. create/freeze the Settlement header
7. create all SettlementItem rows
8. apply legacy MerchantStockTxn settlement locking where still required for backwards compatibility
9. commit together

If any step fails, nothing is marked settled.

### 6. Immutability and corrections

After a settlement is approved/paid, financial facts and settlement items are immutable.

Corrections use reversal / next-period adjustment facts. Do not edit historical amount or source identity in place.

A paid settlement must never be deleted by the POS.

### 7. Status ownership

Use the existing domain lifecycle vocabulary as the baseline:

`draft -> reviewing -> approved -> paid`

`cancelled` may be supported only through an explicit transition rule before paid.

Merchant POS must not be able to self-approve HQ-controlled states unless a later policy explicitly permits it.

### 8. Money type

New POS settlement persistence must use integer TWD (BigInt or equivalent integer storage), following the POS persistence direction. Do not add new Float financial fields.

Existing Float fields on legacy `Settlement` are compatibility debt and must not be copied into new SettlementItem design.

## What is missing now

1. `SettlementItem` persistence does not exist.
2. Existing `Settlement` is consignment-oriented and cannot itself lock heterogeneous POS ledger sources.
3. Current POS `persistStoreSettlement()` intentionally returns `SCHEMA_MISSING`.
4. Existing settlement fields use Float and legacy one-direction assumptions; they cannot be the only source for the new two-direction POS result.
5. There is no DB uniqueness constraint preventing the same non-MerchantStockTxn source from appearing in two settlements.

## Explicit non-decisions for later tasks

Do not decide these inside UI code:

- final Prisma field names for compatibility additions to Settlement
- whether legacy numeric header fields are backfilled into new integer snapshot columns or derived from items during migration
- exact handling of existing historical Settlement rows before SettlementItem existed
- whether payment evidence / transfer reference is stored on Settlement header or a separate settlement-payment record

These require a dedicated schema/migration task and tests before runtime writes are enabled.

## Gate before UI

UI settlement confirmation must stay disabled until all of the following are true:

- schema + migration reviewed
- unique source locking exists
- atomic persistence implemented
- duplicate-settlement tests pass
- cross-merchant isolation tests pass
- legacy HQ settlement flow remains compatible
- real settlement history can be loaded from persisted rows

Only then should POS settlement UI be considered writable.
