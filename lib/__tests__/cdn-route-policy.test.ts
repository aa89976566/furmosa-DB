import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isAnonymousPublicPath,
  isHqLoginPath,
  isPosLoginPath,
  publicHtmlCacheControl,
  shouldBypassAuthForPublicShell,
} from '@/lib/cdn-route-policy';
import { CDN_PUBLIC_HTML, CDN_PUBLIC_HTML_LONG } from '@/lib/cdn-headers';

describe('cdn-route-policy', () => {
  it('marks store-redeem / store / liff as anonymous public', () => {
    assert.equal(isAnonymousPublicPath('/store-redeem'), true);
    assert.equal(isAnonymousPublicPath('/store/abc'), true);
    assert.equal(isAnonymousPublicPath('/liff/profile'), true);
    assert.equal(isAnonymousPublicPath('/login'), false);
    assert.equal(isAnonymousPublicPath('/dashboard'), false);
  });

  it('detects HQ and POS login shells', () => {
    assert.equal(isHqLoginPath('/login'), true);
    assert.equal(isHqLoginPath('/login/'), true);
    assert.equal(isPosLoginPath('/pos/login'), true);
    assert.equal(isPosLoginPath('/pos'), false);
  });

  it('bypasses auth for anonymous pages and cookieless login shells', () => {
    assert.equal(
      shouldBypassAuthForPublicShell({
        pathname: '/store-redeem',
        hasHqCookie: false,
        hasMerchantCookie: false,
      }),
      'public-cdn',
    );
    assert.equal(
      shouldBypassAuthForPublicShell({
        pathname: '/login',
        hasHqCookie: false,
        hasMerchantCookie: false,
      }),
      'public-cdn',
    );
    assert.equal(
      shouldBypassAuthForPublicShell({
        pathname: '/pos/login',
        hasHqCookie: false,
        hasMerchantCookie: false,
      }),
      'public-cdn',
    );
  });

  it('checks auth when login shell has a session cookie', () => {
    assert.equal(
      shouldBypassAuthForPublicShell({
        pathname: '/login',
        hasHqCookie: true,
        hasMerchantCookie: false,
      }),
      'check-auth',
    );
    assert.equal(
      shouldBypassAuthForPublicShell({
        pathname: '/pos/login',
        hasHqCookie: false,
        hasMerchantCookie: true,
      }),
      'check-auth',
    );
    assert.equal(
      shouldBypassAuthForPublicShell({
        pathname: '/dashboard',
        hasHqCookie: false,
        hasMerchantCookie: false,
      }),
      'check-auth',
    );
  });

  it('picks long CDN TTL for login and icons', () => {
    assert.equal(publicHtmlCacheControl('/login'), CDN_PUBLIC_HTML_LONG);
    assert.equal(publicHtmlCacheControl('/icons/icon.svg'), CDN_PUBLIC_HTML_LONG);
    assert.equal(publicHtmlCacheControl('/store-redeem'), CDN_PUBLIC_HTML);
  });
});
