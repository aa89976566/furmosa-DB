import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeMemberPoints } from '../member-points-summary';

test('member points summary separates earned points from reward redemptions', () => {
  assert.deepEqual(
    summarizeMemberPoints({
      earnedPointsChange: 13,
      redeemedPointsChange: -10,
    }),
    { totalEarned: 13, totalRedeemed: 10 },
  );
});

test('empty aggregates are normalized to zero', () => {
  assert.deepEqual(
    summarizeMemberPoints({
      earnedPointsChange: null,
      redeemedPointsChange: null,
    }),
    { totalEarned: 0, totalRedeemed: 0 },
  );
});
