# Legacy sheet candidate prefill v4

Base commit: `00e211a3289425000db679e0067135fc778e69c2`

Claude review: https://claude.ai/chat/14362caa-ffb6-485a-a744-32c5f096824f (`APPROVE`, 2026-10-29)

## Goal

When the existing exact matcher does not resolve a Shopify catalog candidate, use a dated, read-only snapshot of the user's legacy Google Sheet to prefill non-identity fields in the existing create form. Shopify SKU, variant identity, price, and the existing server action remain authoritative.

Name matching is a narrow exception to the rule that names must never establish identity. It may only suggest non-identity fields. It must never create a relationship, auto-create a product, run in batch, enter a hidden field, or reach the action payload. `sourceSku` is display-only.

## Allowed files

- `app/(main)/products/shopify-candidates/[id]/page.tsx`
- `app/(main)/products/shopify-candidates/[id]/candidate-actions.tsx`
- `lib/shopify/legacy-catalog-reference.ts`
- `lib/shopify/legacy-catalog-reference.snapshot.json`
- `lib/shopify/__tests__/legacy-catalog-reference.test.ts`
- `lib/shopify/__tests__/catalog-candidate-pages.test.ts`
- `.cursor/prompts/legacy-sheet-candidate-prefill-v4.md`

## Forbidden scope

No changes to actions, `catalog-candidate-create.ts`, candidate resolution/matcher, catalog sync, `prisma/import.ts`, Prisma schema or migrations, inventory, Shopify clients, other pages, environment variables, deployment settings, packages, or production data.

`candidate-actions.tsx` is client UI only. Its action, form field names, hidden fields, and payload set must not change. It may receive calculated scalar/display props and use them only as `defaultValue`, labels, and read-only text.

## Snapshot

`lib/shopify/legacy-catalog-reference.snapshot.json` is a one-time, deidentified extraction dated 2026-10-29 from these tabs of the user-designated Sheet: `品項主檔`, `單價表`, and `廠商訂單`. It contains only `snapshotDate`, `sourceSku`, canonical product name, category, vendor, unit, legacy retail references, and dated cost history. Runtime must never call Google APIs.

The offline extraction first creates exact normalized name to `sourceSku` candidates from `品項主檔`. Only a name that maps to exactly one `sourceSku` may attach `單價表` or `廠商訂單` data. Because `廠商訂單` lacks `sourceSku`, a purchase row is assigned during extraction only if its exact normalized name maps uniquely; otherwise it is excluded and the conflict remains visible in the snapshot. If one `sourceSku` is associated with different canonical names, runtime treats it as a conflict and does not prefill.

Only the server component may import the snapshot/reference module. The client form receives calculated scalar/display props and must not import the snapshot or reference module.

## Exact name reference rules

- Compare Shopify `productTitle` only with snapshot canonical name.
- Normalization: Unicode NFKC, trim, collapse consecutive whitespace to one space, lowercase.
- Prohibit contains, prefix, suffix, token removal, spec removal, aliases, edit distance, similarity, and mixing `variantTitle` into the name lookup.
- Unique means the normalized name in the master list maps to exactly one `sourceSku` and that source has no conflict.
- Zero rows: no legacy prefill.
- Multiple source SKUs or any conflict: no legacy prefill; show the reason read-only.
- UI must say `依商品名稱比對` and `舊表參考（不會自動寫入）`.
- `sourceSku` is never identity and never enters the form payload.

## Weight parsing

Weight is derived only from Shopify `variantTitle`, never from the legacy sheet. A valid title contains exactly one positive base-10 integer followed by `g`, `克`, or `公克`, with optional normal whitespace between number and unit. The number may not be immediately preceded by a digit, period, or comma. Reject the entire title if it contains a decimal or thousands separator, `kg`, more than one weight, zero, or any multi-pack/combo marker: `x`, `×`, `入`, `包`, `組`, `+`.

Valid examples: `50g`, `50 g`, `50克`, `50 公克`. Invalid examples: `12.5g`, `1,000g`, `0g`, `1kg`, `30g+50g`, `5包 50g`.

When valid, prefill weight even when the legacy name has zero matches or a conflict. Label it `由 Shopify 規格解析，送出前請確認`. If a user changes it, the label disappears by comparing current value to the initial value; no metadata field is added.

If a legacy reference explicitly disagrees with Shopify grams, keep the Shopify weight, leave cost blank, and show `SPEC_MISMATCH`.

## Cost

Version 1 supports only cost-per-gram. Do not convert package, box, piece, or other units. From the unique safe `sourceSku`, choose the latest dated cost with a numeric value greater than zero and unit `g`, `克`, or `公克`. Multiply by parsed Shopify grams for the package cost.

Leave cost blank with a reason when the date is missing, value is invalid, unit conflicts, cost exceeds Shopify selling price, valid historical `max / min > 2`, snapshot age exceeds 18 months, selected cost age exceeds 18 months, or the legacy spec conflicts with Shopify grams. Both age checks receive `now` as a function parameter for deterministic tests.

## UI

- Keep the current form action and field set unchanged.
- Prefill category/mode/unit/cost only when derived safely. Values from the sheet show `舊表帶入，送出前請確認`; the label disappears after the value changes.
- Weight uses the Shopify-specific label above.
- A collapsed, read-only reference card shows: `舊表參考（不會自動寫入）`, `依商品名稱比對`, snapshot date, source SKU, vendor, cost date/source, legacy retail reference, and difference from Shopify price. It has no action button.
- Invalid/future/malformed snapshot never throws. The original form still works and shows a short unavailable notice.
- Candidates already resolved by the exact matcher do not call the legacy lookup and do not show the reference card.

## Tests

- Valid, malformed, future, and hard-stale snapshot with injected `now`.
- Zero, unique, multiple-source, and conflicting source rows.
- NFKC/trim/whitespace/lowercase normalization; prove no contains/prefix/token removal/variant mixing.
- Weight valid cases and every invalid case above.
- Weight still prefills with zero/conflicting legacy match.
- Spec mismatch keeps Shopify weight but leaves cost blank with `SPEC_MISMATCH`.
- Latest valid per-gram cost; missing date, invalid/non-positive value, unit conflict, cost above Shopify price, `max / min > 2`, stale snapshot, and stale cost all leave cost blank.
- Shopify SKU/variant/price props remain authoritative.
- Form field/hidden-field set remains unchanged and contains no `sourceSku` or legacy metadata.
- Exact matcher hits do not invoke lookup.
- Client component does not import snapshot/reference.
- Existing candidate tests remain green.

## Acceptance and release boundary

- `git diff --name-only` is entirely within the allowlist.
- Actions, transaction code, matcher, import script, inventory, and Shopify clients have zero diff.
- Existing creation remains draft, stock zero, Shopify-priced.
- Create a PR only. Do not merge or deploy.
