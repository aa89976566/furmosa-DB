import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accessFor,
  customerCanReadOtherCustomer,
  isAnonymousBookingAllowed,
  merchantCanReadOtherMerchant,
  runtimeRoleMustBypassRls,
} from '@/lib/rls/policy-matrix';
import { RLS_PHASE } from '@/lib/rls/session-context';
import {
  RLS_PLACEHOLDER_RUNTIME_ROLE,
  RLS_PLACEHOLDER_SCHEMA_OWNER,
  SUPABASE_PLATFORM_ROLES,
} from '@/lib/rls/constants';

describe('RLS policy matrix (approved product rules)', () => {
  it('rejects anonymous booking', () => {
    assert.equal(isAnonymousBookingAllowed(), false);
    assert.equal(accessFor('appointments', 'anonymous', 'insert'), 'deny');
  });

  it('merchant A cannot read merchant B rows', () => {
    assert.equal(merchantCanReadOtherMerchant('mer-a', 'mer-b'), false);
    assert.equal(merchantCanReadOtherMerchant('mer-a', 'mer-a'), true);
    assert.equal(accessFor('appointments', 'merchant', 'select'), 'allow_own_merchant');
    assert.equal(accessFor('refill_orders', 'merchant', 'select'), 'allow_own_merchant');
  });

  it('merchant may read-only own Order and Settlement; cannot update Settlement', () => {
    assert.equal(accessFor('Order', 'merchant', 'select'), 'allow_readonly_own_merchant');
    assert.equal(accessFor('Settlement', 'merchant', 'select'), 'allow_readonly_own_merchant');
    assert.equal(accessFor('Settlement', 'merchant', 'update'), 'deny');
    assert.equal(accessFor('Settlement', 'hq', 'update'), 'allow');
  });

  it('customer cannot read other customer', () => {
    assert.equal(customerCanReadOtherCustomer('c1', 'c2'), false);
    assert.equal(accessFor('Customer', 'customer_line', 'select'), 'allow_self');
    assert.equal(accessFor('member_points_ledger', 'customer_line', 'select'), 'allow_self');
    assert.equal(accessFor('Customer', 'customer_line', 'select') !== 'allow', true);
  });

  it('HQ retains legitimate full access on ops tables', () => {
    assert.equal(accessFor('Order', 'hq', 'select'), 'allow');
    assert.equal(accessFor('Settlement', 'hq', 'update'), 'allow');
    assert.equal(accessFor('InventoryBalance', 'hq', 'select'), 'allow');
  });

  it('webhook/cron has minimal write on payment/refill/line session', () => {
    assert.equal(accessFor('payment_orders', 'system_webhook_cron', 'insert'), 'allow');
    assert.equal(accessFor('refill_orders', 'system_webhook_cron', 'update'), 'allow');
    assert.equal(accessFor('LineChatSession', 'system_webhook_cron', 'insert'), 'allow');
    assert.equal(accessFor('Settlement', 'system_webhook_cron', 'update'), 'deny');
  });

  it('anon denied across sensitive tables', () => {
    for (const table of [
      'Customer',
      'Order',
      'Settlement',
      'MerchantStock',
      'LineChatSession',
      'payment_orders',
    ] as const) {
      assert.equal(accessFor(table, 'anonymous', 'select'), 'deny', table);
    }
  });

  it('Prisma runtime must not use BYPASSRLS; Phase 1 has no DB tenant isolation yet', () => {
    assert.equal(runtimeRoleMustBypassRls(), false);
    assert.equal(RLS_PHASE.dbRowTenantIsolation, false);
    assert.equal(RLS_PHASE.runtimeRoleMustNotBypassRls, true);
    assert.match(RLS_PLACEHOLDER_RUNTIME_ROLE, /^REPLACE_ME_/);
    assert.match(RLS_PLACEHOLDER_SCHEMA_OWNER, /^REPLACE_ME_/);
    assert.deepEqual([...SUPABASE_PLATFORM_ROLES], ['anon', 'authenticated', 'service_role']);
  });
});
