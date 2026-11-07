-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateEnum
CREATE TYPE "notifications"."notification_type" AS ENUM ('expiry_digest', 'reservation', 'pickup');

-- CreateEnum
CREATE TYPE "notifications"."device_platform" AS ENUM ('web', 'android', 'ios');

-- CreateTable
CREATE TABLE "notifications"."device_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "notifications"."device_platform" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notifications"."notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_token_token_key" ON "notifications"."device_token"("token");

-- CreateIndex
CREATE INDEX "device_token_user_id_idx" ON "notifications"."device_token"("user_id");

-- CreateIndex
CREATE INDEX "notification_user_id_sent_at_idx" ON "notifications"."notification"("user_id", "sent_at");

-- Row-level security on, with no policies: only the backend (the table owner) reads these.
ALTER TABLE "notifications"."device_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"."notification" ENABLE ROW LEVEL SECURITY;
