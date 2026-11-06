# Sprint 1 SRS compliance check

**Date:** 06/11/2026 · **Branch:** `sprint-1` · **Checked against:** SRS v1.0 and SDD v1.1, after the fixes in [`sprint-1-fix-log.md`](sprint-1-fix-log.md)

## 1. Verdict

**The project does not yet comply with the whole SRS, and is not expected to at this stage.** What is built runs correctly, with no crashes or browser errors, but the SRS covers far more than Sprint 1.

| Area | Total | Met | Partly met | Not met | Not verifiable here | Not due yet |
|---|---|---|---|---|---|---|
| Sprint 1 stories | 14 | 9 | 2 | 3 | 0 | 0 |
| Sprint 2 and 3 stories | 25 | 0 | 0 | 0 | 0 | 25 |
| Stories after the course | 61 | 0 | 0 | 0 | 0 | 61 |
| Non-functional requirements | 31 | 3 | 9 | 12 | 7 | 0 |
| Business rules | 12 | 0 | 1 | 0 | 0 | 11 |

"Met" means the acceptance test passed on what exists today. Sprint 1 runs on mock repositories by design (SRS 6.6 and `docs/sprints/sprint-1-demo.md`), so a story marked met on mock data still needs its real adapter. NFRs have no sprint assigned, so unbuilt ones count as not met here, even where the feature is planned for later.

## 2. What was run

| Part | Check | Result |
|---|---|---|
| Mobile | `dart analyze` | No issues |
| Mobile | `flutter test` | 211 of 211 passed |
| Mobile | Production web build, driven in real Microsoft Edge at 412×915, Arabic, Africa/Cairo | 21 of 22 passed; no browser errors. The failure is NFR-21 |
| Portal | `vitest` | 19 of 19 passed |
| Portal | `tsc -b` and production build | Passed |
| Portal | `oxlint` | Passed with 1 warning |
| Portal | Production build, driven in real Edge at 1280×860 and 390×844 | 22 of 23 passed; no browser errors. The failure is the help link |
| API | `tsc` and `nest build` | Passed |
| API | `eslint` | **Failed:** 209 formatting errors, all auto-fixable |
| API | `jest` | **No tests exist** |
| API | Real run on PostgreSQL: migrations, seed, JWT, receipt scan and confirm | 15 of 15 passed |
| API | AI timeout, using a fake provider that never answers | Gave up at 15.1 s; fallback returned all 3 items |

**Real-time measurements in Edge:** Undo disappeared after 9.9 s. A second push banner stayed for about 7.5 s from when the script detected it, against the 8 s timer.

**Not run:** an Android or iOS build or device, Gemini or Groq, Supabase, Firebase, or any load test.

## 3. Sprint 1 stories

| Story | Status | Evidence and gaps |
|---|---|---|
| US-1.02 Switch the app language | **Met** | Instant switch and full RTL in the app and portal, in Edge; Arabic numerals option works |
| US-1.06 Register a business | **Met (mock)** | Branches, documents and pending status work in Edge. Only file names are kept until Supabase Storage is connected |
| US-1.07 Register an NGO | **Met (mock)** | Offers stay blocked until verified; several coordinators work. Same storage limit |
| US-2.02 Review AI-extracted items | **Met** | Confidence, low-confidence highlight, edit and Confirm all; the API also ran draft to confirm |
| US-2.07 Add an item manually | **Met (mock)** | 3 taps and Arabic and English autocomplete, in Edge. Saved in memory only |
| US-2.10 Record thrown-away food | **Met (mock)** | Reason list plus other, Undo; the record is kept for E9. Saved in memory only |
| US-2.11 View the pantry | **Met (mock)** | Grouping, sorting, search, filter and colour code, in Edge |
| US-14.01 AI gateway | **Met (API)** | Versioned prompts, provider set in configuration, 15 s timeout and fallback all shown by running it. Real providers and the switch to the backup provider were not exercised |
| US-14.03 Mask personal data | **Met** | 23 masker tests pass. The API also masked 2 details that a client failed to mask |
| US-1.04 Set a location | **Partly** | Area choice works and only the area name is shown. GPS is simulated |
| US-13.01 Verify organisations | **Partly** | Approve, reject with reason, and request information all work. **"View documents" fails:** the View button is disabled, and only file names exist |
| US-1.01 Sign up with a phone number | **Not met** | Number check and the 5-attempt lock work, but no SMS is sent, and **the 5-minute code expiry is not implemented**, although the portal's hint text says it is |
| US-2.01 Scan a receipt | **Not met** | The API pipeline works, but the app has no real OCR, and the 90% accuracy target has not been measured. The test set has 3 receipts |
| US-11.01 Receive push notifications | **Not met** | The simulation works, including pickup. The acceptance test requires delivery through FCM, which is not connected |

## 4. Non-functional requirements

| ID | Topic | Status | Notes |
|---|---|---|---|
| NFR-01 | Cold start in 3 s | Not verifiable | Needs an Android phone. First screen took 3.5 s on the web build, which is not comparable |
| NFR-02 | API response times | Not verifiable | `/health` p95 was 1.6 ms and a scan 34 ms locally, but there was no pilot load |
| NFR-03 | Nearby search in 2 s | Not met | Marketplace not built (Sprint 2) |
| NFR-04 | Review screen in 10 s | Not verifiable | Needs real OCR and a real provider. See finding F-01 |
| NFR-05 | 50,000 users | Not verifiable | No load analysis yet |
| NFR-06 | No overselling | Not met | Reservations not built (Sprint 2) |
| NFR-07 | Unsafe food output filter | Not met | Recipes and chat not built |
| NFR-08 | Licensed sellers, allergens | Partly | Licence captured at registration; selling and allergens not built |
| NFR-09 | TLS, encryption at rest | Not verifiable | Nothing is deployed |
| NFR-10 | Role and data restrictions | Partly | Bad tokens were refused, another household's draft returned 404, and portal routes are guarded. The API has no role guard, and portal checks run only in the browser |
| NFR-11 | Hosted card payments | Not met | Payments not built (R-04) |
| NFR-12 | Rate limits, lockout | Partly | The 5-attempt lock works in both mocks. The API has no request rate limit |
| NFR-13 | Consent, access, deletion | Not met | Not built |
| NFR-14 | Delete AI photos in 24 h | Partly | Receipt drafts are purged after 24 h by the worker job. Photos are not built |
| NFR-15 | Groups of at least 10 | Not met | Exports not built |
| NFR-16 | Arabic default, RTL, colloquial | **Met** | Checked in Edge and by review |
| NFR-17 | WCAG 2.1 AA | Partly | Four mobile flows pass 200% text, and three pass touch-target and label checks. The portal has not been audited |
| NFR-18 | Icon and text labels, voice input | Partly | Main actions have both. Voice input not built |
| NFR-19 | Jobs on time, 3 retries | Partly | The purge job is scheduled in Africa/Cairo with 3 retries. Reminders and NGO offers not built |
| NFR-20 | Daily backups, restore | Not met | No backup workflow; there is no `.github` folder |
| NFR-21 | Offline pantry with sync | Not met | A reload lost the session and the pantry, shown in Edge |
| NFR-22 | Non-AI path when AI fails | **Met** | Shown for receipts with no provider and with a provider that never answers |
| NFR-23 | 99.5% availability | Not verifiable | Nothing is deployed |
| NFR-24 | 70% backend coverage | Not met | The API has no tests |
| NFR-25 | OpenAPI at every release | Not met | No specification; the route returns 404 |
| NFR-26 | Central error alerts | Not met | Not built |
| NFR-27 | Android 8+, iOS 15+, browsers | Partly | Only Edge was run. `minSdk` follows Flutter's default and has not been checked against Android 8.0 |
| NFR-28 | 60 MB, 300 KB, no background GPS | Partly | No background location code. Install size needs an Android build; image upload not built |
| NFR-29 | AI accuracy targets | Not verifiable | Needs the labelled set (300, 200 and 100 samples; 3 receipts exist) |
| NFR-30 | Confidence, edit, confirm first | **Met** | Shown for receipts: nothing is saved before Confirm all |
| NFR-31 | EGP, Cairo time, Hijri dates | Not met | No Hijri dates; the app uses the device clock. The API does use Cairo dates |

## 5. Business rules

| ID | Status | Notes |
|---|---|---|
| BR-01 | Partly | Verification gates listing and offers on the portal, shown in Edge. Mock only |
| BR-02 to BR-08, BR-10, BR-11 | Not due | Marketplace, orders and donation features are Sprints 2 and 3 |
| BR-09, BR-12 | Not due | Impact and government exports are later |

## 6. Stories not due yet

- **Sprint 2 (15):** US-14.02, 3.01, 3.03, 3.04, 2.08, 2.09, 4.01, 4.05, 6.01, 5.01, 5.03, 5.04, 5.07, 7.02, 7.03.
- **Sprint 3 (10):** US-6.04, 6.07, 8.01, 8.02, 8.04, 12.04, 9.01, 9.02, 9.03, 9.04.
- **After the course (61):** every other story in SRS chapter 4.

Early work exists for US-3.01 (rule-based estimate), US-6.04 (preview screen), US-11.05 (notification list), US-12.03 (verified badge), US-14.04 (corrections flagged) and US-14.05 (daily cap). None of these has been checked against its acceptance test.

## 7. New findings from this run

These were not in the earlier reports, and none has been fixed.

| ID | Severity | Finding |
|---|---|---|
| F-01 | Medium | **The SRS contradicts itself.** NFR-04 and US-2.01 require a result within 10 s, but US-14.01 allows 15 s before fallback. The measured timeout path took 15.1 s |
| F-02 | Medium | The 5-minute code expiry from US-1.01 is missing, and the portal tells users it exists (`signIn.codeHint`) |
| F-03 | Medium | The admin cannot open documents in US-13.01: the View button is disabled until Sprint 2, although the story is Sprint 1 |
| F-04 | Medium | The API has no tests, although NFR-24 sets 70%, and `test:e2e` has only a config file |
| F-05 | Medium | There is no CI and no `.github` folder, although NFR-20 and US-14.02 depend on one |
| F-06 | Medium | PostGIS is not used anywhere, although SRS 6.1 and the SDD require it. It is needed from Sprint 2 |
| F-07 | Medium | The main `AndroidManifest.xml` has no `INTERNET` permission. Debug builds have it, so a release build would not reach the real backend |
| F-08 | Low | The SRS 3.1 help link is missing from both clients. The portal has an unused `app.help` text |
| F-09 | Low | `pnpm eval:receipts` points to `scripts/eval-receipts.ts`, which does not exist |
| F-10 | Low | API lint fails with 209 formatting errors. `eslint --fix` should clear them |
| F-11 | Low | The SDD and `CLAUDE.md` describe one retry per AI call, but a timed-out call was made once and not retried |
| F-12 | Low | **Deployment note:** with a `C` database locale, Arabic catalogue matching silently finds nothing. Use a UTF-8 language locale |
| F-13 | Low | TBD-01 was due to close in Sprint 1 and is still open |

## 8. Recommended next steps

1. Connect Supabase phone login, FCM and real ML Kit OCR, which closes the three unmet Sprint 1 stories.
2. Add the code expiry (F-02), document viewing (F-03) and the Android permission (F-07).
3. Decide F-01 with the team: either raise the 10 s target or shorten the timeout, in SRS v1.2.
4. Add CI and API tests (F-04, F-05), and run `eslint --fix` (F-10).
5. Add the offline store, because NFR-21 is a Must and a reload loses everything.

---
*This check was run and drafted with Claude (Anthropic). The team reviews and owns the results.*
