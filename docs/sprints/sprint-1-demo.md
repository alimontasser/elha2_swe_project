# Sprint 1 demo

This is a clickable demo of the Sprint 1 stories in the **mobile app** and the **web portal**.

- **By default nothing external is connected.** Sign-in, file storage, AI and push notifications are all simulated by mock implementations. Real Supabase sign-in and the backend's receipt reading can be switched on (see the end of this page). The real adapters for SDD v1.1 (Supabase, the NestJS API, Gemini/Groq through the AI gateway, ML Kit, FCM) replace them later. The list of what is needed is in [`../TODO-integrations.md`](../TODO-integrations.md).
- **What is real:** the screens, Arabic/English with right-to-left layout, validation, the pantry rules (grouping, urgency, expiry estimate) and the **personal-data masker** (US-14.03).

## Run it

**Mobile app:**
```bash
cd apps/mobile
flutter pub get
flutter run -d chrome   # or an Android emulator / device
```
**Web portal:**
```bash
cd apps/portal
pnpm install
pnpm dev                # http://localhost:5173
```
**Tests:**
- mobile: `flutter analyze && flutter test` (211 tests; see [`sprint-1-test-report.md`](sprint-1-test-report.md));
- portal: `pnpm test && pnpm typecheck` (19 tests).

## Demo data
| What | Value |
|---|---|
| One-time code (any number) | `654321` (5 wrong codes lock the number for 1 h) |
| Portal admin | `01000000000`, role "Administrator" |
| Portal business owner | `01011112222`, role "Business owner" (owns the pending *مخبز الشمس*) |
| Portal NGO coordinator | `01233334444`, role "NGO coordinator" (pending *جمعية سلة الخير – المعادي*) |
| App | Any Egyptian mobile (`010/011/012/015` + 8 digits) |

**Reset:** in the portal, **Reset demo data** in the top bar. In the app, Settings → **Reset demo data**.

## Click path per story

**Mobile app** (`docs/sprints/screenshots/app-*.png`):

| Story | Steps | Expected |
|---|---|---|
| US-1.01 Sign up with a phone number | Enter `010 1234 5678` → Send code → type `654321` | Signed in. A wrong code shows the attempts left; the 5th locks for 1 h |
| US-1.02 Switch the app language | Tap **English** on sign-in, or Settings → Language; Settings → Arabic-Indic numerals | Switches instantly; Arabic is right to left, English left to right |
| US-1.04 Set a location | "Use my location", or pick an area → Continue | Only the area name is stored and shown. Settings explains that others see an approximate distance |
| US-2.11 View the pantry | Pantry tab | Grouped Fridge / Freezer / Cupboard, sorted by expiry. Red/orange/green with an icon **and** a text label. Search and filter chips |
| US-2.07 Add an item manually | **Add food** → **Type it** → tap a common item (3 taps), or search `جبنه` / `tomatoes` | Added with the default quantity and an estimated expiry; Undo for 10 s |
| US-2.10 Record thrown-away food | Tap an item → **Thrown away** → pick a reason (or Other + text) → Save | Item leaves the pantry; "counts towards your waste rate"; Undo |
| US-2.01 Scan a receipt + US-14.03 Mask personal data | **Add food** → **Scan receipt** → pick a sample → **Read this receipt** | The masked lines show `[name]`, `[phone]`, `[card]` and the count hidden; then "Reading your receipt…" |
| US-2.02 Review AI-extracted items | Review screen | % per item; orange below 70%; tap to edit; swipe to delete; unknown line not saved unless named; **Confirm all** → "6 items added" |
| NFR-22 AI fallback | Settings → **Simulate AI failure** → scan again | "We couldn't read the items", the raw lines, and **By hand** |
| US-11.01 Receive push notifications | Settings → **Send expiry push** / **Send reservation push** / **Send pickup push** | Banner at the top; **Open** deep-links to Pantry / Deals and marks it read; bell shows the unread count |
| US-4.02 Ask the cooking assistant (Sprint 2 story, built early) | Home → **Cooking assistant** → tap a suggestion, or type a question | An answer from the pantry, items closest to expiry first, with a **Safety note** for leftovers; a non-food question is declined; with **Simulate AI failure** on, a simple offline suggestion |
| US-14.01 AI gateway | (back end, not in the demo) | `MockReceiptAiService` stands in for Gemini → Groq → non-AI fallback |

**Web portal** (`docs/sprints/screenshots/portal-*.png`):

| Story | Steps | Expected |
|---|---|---|
| US-1.01 | Sign in with any role and code `654321` | Wrong code shows an inline error; 5 wrong codes lock the number |
| US-1.06 Register a business | Business owner → **Register a business** → name, CR no., licence no., branches (add several), both documents → Submit | Status "Pending review"; listing is locked until verified (BR-01) |
| US-1.07 Register an NGO | NGO coordinator → **Register an NGO** → areas, food types, capacity, coordinators, certificate → Submit | Pending; "donation offers blocked until verified" |
| US-13.01 Verify organisations | Admin → Verification → **Review** → Approve / Reject (reason required) / Request information (reason required) | History records who decided and when; the owner (or every NGO coordinator) gets a notification |
| US-12.03 (preview) | Back as the business owner | "Verified by Elha2" badge; listings unlocked |
| US-1.02 | 🌐 toggle in the top bar | Whole portal mirrors instantly |

## Verified on 30/10/2026
- **App:** `flutter analyze`: no issues. `flutter test`: 37 passed.
- **Portal:** `vitest`: 19 passed. `tsc -b` and `oxlint` are clean.
- **Browser walkthroughs:** Playwright with Chromium, at 412×915 (app) and 1280×860 / 390×844 (portal).
  - Every step above passed with no console errors.
  - The portal has no horizontal scroll at phone width.
  - The screenshots are in `screenshots/`. Use them to replace the SDD wireframes at the Sprint 1 review (SDD change procedure).

## Re-tested on 06/11/2026
- **App:** `dart analyze`: no issues. `flutter test`: 211 passed. Defects and fixes are in [`sprint-1-test-report.md`](sprint-1-test-report.md).
- The screenshots and browser walkthroughs above were not repeated.

## Receipt scan through the real backend
The app's receipt scan can use the real AI gateway instead of the mock.

```bash
cd apps/api
cp .env.example .env        # fill DATABASE_URL, AUTH_JWT_SECRET (any random string) and GEMINI_API_KEY
pnpm install && pnpm db:deploy && pnpm db:seed
pnpm build && node dist/main          # API on http://localhost:3000
pnpm -s dev-token                     # prints a local login token
```
```bash
cd apps/mobile
flutter run -d chrome --dart-define=ELHA2_API_URL=http://localhost:3000 --dart-define=ELHA2_DEV_TOKEN=<token>
```
Without the two `--dart-define` values the app keeps using the demo mock. Receipt scanning and the cooking assistant go to the backend; "Confirm all" still saves into the app's demo pantry.

## Real phone sign-in (Supabase)
Both clients can sign in through Supabase Auth instead of the mock. The project uses **test numbers** with the fixed code `654321`, so no SMS is sent: `01012345678`, `01000000000` (administrator), `01011112222` and `01233334444`. Other numbers can't sign in until an SMS provider is set up.

**Portal:** copy `apps/portal/.env.example` to `.env.local` and paste the publishable key (Supabase → Project Settings → API Keys), then run `pnpm dev`.
- "Administrator" works only for numbers whose token carries the `admin` role (`01000000000`). Other numbers get "not an administrator".
- Organisations, verification and notifications still use the mock store.

**App:**
```bash
flutter run -d chrome --dart-define=SUPABASE_URL=https://ujvucfvrhlrjttzmavgg.supabase.co --dart-define=SUPABASE_PUBLISHABLE_KEY=<key>
```
- Add `--dart-define=ELHA2_API_URL=http://localhost:3000` to send receipts to the backend. With Supabase on, the backend gets the Supabase token, so start the API with `SUPABASE_URL` set in `apps/api/.env`.

**Wrong codes:** the 5-per-hour limit per number is kept in each client and survives a reload. Supabase itself only limits per IP address.

## Real push notifications (Firebase Cloud Messaging)
The app uses FCM by default: the public web config of Firebase project `elha2-201ad` and its VAPID key are in `apps/mobile/lib/data/fcm/firebase_config.dart`. If Firebase can't load (no permission, blocked network), the app keeps working with the demo pushes. To force the demo pushes, pass `--dart-define=FIREBASE_API_KEY=`.

**Receive a push in Chrome without the backend:**
1. `flutter run -d chrome`.
2. Sign in, and allow notifications when Chrome asks.
3. Settings → **Push device token** → **Copy**.
4. In Firebase → Messaging → **Send test message**, paste the token.
   - With the app open, a banner appears.
   - With the tab in the background, Chrome shows the notification; clicking it opens the app.
   - To open a specific screen, add the custom data `type=expiryDigest` and `deepLink=/pantry`.

**Through the backend:**
- Also pass `ELHA2_API_URL`. The device is registered at sign-in and removed at sign-out.
- Settings → **Send expiry push** asks the backend to push.
- The API needs the service-account key at `apps/api/firebase-service-account.json` (git-ignored). Download it yourself: Firebase → Project settings → Service accounts. Never share it in chat.
- Without the key, the API stores the notification but sends nothing.

**Android:** register the app `org.elha2.elha2` in Firebase and use its app ID.
