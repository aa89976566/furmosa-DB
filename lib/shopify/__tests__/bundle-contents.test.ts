import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveShopifyBundleDisplay } from '@/lib/shopify/bundle-contents';

function snapshot(variantTitle: string) {
  return {
    schemaVersion: 1,
    order: {
      line_items: [
        {
          title: '貝貝團購好友限定優惠',
          variant_title: variantTitle,
          quantity: 1,
        },
      ],
    },
  };
}

describe('Shopify 組合商品內容', () => {
  it('人氣款顯示實際內容物', () => {
    assert.deepEqual(
      resolveShopifyBundleDisplay(snapshot('人氣款'), '貝貝團購好友限定優惠', 1),
      {
        variantLabel: '人氣款',
        contentsLabel: '嚎大大雞排 ×3 片、豬耳朵 30g ×1 份',
      },
    );
  });

  it('多組訂單會換算內容物總數', () => {
    assert.equal(
      resolveShopifyBundleDisplay(snapshot('豪華款'), '貝貝團購好友限定優惠', 2)
        ?.contentsLabel,
      '嚎大大雞排 ×6 片、豬蛋蛋 30g ×2 份',
    );
  });

  it('未知方案不猜測內容', () => {
    assert.equal(
      resolveShopifyBundleDisplay(snapshot('未設定方案'), '貝貝團購好友限定優惠', 1),
      null,
    );
  });
});
