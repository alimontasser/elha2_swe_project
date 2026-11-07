-- CreateEnum
CREATE TYPE "expiry"."product_source" AS ENUM ('open_food_facts', 'user');

-- CreateEnum
CREATE TYPE "expiry"."product_status" AS ENUM ('known', 'pending_review');

-- AlterTable
ALTER TABLE "pantry"."pantry_item" ADD COLUMN     "waste_note" TEXT;

-- CreateTable
CREATE TABLE "expiry"."product" (
    "barcode" TEXT NOT NULL,
    "catalogue_id" TEXT,
    "name_ar" TEXT,
    "name_en" TEXT,
    "brand" TEXT,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "source" "expiry"."product_source" NOT NULL,
    "status" "expiry"."product_status" NOT NULL,
    "suggested_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("barcode")
);

-- CreateIndex
CREATE INDEX "product_status_idx" ON "expiry"."product"("status");

-- Row-level security on, with no policies: only the backend (the table owner) reads it.
ALTER TABLE "expiry"."product" ENABLE ROW LEVEL SECURITY;
