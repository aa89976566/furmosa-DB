import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isAuthSecretError,
  isDbUnreachableError,
  isMissingTableOrColumnError,
  loginFailureMessage,
} from '@/lib/auth-errors';

describe('auth-errors', () => {
  it('detects db unreachable variants', () => {
    assert.equal(
      isDbUnreachableError(new Error("Can't reach database server at localhost")),
      true,
    );
    assert.equal(
      isDbUnreachableError(Object.assign(new Error('pool'), { code: 'P1001' })),
      true,
    );
    assert.equal(
      isDbUnreachableError(new Error('Timed out fetching a new connection from the connection pool')),
      true,
    );
  });

  it('detects missing table/column', () => {
    assert.equal(
      isMissingTableOrColumnError(Object.assign(new Error('x'), { code: 'P2022' })),
      true,
    );
  });

  it('maps AUTH_SECRET errors', () => {
    assert.equal(isAuthSecretError(new Error('缺少環境變數 AUTH_SECRET')), true);
    assert.match(loginFailureMessage(new Error('缺少環境變數 AUTH_SECRET')), /AUTH_SECRET/);
  });
});
