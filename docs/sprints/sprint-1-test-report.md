# Sprint 1 test report: pantry and notifications

**Date:** 06/11/2026 · **Branch:** `sprint-1` · **App:** `apps/mobile` on mock repositories

This report covers static, unit, integration and dynamic testing of four Sprint 1 stories against SRS v1.0: US-2.11 View the pantry, US-2.07 Add an item manually, US-2.10 Record thrown-away food and US-11.01 Receive push notifications. It records each issue as it was found and as it stands after the fixes. The exact code changes are in [`sprint-1-fix-log.md`](sprint-1-fix-log.md).

## 1. Summary

| | Before fixes | After fixes |
|---|---|---|
| Static analysis | No issues | No issues |
| Tests run | 201 | 211 |
| Passed | 191 | **211** |
| Failed | 10 | **0** |
| Defects open (section 4) | 10 | **0** |

All ten defects in section 4 are fixed. The ten failed tests and the ten defects are not one-to-one: D-01 caused three failures, and D-06 and D-10 came from static review. Section 6 lists work that is still open. Three stories now meet their acceptance tests on the demo build. **US-11.01 still does not:** its acceptance test requires delivery through Firebase Cloud Messaging, which is not connected, so the passing push tests exercise the simulated service only.

| Story | Before | After |
|---|---|---|
| US-2.11 View the pantry | Worked, with wrong dates around clock changes and a raw error on load failure | Meets acceptance test |
| US-2.07 Add an item manually | Worked, but failures were silent and Undo never ended | Meets acceptance test |
| US-2.10 Record thrown-away food | Worked, but failures were silent and Undo never ended | Meets acceptance test for this sprint; the E9 waste rate that uses the data arrives in Sprint 3 |
| US-11.01 Receive push notifications | Simulated only; no pickup type; banner hid early | Simulation corrected; **real FCM delivery still open** |

## 2. How it was tested

| Type | What was done |
|---|---|
| Static | `dart analyze` on all app and test code; code review of the four stories against the SRS and SDD v1.1; review of the SRS text itself |
| Unit | Rules (urgency boundaries, grouping, search, expiry estimate), pantry controller, notification service, catalogue data, Arabic and English text parity |
| Integration | The whole app in a widget test: real router, screens, Riverpod state and repository, in Arabic and English |
| Dynamic | Executing the running app through user flows, including slow and failing repositories, 200% text size, touch-target and label checks, and the real Egypt time zone |

**Environment:** Flutter 3.47.8 (Dart 3.13.7), the revision pinned in `.metadata`; Windows 11; time zone Egypt Standard Time.

## 3. Results by test file

| File | Tests before | Failed before | Tests after | Failed after |
|---|---|---|---|---|
| Existing: `app_flow`, `auth`, `expiry_rules`, `pii_masker` | 39 | 0 | 39 | 0 |
| `unit/` (4 files) | 69 | 0 | 73 | 0 |
| `integration/` (4 files) | 67 | 0 | 68 | 0 |
| `defects/srs_gaps_test.dart` | 26 | 10 | 31 | 0 |
| **Total** | **201** | **10** | **211** | **0** |

The counts rose because each fix added tests for behaviour that did not exist before, such as Try again and the pickup push.

## 4. Defects found and fixed

Severity: **High** means wrong data or lost feedback for users; **Medium** breaks a stated SRS rule; **Low** is minor.

### D-01 Wrong expiry dates around Egypt's clock changes (High)
- **Requirement:** US-2.07, US-2.11.
- **Before:** A 7-day item bought on 25 Oct 2026 expired on 31 Oct instead of 1 Nov. On 23 Apr 2026, an item expiring on 25 Apr showed 1 day left instead of 2, and an item 4 days away showed as orange instead of green.
- **Cause:** Dates were calculated by adding 24-hour periods, but the local day is 23 or 25 hours long when the clocks change.
- **After:** Dates are calculated as calendar days and day counts use UTC. Both examples now give the right answer. The backend was checked and never had this bug.
- **Changed:** `core/expiry_rules.dart`, `state/pantry.dart`, `data/mock/mock_data.dart`.

### D-02 Failed saves were silent (High)
- **Requirement:** SRS 3.1, Error messages.
- **Before:** If saving failed, the sheet closed, the item stayed where it was, and the user saw nothing. The exception went unhandled. Failed adds and failed Undo behaved the same way.
- **Cause:** The save calls had no error handling.
- **After:** The user sees "That didn't save. Check your connection and try again." in their language, and no Undo is offered for a change that did not happen.
- **Changed:** `features/pantry/item_sheet.dart`, `features/pantry/manual_add_screen.dart`, `features/common/widgets.dart`.

### D-03 Undo never ended (Medium)
- **Requirement:** US-2.08, SRS 3.1 (10 s undo).
- **Before:** Undo was still on screen after 11 s, and stayed until something replaced it.
- **Cause:** Flutter keeps any snackbar that has an action on screen by default, ignoring its `duration`.
- **After:** Undo is gone by 11 s after adding an item or throwing one away. After adding, it was also confirmed still available at 9 s.
- **Changed:** `item_sheet.dart`, `manual_add_screen.dart`.

### D-04 Raw errors shown to users (Medium)
- **Requirement:** SRS 3.1, Error messages.
- **Before:** When loading failed, the screen showed `SocketException: Failed host lookup: api.elha2.app`, with no way to recover.
- **Cause:** Screens printed the exception directly.
- **After:** The Pantry, Home and Add by hand screens show a plain message in Arabic or English with a **Try again** button that recovers.
- **Changed:** `pantry_screen.dart`, `home_tab.dart`, `manual_add_screen.dart`, `common/widgets.dart`.

### D-05 A second push banner disappeared early (Medium)
- **Requirement:** US-11.01.
- **Before:** If a second push arrived 5 s after the first, the first banner's 8 s timer hid the new banner about 3 s after it appeared.
- **Cause:** Each banner started its own timer, and the timer hid whichever banner was showing.
- **After:** A new push cancels the old timer, so each banner gets its full 8 s.
- **Changed:** `features/notifications/push_banner.dart`.

### D-06 No pickup notification (Medium)
- **Requirement:** US-11.01 names expiry digests, reservations **and pickups**.
- **Before:** Only expiry and reservation types existed.
- **After:** A pickup type exists with Arabic and English text and a deep link, plus a **Send pickup push** demo button in Settings. It opens Deals, because the order screen arrives in Sprint 2.
- **Changed:** `data/models.dart`, `data/mock/mock_services.dart`, `push_banner.dart`, `settings_screen.dart`, translation files.

### D-07 Orange urgency label too faint (Low)
- **Requirement:** NFR-17 (WCAG 2.1 AA, 4.5:1 for small text).
- **Before:** Orange on its soft background measured 4.05:1. Red and green already passed.
- **After:** The orange changed from `#B85C12` to `#A8520F`, which clears 4.5:1. The portal uses the same palette, so its value changed too.
- **Changed:** `app/theme.dart`, `apps/portal/src/index.css`.

### D-08 Typed items were not marked as estimated (Low)
- **Requirement:** US-3.01, UC-10.
- **Before:** A typed item's automatic 3-day date was saved as `userSet`, so the app showed a guess as if the user had chosen it. Unknown receipt lines the user named behaved the same way.
- **After:** Both are saved as `estimated` and show the "estimated" label.
- **Changed:** `state/pantry.dart`.

### D-09 Opening a push from the banner left it unread (Low)
- **Requirement:** US-11.01, consistent with US-11.05.
- **Before:** Tapping **Open** left the notification unread. The bell only refreshed when navigation happened to rebuild it.
- **After:** **Open** marks it read, and the notification service now announces every change, so the bell updates even when Open stays on the same tab.
- **Changed:** `push_banner.dart`, `main.dart`, `data/repositories.dart`, `mock_services.dart`, `home_shell.dart`, `notifications_screen.dart`.

### D-10 Left/right padding on the item sheet (Low)
- **Requirement:** project convention, correct RTL layout.
- **Before:** `item_sheet.dart` used `EdgeInsets.fromLTRB`.
- **After:** It uses `EdgeInsetsDirectional`. The two values are equal, so nothing looks different.

## 5. Checked, no defect found

- 200% text size on the pantry, item sheet, waste dialog, add-by-hand and push banner, in Arabic and English, using the real Cairo font.
- Touch-target and screen-reader label checks on the pantry, add-by-hand and waste dialog.
- Undo still appears when saving takes 1 s, and leaving the Add screen during a save does not crash.
- Arabic and English translation files have the same keys and placeholders.
- A push received while signed out cannot bypass sign-in.

The automatic pixel-based contrast check was dropped for these screens because it gave impossible readings, such as 2.16:1 for dark text on white. D-07 was measured from the colour values instead.

## 6. Still open in the code

These were not fixed, either because they need something outside the code or because they are planned features rather than errors.

| Item | Requirement | Why it is still open |
|---|---|---|
| Real push delivery, including when the app is closed | US-11.01 | Needs the team's Firebase project and the Notifications backend (`docs/TODO-integrations.md`). **Blocks US-11.01 acceptance** |
| Push text is fixed demo text, not built from the pantry | US-11.01, US-3.03 | Depends on the digest job in Sprint 2 |
| Pantry is lost when the app restarts; no offline store | NFR-21 | Drift store not built yet; the app runs on mocks |
| No `/pantry/items` route, so nothing tested against a server | US-2.07, 2.10, 2.11 | Backend route not built yet |
| Expiry date cannot be edited (`updateItem` is unused) | US-3.01 | Sprint 2 story |
| No help link and no offline banner | SRS 3.1 | New screens and content needed; needs a team decision on FAQ content |
| No Hijri dates; times use the device clock, not Africa/Cairo | NFR-31 | Needs a calendar and time-zone library, which is a dependency decision |
| `fromLTRB` still used in `receipt_review_screen.dart` | Project convention | Outside the four stories; equal values, so no visible effect |
| Failed "Confirm all" on receipt review is unhandled | SRS 3.1 | Outside the four stories; same fix as D-02 applies |

## 7. Issues in the SRS itself

The SRS was not changed. These need a team decision and belong in the v1.2 revision with tracked changes.

| Section | Issue | Suggested change |
|---|---|---|
| US-2.11 | Expired items are not covered, and "within 3 days", "search" and "filter" are undefined | State that expired shows red, days 1 to 3 show orange, search covers names, and filter covers storage place |
| Table B.1 | Viewing the pantry has no use case; US-2.11 is mapped to UC-16 "Update item status" | Add a "View pantry" use case |
| US-2.07 | "3 taps" has no starting point, and items outside the catalogue are not covered | Count from the Pantry tab; state the free-text behaviour and its 3-day estimate |
| US-2.10 | The acceptance test needs the E9 waste rate, which is Sprint 3 | Test in Sprint 1 that the reason is stored |
| US-11.01 | In Sprint 1, but digests, reservations and pickups arrive in Sprints 2 and 3; "the right screen" is undefined | Move the story or split it; list the target screen for each type |
| US-11.01 | The acceptance test names a technology (FCM) and gives no delivery time | State the behaviour and link it to NFR-19 |
| Section 3.2 | Notification permission is not listed | Add it, including the Android 13+ prompt |
| Section 3.1, NFR-17 | Section 3.1 cites NFR-17 for "colour is never the only signal", but NFR-17 does not say this | Add the wording to NFR-17 |
| Section 6.1, SDD | `wasteNote` for the "other" reason is in the code but not in the data model | Add it to both documents |
| Section 3.1, US-2.08 | The 10 s undo for thrown-away food is implied, not stated in US-2.10 | State it in US-2.10 |

## 8. Limits of this testing

- The Flutter tests ran in Flutter's headless test environment; running them in Edge hung and was stopped. The production web build was later driven through the main flows in real Edge. Nothing was run on a phone. See [`sprint-1-srs-compliance.md`](sprint-1-srs-compliance.md).
- All external services are mocked, so no real Firebase or AI provider was involved. The pantry and push flows do not reach a backend.
- The portal's 19 tests were run after the colour change, and they pass.
- `dart analyze` was used because `flutter analyze` hit the Windows path-length limit in the temporary SDK folder. It runs the same analyzer.
- SRS Appendix D.4 still shows "Not run". Update it at the Sprint 1 review.

## 9. How to repeat the tests

```bash
cd apps/mobile
flutter pub get
dart analyze .
flutter test
```

**OneDrive:** if `flutter pub get` reports that `arb-dir` "doesn't allow reading and writing", the cause is the read-only flag OneDrive sets on folders. Clone or copy the project to a folder outside OneDrive and run the commands there. The tests in this report ran on such a copy.

`pii_masker_test.dart` reads `fixtures/` at the repository root, so keep the `apps/mobile` folder depth when copying.

Tests that check clock changes only detect the bug in a time zone that observes daylight saving, such as Egypt's.

---
*This report was drafted with Claude (Anthropic), which also wrote the tests and fixes. The team reviews and owns the results.*
