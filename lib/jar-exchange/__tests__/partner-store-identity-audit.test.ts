import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatAuditReportMarkdown,
  summarizePartnerStoreIdentityAudit,
  type PartnerStoreIdentityAuditSnapshot,
} from '@/lib/jar-exchange/partner-store-identity-audit';

function snapshot(partial: Partial<PartnerStoreIdentityAuditSnapshot> = {}): PartnerStoreIdentityAuditSnapshot {
  return {
    stores: [
      { id: 's1', slug: 'mer_0018', name: '墨菲寵物美學' },
      { id: 's2', slug: 'niuniu', name: '淡水妞妞' },
      { id: 's3', slug: 'mer_0999', name: '幽靈店' },
    ],
    merchants: [
      {
        id: 'm1',
        merchantId: 'MER-0018',
        name: '墨菲寵物美學',
        city: '新北',
        address: '板橋',
        status: 'active',
        types: ['jar_exchange'],
      },
      {
        id: 'm2',
        merchantId: 'MER-0001',
        name: '淡水妞妞',
        city: '新北',
        address: '淡水',
        status: 'active',
        types: ['jar_exchange'],
      },
    ],
    merchantUsers: [
      { id: 'u1', merchantRecordId: 'm1' },
      { id: 'u2', merchantRecordId: 'missing' },
    ],
    refillOrders: [{ id: 'ro1', merchantRecordId: 'm2' }],
    coupons: [
      { id: 'c1', storeKey: 'mer_0018' },
      { id: 'c2', storeKey: 'ghost' },
    ],
    customers: [
      {
        customerId: 'furmosa-0001',
        signupStore: 'mer_0018',
        storeId: 'mer_0018',
        phoneKey: 'p-a',
        lineKey: 'l-a',
        hasJarActivity: true,
      },
      {
        customerId: 'furmosa-0002',
        signupStore: 'ghost',
        storeId: 'ghost',
        phoneKey: 'p-a',
        lineKey: 'l-b',
        hasJarActivity: true,
      },
      {
        customerId: 'furmosa-0003',
        signupStore: null,
        storeId: null,
        phoneKey: null,
        lineKey: 'l-b',
        hasJarActivity: true,
      },
    ],
    ...partial,
  };
}

describe('partner store identity read-only audit', () => {
  it('reconciles all records into four mutually exclusive classes', () => {
    const report = summarizePartnerStoreIdentityAudit(snapshot(), {
      checkedAt: new Date('2026-08-29T16:00:00.000Z'),
      environmentName: 'unit-test',
      databaseConfigured: false,
      queriedLiveData: false,
    });

    assert.equal(report.totals.redeemStoreCount, 3);
    assert.equal(report.totals.merchantMasterCount, 2);
    assert.equal(report.totals.allRecordCount, 5);
    assert.equal(report.storeIdentity.exclusive, true);
    assert.equal(report.storeIdentity.recordsCountedInMultipleClasses, 0);
    assert.equal(report.storeIdentity.reconcilable, true);
    const { byClass } = report.storeIdentity;
    assert.equal(
      byClass.one_to_one + byClass.needs_review + byClass.conflict + byClass.orphan,
      report.totals.allRecordCount,
    );
    assert.equal(report.storeIdentity.storeByClass.one_to_one, 1);
    assert.equal(report.storeIdentity.storeByClass.needs_review, 1);
    assert.equal(report.storeIdentity.storeByClass.orphan, 1);
  });

  it('keeps member/LINE stats separate and never prints PII', () => {
    const report = summarizePartnerStoreIdentityAudit(snapshot(), {
      environmentName: 'unit-test',
      databaseConfigured: false,
      queriedLiveData: false,
    });
    assert.equal(report.membersAndLine.separateFromStoreIdentity, true);
    assert.equal(report.membersAndLine.duplicatePhoneGroups, 1);
    assert.equal(report.membersAndLine.duplicateLineGroups, 1);
    assert.equal(report.supplementalSeven.overlapping, true);
    assert.ok(report.supplementalSeven.items.every((item) => item.key !== '4'));

    const markdown = formatAuditReportMarkdown(report);
    assert.match(markdown, /全部資料＝一對一＋待確認＋衝突＋孤立/);
    assert.match(markdown, /會員／LINE（獨立/);
    assert.doesNotMatch(markdown, /0900|U[0-9a-f]{32}|淡水妞妞/);
    assert.match(markdown, /furmosa-0002|MER-0018|niuniu/);
  });

  it('marks conflict subtypes that can exceed the exclusive conflict count', () => {
    const report = summarizePartnerStoreIdentityAudit(
      snapshot({
        stores: [
          { id: 'a', slug: 'mer_0018', name: '甲' },
          { id: 'b', slug: 'MER_0018', name: '乙' },
        ],
        merchants: [
          {
            id: 'm1',
            merchantId: 'MER-0018',
            name: '甲',
            city: null,
            address: null,
            status: 'active',
            types: ['jar_exchange'],
          },
          {
            id: 'm2',
            merchantId: 'mer-0018',
            name: '乙',
            city: null,
            address: null,
            status: 'active',
            types: ['jar_exchange'],
          },
        ],
      }),
      {
        environmentName: 'unit-test',
        databaseConfigured: false,
        queriedLiveData: false,
      },
    );
    assert.ok(report.conflictSubtypes.duplicateSlug >= 2);
    assert.ok(report.conflictSubtypes.twoNumbersOneSlug >= 2);
    assert.equal(report.conflictSubtypes.mayExceedConflictCount, true);
  });
});
