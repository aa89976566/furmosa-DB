import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveHqLoginDestination, resolvePosLoginDestination } from '../auth-redirect';

describe('resolveHqLoginDestination', () => {
  it('defaults an empty destination to the dashboard', () => {
    assert.equal(resolveHqLoginDestination(), '/dashboard');
  });

  it('sends the legacy root destination to the dashboard', () => {
    assert.equal(resolveHqLoginDestination('/'), '/dashboard');
  });

  it('keeps a valid internal destination', () => {
    assert.equal(resolveHqLoginDestination('/orders/new'), '/orders/new');
  });

  it('rejects external and protocol-relative destinations', () => {
    assert.equal(resolveHqLoginDestination('https://example.com'), '/dashboard');
    assert.equal(resolveHqLoginDestination('//example.com'), '/dashboard');
  });
});

describe('resolvePosLoginDestination', () => {
  it('defaults to the POS counter', () => {
    assert.equal(resolvePosLoginDestination(), '/pos');
  });

  it('keeps a valid internal POS destination', () => {
    assert.equal(resolvePosLoginDestination('/pos/stock'), '/pos/stock');
  });

  it('never routes a successful login back to the login page or outside POS', () => {
    assert.equal(resolvePosLoginDestination('/pos/login'), '/pos');
    assert.equal(resolvePosLoginDestination('/dashboard'), '/pos');
    assert.equal(resolvePosLoginDestination('https://example.com/pos'), '/pos');
  });
});
