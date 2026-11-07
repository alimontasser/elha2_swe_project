# From demo to real Sprint 1: checklist

The Sprint 1 demo runs on mock repositories. These items turn it into the real system described in SDD v1.1.

## Access and accounts
- [ ] **GitHub:** give Claude access to `mdessouky/elha2_swe_project`. Either install the Claude GitHub App or reconnect at <https://claude.ai/connect-github>.
- [x] **Supabase project:** `https://ujvucfvrhlrjttzmavgg.supabase.co` (ref `ujvucfvrhlrjttzmavgg`); publishable key received.
- [x] **Network:** the cloud environment now allows `ujvucfvrhlrjttzmavgg.supabase.co` and `api.groq.com`. Inside the cloud sandbox, Node needs `NODE_USE_ENV_PROXY=1` to use its proxy; local machines don't.
- [x] **Groq backup:** key works; default model `openai/gpt-oss-120b` read the Fresh Mart demo receipt correctly in 3.2 s.
- [x] **Supabase database:** both Prisma migrations are applied (schemas `accounts`, `expiry`, `pantry`, `ai`; `pg_trgm`; row-level security on). The 104 catalogue items and 3 AI examples are loaded. `_prisma_migrations` matches the repo, so `pnpm db:deploy` against Supabase is a no-op until a new migration is added.
- [x] **Supabase phone login (US-1.01):** Phone is on, using **test numbers** with the fixed code `654321` (`201012345678`, `201000000000`, `201011112222`, `201233334444`); they stop working on 31/01/2027.
  - Twilio holds placeholder values: Supabase needs a provider, but sends no SMS to test numbers. Any other number fails until a real provider is set up.
  - The code expires after 300 s (US-1.01).
  - Checked on 07/11/2026: a wrong code is refused, `654321` signs in, and the API accepts the ES256 token through the project's JWKS when `SUPABASE_URL` is set.
  - Still open: Supabase limits code checks per IP, not per number, so US-1.01's "5 attempts per hour per number" needs our own check.
- [ ] **Supabase, still to do:**
  - give the team the database connection string (Connect → **Session pooler**) for `DATABASE_URL` in `apps/api/.env`; on Cloud Run it goes in the secret manager;
  - enable `postgis` when the Accounts location endpoint (US-1.04) is built.
- [ ] **Firebase project, used only for FCM (US-11.01) and portal hosting:** download `google-services.json`, `GoogleService-Info.plist` and a service-account key.
- [ ] **Free AI keys:** Google AI Studio (Gemini, main) and GroqCloud (backup). Neither needs a card.
  - Free tiers may use prompts for training. Only masked text is sent (US-14.03), but this must still be stated in the consent text (NFR-13) and in the SRS.
- [ ] **Later sprints:**
  - Google Maps Platform key (US-5.07). It needs billing enabled; there is a monthly free credit.
  - Paymob. It needs a registered company (R-04), so the course uses cash at pickup only.
- [ ] **Distribution:** an Android APK is enough for the course. Play Console internal testing costs $25 once. TestFlight needs an Apple Developer account ($99/year).

## Data
- [ ] Collect about 50 real Egyptian receipt photos and label each item as name, qty, unit and category. They are needed for TBD-01 and US-2.01, and the target is 300 by Sprint 2 (US-14.02).
- [ ] Review the seeded food catalogue (`apps/mobile/assets/catalogue.json`): Arabic and English names, categories, and shelf life per storage place.

## Docs (Sprint 1 review)
- [ ] Release SRS/SDD v1.2 with tracked changes:
  - close TBD-01 (Gemini vs Groq, by measured accuracy and cost);
  - replace the wireframes with demo screenshots (`docs/sprints/screenshots/`);
  - add AIExample and DeviceToken to the data dictionary if they are missing.
- [ ] Add revision-history rows and tag `docs-v1.2`.

## Code (real Sprint 1)
- [ ] **NestJS API:**
  - a Supabase JWT guard and a role guard;
  - Prisma + PostGIS, one schema per module;
  - `/api/v1`, OpenAPI, and a `/health` endpoint.
- [ ] **Accounts:** `/me` (language, location stored as `geography(Point)`, only the area name returned) and `/organisations` with documents saved to a private Storage bucket.
- [ ] **Administration:** `/admin/verifications` using `IOrgVerify` (approve, reject with a reason, request info). BR-01 is enforced.
- [ ] **Pantry:** `/pantry/items` (US-2.07, 2.10, 2.11); `/pantry/receipts` with draft → confirm in one transaction, and drafts purged after 24 h.
- [ ] **AI gateway (US-14.01):**
  - prompt registry and context builder;
  - schema validation, cache and AIRequestLog;
  - provider order Gemini → Groq → non-AI fallback.
- [ ] **Notifications (US-11.01):**
  - [x] Backend: device tokens, the stored Notification row (30 days), FCM HTTP v1 push with a deep link, and a demo `POST /api/v1/notifications/test`. The tables are in Supabase (`notifications` schema, RLS on).
  - [ ] Firebase web config and VAPID key (public values) for the app's FCM adapter.
  - [ ] Each developer saves the service-account key as `apps/api/firebase-service-account.json` (git-ignored, never shared in chat). Without it, notifications are stored but not pushed.
  - [ ] Android: register `org.elha2.elha2` in Firebase.
- [ ] **Worker:** a pg-boss Scheduler worker running as a separate entrypoint.
- [ ] **CI:** GitHub Actions for lint and tests (api, portal, mobile).
- [ ] **Switch the clients to the real adapters:**
  - mobile: `apps/mobile/lib/data/providers.dart`, plus real ML Kit OCR and FCM;
  - portal: `apps/portal/src/api/index.ts`.
