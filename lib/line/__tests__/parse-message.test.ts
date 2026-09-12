import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ecoNoteForJarCount,
  formatJarDepositSuccessMessage,
  formatHistoryStatusMessage,
  formatSavingsStatusMessage,
  formatVaultStatusMessage,
  rewardProgress,
} from '../jar-deposit-copy';
import { formatRedeemButtonLabel } from '../reward-menu';
import { parseLineUserText } from '../parse-message';
import { CUSTOMER_ID_EXAMPLE } from '../../customers/customer-id';

describe('parseLineUserText', () => {
  it('formats redeem button label with gift name and points', () => {
    assert.equal(
      formatRedeemButtonLabel({ rewardName: '洗澡折 250', pointsRequired: 10 }),
      '洗澡折 250（10點）',
    );
  });

  it('recognizes bind commands', () => {
    assert.equal(parseLineUserText(`綁定 ${CUSTOMER_ID_EXAMPLE}`).kind, 'bind');
    assert.equal(parseLineUserText('綁定 0912345678').kind, 'bind');
  });

  it('recognizes three world hubs', () => {
    assert.equal(parseLineUserText('換罐計畫').kind, 'hub_jar');
    assert.equal(parseLineUserText('換罐計劃').kind, 'hub_jar');
    assert.equal(parseLineUserText('♻️ 換罐計畫').kind, 'hub_jar');
    assert.equal(parseLineUserText('一起搞事').kind, 'hub_chaos');
    assert.equal(parseLineUserText('🎉 一起搞事').kind, 'hub_chaos');
    assert.equal(parseLineUserText('🔥 一起搞事').kind, 'hub_chaos');
    assert.equal(parseLineUserText('野放中').kind, 'hub_wild');
  });

  it('recognizes four-panel comic rich menu labels', () => {
    assert.equal(parseLineUserText('一起野放').kind, 'comic_roam');
    assert.equal(parseLineUserText('預約美容').kind, 'comic_grooming');
    assert.equal(parseLineUserText('漂亮一下').kind, 'comic_grooming');
    assert.equal(parseLineUserText('回家').kind, 'comic_home');
  });

  it('recognizes vault and legacy phrases', () => {
    assert.equal(parseLineUserText('開戶存罐罐').kind, 'bind_help');
    assert.equal(parseLineUserText('存罐攻略').kind, 'help');
    assert.equal(parseLineUserText('小金庫').kind, 'savings');
    assert.equal(parseLineUserText('毛孩罐庫').kind, 'savings');
    assert.equal(parseLineUserText('兌換好康').kind, 'rewards_list');
    assert.equal(parseLineUserText('嗷嗚計畫').kind, 'unboxing');
    assert.equal(parseLineUserText('嗷嗚計劃').kind, 'unboxing');
    assert.equal(parseLineUserText('青蛙誰在怕').kind, 'unboxing');
    assert.equal(parseLineUserText('開箱任務').kind, 'jiba_unbox');
    assert.equal(parseLineUserText('開箱').kind, 'jiba_unbox');
    assert.equal(parseLineUserText('UGC').kind, 'jiba_unbox');
    assert.equal(parseLineUserText('活動中心').kind, 'events_center');
    assert.equal(parseLineUserText('沒梗了').kind, 'events_center');
  });

  it('recognizes jar explain submenu labels', () => {
    assert.equal(parseLineUserText('換罐計劃是什麼').kind, 'jar_explain');
    assert.equal(parseLineUserText('什麼是換罐計劃？').kind, 'jar_explain_intro');
    assert.equal(parseLineUserText('介紹').kind, 'jar_explain_intro');
    assert.equal(parseLineUserText('流程').kind, 'jar_explain_flow');
    assert.equal(parseLineUserText('毛爸媽常問').kind, 'jar_explain_faq');
    assert.equal(parseLineUserText('常見問題').kind, 'jar_explain_faq');
    assert.equal(parseLineUserText('Q&A').kind, 'jar_explain_faq');
    assert.equal(parseLineUserText('q&a').kind, 'jar_explain_faq');
    assert.equal(parseLineUserText('換罐規則').kind, 'jar_explain_faq');
    assert.equal(parseLineUserText('查看合作店').kind, 'jar_stores');
    assert.equal(parseLineUserText('合作店家').kind, 'jar_stores');
    assert.equal(parseLineUserText('配合店家').kind, 'jar_stores');
    assert.equal(parseLineUserText('兌換序號').kind, 'jar_enter');
    assert.equal(parseLineUserText('輸入序號').kind, 'jar_enter');
    assert.equal(parseLineUserText('開始換罐').kind, 'jar_start');
    assert.equal(parseLineUserText('點數換折價').kind, 'redeem_coupon');
    assert.equal(parseLineUserText('兌換優惠券').kind, 'redeem_coupon');
    assert.equal(parseLineUserText('兌換美容折價券').kind, 'redeem_coupon');
    assert.equal(parseLineUserText('兌換好禮').kind, 'rewards_list');
    assert.equal(parseLineUserText('換罐計劃\u200b').kind, 'hub_jar');
    assert.equal(parseLineUserText('看本期口味').kind, 'refill_flavours');
  });

  it('recognizes jar codes', () => {
    const parsed = parseLineUserText('35085664');
    assert.deepEqual(parsed, { kind: 'jar_code', code: '35085664' });
  });

  it('recognizes balance and help', () => {
    assert.equal(parseLineUserText('點數').kind, 'balance');
    assert.equal(parseLineUserText('說明').kind, 'help');
  });

  it('recognizes rewards and redeem', () => {
    assert.equal(parseLineUserText('獎勵').kind, 'rewards_list');
    assert.deepEqual(parseLineUserText('兌換 1'), { kind: 'redeem_reward', target: '1' });
  });
});

describe('jar deposit copy', () => {
  it('shows cumulative jars without preachy tone', () => {
    const msg = formatJarDepositSuccessMessage({
      customerName: '王小明',
      customerCode: 'furmosa-0001',
      pointsBalance: 20,
      jarsDeposited: 2,
      pointsEarnedThisTime: 10,
      code: '35085664',
    });
    assert.match(msg, /累積已換：2 罐/);
    assert.match(msg, /累積 2 罐/);
  });

  it('formats vault for zero jars', () => {
    const msg = formatVaultStatusMessage({
      customerName: '王小明',
      customerCode: 'furmosa-0001',
      pointsBalance: 0,
      jarsDeposited: 0,
    });
    assert.match(msg, /還沒存過罐/);
    assert.match(msg, /目前點數/);
  });

  it('formats history with serials', () => {
    const msg = formatHistoryStatusMessage({
      customerName: '王小明',
      customerCode: 'furmosa-0001',
      pointsBalance: 5,
      jarsDeposited: 2,
      recentCodes: ['35085664', '35085665'],
    });
    assert.match(msg, /換罐紀錄/);
    assert.match(msg, /35085664/);
  });

  it('formats savings status for zero jars', () => {
    const msg = formatSavingsStatusMessage({
      customerName: '王小明',
      customerCode: 'furmosa-0001',
      pointsBalance: 0,
      jarsDeposited: 0,
    });
    assert.match(msg, /還沒存過罐/);
  });

  it('tracks reward progress to 10', () => {
    assert.equal(rewardProgress(3).needMore, 7);
    assert.equal(rewardProgress(10).needMore, 0);
  });

  it('escalates eco notes by jar count', () => {
    assert.match(ecoNoteForJarCount(1)!, /第 1 罐/);
    assert.match(ecoNoteForJarCount(10)!, /10 罐/);
  });
});
