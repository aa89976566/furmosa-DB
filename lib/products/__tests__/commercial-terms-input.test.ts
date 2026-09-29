import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseProductCommercialTerms,
  productCommercialTermsChanged,
} from '../commercial-terms-input.ts';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test('percent commission is stored as integer basis points', () => {
  const parsed = parseProductCommercialTerms(
    form({
      businessTier: 'premium',
      consignmentEnabled: 'on',
      defaultConsignmentCommissionMode: 'percent',
      defaultConsignmentCommissionDisplayValue: '30',
    }),
    'STANDARD',
  );
  assert.equal(parsed.defaultConsignmentCommissionValue, 3000);
  assert.equal(parsed.businessTier, 'premium');
});

test('fixed commission and wholesale price require positive integer TWD', () => {
  assert.throws(
    () => parseProductCommercialTerms(
      form({
        businessTier: 'standard',
        consignmentEnabled: 'on',
        defaultConsignmentCommissionMode: 'amount',
        defaultConsignmentCommissionDisplayValue: '10.5',
      }),
      'STANDARD',
    ),
    /整數/,
  );
  assert.throws(
    () => parseProductCommercialTerms(
      form({ businessTier: 'standard', wholesaleEnabled: 'on', defaultWholesaleUnitPrice: '0' }),
      'STANDARD',
    ),
    /大於 0/,
  );
});

test('jar exchange cannot be enabled on a standard product', () => {
  assert.throws(
    () => parseProductCommercialTerms(
      form({ businessTier: 'standard', jarExchangeEnabled: 'on' }),
      'STANDARD',
    ),
    /只有換罐計畫商品/,
  );
});

test('disabled modes clear their defaults and unchanged values do not bump version', () => {
  const parsed = parseProductCommercialTerms(form({ businessTier: 'standard' }), 'STANDARD');
  assert.equal(parsed.defaultConsignmentCommissionMode, null);
  assert.equal(parsed.defaultWholesaleUnitPrice, null);
  assert.equal(productCommercialTermsChanged(parsed, parsed), false);
});
