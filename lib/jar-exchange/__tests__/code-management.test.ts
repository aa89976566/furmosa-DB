import assert from 'node:assert/strict';
import { it } from 'node:test';
import { availableJarCodeWhere, safeAvailableJarCodeWhere, managementJarCodeWhere } from '../code-management';
import { buildCodesXlsx } from '../codes-xlsx';

it('excludes customer-reported serial and all claim/lock evidence', () => {
  const where = availableJarCodeWhere();
  assert.ok(where.code.notIn.includes('79984418'));
  assert.equal(where.status, 'unused');
  for (const key of ['redeemedByCustomerId', 'redeemedAt', 'issuedAt', 'returnedAt', 'issuedMerchantId', 'returnedMerchantId', 'lockedByRefillOrderId']) assert.equal(where[key as keyof typeof where], null);
});
it('searching available serials retains exclusions instead of overwriting the code condition', () => {
  const available = availableJarCodeWhere();
  const where = managementJarCodeWhere(available, { status: 'available', batch: 'BATCH', q: '7998' });
  assert.deepEqual(where.AND, [available, { batchNo: 'BATCH' }, { code: { contains: '7998', mode: 'insensitive' } }]);
});
it('excludes historical ledger and status evidence even when current status is unused', async () => {
  const db = {
    memberPointsLedger: { findMany: async () => [{ sourceRefId: 'previously-used' }, { sourceRefId: null }] },
    statusAuditLog: { findMany: async () => [{ entityId: 'previously-voided' }, { entityId: 'previously-used' }] },
    refillAuditLog: { findMany: async () => [{ serial: '12345678' }] },
  };
  const where = await safeAvailableJarCodeWhere(db as never);
  assert.deepEqual(where.id, { notIn: ['previously-used', 'previously-voided'] });
  assert.deepEqual(where.code, { notIn: ['79984418', '12345678'] });
});
it('exports real OOXML with text cells, leading zeroes and escaped formula-like batch names', () => {
  const data = buildCodesXlsx([{ code: '03162336', batchNo: '=1+1<&' }]);
  assert.equal(data.readUInt32LE(), 0x04034b50);
  const xml = data.toString();
  assert.ok(xml.includes('t="inlineStr"'));
  assert.ok(xml.includes('03162336'));
  assert.ok(xml.includes('=1+1&lt;&amp;'));
  assert.ok(!xml.includes('<f>'));
});
