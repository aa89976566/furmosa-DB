# LINE Cart Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer reduce, increase, or remove LINE cart items without leaving the LINE conversation.

**Architecture:** Extend the existing server-owned `LineShopDraft` cart and postback router. Cart buttons send variant-scoped postbacks; the server reloads the active session, applies a bounded quantity change, clears stale checkout fields, saves the draft, and returns the refreshed cart Flex message.

**Tech Stack:** Next.js, TypeScript, LINE Messaging API Flex Messages, Prisma-backed `LineChatSession`, Node test runner.

**Spec:** Existing LINE commerce requirements in this chat and `lib/line/shop-checkout.ts`.

## Global Constraints

- Do not change Prisma schema, migrations, Shopify data, HQ production data, prices, inventory, or order history.
- Cart state remains server-side and variant IDs are validated against the live Shopify catalog before adding.
- Quantity must stay between 1 and 99; decrementing the last unit removes the item.
- Any cart edit invalidates stale recipient, shipping, order, and checkout fields.
- Use existing FURMOSA Flex colors and components; support LINE mobile and desktop clients.

## Review Focus

- Unknown variant postback leaves the cart unchanged and returns a safe cart response.
- Repeated increment never exceeds 99.
- Decrementing quantity 1 removes only the selected variant.
- Editing after checkout questions started returns the session to `CART` and clears stale checkout data.
- Empty cart remains navigable back to shopping categories.

---

### Task 1: Pure cart mutation rules

**Files:**
- Modify: `lib/line/shop-checkout.ts`
- Test: `lib/line/__tests__/shop-checkout.test.ts`

**Interfaces:**
- Produces: `updateLineShopCartItems(items, variantId, operation)` returning a new bounded cart array.

- [ ] **Step 1: Write failing tests** for increment, decrement, remove, unknown variant, and quantity cap.
- [ ] **Step 2: Run the focused test and confirm failure is caused by the missing mutation helper.**
- [ ] **Step 3: Implement the minimal pure helper.**
- [ ] **Step 4: Run the focused test and confirm it passes.**

### Task 2: Persistent cart update and LINE actions

**Files:**
- Modify: `lib/line/shop-checkout.ts`
- Modify: `lib/line/postback-actions.ts`
- Test: `lib/line/__tests__/shop-checkout.test.ts`

**Interfaces:**
- Consumes: `updateLineShopCartItems` from Task 1.
- Produces: `updateLineShopItem(lineUserId, variantId, operation)` and `jd=shop_increment|shop_decrement|shop_remove` handlers.

- [ ] **Step 1: Add failing assertions that cart Flex output contains variant-scoped add, subtract, and remove postbacks.**
- [ ] **Step 2: Run the focused test and confirm the new assertions fail.**
- [ ] **Step 3: Add cart controls, persistent update, stale-checkout clearing, and postback routing.**
- [ ] **Step 4: Run all LINE commerce tests.**
- [ ] **Step 5: Run TypeScript and the repository test gate, then commit and open a Draft PR.**
