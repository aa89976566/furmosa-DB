import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveHqLoginDestination } from '../auth-redirect';

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
