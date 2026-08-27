import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildButtonMenuFlex } from '@/lib/line/flex-hubs';
import { WORLD_THEME } from '@/lib/line/card-theme';
import {
  JIBA_LICENSE_ASK,
  JIBA_LICENSE_BODY,
  JIBA_ASK_PRODUCT,
} from '@/lib/campaigns/jiba-two-piece/copy';
import { JIBA_PRODUCTS } from '@/lib/campaigns/jiba-two-piece/constants';
import {
  buildPreviewButtonMenuFlex,
  jibaPreviewIntroChoiceMenu,
  jibaPreviewLicenseFlex,
  jibaPreviewProductChoiceMenu,
  jibaPreviewStoreCandidatesFlex,
  JIBA_PREVIEW_MOCK_STORES,
  JIBA_PREVIEW_STORE_FINDER_URI,
} from '@/lib/line/campaigns/jiba-unbox/preview-messages';

const FLOW_SRC = readFileSync(
  join(process.cwd(), 'lib/line/campaigns/jiba-unbox/flow.ts'),
  'utf8',
);

describe('jiba preview drift vs production builders', () => {
  it('preview buildPreviewButtonMenuFlex 與正式 buildButtonMenuFlex JSON 一致（chaos／無 dogFrame）', () => {
    const opts = {
      altText: '投稿授權同意',
      title: JIBA_LICENSE_ASK,
      subtitle: JIBA_LICENSE_BODY,
      items: [
        {
          label: '我同意',
          action: { type: 'message' as const, text: '我同意' },
          style: 'primary' as const,
        },
        {
          label: '不同意',
          action: { type: 'message' as const, text: '不同意' },
          style: 'secondary' as const,
        },
      ],
    };
    const production = buildButtonMenuFlex({
      ...opts,
      theme: WORLD_THEME.chaos,
    });
    const preview = buildPreviewButtonMenuFlex(opts);
    assert.deepEqual(preview, production);
  });

  it('商品選單／介紹選單標籤與 flow.ts 原始碼關鍵字對齊', () => {
    assert.match(FLOW_SRC, /我要參加/);
    assert.match(FLOW_SRC, /先看看規則/);
    assert.match(FLOW_SRC, /這次先不要/);
    assert.match(FLOW_SRC, /選雞霸兩片/);
    assert.match(FLOW_SRC, /選青蛙凍乾/);
    assert.match(FLOW_SRC, /好，開始填資料/);
    assert.match(FLOW_SRC, /投稿授權同意/);
    assert.match(FLOW_SRC, /資料正確，送出/);

    const intro = jibaPreviewIntroChoiceMenu('開箱任務', '想一起讓毛孩試試嗎？');
    assert.equal(intro.type, 'flex');
    const introJson = JSON.stringify(intro);
    assert.match(introJson, /我要參加/);
    assert.match(introJson, /先看看規則/);
    assert.match(introJson, /這次先不要/);

    const product = jibaPreviewProductChoiceMenu();
    const productJson = JSON.stringify(product);
    assert.match(productJson, new RegExp(JIBA_PRODUCTS.jiba.label));
    assert.match(productJson, new RegExp(JIBA_PRODUCTS.frog.label));
    assert.match(productJson, /選雞霸兩片/);
    assert.match(productJson, /選青蛙凍乾/);
    assert.match(productJson, new RegExp(JIBA_ASK_PRODUCT.slice(0, 8)));

    const license = jibaPreviewLicenseFlex();
    assert.deepEqual(
      buildPreviewButtonMenuFlex({
        altText: '投稿授權同意',
        title: JIBA_LICENSE_ASK,
        subtitle: JIBA_LICENSE_BODY,
        items: [
          {
            label: '我同意',
            action: { type: 'message', text: '我同意' },
            style: 'primary',
          },
          {
            label: '不同意',
            action: { type: 'message', text: '不同意' },
            style: 'secondary',
          },
        ],
      }),
      license,
    );
  });

  it('門市候選 Flex 與正式 URI／選門市 action 對齊', () => {
    assert.match(FLOW_SRC, /選門市\$\{i \+ 1\}/);
    assert.match(FLOW_SRC, /重選門市/);
    assert.match(FLOW_SRC, /查 7-11 店名/);

    const flex = jibaPreviewStoreCandidatesFlex([...JIBA_PREVIEW_MOCK_STORES]);
    const raw = JSON.stringify(flex);
    assert.match(raw, /選門市1/);
    assert.match(raw, /板橋新埔門市/);
    assert.match(raw, /重選門市/);
    assert.match(raw, new RegExp(JIBA_PREVIEW_STORE_FINDER_URI.replace(/\./g, '\\.')));
  });
});
