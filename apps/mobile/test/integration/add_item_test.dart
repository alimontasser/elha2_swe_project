import 'package:elha2/app/router.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/state/pantry.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

Future<void> openManualAdd(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('addFood')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('captureManual')));
  await tester.pumpAndSettle();
}

Future<void> type(WidgetTester tester, String text) async {
  await tester.enterText(find.byKey(const Key('manualSearch')), text);
  await tester.pumpAndSettle();
}

Future<void> back(WidgetTester tester, ProviderContainer container) async {
  container.read(routerProvider).pop();
  await tester.pumpAndSettle();
}

List<PantryItem> items(ProviderContainer c) => c.read(pantryProvider).requireValue;

void main() {
  group('US-2.07 add an item manually', () {
    testWidgets('three taps: Add food, Type it, the item', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      final before = items(container).length;
      await tester.tap(find.byKey(const Key('addFood'))); // 1
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('captureManual'))); // 2
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('suggest-ful'))); // 3
      await tester.pumpAndSettle();
      expect(items(container), hasLength(before + 1));
      expect(items(container).last.catalogueId, 'ful');
    });

    testWidgets('the Add sheet offers all five capture methods with icon and text', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await tester.tap(find.byKey(const Key('addFood')));
      await tester.pumpAndSettle();
      for (final key in ['captureReceipt', 'captureManual', 'captureBarcode', 'capturePhoto', 'captureVoice']) {
        final tile = tester.widget<ListTile>(find.byKey(Key(key)));
        expect(tile.leading, isA<Icon>(), reason: key);
        expect(tile.title, isA<Text>(), reason: key);
      }
    });

    testWidgets('common items show before typing, with a default quantity', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await openManualAdd(tester);
      expect(find.text('حاجات متكررة · دوس للإضافة'), findsOneWidget);
      expect(find.byKey(const Key('suggest-baladi-bread')), findsOneWidget);
      expect(find.byKey(const Key('addCustom')), findsNothing);
      final subtitle = tester.widget<ListTile>(find.byKey(const Key('suggest-rice'))).subtitle! as Text;
      expect(subtitle.data, contains('Rice'));
      expect(subtitle.data, contains('الدولاب'));
    });

    for (final (query, id) in [('جبنه', 'white-cheese'), ('tomatoes', 'tomatoes'), ('TOMATOES', 'tomatoes')]) {
      testWidgets('autocomplete: "$query" suggests $id', (tester) async {
        await pumpApp(tester);
        await openPantry(tester);
        await openManualAdd(tester);
        await type(tester, query);
        expect(find.byKey(Key('suggest-$id')), findsOneWidget);
      });
    }

    testWidgets('a search result is added with the catalogue data and shows in the pantry', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await openManualAdd(tester);
      await type(tester, 'فول');
      await tester.tap(find.byKey(const Key('suggest-ful')));
      await tester.pumpAndSettle();
      final added = items(container).last;
      expect(added.expirySource, ExpirySource.estimated);
      expect(added.addedBy, CaptureMethod.manual);
      expect(tester.widget<TextField>(find.byKey(const Key('manualSearch'))).controller!.text, isEmpty);
      await back(tester, container);
      expect(find.byKey(Key('pantry-${added.id}')), findsOneWidget);
    });

    testWidgets('food outside the catalogue can be added as typed', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await openManualAdd(tester);
      await type(tester, 'كنافة بالمانجا');
      await tester.tap(find.byKey(const Key('addCustom')));
      await tester.pumpAndSettle();
      expect(items(container).last.nameAr, 'كنافة بالمانجا');
      await back(tester, container);
      expect(find.text('كنافة بالمانجا'), findsOneWidget);
    });

    testWidgets('spaces alone cannot create an item', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await openManualAdd(tester);
      await type(tester, '    ');
      expect(find.byKey(const Key('addCustom')), findsNothing);
    });

    testWidgets('surrounding spaces are not saved in the name', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await openManualAdd(tester);
      await type(tester, '  كنافة  ');
      await tester.tap(find.byKey(const Key('addCustom')));
      await tester.pumpAndSettle();
      expect(items(container).last.nameAr, 'كنافة');
    });

    testWidgets('Undo removes the item again', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      final before = items(container).length;
      await openManualAdd(tester);
      await tester.tap(find.byKey(const Key('suggest-ful')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('تراجع'));
      await tester.pumpAndSettle();
      expect(items(container), hasLength(before));
    });

    testWidgets('several items can be added in one visit', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      final before = items(container).length;
      await openManualAdd(tester);
      await tester.tap(find.byKey(const Key('suggest-ful')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('suggest-pasta')));
      await tester.pumpAndSettle();
      expect(items(container), hasLength(before + 2));
      expect(find.text('اتضاف مكرونة'), findsOneWidget);
    });

    testWidgets('works in English', (tester) async {
      final container = await pumpApp(tester);
      container.read(settingsProvider.notifier).setLanguage('en');
      await tester.pumpAndSettle();
      await openPantry(tester, tab: 'Pantry');
      await openManualAdd(tester);
      await type(tester, 'tomatoes');
      await tester.tap(find.byKey(const Key('suggest-tomatoes')));
      await tester.pumpAndSettle();
      expect(find.text('Tomatoes added'), findsOneWidget);
    });

    testWidgets('unavailable capture methods are disabled and say which sprint', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await tester.tap(find.byKey(const Key('addFood')));
      await tester.pumpAndSettle();
      expect(tester.widget<ListTile>(find.byKey(const Key('captureBarcode'))).enabled, isFalse);
      expect(find.text('سبرنت 2'), findsOneWidget);
    });
  });
}
