import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTION_SUPABASE_PROJECT_REF } from '@/lib/jar-exchange/partner-store-identity-isolation';

const enabled = process.env.IDENTITY_PERSIST_TEST === '1';

function assertNotOfficialDatabase() {
  const url = `${process.env.DATABASE_URL ?? ''} ${process.env.DIRECT_URL ?? ''}`;
  assert.equal(url.includes(PRODUCTION_SUPABASE_PROJECT_REF), false);
  assert.equal(/supabase\.co/i.test(url), false);
}

describe('partner store identity persist (temp postgres)', () => {
  it('skips unless IDENTITY_PERSIST_TEST=1', () => {
    if (!enabled) {
      assert.equal(enabled, false);
      return;
    }
    assert.equal(enabled, true);
  });
});

if (enabled) {
  describe('temporary postgres write path', () => {
    it('confirms, records HQ account and time, revokes without deleting, and blocks duplicates', async () => {
      assertNotOfficialDatabase();
      delete process.env.VERCEL_ENV;
      delete process.env.LINE_CHANNEL_SECRET;
      delete process.env.ECPAY_HASH_KEY;
      delete process.env.ECPAY_HASH_IV;

      const { prisma } = await import('@/lib/prisma');
      const { createIdentityDecision, listIdentityDecisions, revokeIdentityDecision } =
        await import('@/lib/jar-exchange/partner-store-identity-store');
      const { mergePartnerStoreDirectory, partnerStoreDirectoryStats } = await import(
        '@/lib/jar-exchange/partner-store-directory'
      );

      const user = await prisma.user.upsert({
        where: { email: 'hq-acceptance@example.test' },
        update: {},
        create: {
          email: 'hq-acceptance@example.test',
          name: '驗收總部帳號',
          role: 'admin',
          passwordHash: 'unused-local-hash',
        },
      });

      const stores = [
        { slug: 'zhuwo_banqiao', name: '驗收豬窩板橋' },
        { slug: 'zhuwo_tucheng', name: '驗收豬窩土城' },
        { slug: 'zhuwo_zhonghe', name: '驗收豬窩中和' },
        { slug: 'manlisa', name: '驗收曼利莎' },
        { slug: 'niuniu', name: '驗收妞妞' },
        { slug: 'pet99', name: '驗收待確認店' },
        { slug: 'mer_other', name: '驗收測試對照' },
      ];
      for (const row of stores) {
        await prisma.store.upsert({
          where: { slug: row.slug },
          update: { name: row.name },
          create: { slug: row.slug, name: row.name, secretToken: `anon-${row.slug}` },
        });
      }

      const merchants = [
        { merchantId: 'MER-0019', name: '驗收豬窩板橋' },
        { merchantId: 'MER-0020', name: '驗收豬窩土城' },
        { merchantId: 'MER-0016', name: '驗收豬窩中和' },
        { merchantId: 'MER-0017', name: '驗收曼利莎' },
        { merchantId: 'MER-0010', name: '驗收妞妞' },
        { merchantId: 'MER-OTHER', name: '驗收測試對照' },
        { merchantId: 'MER-REFILL', name: '驗收換罐測試' },
        { merchantId: 'MER-DEMO', name: '驗收示範店' },
      ];
      for (const row of merchants) {
        await prisma.merchant.upsert({
          where: { merchantId: row.merchantId },
          update: { name: row.name, types: ['jar_exchange'] },
          create: {
            merchantId: row.merchantId,
            name: row.name,
            type: 'jar_exchange',
            types: ['jar_exchange'],
          },
        });
      }

      const before = new Date();
      const created = await createIdentityDecision({
        merchantId: 'MER-0010',
        legacySlug: 'niuniu',
        verdict: 'same_store',
        decidedByUserId: user.id,
        decidedByAccount: user.email,
        rationale: '臨時庫驗收：確認同一門市',
        otherRecordDisposition: 'keep_legacy_link',
        scope: 'production',
      });
      const after = new Date();
      assert.equal(created.ok, true);
      if (!created.ok) return;
      assert.equal(created.decision.decidedByAccount, 'hq-acceptance@example.test');
      assert.equal(created.decision.decidedByUserId, user.id);
      const decidedAt = new Date(created.decision.decidedAt);
      assert.ok(decidedAt >= before);
      assert.ok(decidedAt <= after);

      const duplicate = await createIdentityDecision({
        merchantId: 'MER-0010',
        legacySlug: 'niuniu',
        verdict: 'same_store',
        decidedByUserId: user.id,
        decidedByAccount: user.email,
        rationale: '重複確認應該被擋',
        otherRecordDisposition: 'keep_legacy_link',
        scope: 'production',
      });
      assert.equal(duplicate.ok, false);
      if (!duplicate.ok) {
        assert.match(duplicate.error, /已有未撤銷的確認/);
      }

      const revokedAt = new Date();
      const revoked = await revokeIdentityDecision({
        id: created.decision.id,
        revokedByUserId: user.id,
        revokedByAccount: user.email,
        revokeReason: '驗收撤銷：資料有誤',
        revokedAt,
      });
      assert.equal(revoked.ok, true);
      if (!revoked.ok) return;
      assert.equal(revoked.decision.id, created.decision.id);
      assert.ok(revoked.decision.revokedAt);
      assert.equal(revoked.decision.revokeReason, '驗收撤銷：資料有誤');
      assert.equal(revoked.decision.decidedByAccount, 'hq-acceptance@example.test');

      const history = await listIdentityDecisions('production');
      const original = history.find((row) => row.id === created.decision.id);
      assert.ok(original);
      assert.ok(original?.revokedAt);

      const pendingRows = mergePartnerStoreDirectory(
        {
          stores: stores.map((row) => ({
            id: row.slug,
            slug: row.slug,
            name: row.name,
            groomingDiscountAmount: 200,
          })),
          merchants: merchants.map((row) => ({
            id: row.merchantId,
            merchantId: row.merchantId,
            name: row.name,
            city: null,
            types: ['jar_exchange'],
          })),
        },
        history,
      );
      assert.equal(pendingRows.find((row) => row.slug === 'niuniu')?.identityNote, 'needs_review');

      const pairs = [
        ['MER-0019', 'zhuwo_banqiao'],
        ['MER-0020', 'zhuwo_tucheng'],
        ['MER-0016', 'zhuwo_zhonghe'],
        ['MER-0017', 'manlisa'],
        ['MER-0010', 'niuniu'],
      ] as const;
      for (const [merchantId, legacySlug] of pairs) {
        const result = await createIdentityDecision({
          merchantId,
          legacySlug,
          verdict: 'same_store',
          decidedByUserId: user.id,
          decidedByAccount: user.email,
          rationale: `臨時庫驗收：${legacySlug}`,
          otherRecordDisposition: 'keep_legacy_link',
          scope: 'production',
        });
        assert.equal(result.ok, true);
      }
      await createIdentityDecision({
        merchantId: 'MER-OTHER',
        legacySlug: 'mer_other',
        verdict: 'test',
        decidedByUserId: user.id,
        decidedByAccount: user.email,
        rationale: '臨時庫驗收：測試店',
        otherRecordDisposition: 'keep_legacy_link',
        scope: 'production',
      });

      const active = await listIdentityDecisions('production');
      const rows = mergePartnerStoreDirectory(
        {
          stores: stores.map((row) => ({
            id: row.slug,
            slug: row.slug,
            name: row.name,
            groomingDiscountAmount: 200,
          })),
          merchants: merchants.map((row) => ({
            id: row.merchantId,
            merchantId: row.merchantId,
            name: row.name,
            city: null,
            types: ['jar_exchange'],
          })),
        },
        active,
      );
      const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));
      assert.equal(bySlug.zhuwo_banqiao.merchantId, 'MER-0019');
      assert.equal(bySlug.zhuwo_tucheng.merchantId, 'MER-0020');
      assert.equal(bySlug.zhuwo_zhonghe.merchantId, 'MER-0016');
      assert.equal(bySlug.niuniu.identityNote, null);
      assert.equal(Boolean(bySlug.mer_other), false);
      const stats = partnerStoreDirectoryStats(rows, {
        storeSlugs: stores.map((row) => row.slug),
        merchantIds: merchants.map((row) => row.merchantId),
        decisions: active,
      });
      assert.equal(stats.officialOneToOneCount, 5);
      assert.equal(rows.filter((row) => row.slug.startsWith('zhuwo_')).length, 3);

      await prisma.$disconnect();
    });
  });
}
