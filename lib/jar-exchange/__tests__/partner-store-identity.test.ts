import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { MerchantType } from '@/lib/merchant-types';
import {
  classifyPartnerStoreIdentity,
  HUMAN_DECISION_REQUIRED_FIELDS,
  missingHumanDecisionFields,
  pendingRestriction,
  storeNumberFromRedeemSlug,
  typesImplyConsignment,
  type IdentityMerchant,
  type IdentityStore,
} from '@/lib/jar-exchange/partner-store-identity';

const SOURCE = readFileSync(new URL('../partner-store-identity.ts', import.meta.url), 'utf8');

function store(slug: string, name: string, id = `store_${slug}`): IdentityStore {
  return { id, slug, name };
}

function merchant(
  merchantId: string,
  name: string,
  types: MerchantType[] = ['jar_exchange'],
  extra: Partial<Pick<IdentityMerchant, 'city' | 'address' | 'id'>> = {},
): IdentityMerchant {
  return {
    id: extra.id ?? `m_${merchantId}`,
    merchantId,
    name,
    city: extra.city ?? null,
    address: extra.address ?? null,
    status: 'active',
    types,
  };
}

describe('判定層邊界：不發號、不改功能、不改資料、不存檔', () => {
  it('does not contain issuing, type switching, or persistence helpers', () => {
    assert.doesNotMatch(SOURCE, /function issueStoreNumber|function nextStoreNumber|function resolveNumberForSiteEvent/);
    assert.doesNotMatch(SOURCE, /function recordHumanIdentityDecision|prisma\.|insertMerchant|update\(/);
    assert.doesNotMatch(SOURCE, /types\.push\(|requestedTypes/);
  });
});

describe('換罐與寄賣：不因換罐身分自動判定為寄賣；不發號', () => {
  it('keeps jar_exchange-only types unchanged and does not imply consignment', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '墨菲寵物美學')],
      merchants: [merchant('MER-0018', '墨菲寵物美學', ['jar_exchange'])],
    });
    assert.deepEqual(result.merchants[0]?.types, ['jar_exchange']);
    assert.equal(typesImplyConsignment(result.merchants[0]?.types ?? []), false);
    assert.equal(result.stores.length, 1);
    assert.equal(result.merchants.length, 1);
  });
});

describe('唯一編號與 slug → 一對一', () => {
  it('classifies mer_0018 + MER-0018 as one_to_one', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '墨菲寵物美學（核銷）')],
      merchants: [merchant('MER-0018', '墨菲寵物美學')],
    });
    assert.equal(result.stores[0]?.class, 'one_to_one');
    assert.equal(result.merchants[0]?.class, 'one_to_one');
    assert.equal(storeNumberFromRedeemSlug('mer_0018'), 'MER-0018');
    assert.equal(storeNumberFromRedeemSlug('niuniu'), null);
  });
});

describe('一對多或多對一 → 衝突', () => {
  it('treats two numbers that share a slug as conflict', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '墨菲')],
      merchants: [merchant('MER-0018', '墨菲'), merchant('mer-0018', '墨菲二')],
    });
    assert.equal(result.stores[0]?.class, 'conflict');
    assert.ok(result.merchants.every((row) => row.class === 'conflict'));
  });

  it('treats two slugs that reverse to the same number as conflict', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '甲'), store('MER_0018', '乙')],
      merchants: [merchant('MER-0018', '甲')],
    });
    assert.ok(result.stores.every((row) => row.class === 'conflict'));
    assert.equal(result.merchants[0]?.class, 'conflict');
  });
});

describe('店名、地址、分店相似 → 待確認', () => {
  it('keeps same-name custom slug as needs_review with candidates', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('niuniu', '淡水妞妞')],
      merchants: [merchant('MER-0001', '淡水妞妞')],
    });
    assert.equal(result.stores[0]?.class, 'needs_review');
    assert.equal(result.merchants[0]?.class, 'needs_review');
    assert.deepEqual(result.stores[0]?.candidateIds, ['MER-0001']);
  });

  it('lists 豬窩 branch clues as needs_review, not a new number', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('zhuwo_zhonghe', '豬窩 中和店')],
      merchants: [
        merchant('MER-0020', '豬窩板橋店', ['jar_exchange'], { city: '新北', address: '板橋區' }),
      ],
    });
    assert.equal(result.stores[0]?.class, 'needs_review');
    assert.equal(result.merchants.length, 1);
    assert.equal(result.merchants[0]?.merchantId, 'MER-0020');
  });
});

describe('搬家或改名 → 待總部確認，不自行換號', () => {
  it('does not invent a second merchant number when names look like a move', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('niuniu', '淡水妞妞')],
      merchants: [
        merchant('MER-0001', '淡水妞妞', ['jar_exchange'], {
          city: '新北',
          address: '新地址文化路1號',
        }),
      ],
    });
    assert.equal(result.stores[0]?.class, 'needs_review');
    assert.equal(result.merchants[0]?.merchantId, 'MER-0001');
    assert.match(result.stores[0]?.reasons.join(' ') ?? '', /不自行換號/);
  });
});

describe('待確認：回傳禁止新增功能的原因，尚未接入流程', () => {
  it('returns a restriction description without wiring it to onboarding', () => {
    const restriction = pendingRestriction('needs_review');
    assert.equal(restriction.blocksNewFeatures, true);
    assert.equal(restriction.wiredToOnboarding, false);
    assert.match(restriction.reason, /尚未接入開通流程/);
  });
});

describe('人工確認：定義必填欄位，尚未保存', () => {
  it('lists required fields and only reports what is missing', () => {
    assert.deepEqual(HUMAN_DECISION_REQUIRED_FIELDS, [
      'decidedBy',
      'decidedAt',
      'rationale',
      'keptMerchantId',
      'otherRecordId',
      'otherRecordDisposition',
    ]);
    assert.deepEqual(
      missingHumanDecisionFields({
        decidedBy: 'hq-staff-01',
        rationale: '',
        keptMerchantId: 'MER-0001',
      }),
      ['decidedAt', 'rationale', 'otherRecordId', 'otherRecordDisposition'],
    );
  });
});

describe('資料處理：不修改、不合併、不發號', () => {
  it('returns the same number of input rows and never merges them', () => {
    const stores = [store('niuniu', '淡水妞妞'), store('mer_0001', '淡水妞妞')];
    const merchants = [merchant('MER-0001', '淡水妞妞')];
    const result = classifyPartnerStoreIdentity({ stores, merchants });
    assert.equal(result.stores.length, stores.length);
    assert.equal(result.merchants.length, merchants.length);
    assert.ok(result.stores.some((row) => row.class === 'one_to_one'));
    assert.ok(result.stores.some((row) => row.class === 'needs_review'));
  });

  it('marks a mer_ slug that points at a missing number as orphan', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0999', '幽靈店')],
      merchants: [merchant('MER-0018', '墨菲')],
    });
    assert.equal(result.stores[0]?.class, 'orphan');
  });
});
