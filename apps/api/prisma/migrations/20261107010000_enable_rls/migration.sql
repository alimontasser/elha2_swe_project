-- Row-level security on, with no policies.
-- Only the backend reads these tables. It connects as their owner, which bypasses RLS.
-- The apps never query them through the Supabase Data API, so anon and authenticated get nothing.
ALTER TABLE "accounts"."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts"."household" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expiry"."food_catalogue_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pantry"."pantry_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pantry"."receipt_draft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."request_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."response_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."daily_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai"."example" ENABLE ROW LEVEL SECURITY;
