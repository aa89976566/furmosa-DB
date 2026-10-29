# Legacy sheet candidate title-suffix prefill v5

Base commit: `7336c52`

Claude review: https://claude.ai/chat/6e6a70db-c4b8-429c-8932-b076d8588801 (approved minimal design, 2026-10-29)

## Goal

Extend the existing read-only legacy reference in Shopify catalog candidates so marketing prefixes in Shopify product titles do not prevent a safe reference match. Real store examples include `◈ 走敢若飛 ◈ 鴨翅`, whose canonical HQ/legacy product name is `鴨翅`.

This is still a non-identity prefill only. Shopify SKU, variant identity, price, weight parsing, the create action, payload, inventory, and all existing transaction behavior remain authoritative and unchanged. Legacy `sourceSku` remains display-only and must never be compared with or linked to Shopify SKU.

## Allowed files

- `app/(main)/products/shopify-candidates/[id]/page.tsx`
- `lib/shopify/legacy-catalog-reference.ts`
- `lib/shopify/__tests__/legacy-catalog-reference.test.ts`
- `lib/shopify/__tests__/catalog-candidate-pages.test.ts`
- `.cursor/prompts/legacy-sheet-candidate-prefill-v5.md`

## Forbidden scope

No changes to the snapshot, client form, actions, `catalog-candidate-create.ts`, candidate identity resolution/matcher, catalog sync, import scripts, Prisma schema/migrations, inventory, Shopify clients, environment variables, packages, deployment settings, production data, or any file outside the allowlist.

## Matching algorithm

Normalize both Shopify product title and canonical legacy names using Unicode NFKC, remove Unicode format-control (`Cf`) characters, trim, collapse consecutive whitespace to one space, and lowercase.

1. Try the existing normalized exact-name lookup first.
2. If an exact normalized name exists but maps to multiple legacy `sourceSku` values, return `NAME_CONFLICT` and do not fall back to suffix matching.
3. Only when no exact normalized name exists, consider a canonical legacy name when:
   - the normalized Shopify product title ends with the complete normalized canonical name;
   - the canonical name contains at least two Han-script characters;
   - the normalized canonical name is shorter than the normalized Shopify title;
   - that canonical name maps to exactly one normalized legacy `sourceSku`.
4. No separator is required between the marketing prefix and canonical name.
5. When more than one safe canonical name is a suffix, choose the longest normalized canonical name by Unicode code-point count.
6. If the longest result is not unique, or its canonical name/source data is conflicted, fail closed with `NAME_CONFLICT` or `SOURCE_CONFLICT`; do not prefill.
7. The existing source consistency checks still apply to the selected canonical name and `sourceSku`.

Permitted examples:

- exact: `鴨翅` → `鴨翅`
- suffix with separator: `◈ 走敢若飛 ◈ 鴨翅` → `鴨翅`
- suffix without separator: `走敢若飛鴨翅` → `鴨翅`
- longest safe suffix: if both `鴨翅` and `辣鴨翅` exist, `好吃辣鴨翅` → `辣鴨翅`

Prohibited:

- prefix, middle-substring, token removal, specification removal, alias tables, edit distance, fuzzy/similarity matching, or variant-title name matching;
- one-Han-character suffix matching such as `魚`;
- matching `鴨翅（5入）` to `鴨翅`, because the product title does not end with the complete canonical name;
- comparing legacy `sourceSku` with Shopify SKU or using it as identity.

Exact matching may still match a canonical name shorter than two Han characters; the two-Han minimum applies only to suffix fallback.

## Non-identity fields and guards

The selected legacy row may only prefill the same non-identity fields already supported by v4: category and safely derived package cost. Weight remains derived exclusively from Shopify `variantTitle`. All v4 date, stale-data, unit, spec, cost-outlier, and cost-above-price guards remain unchanged.

The candidate form field set and action payload must remain byte-for-byte compatible with the existing action. No confirmation checkbox or new hidden metadata field is added.

## UI

Keep `舊表參考（不會自動寫入）` and the collapsed read-only card.

- Exact match copy: `依完全相同的商品名稱參考`.
- Suffix match copy: `Shopify 標題結尾「<canonical name>」與舊表商品相同，僅作填寫參考`.
- No-match copy must mention that neither an exact name nor a safe title-ending match was found.
- Do not use words that imply identity or persistence, including `綁定`, `連結`, `同步`, or `自動對應`, inside the legacy reference card.
- Keep the existing editable prefill labels and all form behavior unchanged.

## Tests

- Preserve all v4 tests.
- Exact match remains first and reports `matchedBy: exact_product_name`.
- Marketing prefixes with and without separators match a complete canonical suffix and report `matchedBy: product_title_suffix`.
- Actual style `◈ 走敢若飛 ◈ 鴨翅` matches `鴨翅`.
- NFKC plus Unicode `Cf` removal works.
- One-Han canonical suffix, prefix-only, middle substring, trailing specification, and fuzzy text do not match.
- A conflicted exact name does not fall back to another suffix.
- Longest safe canonical suffix wins.
- Duplicate/conflicted longest results fail closed.
- Shopify SKU may differ from legacy `sourceSku`; the reference still works and neither value is used to establish identity.
- Weight remains Shopify-only; cost and category remain guarded legacy non-identity prefills.
- UI tests assert exact/suffix explanation copy and unchanged form payload/field set.
- Existing candidate and Shopify suites remain green.

## Acceptance and release boundary

- `git diff --name-only 7336c52...HEAD` is entirely within the v5 allowlist.
- Snapshot, client form, actions, transaction code, matcher, import scripts, inventory, schema, and Shopify clients have zero diff.
- Existing creation remains draft, inventory remains zero, and Shopify price remains authoritative.
- Update the existing draft PR only. Do not merge or deploy.
