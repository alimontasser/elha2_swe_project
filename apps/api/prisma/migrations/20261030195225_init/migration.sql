-- pg_trgm matches receipt lines to the food catalogue (AI gateway context step 2).
-- It lives in the "extensions" schema, as on Supabase.
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA "extensions";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "accounts";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "expiry";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pantry";

-- CreateEnum
CREATE TYPE "expiry"."food_category" AS ENUM ('bakery', 'produce', 'dairy', 'meat', 'cooked', 'dry', 'drinks');

-- CreateEnum
CREATE TYPE "expiry"."unit" AS ENUM ('piece', 'kg', 'g', 'l', 'ml', 'pack', 'loaf');

-- CreateEnum
CREATE TYPE "expiry"."storage_place" AS ENUM ('fridge', 'freezer', 'cupboard');

-- CreateEnum
CREATE TYPE "pantry"."item_status" AS ENUM ('in_stock', 'used', 'donated', 'wasted');

-- CreateEnum
CREATE TYPE "pantry"."expiry_source" AS ENUM ('printed', 'estimated', 'user_set');

-- CreateEnum
CREATE TYPE "pantry"."capture_method" AS ENUM ('receipt', 'barcode', 'order', 'photo', 'voice', 'manual');

-- CreateEnum
CREATE TYPE "pantry"."waste_reason" AS ENUM ('spoiled', 'forgotten', 'cooked_too_much', 'other');

-- CreateTable
CREATE TABLE "accounts"."user" (
    "id" UUID NOT NULL,
    "auth_uid" TEXT NOT NULL,
    "phone" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "household_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts"."household" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expiry"."food_catalogue_item" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "expiry"."food_category" NOT NULL,
    "unit" "expiry"."unit" NOT NULL,
    "default_quantity" DECIMAL(10,3) NOT NULL,
    "default_storage" "expiry"."storage_place" NOT NULL,
    "shelf_life_fridge" INTEGER,
    "shelf_life_freezer" INTEGER,
    "shelf_life_cupboard" INTEGER,
    "receipt_aliases" TEXT[],
    "search_text" TEXT NOT NULL,
    "retired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_catalogue_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantry"."pantry_item" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "catalogue_id" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "expiry_source" "pantry"."expiry_source" NOT NULL,
    "status" "pantry"."item_status" NOT NULL DEFAULT 'in_stock',
    "waste_reason" "pantry"."waste_reason",
    "added_by" "pantry"."capture_method" NOT NULL,
    "added_on" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pantry_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantry"."receipt_draft" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lines" TEXT[],
    "items" JSONB NOT NULL,
    "ai_request_id" UUID,
    "fallback_used" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."request_log" (
    "id" UUID NOT NULL,
    "task" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "prompt_version" INTEGER NOT NULL,
    "input_hash" TEXT NOT NULL,
    "context_chars" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "confidence" DECIMAL(4,3),
    "fallback_used" BOOLEAN NOT NULL,
    "from_cache" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL,
    "error_codes" TEXT[],
    "user_corrected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."response_cache" (
    "key" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "response_cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ai"."daily_usage" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "task" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_usage_pkey" PRIMARY KEY ("user_id","day","task")
);

-- CreateTable
CREATE TABLE "ai"."example" (
    "id" UUID NOT NULL,
    "task" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "example_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_uid_key" ON "accounts"."user"("auth_uid");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "accounts"."user"("phone");

-- CreateIndex
CREATE INDEX "pantry_item_household_id_status_expiry_date_idx" ON "pantry"."pantry_item"("household_id", "status", "expiry_date");

-- CreateIndex
CREATE INDEX "receipt_draft_created_at_idx" ON "pantry"."receipt_draft"("created_at");

-- CreateIndex
CREATE INDEX "request_log_task_created_at_idx" ON "ai"."request_log"("task", "created_at");

-- CreateIndex
CREATE INDEX "response_cache_expires_at_idx" ON "ai"."response_cache"("expires_at");

-- CreateIndex
CREATE INDEX "example_task_idx" ON "ai"."example"("task");

-- AddForeignKey
ALTER TABLE "accounts"."user" ADD CONSTRAINT "user_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "accounts"."household"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Trigram index for catalogue matching.
CREATE INDEX "food_catalogue_item_search_trgm" ON "expiry"."food_catalogue_item" USING gin ("search_text" "extensions".gin_trgm_ops);
