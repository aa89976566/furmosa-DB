/**
 * Merchant→Store 純 mapping 規格鎖。
 * 零 DB／零網路／零 env side effect。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  merchantToStoreSlug,
  resolveMerchantStore,
  type MerchantResolveInput,
  type StoreCandidate,
} from '@/lib/stores/resolve-merchant-store';

const STORES: StoreCandidate[] = [
  { id: 's_zhuwo_zh', slug: 'zhuwo_zhonghe', name: '豬窩 中和店' },
  { id: 's_zhuwo_bq', slug: 'zhuwo_banqiao', name: '豬窩 板橋店' },
  { id: 's_zhuwo_tc', slug: 'zhuwo_tucheng', name: '豬窩 土城店' },
  { id: 's_legacy', slug: 'mer_0016', name: '舊豬窩殘留' },
  { id: 's_niuniu', slug: 'niuniu', name: '淡水妞妞' },
  { id: 's_manlisa', slug: 'manlisa', name: '曼利莎寵物美容' },
  { id: 's_pet99', slug: 'pet99', name: '99寵物美容' },
  { id: 's_qimu', slug: 'mer_0014', name: '柒沐寵物美容' },
  { id: 's_murphy', slug: 'mer_0018', name: '墨菲寵物美學' },
];

function merchant(
  partial: Partial<MerchantResolveInput> &
    Pick<MerchantResolveInput, 'merchantId' | 'name'>,
): MerchantResolveInput {
  return {
    id: partial.id ?? 'm_cuid_synthetic',
    merchantId: partial.merchantId,
    name: partial.name,
    status: partial.status ?? 'active',
    types: partial.types ?? ['consignment', 'jar_exchange'],
  };
}

describe('merchantToStoreSlug', () => {
  it('MER-0014 → mer_0014', () => {
    assert.equal(merchantToStoreSlug('MER-0014'), 'mer_0014');
  });
});

describe('resolveMerchantStore — gates', () => {
  it('denies inactive', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容', status: 'inactive' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'inactive' });
  });

  it('denies missing jar_exchange', () => {
    const r = resolveMerchantStore(
      merchant({
        merchantId: 'MER-0014',
        name: '柒沐寵物美容',
        types: ['consignment'],
      }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'not_jar_exchange' });
  });

  it('denies internal merchant ids', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-OTHER', name: '錯誤店家對照' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'internal_merchant' });
  });
});

describe('resolveMerchantStore — zhuwo name required', () => {
  it('MER-0016 + 豬窩 中和店 → zhuwo_zhonghe', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '豬窩 中和店' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'zhuwo_zhonghe');
      assert.equal(r.matchedBy, 'zhuwo_name');
    }
  });

  it('NEGATIVE: MER-0016 + 非豬窩名稱不得映射 zhuwo', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '淡水妞妞' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'zhuwo_mer_name_mismatch' });
  });

  it('NEGATIVE: MER-0016 + 豬窩 板橋店（MER/店名交叉）fail closed', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '豬窩 板橋店' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'zhuwo_mer_name_mismatch' });
  });

  it('豬窩店名匹配不可落到 legacy mer_0016 slug', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '豬窩 中和店' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.notEqual(r.store.slug, 'mer_0016');
  });

  it('zhuwo name with remapped MER (not in preference table) still maps by name', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0099', name: '豬窩 中和店' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'zhuwo_zhonghe');
      assert.equal(r.matchedBy, 'zhuwo_name');
    }
  });

  it('zhuwo name missing from candidates → missing_store', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0019', name: '豬窩 板橋店' }),
      STORES.filter((s) => s.slug !== 'zhuwo_banqiao'),
    );
    assert.deepEqual(r, { ok: false, reason: 'missing_store' });
  });
});

describe('resolveMerchantStore — general stores', () => {
  it('柒沐：derived slug + exact name', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'mer_0014');
      assert.equal(r.matchedBy, 'derived_slug');
    }
  });

  it('友好 slug 店（淡水妞妞）：僅 exact name，不可用錯誤 MER 推 zhuwo', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0010', name: '淡水妞妞' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'niuniu');
      assert.equal(r.matchedBy, 'exact_name');
    }
  });

  it('derived slug 店名不一致 → name_conflict', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐（改名衝突）' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });

  it('slug 與 exact name 指向不同店 → name_conflict', () => {
    const stores: StoreCandidate[] = [
      { id: 'slug_hit', slug: 'mer_0018', name: '墨菲寵物美學' },
      { id: 'name_hit', slug: 'murphy_alias', name: '墨菲寵物美學' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0018', name: '墨菲寵物美學' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });

  it('missing store → missing_store', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0999', name: '不存在的店' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'missing_store' });
  });

  it('ambiguous exact name → ambiguous', () => {
    const stores: StoreCandidate[] = [
      { id: '1', slug: 'a', name: '重複店名' },
      { id: '2', slug: 'b', name: '重複店名' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0500', name: '重複店名' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'ambiguous' });
  });

  it('does not create stores — empty candidates always missing', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      [],
    );
    assert.deepEqual(r, { ok: false, reason: 'missing_store' });
  });
});
