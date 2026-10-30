import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  canResetMerchantPosPassword,
  requirePosPasswordResetPermission,
} from '../password-reset-permission';

it('allows only admins and inventory reviewers to reset merchant POS passwords', () => {
  assert.equal(canResetMerchantPosPassword('admin'), true);
  assert.equal(canResetMerchantPosPassword('inventory_reviewer'), true);
  for (const role of ['staff', 'finance', 'warehouse', '', null, undefined]) {
    assert.equal(canResetMerchantPosPassword(role), false);
  }
});

it('rechecks the current database role and returns the actor id for auditing', async () => {
  const db = {
    user: {
      findUnique: async ({ where }: any) => {
        const roles: Record<string, string> = {
          admin1: 'admin',
          cc1: 'inventory_reviewer',
          staff1: 'staff',
        };
        return roles[where.id] ? { id: where.id, role: roles[where.id] } : null;
      },
    },
  } as unknown as PrismaClient;

  assert.equal(await requirePosPasswordResetPermission(db, { userId: 'admin1' }), 'admin1');
  assert.equal(await requirePosPasswordResetPermission(db, { userId: 'cc1' }), 'cc1');
  await assert.rejects(
    requirePosPasswordResetPermission(db, { userId: 'staff1' }),
    /沒有權限/,
  );
  await assert.rejects(requirePosPasswordResetPermission(db, null), /沒有權限/);
});
