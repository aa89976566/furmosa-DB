-- Additive HQ User.isActive. Existing rows stay true via DEFAULT.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
