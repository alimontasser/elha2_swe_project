// Regression tests for the Sprint 1 defects in docs/sprints/sprint-1-test-report.md. Each test states
// what the SRS requires; a failure here means a product defect has come back.
import 'dart:io';

import 'package:elha2/app/router.dart';
import 'package:elha2/app/theme.dart';
import 'package:elha2/core/expiry_rules.dart';
import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/state/pantry.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

/// A repository with network-like delay, as the real API adapter will have.
class SlowPantryRepository extends InMemoryPantryRepository {
  SlowPantryRepository(this.delay);

  final Duration delay;

  @override
  Future<PantryItem> update(PantryItem item) async {
    await Future<void>.delayed(delay);
    return super.update(item);
  }

  @override
  Future<void> delete(String id) async {
    await Future<void>.delayed(delay);
    return super.delete(id);
  }
}

class FailingLoadRepository extends InMemoryPantryRepository {
  @override
  Future<List<PantryItem>> items() async => throw const SocketException('Failed host lookup: api.elha2.app');
}

class FailingSaveRepository extends InMemoryPantryRepository {
  @override
  Future<PantryItem> update(PantryItem item) async => throw const SocketException('Failed host lookup: api.elha2.app');

  @override
  Future<PantryItem> add(PantryItem item) async => throw const SocketException('Failed host lookup: api.elha2.app');
}

/// The first load fails, then the connection comes back.
class FailsOnceRepository extends InMemoryPantryRepository {
  var _failed = false;

  @override
  Future<List<PantryItem>> items() async {
    if (_failed) return super.items();
    _failed = true;
    throw const SocketException('Failed host lookup: api.elha2.app');
  }
}

/// The save works, then the connection drops before the user taps Undo.
class FailingUndoRepository extends InMemoryPantryRepository {
  var _saves = 0;

  @override
  Future<PantryItem> update(PantryItem item) async {
    if (_saves++ > 0) throw const SocketException('Failed host lookup: api.elha2.app');
    return super.update(item);
  }
}

Future<void> loadCairoFont() async {
  ByteData read(String p) => ByteData.sublistView(File(p).readAsBytesSync());
  final loader = FontLoader('Cairo')
    ..addFont(Future.value(read('assets/fonts/Cairo-Regular.ttf')))
    ..addFont(Future.value(read('assets/fonts/Cairo-Bold.ttf')));
  await loader.load();
}

void main() {
  group('Daylight saving (Egypt observes it; run with an Egyptian time zone)', () {
    const tomatoes = CatalogueItem(
      id: 'tomatoes',
      nameAr: 'طماطم',
      nameEn: 'Tomatoes',
      category: FoodCategory.produce,
      unit: Unit.kg,
      defaultQuantity: 1,
      defaultStorage: StoragePlace.fridge,
      shelfLifeDays: {StoragePlace.fridge: 7},
    );

    test('US-2.07: a 7-day item bought on 25 Oct 2026 expires on 1 Nov', () {
      final d = estimateExpiry(tomatoes, StoragePlace.fridge, DateTime(2026, 10, 25));
      expect((d.year, d.month, d.day), (2026, 11, 1));
    });

    test('US-2.11: 25 Apr 2026 is 2 days after 23 Apr', () {
      expect(daysUntil(DateTime(2026, 4, 25), DateTime(2026, 4, 23)), 2);
    });

    test('US-2.11: an item 4 days away across the clock change is "later"', () {
      expect(urgencyOf(DateTime(2026, 4, 27), DateTime(2026, 4, 23)), Urgency.later);
    });
  });

  group('SRS 3.1 and US-2.10: 10 s undo', () {
    testWidgets('the Undo offer ends after 10 s', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await throwAway(tester, 'bananas');
      expect(find.text('تراجع'), findsOneWidget);
      await tester.pump(const Duration(seconds: 11));
      await tester.pumpAndSettle();
      expect(find.text('تراجع'), findsNothing);
    });

    testWidgets('the Undo offer after adding an item ends after 10 s', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await tester.tap(find.byKey(const Key('addFood')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('captureManual')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('suggest-ful')));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 9));
      expect(find.text('تراجع'), findsOneWidget);
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.text('تراجع'), findsNothing);
    });

    testWidgets('Undo still appears when saving takes 1 s (real network)', (tester) async {
      await pumpApp(tester, pantry: SlowPantryRepository(const Duration(seconds: 1)));
      await openPantry(tester);
      await openItem(tester, 'bananas');
      await tester.tap(find.byKey(const Key('markWasted')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('waste-spoiled')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('saveWaste')));
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.text('تراجع'), findsOneWidget);
    });

    testWidgets('leaving the Add screen while the save is running does not crash', (tester) async {
      final c = await pumpApp(tester, pantry: _SlowAdd());
      await openPantry(tester);
      await tester.tap(find.byKey(const Key('addFood')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('captureManual')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('suggest-ful')));
      await tester.pump(const Duration(milliseconds: 100));
      c.read(routerProvider).pop();
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });
  });

  group('SRS 3.1 error messages', () {
    testWidgets('a load failure never shows raw exception text', (tester) async {
      await pumpApp(tester, pantry: FailingLoadRepository());
      await openPantry(tester);
      expect(find.textContaining('SocketException'), findsNothing);
      expect(find.textContaining('api.elha2.app'), findsNothing);
    });

    testWidgets('a failed save tells the user', (tester) async {
      await pumpApp(tester, pantry: FailingSaveRepository());
      await openPantry(tester);
      await throwAway(tester, 'bananas');
      expect(find.text('ما اتحفظش. اتأكد من النت وجرّب تاني.'), findsOneWidget);
      expect(find.text('تراجع'), findsNothing);
      expect(find.byKey(const Key('pantry-bananas')), findsOneWidget);
    });

    testWidgets('a failed add tells the user', (tester) async {
      await pumpApp(tester, pantry: FailingSaveRepository());
      await openPantry(tester);
      await tester.tap(find.byKey(const Key('addFood')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('captureManual')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('suggest-ful')));
      await tester.pumpAndSettle();
      expect(find.text('ما اتحفظش. اتأكد من النت وجرّب تاني.'), findsOneWidget);
    });

    testWidgets('a failed Undo tells the user', (tester) async {
      await pumpApp(tester, pantry: FailingUndoRepository());
      await openPantry(tester);
      await throwAway(tester, 'bananas');
      await tester.tap(find.text('تراجع'));
      await tester.pumpAndSettle();
      expect(find.text('ما اتحفظش. اتأكد من النت وجرّب تاني.'), findsOneWidget);
    });

    testWidgets('a load failure says how to fix it, and Try again recovers', (tester) async {
      await pumpApp(tester, pantry: FailsOnceRepository());
      await openPantry(tester);
      expect(find.text('ما قدرناش نحمّل البيانات. اتأكد من النت وجرّب تاني.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('retryLoad')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantry-milk')), findsOneWidget);
    });
  });

  group('US-11.01 banner', () {
    testWidgets('a second push keeps its full 8 s on screen', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      final service = c.read(notificationServiceProvider);
      service.simulate(NotificationType.expiryDigest);
      await tester.pump();
      await tester.pump(const Duration(seconds: 5));
      service.simulate(NotificationType.reservation);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('الشنطة اتحجزت'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3)); // 4 s into the second banner
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('الشنطة اتحجزت'), findsOneWidget);
      await flushBannerTimer(tester);
    });

    testWidgets('reading a notification clears the bell', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      c.read(notificationServiceProvider).simulate(NotificationType.expiryDigest);
      await tester.pumpAndSettle();
      await flushBannerTimer(tester);
      await tester.tap(find.byTooltip('الإشعارات'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('٣ حاجات قربت تخلص'));
      await tester.pumpAndSettle();
      expect(tester.widget<Badge>(find.byType(Badge)).isLabelVisible, isFalse);
    });

    testWidgets('the bell clears even when Open stays on the same tab', (tester) async {
      final c = await pumpApp(tester);
      await openPantry(tester);
      c.read(notificationServiceProvider).simulate(NotificationType.expiryDigest);
      await tester.pumpAndSettle();
      expect(tester.widget<Badge>(find.byType(Badge)).isLabelVisible, isTrue);
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(tester.widget<Badge>(find.byType(Badge)).isLabelVisible, isFalse);
      await flushBannerTimer(tester);
    });

    testWidgets('opening a push from the banner marks it read', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      c.read(notificationServiceProvider).simulate(NotificationType.expiryDigest);
      await tester.pumpAndSettle();
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(c.read(notificationServiceProvider).history.single.readAt, isNotNull);
      await flushBannerTimer(tester);
    });
  });

  group('US-3.01 / UC-10 free-text items', () {
    testWidgets('the 3-day guess for a typed item is marked as estimated', (tester) async {
      final c = await pumpApp(tester);
      await openPantry(tester);
      final item = await c.read(pantryProvider.notifier).addCustom('كنافة');
      expect(item.expirySource, ExpirySource.estimated);
      await tester.pumpAndSettle();
      await openItem(tester, item.id);
      expect(find.textContaining('تقديري'), findsOneWidget);
    });
  });

  group('NFR-17 accessibility', () {
    for (final language in ['ar', 'en']) {
      final pantryTab = language == 'ar' ? 'المطبخ' : 'Pantry';

      // Signs in at normal size, then enlarges the text, so each test covers only its own screen.
      Future<ProviderContainer> start(WidgetTester tester) async {
        await tester.runAsync(loadCairoFont);
        final c = await pumpApp(tester, screen: phoneScreen);
        c.read(settingsProvider.notifier).setLanguage(language);
        await tester.pumpAndSettle();
        await signIn(tester);
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await tester.pumpAndSettle();
        return c;
      }

      testWidgets('[$language] pantry fits at 200% text', (tester) async {
        await start(tester);
        await tester.tap(find.text(pantryTab));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });

      testWidgets('[$language] item sheet and waste dialog fit at 200% text', (tester) async {
        await start(tester);
        await tester.tap(find.text(pantryTab));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('pantry-milk')));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.byKey(const Key('markWasted')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('markWasted')));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });

      testWidgets('[$language] add-by-hand fits at 200% text', (tester) async {
        await start(tester);
        await tester.tap(find.text(pantryTab));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('addFood')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('captureManual')));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });

      testWidgets('[$language] push banner fits at 200% text', (tester) async {
        final c = await start(tester);
        c.read(notificationServiceProvider).simulate(NotificationType.reservation);
        await tester.pumpAndSettle();
        expect(find.byType(MaterialBanner), findsOneWidget);
        expect(tester.takeException(), isNull);
        await flushBannerTimer(tester);
      });
    }

    Future<void> checkGuidelines(WidgetTester tester) async {
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    }

    // Worked out from the colours: the pixel-sampling textContrastGuideline misreads these screens
    // (it reported 2.16 for dark text on a white dialog).
    double contrast(Color a, Color b) {
      final (la, lb) = (a.computeLuminance(), b.computeLuminance());
      return (la > lb ? la + 0.05 : lb + 0.05) / (la > lb ? lb + 0.05 : la + 0.05);
    }

    for (final (name, fg, bg) in [
      ('red urgency label', Elha2Colors.red, Elha2Colors.redSoft),
      ('orange urgency label', Elha2Colors.orange, Elha2Colors.orangeSoft),
      ('green urgency label', Elha2Colors.green, Elha2Colors.greenSoft),
    ]) {
      test('$name meets the WCAG AA ratio of 4.5:1 for small text', () {
        expect(contrast(fg, bg), greaterThanOrEqualTo(4.5));
      });
    }

    testWidgets('pantry meets touch-target and label guidelines', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpApp(tester, screen: phoneScreen);
      await openPantry(tester);
      await checkGuidelines(tester);
      semantics.dispose();
    });

    testWidgets('add-by-hand meets touch-target and label guidelines', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpApp(tester, screen: phoneScreen);
      await openPantry(tester);
      await tester.tap(find.byKey(const Key('addFood')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('captureManual')));
      await tester.pumpAndSettle();
      await checkGuidelines(tester);
      semantics.dispose();
    });

    testWidgets('waste dialog meets touch-target and label guidelines', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpApp(tester, screen: tallScreen);
      await openPantry(tester);
      await openItem(tester, 'bananas');
      await tester.tap(find.byKey(const Key('markWasted')));
      await tester.pumpAndSettle();
      await checkGuidelines(tester);
      semantics.dispose();
    });
  });
}

class _SlowAdd extends InMemoryPantryRepository {
  @override
  Future<PantryItem> add(PantryItem item) async {
    await Future<void>.delayed(const Duration(seconds: 1));
    return super.add(item);
  }
}
