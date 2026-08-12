/**
 * Merchant→Store 純 mapping 規格鎖（僅 allowlist 四元組，無 derived fallback）。
 * 零 DB／零網路／零 env side effect。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MERCHANT_STORE_ALLOWLIST,
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

describe('allowlist pairs are explicit', () => {
  it('exports proven pairs only; pet99 absent', () => {
    const pairs = MERCHANT_STORE_ALLOWLIST.map((p) => ({
      merchantId: p.merchantId,
      merchantName: p.merchantName,
      storeSlug: p.storeSlug,
      storeName: p.storeName,
    }));
    assert.ok(pairs.some((p) => p.merchantId === 'MER-0016' && p.storeSlug === 'zhuwo_zhonghe'));
    assert.ok(
      pairs.some(
        (p) =>
          p.merchantId === 'MER-0010' &&
          p.merchantName === '淡水妞妞' &&
          p.storeSlug === 'niuniu' &&
          p.storeName === '淡水妞妞',
      ),
    );
    assert.ok(
      pairs.some(
        (p) =>
          p.merchantId === 'MER-0017' &&
          p.merchantName === '曼利莎寵物美容' &&
          p.storeSlug === 'manlisa' &&
          p.storeName === '曼利莎寵物美容',
      ),
    );
    assert.ok(pairs.some((p) => p.merchantId === 'MER-0014' && p.storeSlug === 'mer_0014'));
    assert.ok(pairs.some((p) => p.merchantId === 'MER-0018' && p.storeSlug === 'mer_0018'));
    assert.equal(
      pairs.some((p) => p.storeSlug === 'pet99' || p.merchantName === '99寵物美容'),
      false,
      'pet99 must remain fail-closed without Merchant/MER proof',
    );
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

describe('resolveMerchantStore — unknown MER cannot use legal names/slugs', () => {
  for (const name of ['豬窩 中和店', '豬窩 板橋店', '豬窩 土城店'] as const) {
    it(`unknown MER + ${name} rejected`, () => {
      const r = resolveMerchantStore(
        merchant({ merchantId: 'MER-9999', name }),
        STORES,
      );
      assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
    });
  }

  for (const name of ['淡水妞妞', '曼利莎寵物美容'] as const) {
    it(`unknown MER + ${name} rejected`, () => {
      const r = resolveMerchantStore(
        merchant({ merchantId: 'MER-9999', name }),
        STORES,
      );
      assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
    });
  }

  it('unknown MER + 99寵物美容 rejected (pet99 fail closed)', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-9999', name: '99寵物美容' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('unknown MER cannot authorize via derived mer_0010 when name is 淡水妞妞', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0010', name: '淡水妞妞' }),
      [{ id: 'wrong', slug: 'mer_0010', name: '淡水妞妞' }],
    );
    // allowlist expects niuniu; mer_0010 candidate with same name ≠ target slug
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });
});

describe('resolveMerchantStore — crafted / derived self-proof rejected', () => {
  it('PET99 + 99寵物美容 + pet99 candidate 拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'PET99', name: '99寵物美容' }),
      [{ id: 's_pet99', slug: 'pet99', name: '99寵物美容' }],
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('MER-9999 + 99寵物美容 + mer_9999 candidate 拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-9999', name: '99寵物美容' }),
      [{ id: 's_fake', slug: 'mer_9999', name: '99寵物美容' }],
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('niuniu + 淡水妞妞 + niuniu candidate 拒絕（非權威 MER）', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'niuniu', name: '淡水妞妞' }),
      [{ id: 's_niuniu', slug: 'niuniu', name: '淡水妞妞' }],
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('任意未知 MER + 完全匹配 derived slug/name 仍拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-8888', name: '完全自證店' }),
      [{ id: 's_self', slug: 'mer_8888', name: '完全自證店' }],
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('MER-0050 derived pair 拒絕（無 allowlist）', () => {
    const stores: StoreCandidate[] = [
      { id: 's50', slug: 'mer_0050', name: '新合作店' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0050', name: '新合作店' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });
});

describe('resolveMerchantStore — allowlist legal pairs', () => {
  it('MER-0016 + 豬窩 中和店 → zhuwo_zhonghe', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '豬窩 中和店' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'zhuwo_zhonghe');
      assert.equal(r.matchedBy, 'allowlist');
    }
  });

  it('MER-0019 + 豬窩 板橋店 → zhuwo_banqiao', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0019', name: '豬窩 板橋店' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.store.slug, 'zhuwo_banqiao');
  });

  it('MER-0020 + 豬窩 土城店 → zhuwo_tucheng', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0020', name: '豬窩 土城店' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.store.slug, 'zhuwo_tucheng');
  });

  it('MER-0010 + 淡水妞妞 + niuniu 成功', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0010', name: '淡水妞妞' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'niuniu');
      assert.equal(r.store.name, '淡水妞妞');
      assert.equal(r.matchedBy, 'allowlist');
    }
  });

  it('MER-0017 + 曼利莎寵物美容 + manlisa 成功', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0017', name: '曼利莎寵物美容' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'manlisa');
      assert.equal(r.store.name, '曼利莎寵物美容');
      assert.equal(r.matchedBy, 'allowlist');
    }
  });

  it('MER-0014 + 柒沐寵物美容 → mer_0014', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.store.slug, 'mer_0014');
      assert.equal(r.matchedBy, 'allowlist');
    }
  });

  it('MER-0018 + 墨菲寵物美學 → mer_0018', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0018', name: '墨菲寵物美學' }),
      STORES,
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.store.slug, 'mer_0018');
  });
});

describe('resolveMerchantStore — wrong name / wrong store name', () => {
  it('MER-0010 錯 merchant name 拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0010', name: '妞妞寵物美容' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('MER-0010 合法 pair + 錯 Store name 拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0010', name: '淡水妞妞' }),
      [{ id: 'bad', slug: 'niuniu', name: '錯誤店名' }],
    );
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });

  it('MER-0017 錯名拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0017', name: '曼莉莎寵物美容' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('MER-0017 合法 pair + 錯 Store name 拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0017', name: '曼利莎寵物美容' }),
      [{ id: 'bad', slug: 'manlisa', name: '錯誤曼利莎' }],
    );
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });

  it('合法 MER + 錯名拒絕（柒沐）', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐（改名衝突）' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('MER-0016 + 非豬窩名拒絕', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '淡水妞妞' }),
      STORES,
    );
    assert.deepEqual(r, { ok: false, reason: 'allowlist_mismatch' });
  });

  it('豬窩合法 pair + candidate slug 正確但 Store name 錯誤 → name_conflict', () => {
    const stores: StoreCandidate[] = [
      { id: 'bad', slug: 'zhuwo_zhonghe', name: '錯誤店名' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0016', name: '豬窩 中和店' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });

  it('allowlist slug 指 A / name 指 B → name_conflict', () => {
    const stores: StoreCandidate[] = [
      { id: 'slug_hit', slug: 'mer_0014', name: '店A' },
      { id: 'name_hit', slug: 'other', name: '柒沐寵物美容' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'name_conflict' });
  });
});

describe('resolveMerchantStore — duplicates / empty', () => {
  it('duplicate slug candidates → ambiguous', () => {
    const stores: StoreCandidate[] = [
      { id: '1', slug: 'mer_0014', name: '柒沐寵物美容' },
      { id: '2', slug: 'mer_0014', name: '柒沐寵物美容' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'ambiguous' });
  });

  it('duplicate name candidates (same name different slug) → ambiguous', () => {
    const stores: StoreCandidate[] = [
      { id: '1', slug: 'mer_0014', name: '柒沐寵物美容' },
      { id: '2', slug: 'alias', name: '柒沐寵物美容' },
    ];
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      stores,
    );
    assert.deepEqual(r, { ok: false, reason: 'ambiguous' });
  });

  it('empty candidates → missing_store', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
      [],
    );
    assert.deepEqual(r, { ok: false, reason: 'missing_store' });
  });

  it('does not create stores for allowlisted missing candidate', () => {
    const r = resolveMerchantStore(
      merchant({ merchantId: 'MER-0010', name: '淡水妞妞' }),
      STORES.filter((s) => s.slug !== 'niuniu'),
    );
    assert.deepEqual(r, { ok: false, reason: 'missing_store' });
  });
});
