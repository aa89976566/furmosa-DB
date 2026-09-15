ALTER TABLE "merchant_users" ADD COLUMN "encrypted_password" TEXT;
CREATE TABLE "pos_password_access_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "admin_id" TEXT NOT NULL,
  "merchant_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pos_password_access_logs_merchant_user_id_created_at_idx"
  ON "pos_password_access_logs"("merchant_user_id", "created_at");
ALTER TABLE "pos_password_access_logs" ENABLE ROW LEVEL SECURITY;
