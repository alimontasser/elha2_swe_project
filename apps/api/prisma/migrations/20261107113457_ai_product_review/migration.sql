-- AlterEnum
ALTER TYPE "expiry"."product_status" ADD VALUE 'rejected';

-- AlterTable
ALTER TABLE "expiry"."product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "reviewed_by" TEXT;
