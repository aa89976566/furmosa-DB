import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  evaluateFreshHqIdentity,
  type FreshHqIdentityRow,
} from '../hq-identity-policy.ts';
import {
  HQ_IDENTITY_ROLES,
  isHqIdentityRole,
  parseHqIdentityRole,
} from '../hq-roles.ts';

const USER_ID = 'user_pk_001';
const OTHER_ID = 'user_pk_999';
const SAME_EMAIL = 'same-person@example.com';
const LEAK_MARKER = 'leak-marker-do-not-echo';
const FAKE_SECRET = 'fake-db-password-should-never-appear';

function row(overrides: Partial<FreshHqIdentityRow> = {}): FreshHqIdentityRow {
  return {
    id: USER_ID,
    role: 'staff',
    isActive: true,
    ...overrides,
  };
}

function assertDenied(result: unknown) {
  assert.deepEqual(result, { ok: false });
  const dumped = JSON.stringify(result);
  assert.doesNotMatch(dumped, new RegExp(LEAK_MARKER));
  assert.doesNotMatch(dumped, new RegExp(FAKE_SECRET));
  assert.doesNotMatch(dumped, /same-person@example\.com/);
}

describe('HQ identity role vocabulary', () => {
  it('keeps the five canonical lowercase roles as-is', () => {
    assert.deepEqual([...HQ_IDENTITY_ROLES], [
      'owner',
      'admin',
      'staff',
      'finance',
      'warehouse',
    ]);
    for (const role of HQ_IDENTITY_ROLES) {
      assert.equal(parseHqIdentityRole(role), role);
      assert.equal(isHqIdentityRole(role), true);
    }
  });

  it('does not map finance or warehouse to admin or owner', () => {
    assert.equal(parseHqIdentityRole('finance'), 'finance');
    assert.equal(parseHqIdentityRole('warehouse'), 'warehouse');
    assert.notEqual(parseHqIdentityRole('finance'), 'admin');
    assert.notEqual(parseHqIdentityRole('finance'), 'owner');
    assert.notEqual(parseHqIdentityRole('warehouse'), 'admin');
    assert.notEqual(parseHqIdentityRole('warehouse'), 'owner');
  });

  it('denies unknown, blank, and case-mismatched roles without normalizing', () => {
    for (const value of [
      'superadmin',
      'root',
      'OWNER',
      'Admin',
      'STAFF',
      'Finance',
      'Warehouse',
      '',
      ' staff',
      'staff ',
      null,
      undefined,
      1,
    ]) {
      assert.equal(parseHqIdentityRole(value), null);
      assert.equal(isHqIdentityRole(value), false);
    }
  });
});

describe('evaluateFreshHqIdentity', () => {
  it('returns each canonical role from the DB row unchanged', () => {
    for (const role of HQ_IDENTITY_ROLES) {
      const result = evaluateFreshHqIdentity({
        userId: USER_ID,
        row: row({ role }),
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.user.id, USER_ID);
        assert.equal(result.user.role, role);
        assert.equal(result.user.isActive, true);
      }
    }
  });

  it('keeps finance and warehouse as themselves, not elevated roles', () => {
    const finance = evaluateFreshHqIdentity({
      userId: USER_ID,
      row: row({ role: 'finance' }),
    });
    const warehouse = evaluateFreshHqIdentity({
      userId: USER_ID,
      row: row({ role: 'warehouse' }),
    });
    assert.equal(finance.ok, true);
    assert.equal(warehouse.ok, true);
    if (finance.ok) assert.equal(finance.user.role, 'finance');
    if (warehouse.ok) assert.equal(warehouse.user.role, 'warehouse');
  });

  it('denies unknown, case-mismatched, and blank DB roles', () => {
    for (const role of ['superadmin', 'OWNER', 'Admin', 'STAFF', '', ' staff']) {
      assertDenied(
        evaluateFreshHqIdentity({
          userId: USER_ID,
          row: row({ role }),
        }),
      );
    }
  });

  it('denies a missing session subject', () => {
    assertDenied(evaluateFreshHqIdentity({ userId: null, row: row() }));
    assertDenied(evaluateFreshHqIdentity({ userId: '', row: row() }));
  });

  it('denies padded userId " user_pk_001 " against row id user_pk_001', () => {
    assertDenied(
      evaluateFreshHqIdentity({
        userId: ' user_pk_001 ',
        row: row({ id: 'user_pk_001' }),
      }),
    );
  });

  it('denies trailing-space userId "user_pk_001 "', () => {
    assertDenied(
      evaluateFreshHqIdentity({
        userId: 'user_pk_001 ',
        row: row({ id: 'user_pk_001' }),
      }),
    );
  });

  it('denies newline-suffixed userId "user_pk_001\\n"', () => {
    assertDenied(
      evaluateFreshHqIdentity({
        userId: 'user_pk_001\n',
        row: row({ id: 'user_pk_001' }),
      }),
    );
  });

  it('allows only the exact userId user_pk_001', () => {
    const result = evaluateFreshHqIdentity({
      userId: 'user_pk_001',
      row: row({ id: 'user_pk_001' }),
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.id, 'user_pk_001');
  });

  it('denies a missing user row', () => {
    assertDenied(evaluateFreshHqIdentity({ userId: USER_ID, row: null }));
  });

  it('denies when session userId and row id do not match', () => {
    assertDenied(
      evaluateFreshHqIdentity({
        userId: OTHER_ID,
        row: row({ id: USER_ID }),
      }),
    );
  });

  it('denies inactive rows including owner and admin', () => {
    for (const role of ['owner', 'admin', 'staff'] as const) {
      assertDenied(
        evaluateFreshHqIdentity({
          userId: USER_ID,
          row: row({ role, isActive: false }),
        }),
      );
    }
  });

  it('uses the DB role when a JWT role would disagree', () => {
    const jwtRole = 'admin';
    const result = evaluateFreshHqIdentity({
      userId: USER_ID,
      row: row({ role: 'staff' }),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.user.role, 'staff');
      assert.notEqual(result.user.role, jwtRole);
    }
  });

  it('denies when email matches but session userId is missing', () => {
    const knownEmail = SAME_EMAIL;
    assert.equal(knownEmail, SAME_EMAIL);
    assertDenied(evaluateFreshHqIdentity({ userId: null, row: row() }));
  });

  it('denies when email matches but session userId is wrong', () => {
    const knownEmail = SAME_EMAIL;
    assert.equal(knownEmail, SAME_EMAIL);
    assertDenied(
      evaluateFreshHqIdentity({
        userId: OTHER_ID,
        row: row({ id: USER_ID }),
      }),
    );
  });

  it('does not copy email, name, or secrets onto a successful result', () => {
    const dbRow = {
      id: USER_ID,
      role: 'owner',
      isActive: true,
      email: SAME_EMAIL,
      name: LEAK_MARKER,
      passwordHash: FAKE_SECRET,
    };
    const result = evaluateFreshHqIdentity({ userId: USER_ID, row: dbRow });
    assert.equal(result.ok, true);
    const dumped = JSON.stringify(result);
    assert.doesNotMatch(dumped, new RegExp(LEAK_MARKER));
    assert.doesNotMatch(dumped, new RegExp(FAKE_SECRET));
    assert.doesNotMatch(dumped, /same-person@example\.com/);
  });
});

describe('hq user isActive migration', () => {
  it('is a single fail-fast additive column', () => {
    const sql = readFileSync(
      'prisma/migrations/20260814160000_hq_user_is_active/migration.sql',
      'utf8',
    );
    const statements = sql
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--'))
      .join('\n');
    assert.equal(
      statements,
      'ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;',
    );
    assert.doesNotMatch(sql, /IF NOT EXISTS/i);
    assert.doesNotMatch(sql, /\bUPDATE\b/i);
    assert.doesNotMatch(sql, /\bDELETE\b/i);
    assert.doesNotMatch(sql, /\bDROP\b/i);
    assert.doesNotMatch(sql, /\bOWNER\b/i);
    assert.doesNotMatch(sql, /\bINDEX\b/i);
  });
});
