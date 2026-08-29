# POS Settlement Cancel / Delete / Reversal Decision

Status: foundation decision only. No Prisma schema change, no migration, no runtime write, no UI work in this step.

## 1. Why this decision is required

Furmosa DB already has a legacy HQ settlement delete flow that can delete a non-paid Settlement and release `MerchantStockTxn.settlementId` locks. POS settlement will eventually include heterogeneous sources through `SettlementItem`, so the legacy delete behavior cannot be applied blindly to new multi-source settlements.

The POS domain contract already defines the canonical lifecycle:

`draft -> reviewing -> approved -> paid`

with `draft -> cancelled` allowed, and no transition out of `paid`.

Therefore cancellation, physical deletion, and accounting reversal must be treated as three different operations.

## 2. Canonical rule

### 2.1 Draft cancellation

A settlement may be cancelled only while it is still `draft`.

Cancellation must be atomic and must release every lock created by that settlement:
- delete / invalidate all `SettlementItem` rows belonging to the draft settlement;
- clear matching legacy `MerchantStockTxn.settlementId` locks where they point to that same settlement;
- change the Settlement status to `cancelled`;
- preserve the Settlement header for audit history.

Do not physically delete the Settlement row for POS-created multi-source settlements.

A cancelled settlement is terminal and cannot be reopened. If the merchant/HQ needs a new settlement, create a new Settlement from still-eligible source facts.

### 2.2 Reviewing settlement

A `reviewing` settlement may transition back to `draft` according to the existing POS domain contract.

Returning to draft does not release source locks. The same frozen source set remains attached to that Settlement unless HQ explicitly cancels it after it is back in `draft`.

This prevents silent source substitution during review.

### 2.3 Approved settlement

An `approved` settlement cannot be deleted or cancelled.

If approval was wrong, the correction must be represented through a later reversal / adjustment workflow. Do not unlock the original source facts or edit the approved snapshot in place.

### 2.4 Paid settlement

A `paid` settlement is final and immutable.

It cannot be deleted, cancelled, unlocked, edited, or reopened.

Any accounting correction must create a new correction fact included in a later settlement.

## 3. Physical DELETE policy

For new POS multi-source settlements, application runtime must not physically delete Settlement rows.

The legacy HQ `deleteSettlement()` behavior may remain temporarily for legacy-only settlements if required for backwards compatibility, but it must be gated so it cannot delete a Settlement that has any `SettlementItem` rows.

Required compatibility guard:

```text
if Settlement has SettlementItem rows:
  physical delete = forbidden
else:
  legacy behavior may continue until HQ flow is migrated
```

This avoids orphaned accounting history and partially released cross-source locks.

## 4. Source lock release on draft cancellation

Draft cancellation must run in one database transaction.

Transaction order:
1. load Settlement with merchant scope and current status;
2. require status = `draft`;
3. load all SettlementItems for the Settlement;
4. identify matching legacy MerchantStockTxn sources;
5. verify every legacy txn currently points to the same Settlement;
6. remove SettlementItem locks for this draft settlement;
7. clear matching MerchantStockTxn.settlementId values;
8. set Settlement.status = `cancelled`;
9. commit.

Any mismatch or failure rolls back the entire cancellation.

No source becomes reusable unless every lock associated with the cancelled settlement is successfully released.

## 5. Reviewing -> draft rule

`reviewing -> draft` is allowed, matching the existing domain contract.

This transition changes only workflow status. It does not:
- delete SettlementItems;
- clear MerchantStockTxn locks;
- change amounts;
- change source identity;
- add or remove sources.

If source composition needs to change, the settlement must first return to draft, then be cancelled atomically, then a new settlement may be created from current eligible facts.

## 6. Reversal / correction rule

Once a settlement is `approved` or `paid`, correction must never modify the original SettlementItem amount or source identity.

Correction is a new financial fact, for example:
- `REVERSAL`
- `ADJUSTMENT`
- `NEXT_PERIOD_ADJUSTMENT`

The correction fact must contain a deterministic reference to the original financial fact or original SettlementItem so the audit trail is traceable.

A correction enters a later Settlement as a new SettlementItem with its own unique source identity.

The original Settlement and SettlementItems remain unchanged.

## 7. No negative-source mutation shortcut

Do not "correct" accounting by changing the original amount from +100 to -100 or by changing its direction in place.

Correct pattern:
- original item stays +100;
- later reversal item is -100-equivalent through correction semantics / opposite direction;
- audit can show both events.

Exact signed representation belongs in the later schema/runtime task, but history must remain append-only after approval.

## 8. Merchant permissions

Merchant POS users must not:
- approve a settlement;
- mark it paid;
- cancel an approved/paid settlement;
- directly release source locks;
- create manual reversal amounts without an HQ-controlled policy.

At most, a later policy may let a merchant initiate or request review/cancellation. Final accounting authority remains server/HQ controlled unless explicitly changed by a future contract.

## 9. Legacy HQ compatibility

Current HQ `deleteSettlement()` physically deletes non-paid Settlement rows and clears `MerchantStockTxn.settlementId`.

Before POS persistence is enabled:
- add a guard that prevents this legacy delete path when `SettlementItem` exists;
- preserve existing legacy behavior for settlements with zero SettlementItems until HQ pages are migrated;
- never let legacy delete remove a POS multi-source Settlement.

Do not change this runtime yet in the foundation phase.

## 10. Required tests before Cursor implementation may migrate schema

1. `draft -> cancelled` is allowed.
2. `reviewing -> draft` preserves all source locks.
3. `reviewing -> cancelled` directly is rejected.
4. `approved -> cancelled` is rejected.
5. `paid -> any state` is rejected.
6. cancelling a draft releases SettlementItem and legacy MerchantStockTxn locks atomically.
7. a lock mismatch causes full rollback.
8. cancelled sources become eligible for a future new settlement only after all locks are released.
9. physical delete is rejected when SettlementItem rows exist.
10. legacy physical delete may still work for zero-item legacy settlements during transition.
11. approved/paid correction creates a new reversal/adjustment fact; original items remain unchanged.
12. merchant session cannot directly execute HQ-only approval/payment/reversal authority.

## 11. Pre-Cursor consistency result

This decision is consistent with:
- existing POS domain contract settlement statuses and transitions;
- existing canonical `Settlement` header;
- planned `SettlementItem` cross-source lock;
- legacy `MerchantStockTxn.settlementId` compatibility;
- append-only accounting history after approval/paid.

## 12. Remaining gates before Cursor

Before handing implementation to Cursor, perform one final foundation audit covering:
- all four settlement decision documents together;
- source-kind identity rules and sourceSubKey consistency;
- exact Prisma relation names / maps;
- Int vs BigInt choice for TWD in this codebase;
- historical Settlement backfill strategy;
- whether NO_SETTLEMENT reconciliation facts should be persisted as SettlementItems or remain read-only reconciliation rows;
- test plan and migration rollback plan.

Only after those questions are closed should Cursor receive the first implementation prompt.