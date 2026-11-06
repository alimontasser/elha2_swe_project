# Sprint 1 fix log

**Date:** 06/11/2026 · **Branch:** `sprint-1`

This log records every issue that was found and fixed while testing US-2.11, US-2.07, US-2.10 and US-11.01, with the code before and after. The test method and results are in [`sprint-1-test-report.md`](sprint-1-test-report.md). Items that are still open are listed in section 8.

**Result:** 11 product issues fixed across 20 production files (162 lines added, 49 removed). Tests went from 191 of 201 passing to 211 of 211 passing, and static analysis stayed clean.

## Types of testing performed

| Type | How it was done here | Tests | Result after fixes |
|---|---|---|---|
| **Static testing** | `dart analyze` on all app and test code; manual review of the code against the SRS and SDD v1.1; review of the SRS text for the four stories | Not counted as test cases | No analyzer issues; review findings are D-06, D-10 and D-11, plus the open items in section 8 |
| **Unit testing** | Rules, pantry controller, notification service and content, each tested alone, without screens | 73 in `unit/` | All pass |
| **Integration testing** | The whole app in a widget test, with real screens, router, Riverpod state and repository working together | 68 in `integration/` | All pass |
| **Dynamic testing** | Running the app's code through user flows and checking what it does, which covers the unit and integration tests above and the targeted checks below | 31 in `defects/`, plus all of the above | All pass |
| **Regression testing** | The 39 existing tests rerun after every change, and each fixed defect kept as a permanent test in `defects/` | 39 existing, plus 31 in `defects/` | All pass |

Techniques used within those types:

| Technique | Used for |
|---|---|
| Boundary value analysis | Urgency at −1, 0, 1, 3 and 4 days; the summer months; month and year ends |
| Equivalence partitioning | Search queries, the waste reasons, notification types, storage filters |
| Fault injection | Repositories that fail, or respond after a delay, to imitate a real network |
| Time-based testing | Undo at 9 and 11 s, banners at 8 s, and dates across the clock changes in the Egypt time zone |
| Accessibility testing | 200% text, touch targets, screen-reader labels, contrast ratios (NFR-17) |
| Localisation testing | Arabic and English text, right-to-left layout, Arabic plurals and digits |

**Not performed for these fixes:** testing on a real phone, end-to-end testing against a real backend or Firebase, load or performance testing, security testing, and usability testing with real users. Browser testing in real Edge was done afterwards and is recorded in [`sprint-1-srs-compliance.md`](sprint-1-srs-compliance.md).

## 1. All fixed issues

| ID | Severity | Issue | Story or rule | Found by | Status |
|---|---|---|---|---|---|
| [D-01](#d-01-wrong-expiry-dates-around-clock-changes) | High | Wrong expiry dates around Egypt's clock changes | US-2.07, US-2.11 | Unit testing (time-based) | Fixed |
| [D-02](#d-02-failed-saves-were-silent) | High | Failed saves showed the user nothing | SRS 3.1 | Dynamic testing (fault injection) | Fixed |
| [D-03](#d-03-undo-never-ended) | Medium | Undo did not end after 10 s | US-2.08, SRS 3.1 | Dynamic testing (time-based) | Fixed |
| [D-04](#d-04-raw-errors-shown-to-users) | Medium | Raw exception text shown on screen | SRS 3.1 | Dynamic testing (fault injection) | Fixed |
| [D-05](#d-05-second-push-banner-disappeared-early) | Medium | A second push banner disappeared early | US-11.01 | Dynamic testing (time-based) | Fixed |
| [D-06](#d-06-no-pickup-notification) | Medium | No pickup notification type | US-11.01 | Static testing (review against SRS) | Fixed |
| [D-07](#d-07-orange-label-too-faint) | Low | Orange urgency label below WCAG AA contrast | NFR-17 | Unit testing (accessibility) | Fixed |
| [D-08](#d-08-guessed-dates-not-marked-as-estimated) | Low | Guessed dates not marked as estimated | US-3.01, UC-10 | Static review, confirmed by integration testing | Fixed |
| [D-09](#d-09-open-left-the-push-unread) | Low | **Open** left the push unread and the bell stale | US-11.01, US-11.05 | Integration testing | Fixed |
| [D-10](#d-10-leftright-padding-on-the-item-sheet) | Low | Left/right padding on the item sheet | RTL convention | Static testing (code review) | Fixed |
| [D-11](#d-11-leftright-padding-on-the-pantry-screen) | Low | Left/right padding on the pantry screen | RTL convention | Static testing (code review) | Fixed in commit `7e987fb` |

## 2. Issue details

Paths are relative to `apps/mobile/lib/`. Line numbers refer to the code before the fix.

### D-01 Wrong expiry dates around clock changes

**What happened:** A 7-day item bought on 25 Oct 2026 expired on 31 Oct instead of 1 Nov. On 23 Apr 2026, an item expiring on 25 Apr showed 1 day left instead of 2. An item 4 days away showed orange instead of green.

**Cause:** Dates were worked out by adding 24-hour periods, but a local day is 23 or 25 hours long when the clocks change. The backend already used UTC, so it never had this bug.

`core/expiry_rules.dart`, estimate (lines 12–13):
```dart
// Before
final day = DateTime(purchasedOn.year, purchasedOn.month, purchasedOn.day);
return day.add(Duration(days: days));

// After
return daysAfter(purchasedOn, days);

DateTime daysAfter(DateTime from, int days) => DateTime(from.year, from.month, from.day + days);
```

`core/expiry_rules.dart`, day count (lines 28–29):
```dart
// Before
final a = DateTime(now.year, now.month, now.day);
final b = DateTime(expiry.year, expiry.month, expiry.day);

// After: UTC days are always 24 hours
final a = DateTime.utc(now.year, now.month, now.day);
final b = DateTime.utc(expiry.year, expiry.month, expiry.day);
```

The same `Duration` pattern was replaced with `daysAfter` in `state/pantry.dart` (lines 51 and 79) and `data/mock/mock_data.dart` (lines 146 and 149).

**Verified by:** the three "Daylight saving" tests, run in the Egypt time zone, plus the new `daysAfter` unit tests.

### D-02 Failed saves were silent

**What happened:** If saving failed, the sheet closed, the item stayed where it was, and the user saw no message. The exception went unhandled. Failed adds and failed Undo behaved the same way.

**Cause:** The save calls had no error handling.

`features/pantry/item_sheet.dart` (each action had this shape):
```dart
// Before
onPressed: () async {
  Navigator.of(context).pop();
  await ref.read(pantryProvider.notifier).markUsed(item);
  _undoable(ref, l.usedRecorded);
},

// After
onPressed: () => _apply(context, ref, l.usedRecorded, (c) => c.markUsed(item)),
```

The new `_apply` method reads what it needs before the sheet closes, then handles failure:
```dart
Navigator.of(sheetContext).pop();
try {
  await change(controller);
} on Exception {
  showSaveFailed(messenger, l.saveFailed);
  return;
}
```

`features/pantry/manual_add_screen.dart` got the same treatment: `_added` became `_add`, with the same `try`/`on Exception`. It also checks `mounted` before touching the screen, because the user may leave during a save. The Undo buttons on both screens now catch failures too.

`features/common/widgets.dart` gained the shared helper:
```dart
void showSaveFailed(ScaffoldMessengerState messenger, String message) {
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(content: Text(message)));
}
```

**Verified by:** "a failed save tells the user", "a failed add tells the user", "a failed Undo tells the user".

### D-03 Undo never ended

**What happened:** Undo was still on screen after 11 s, although the SRS gives it 10 s.

**Cause:** Flutter sets `persist = action != null`, so a snackbar with an action ignores its `duration`.

`item_sheet.dart` (line 29) and `manual_add_screen.dart` (line 52):
```dart
// Before
SnackBar(
  content: Text(message),
  duration: const Duration(seconds: 10),
  action: ...

// After
SnackBar(
  content: Text(message),
  duration: const Duration(seconds: 10),
  persist: false,
  action: ...
```

**Verified by:** "the Undo offer ends after 10 s", "the Undo offer after adding an item ends after 10 s".

### D-04 Raw errors shown to users

**What happened:** When loading failed, the screen showed `SocketException: Failed host lookup: api.elha2.app`, with no way to recover.

**Cause:** Three screens printed the exception directly.

`features/pantry/pantry_screen.dart:34`, `features/shell/home_tab.dart:22` and `features/pantry/manual_add_screen.dart:71`:
```dart
// Before
error: (e, _) => Center(child: Text('$e')),

// After (the Add screen retries catalogueProvider)
error: (_, _) => LoadError(onRetry: () => ref.invalidate(pantryProvider)),
```

`LoadError` is a new shared widget in `features/common/widgets.dart`. It shows an icon, a plain message and a **Try again** button.

**Verified by:** "a load failure never shows raw exception text", "a load failure says how to fix it, and Try again recovers".

### D-05 Second push banner disappeared early

**What happened:** If a second push arrived 5 s after the first, the new banner vanished about 3 s after it appeared.

**Cause:** Each banner started its own 8 s timer, and the timer hid whichever banner was showing.

`features/notifications/push_banner.dart` (line 58):
```dart
// Before
Future<void>.delayed(const Duration(seconds: 8), () {
  if (messengerKey.currentState?.mounted ?? false) messenger.hideCurrentMaterialBanner();
});

// After
Timer? _hideBanner;
...
_hideBanner?.cancel();
...
_hideBanner = Timer(const Duration(seconds: 8), () {
  if (messengerKey.currentState?.mounted ?? false) messenger.hideCurrentMaterialBanner();
});
```

**Verified by:** "a second push keeps its full 8 s on screen".

### D-06 No pickup notification

**What happened:** US-11.01 names expiry digests, reservations and pickups, but only the first two existed.

`data/models.dart:205`:
```dart
// Before
enum NotificationType { expiryDigest, reservation }

// After
enum NotificationType { expiryDigest, reservation, pickup }
```

`data/mock/mock_services.dart:173`:
```dart
// Before
deepLink: type == NotificationType.expiryDigest ? '/pantry' : '/deals',

// After
deepLink: switch (type) {
  NotificationType.expiryDigest => '/pantry',
  NotificationType.reservation || NotificationType.pickup => '/deals',
},
```

Also added: the pickup text in `push_banner.dart`, a **Send pickup push** demo tile in `features/profile/settings_screen.dart`, and the strings in section 4. Pickup opens Deals for now, because the order screen arrives in Sprint 2.

**Verified by:** "a pickup push shows its own text and opens Deals", plus unit tests on the types and deep links.

### D-07 Orange label too faint

**What happened:** Orange on its soft background measured 4.05:1, and WCAG AA needs 4.5:1 for small text. Red and green already passed.

`app/theme.dart:10` and `apps/portal/src/index.css:12` (the palette is shared):
```dart
// Before
static const orange = Color(0xFFB85C12);

// After
static const orange = Color(0xFFA8520F);
```

**Verified by:** "orange urgency label meets the WCAG AA ratio of 4.5:1 for small text". The portal's value changed to match, and its 19 tests pass.

### D-08 Guessed dates not marked as estimated

**What happened:** A typed item's automatic 3-day date was saved as `userSet`, so a guess looked as if the user had chosen it. Unknown receipt lines the user named behaved the same way.

`state/pantry.dart` (lines 52 and 80):
```dart
// Before
expirySource: ExpirySource.userSet,
expirySource: byId[d.catalogueId] != null ? ExpirySource.estimated : ExpirySource.userSet,

// After, in both places
expirySource: ExpirySource.estimated,
```

The comment on `addCustom` also claimed "the user can change" the date, which was untrue, so it was corrected.

**Verified by:** "the 3-day guess for a typed item is marked as estimated", which also checks that the item sheet shows the label.

### D-09 Open left the push unread

**What happened:** Tapping **Open** on a banner left the notification unread. The bell only refreshed when navigation happened to rebuild it.

**Cause:** The banner never called `markRead`, and `markRead` told nobody that anything had changed.

`features/notifications/push_banner.dart` and `main.dart`:
```dart
// Before
showPushBanner(_messengerKey, n, ref.read(routerProvider));

// After
showPushBanner(_messengerKey, n, ref.read(routerProvider), onOpen: () => notifications.markRead(n.id));
```

`data/repositories.dart` gained a stream that `MockNotificationService` fires on every change:
```dart
Stream<void> get changes;
```

`features/shell/home_shell.dart:25` and `features/notifications/notifications_screen.dart:25`:
```dart
// Before
stream: notifications.incoming,

// After
stream: notifications.changes,
```

`markRead` now also ignores a notification that is already read, so its first read time is kept. **The real FCM adapter must implement `changes` too.**

**Verified by:** "opening a push from the banner marks it read", "the bell clears even when Open stays on the same tab", and the unit test on change events.

### D-10 Left/right padding on the item sheet

`features/pantry/item_sheet.dart:48`:
```dart
// Before
padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),

// After
padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 16),
```

The left and right values are equal, so nothing looks different. **Verified by:** static analysis and the existing item sheet tests.

### D-11 Left/right padding on the pantry screen

`features/pantry/pantry_screen.dart` (lines 45 and 86), already committed in `7e987fb`:
```dart
// Before
padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),

// After
padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 4),
padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 0),
```

The left and right values are equal, so nothing looks different. **Verified by:** static analysis and the view-pantry tests.

## 3. Every file changed

| File | Lines (+/−) | Issues |
|---|---|---|
| `apps/mobile/lib/app/theme.dart` | 1 / 1 | D-07 |
| `apps/mobile/lib/core/expiry_rules.dart` | 8 / 4 | D-01 |
| `apps/mobile/lib/data/mock/mock_data.dart` | 3 / 2 | D-01 |
| `apps/mobile/lib/data/mock/mock_services.dart` | 11 / 2 | D-06, D-09 |
| `apps/mobile/lib/data/models.dart` | 1 / 1 | D-06 |
| `apps/mobile/lib/data/repositories.dart` | 3 / 0 | D-09 |
| `apps/mobile/lib/features/common/widgets.dart` | 35 / 0 | D-02, D-04 |
| `apps/mobile/lib/features/notifications/notifications_screen.dart` | 1 / 1 | D-09 |
| `apps/mobile/lib/features/notifications/push_banner.dart` | 11 / 3 | D-05, D-06, D-09 |
| `apps/mobile/lib/features/pantry/item_sheet.dart` | 32 / 16 | D-02, D-03, D-10 |
| `apps/mobile/lib/features/pantry/manual_add_screen.dart` | 27 / 6 | D-02, D-03, D-04 |
| `apps/mobile/lib/features/pantry/pantry_screen.dart` | 1 / 1 | D-04 |
| `apps/mobile/lib/features/profile/settings_screen.dart` | 5 / 0 | D-06 |
| `apps/mobile/lib/features/shell/home_shell.dart` | 1 / 1 | D-09 |
| `apps/mobile/lib/features/shell/home_tab.dart` | 1 / 1 | D-04 |
| `apps/mobile/lib/l10n/app_ar.arb` | 6 / 0 | D-02, D-04, D-06 |
| `apps/mobile/lib/l10n/app_en.arb` | 6 / 0 | D-02, D-04, D-06 |
| `apps/mobile/lib/main.dart` | 3 / 2 | D-09 |
| `apps/mobile/lib/state/pantry.dart` | 5 / 7 | D-01, D-08 |
| `apps/portal/src/index.css` | 1 / 1 | D-07 |
| `docs/sprints/sprint-1-demo.md` | updated | Test count, pickup push, re-test note |

The line counts above do not include D-11, which is in commit `7e987fb`.

## 4. New text

The Arabic has not yet been reviewed by a native speaker.

| Key | English | Arabic |
|---|---|---|
| `saveFailed` | That didn't save. Check your connection and try again. | ما اتحفظش. اتأكد من النت وجرّب تاني. |
| `loadFailed` | We couldn't load this. Check your connection and try again. | ما قدرناش نحمّل البيانات. اتأكد من النت وجرّب تاني. |
| `retry` | Try again | جرّب تاني |
| `pushPickupTitle` | Your pickup window ends soon | وقت الاستلام قرب يخلص |
| `pushPickupBody` | Collect your bag from Sun Bakery before 10 pm. Code 4821. | استلم شنطتك من مخبز الشمس قبل ١٠ بالليل. الكود 4821. |
| `sendPickupPush` | Send pickup push | ابعت إشعار استلام |

## 5. Tests added

All files are under `apps/mobile/test/`. The 39 existing tests were not changed, and they all still pass.

| File | Tests | Covers |
|---|---|---|
| `unit/pantry_rules_test.dart` | 28 | Urgency boundaries, grouping, sorting, search, expiry estimate |
| `unit/pantry_controller_test.dart` | 18 | Adding, thrown-away reasons, Undo, reset |
| `unit/notification_service_test.dart` | 10 | Delivery, deep links, read state, change events |
| `unit/content_test.dart` | 17 | Arabic and English text parity, food catalogue |
| `integration/view_pantry_test.dart` | 28 | US-2.11 through the whole app |
| `integration/add_item_test.dart` | 14 | US-2.07 through the whole app |
| `integration/thrown_away_test.dart` | 12 | US-2.10 through the whole app |
| `integration/push_notifications_test.dart` | 14 | US-11.01 (simulated) through the whole app |
| `defects/srs_gaps_test.dart` | 31 | Regression tests for this log, and accessibility |
| `support/harness.dart` | not a test | Shared helpers that start the app and sign in |

## 6. Problems in the tests themselves

These were mistakes in the new tests or the test setup, not app bugs. They are listed so the first-run numbers make sense: the first full run showed 21 failures, and only 10 of those were real.

| Problem | Effect | Fix |
|---|---|---|
| The test copy of the project had no `fixtures/` folder at the expected depth | `pii_masker_test.dart` failed to load, which looked like a broken existing test | Copied at the same folder depth; all 23 tests pass |
| The third filter chip starts off screen, so the tap missed | 2 false failures | The test scrolls the chip into view first |
| `tester.pageBack()` could not find a back button | 1 false failure | The test uses the router instead |
| 200% text tests enlarged the text before sign-in, so they stuck on the location screen | 6 false failures, and 2 banner tests passed without proving anything | Sign in first, then enlarge the text; the banner test now checks that the banner exists |
| The pixel-based contrast check misread screens, reporting 2.16:1 for dark text on white | 2 false failures that hid the real result | Replaced with exact contrast maths on the colour values, which confirmed D-07 |
| An unneeded typedef and import in the defects test file | Clutter | Removed |

## 7. Tooling problems

| Problem | Cause | What was done |
|---|---|---|
| Flutter, Dart and git were not on PATH | Flutter is not installed on this machine | Used a checksum-verified Flutter 3.47.8 in a temporary folder and GitHub Desktop's git; nothing was installed on the system |
| `flutter pub get` failed with an `arb-dir` error | OneDrive marks folders read-only, and Flutter treats that as not writable | Ran the tests on a copy outside OneDrive; OneDrive settings were not changed |
| `flutter analyze` failed | A path in the temporary SDK folder exceeded the 260-character Windows limit | Ran `dart analyze`, which uses the same analyzer |
| The failed `pub get` left `.dart_tool` in the project, pointing at a temporary cache | A side effect of the first attempt | Removed |
| `flutter test --platform chrome` hung in Edge | Not diagnosed | Stopped after 10 minutes. The production web build was later driven in real Edge instead (see `sprint-1-srs-compliance.md`) |

## 8. Not fixed

These are not covered by this log. Details and reasons are in [`sprint-1-test-report.md`](sprint-1-test-report.md).

- **Section 6, code still open:** real FCM delivery (**US-11.01 cannot pass acceptance without it**), pantry-based push text, offline storage, the `/pantry/items` backend route, editing the expiry date, the help link and offline banner, Hijri dates and Africa/Cairo times, `fromLTRB` in `receipt_review_screen.dart`, and error handling on the receipt "Confirm all".
- **Section 7, SRS corrections:** ten suggested changes for the team to decide on in v1.2.

## 9. Before merging

- Run `flutter pub get` and `flutter test`, outside OneDrive if needed, and expect 211 passing.
- Do one manual run on a real phone.
- Have the new Arabic text reviewed.
- Retake any screenshots that show the old orange.

---
*This log was drafted with Claude (Anthropic), which also wrote the fixes and tests. The team reviews and owns the changes.*
