import assert from 'node:assert/strict';
import test from 'node:test';

import { createLogoutRedirectResponse } from '../../app/api/auth/logout/route';

test('HQ logout uses a relative login redirect behind a reverse proxy', () => {
  const response = createLogoutRedirectResponse();

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/login');
});
