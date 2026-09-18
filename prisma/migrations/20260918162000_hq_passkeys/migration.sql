-- HQ-only WebAuthn credentials. Stores public-key metadata; never biometric data.
CREATE TABLE "hq_passkey_credentials" (
  "id" TEXT NOT NULL,
  "credential_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "webauthn_user_id" TEXT NOT NULL,
  "public_key" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "device_type" TEXT NOT NULL,
  "backed_up" BOOLEAN NOT NULL DEFAULT false,
  "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "device_name" TEXT NOT NULL DEFAULT 'Face ID 裝置',
  "user_agent" TEXT,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hq_passkey_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hq_passkey_credentials_credential_id_key"
  ON "hq_passkey_credentials"("credential_id");
CREATE INDEX "hq_passkey_credentials_user_id_created_at_idx"
  ON "hq_passkey_credentials"("user_id", "created_at");
ALTER TABLE "hq_passkey_credentials" ADD CONSTRAINT "hq_passkey_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-side Prisma owns HQ authentication credentials.
ALTER TABLE "hq_passkey_credentials" ENABLE ROW LEVEL SECURITY;
