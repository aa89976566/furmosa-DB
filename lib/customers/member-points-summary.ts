export function summarizeMemberPoints({
  earnedPointsChange,
  redeemedPointsChange,
}: {
  earnedPointsChange: number | null;
  redeemedPointsChange: number | null;
}) {
  return {
    totalEarned: Math.max(earnedPointsChange ?? 0, 0),
    totalRedeemed: Math.abs(Math.min(redeemedPointsChange ?? 0, 0)),
  };
}
