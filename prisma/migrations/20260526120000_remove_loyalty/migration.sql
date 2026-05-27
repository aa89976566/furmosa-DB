-- Drop P.ET / loyalty tables
DROP TABLE IF EXISTS "pet_return_gift_redemptions";
DROP TABLE IF EXISTS "pet_return_gifts";
DROP TABLE IF EXISTS "redeem_codes";
DROP TABLE IF EXISTS "user_points";
DROP TABLE IF EXISTS "Redemption";
DROP TABLE IF EXISTS "Reward";
DROP TABLE IF EXISTS "PointLedger";

-- Customer loyalty columns
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "isLoyaltyMember";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "loyaltyMemberId";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "loyaltyTier";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "loyaltyPoints";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "loyaltyEarned";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "loyaltyRedeemed";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "joinedLoyaltyAt";

-- Order loyalty points
ALTER TABLE "Order" DROP COLUMN IF EXISTS "pointsEarned";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "pointsUsed";
