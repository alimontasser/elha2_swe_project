# Elha2: project context

Elha2 is a food-saving app for Egypt, built for the AUC Software Engineering course (Fall 2026). It is Arabic-first and AI-assisted, with a mobile app and a web portal. It cuts food waste at three points:
- **Prevent:** a smart household pantry with expiry reminders and Egyptian recipes.
- **Sell:** businesses list surplus at a discount for pickup.
- **Donate:** unsold food goes to NGOs.

Every verified action is measured in kg, EGP, CO2e and meals.

**Team:** Malak Dessouky, Yassin Shamaa, Ali Montasser, Farida Fayek, Ibrahim Meligy.

## Source of truth
- `docs/specs/Elha2_SRS_v1.0.pdf` (+ `.txt`). The product backlog:
  - stories US-x.xx, each with a "shall" requirement, an acceptance test, a MoSCoW priority and points;
  - NFR-01..31, BR-01..12, risks R-01..13, TBD-01.
- `docs/specs/Elha2_SDD_v1.1.pdf` (+ `.txt`). The design (29/10/2026). Where v1.0 and v1.1 differ, **v1.1 wins**.
- Both are updated every sprint with tracked changes: `\chg{version}{...}`, `\del{version}{...}`, a revision-history row and a `docs-vX.Y` tag.
- Both end with a Declaration of AI Use. Keep it accurate.

**Definition of Done:**
- code reviewed and merged;
- tests and the acceptance test pass;
- Arabic and English text in place;
- correct right-to-left layout.

## Architecture (SDD v1.1)
- **Style:** a modular monolith backend plus one ML microservice.
- **Clients:** a Flutter mobile app (Riverpod; Drift offline store; ML Kit OCR, barcode reading and personal-data masking on the phone) and a React + TypeScript web portal.
- **Backend:** NestJS, one REST API at `/api/v1`. It has 8 feature modules (Accounts, Pantry, Expiry, Recipes, Marketplace, Orders, Donations, Administration) and 5 shared services (AI gateway, Impact ledger, Notifications, Scheduler, Adapters).
  - Modules talk only through named interfaces (IPantryQuery, IEstimateExpiry, IStock, IOrgVerify, IAI, IRecordImpact, INotify, IExternal).
  - No module touches another module's tables.
- **ML service:** Python + FastAPI (shelf life, item matcher, deal recommender), reached through IPredict.
- **Supabase:**
  - Postgres with PostGIS, one schema per module, and the pg-boss job queue;
  - **Auth** for phone OTP login (the backend verifies the Supabase JWT);
  - **Storage** in private buckets with signed links;
  - **Realtime** (the backend posts, the apps listen).
- **Firebase:** only FCM push and portal hosting.
- **AI gateway:** every hosted-model call goes through it. It runs a 6-step context builder (template → retrieve context → worked examples → mask and trim → structured call → validate). Each call has a 15 s timeout and one retry, then the backup provider, then a non-AI fallback. A person confirms every AI output (NFR-30).
- **Providers:** free tiers only for the course: Gemini (main) and Groq through an OpenAI-compatible adapter (backup). TBD-01 picks the main provider by measured accuracy.
- **Deployment:** Cloud Run with ≥2 stateless API instances, a Scheduler worker and the ML service. Database backups run nightly from GitHub Actions.

## Current status
**Sprint 1 demo:** the app and portal run on **mock** repositories, with no backend or external services. See `docs/sprints/sprint-1-demo.md` and `docs/TODO-integrations.md`.
- Each client picks its implementations in one file: `apps/mobile/lib/data/providers.dart` and `apps/portal/src/api/index.ts`.
- Real adapters replace the mocks there; screens must not change.

## Repo map
```
apps/mobile   Flutter app      flutter pub get · flutter analyze · flutter test · flutter run -d chrome
apps/portal   React portal     pnpm install · pnpm dev · pnpm test · pnpm build
docs/         specs, sprint plans and demo script, integration checklist
```

## Conventions
- All user-facing text lives in translation files (`apps/mobile/lib/l10n/*.arb`, `apps/portal/src/i18n/*.json`), never in code. Arabic is the default.
- Use start/end (directional) padding and alignment, never left/right, so RTL mirrors correctly.
- Colour is never the only signal; every main action has an icon **and** a text label (NFR-17, NFR-18).
- Money is stored as integer piastres. Times are in Africa/Cairo.
- Never commit secrets; they go in the platform secret manager.

## Sprint plan (SRS §6.6.2)
1. **Sprint 1 → M2 (52 pts):** US-1.01, 1.02, 1.04, 1.06, 1.07, 13.01, 2.07, 2.10, 2.11, 14.01, 11.01, 2.01, 2.02, 14.03.
2. **Sprint 2 → M3 (55 pts):** US-14.02, 3.01, 3.03, 3.04, 2.08, 2.09, 4.01, 4.05, 6.01, 5.01, 5.03, 5.04, 5.07, 7.02, 7.03.
3. **Sprint 3 → M4, Dec 1 (39 pts):** US-6.04, 6.07, 8.01, 8.02, 8.04, 12.04, 9.01, 9.02, 9.03, 9.04.

## How the instructor grades (from the lectures)
- **Requirements:** unambiguous, consistent and complete; NFRs must be measurable.
- **Architecture:** a UML component diagram (arrows mean "uses"). Justify every decision by its trade-off and its *why*.
- **Diagrams:** sequence diagrams only across components; use a class diagram for a use case that stays inside one component.
- **Design quality:** high cohesion, low coupling, no single point of failure; refactor to control technical debt.
- **Consistency:** the SRS and SDD must agree with each other.

## Working preferences (Ali)
- Keep replies short and direct.
- Don't recap what was already done; move forward.
