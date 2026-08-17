import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SHIPPING_NORMALIZE_MARKER,
  parseEmbeddedShippingAddress,
  planCustomerShippingRepair,
} from '../normalize-shipping-address';

const FAKE_NAME = '測試收件人';
const FAKE_PHONE = '0912000111';
const FAKE_STORE_NAME = '測試門市';
const FAKE_STORE_ID = '123456';
const FAKE_ADDRESS = '台北市測試區測試路1號';

describe('parseEmbeddedShippingAddress', () => {
  it('parses labeled recipient, mobile, and 7-ELEVEN store', () => {
    const parsed = parseEmbeddedShippingAddress(
      `收件人：${FAKE_NAME}\n手機：0912-000-111\n7-ELEVEN ${FAKE_STORE_NAME} 店號${FAKE_STORE_ID}`,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.fields.recipientName, FAKE_NAME);
    assert.equal(parsed.fields.recipientPhone, FAKE_PHONE);
    assert.equal(parsed.fields.cvsBrand, '711');
    assert.equal(parsed.fields.cvsStoreId, FAKE_STORE_ID);
    assert.equal(parsed.fields.cvsStoreName, FAKE_STORE_NAME);
  });

  it('parses 7-11 store name with parenthetical store id', () => {
    const parsed = parseEmbeddedShippingAddress(`7-11${FAKE_STORE_NAME}（${FAKE_STORE_ID}）`);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.fields.cvsStoreId, FAKE_STORE_ID);
    assert.equal(parsed.fields.cvsStoreName, FAKE_STORE_NAME);
  });

  it('skips unlabeled home address without embedded fields', () => {
    const parsed = parseEmbeddedShippingAddress(FAKE_ADDRESS);
    assert.deepEqual(parsed, { ok: false, reason: 'no_embedded_fields' });
  });

  it('skips multiple mobiles as ambiguous', () => {
    const parsed = parseEmbeddedShippingAddress(
      `收件人：${FAKE_NAME} 0912000111 0912000222 7-ELEVEN ${FAKE_STORE_NAME} 店號${FAKE_STORE_ID}`,
    );
    assert.deepEqual(parsed, { ok: false, reason: 'multiple_phones' });
  });

  it('skips 7-11 mention without store name or id', () => {
    const parsed = parseEmbeddedShippingAddress('請送到 7-ELEVEN');
    assert.deepEqual(parsed, { ok: false, reason: 'store_brand_without_id_or_name' });
  });

  it('does not guess a name without 收件人/姓名 label', () => {
    const parsed = parseEmbeddedShippingAddress(`${FAKE_NAME} ${FAKE_ADDRESS}`);
    assert.deepEqual(parsed, { ok: false, reason: 'no_embedded_fields' });
  });
});

describe('planCustomerShippingRepair', () => {
  const base = {
    source: 'website',
    note: null,
    shippingMethod: 'home',
    cvsBrand: null,
    cvsStoreId: null,
    cvsStoreName: null,
    shipments: [
      {
        id: 'shp_fake_1',
        recipientName: null,
        recipientPhone: null,
        recipientAddress: null,
      },
    ],
  };

  it('fills empty structured fields from an unambiguous blob', () => {
    const plan = planCustomerShippingRepair({
      ...base,
      shippingAddress: `收件人：${FAKE_NAME}／0912000111／7-ELEVEN ${FAKE_STORE_NAME} 店號${FAKE_STORE_ID}`,
    });
    assert.equal(plan.action, 'repair');
    if (plan.action !== 'repair') return;
    assert.equal(plan.orderPatch.cvsBrand, '711');
    assert.equal(plan.orderPatch.cvsStoreId, FAKE_STORE_ID);
    assert.equal(plan.orderPatch.cvsStoreName, FAKE_STORE_NAME);
    assert.equal(plan.orderPatch.shippingMethod, 'convenience');
    assert.ok((plan.orderPatch.note ?? '').includes(SHIPPING_NORMALIZE_MARKER));
    assert.equal(plan.shipmentPatches[0]?.recipientName, FAKE_NAME);
    assert.equal(plan.shipmentPatches[0]?.recipientPhone, FAKE_PHONE);
    assert.ok(!JSON.stringify(plan).includes('真實'));
  });

  it('skips conflicting existing store id', () => {
    const plan = planCustomerShippingRepair({
      ...base,
      cvsBrand: '711',
      cvsStoreId: '654321',
      shippingAddress: `7-ELEVEN ${FAKE_STORE_NAME} 店號${FAKE_STORE_ID}`,
    });
    assert.deepEqual(plan, { action: 'skip', reason: 'conflicting_existing_values' });
  });

  it('is idempotent after the audit marker is present', () => {
    const first = planCustomerShippingRepair({
      ...base,
      shippingAddress: `收件人：${FAKE_NAME}\n7-ELEVEN ${FAKE_STORE_NAME} 店號${FAKE_STORE_ID}`,
    });
    assert.equal(first.action, 'repair');
    if (first.action !== 'repair') return;

    const second = planCustomerShippingRepair({
      ...base,
      note: first.orderPatch.note ?? SHIPPING_NORMALIZE_MARKER,
      shippingAddress: first.orderPatch.shippingAddress ?? base.shipments[0]!.recipientAddress,
      cvsBrand: first.orderPatch.cvsBrand ?? '711',
      cvsStoreId: first.orderPatch.cvsStoreId ?? FAKE_STORE_ID,
      cvsStoreName: first.orderPatch.cvsStoreName ?? FAKE_STORE_NAME,
      shippingMethod: 'convenience',
      shipments: [
        {
          id: 'shp_fake_1',
          recipientName: FAKE_NAME,
          recipientPhone: null,
          recipientAddress: FAKE_STORE_NAME,
        },
      ],
    });
    assert.deepEqual(second, { action: 'noop', reason: 'already_normalized' });
  });

  it('noops when structured fields already match', () => {
    const plan = planCustomerShippingRepair({
      ...base,
      shippingMethod: 'convenience',
      cvsBrand: '711',
      cvsStoreId: FAKE_STORE_ID,
      cvsStoreName: FAKE_STORE_NAME,
      shippingAddress: `7-ELEVEN ${FAKE_STORE_NAME} 店號${FAKE_STORE_ID}`,
      shipments: [
        {
          id: 'shp_fake_1',
          recipientName: FAKE_NAME,
          recipientPhone: FAKE_PHONE,
          recipientAddress: FAKE_STORE_NAME,
        },
      ],
    });
    assert.deepEqual(plan, { action: 'noop', reason: 'already_structured' });
  });

  it('skips non-customer sources', () => {
    const plan = planCustomerShippingRepair({
      ...base,
      source: 'consignment',
      shippingAddress: `收件人：${FAKE_NAME}`,
    });
    assert.deepEqual(plan, { action: 'skip', reason: 'not_customer_order' });
  });
});
