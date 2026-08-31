import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildStoreRedeemUrl,
  buildUnifiedStoreRedeemPath,
  buildUnifiedStoreRedeemUrl,
} from '@/lib/stores/redeem-url';

describe('store redeem URL', () => {
  it('always uses the same-deployment POS login path', () => {
    assert.equal(buildUnifiedStoreRedeemPath(), '/pos/login');
    assert.equal(buildUnifiedStoreRedeemUrl(), '/pos/login');
  });

  it('does not place a store slug in the URL', () => {
    assert.equal(buildUnifiedStoreRedeemPath('zhuwo_banqiao'), '/pos/login');
    assert.equal(buildUnifiedStoreRedeemUrl('niuniu'), '/pos/login');
    assert.equal(buildStoreRedeemUrl('manlisa', 'legacy-secret'), '/pos/login');
  });

  it('cannot be redirected to a Preview deployment by environment variables', () => {
    const previousMemberSite = process.env.NEXT_PUBLIC_MEMBER_SITE_URL;
    const previousVercelUrl = process.env.VERCEL_URL;

    process.env.NEXT_PUBLIC_MEMBER_SITE_URL =
      'https://furmosa-preview.example.vercel.app';
    process.env.VERCEL_URL = 'furmosa-preview.example.vercel.app';

    try {
      assert.equal(buildUnifiedStoreRedeemUrl('pet99'), '/pos/login');
    } finally {
      if (previousMemberSite === undefined) delete process.env.NEXT_PUBLIC_MEMBER_SITE_URL;
      else process.env.NEXT_PUBLIC_MEMBER_SITE_URL = previousMemberSite;

      if (previousVercelUrl === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = previousVercelUrl;
    }
  });
});
