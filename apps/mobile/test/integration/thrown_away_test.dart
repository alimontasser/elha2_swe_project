import 'package:elha2/data/models.dart';
import 'package:elha2/state/pantry.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

PantryItem find_(ProviderContainer c, String id) => c.read(pantryProvider).requireValue.firstWhere((i) => i.id == id);

Future<void> openDialog(WidgetTester tester, String id) async {
  await openItem(tester, id);
  await tester.tap(find.byKey(const Key('markWasted')));
  await tester.pumpAndSettle();
}

FilledButton saveButton(WidgetTester tester) => tester.widget<FilledButton>(find.byKey(const Key('saveWaste')));

void main() {
  group('US-2.10 record thrown-away food', () {
    testWidgets('the dialog offers the fixed reasons plus other', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await openDialog(tester, 'bananas');
      expect(find.text('اترمى ليه؟'), findsOneWidget);
      for (final label in ['باظ', 'نسيته', 'طبخت كتير', 'سبب تاني']) {
        expect(find.text(label), findsOneWidget);
      }
    });

    testWidgets('Save stays disabled until a reason is chosen', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await openDialog(tester, 'bananas');
      expect(saveButton(tester).onPressed, isNull);
      await tester.tap(find.byKey(const Key('waste-forgotten')));
      await tester.pumpAndSettle();
      expect(saveButton(tester).onPressed, isNotNull);
    });

    for (final (key, reason) in [
      ('spoiled', WasteReason.spoiled),
      ('forgotten', WasteReason.forgotten),
      ('cookedTooMuch', WasteReason.cookedTooMuch),
    ]) {
      testWidgets('saves $key and removes the item from the pantry', (tester) async {
        final container = await pumpApp(tester);
        await openPantry(tester);
        await throwAway(tester, 'bananas', reason: key);
        final saved = find_(container, 'bananas');
        expect(saved.status, ItemStatus.wasted);
        expect(saved.wasteReason, reason);
        expect(find.byKey(const Key('pantry-bananas')), findsNothing);
        expect(find.textContaining('نسبة الهدر'), findsOneWidget);
      });
    }

    testWidgets('"other" needs real text, which is saved trimmed', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await openDialog(tester, 'bananas');
      await tester.tap(find.byKey(const Key('waste-other')));
      await tester.pumpAndSettle();
      expect(saveButton(tester).onPressed, isNull);
      await tester.enterText(find.byType(TextField).last, '    ');
      await tester.pump();
      expect(saveButton(tester).onPressed, isNull);
      await tester.enterText(find.byType(TextField).last, '  وقع على الأرض ');
      await tester.pump();
      await tester.tap(find.byKey(const Key('saveWaste')));
      await tester.pumpAndSettle();
      final saved = find_(container, 'bananas');
      expect(saved.wasteReason, WasteReason.other);
      expect(saved.wasteNote, 'وقع على الأرض');
    });

    testWidgets('text typed for "other" is dropped if the user picks a fixed reason', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await openDialog(tester, 'bananas');
      await tester.tap(find.byKey(const Key('waste-other')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, 'وقع');
      await tester.pump();
      await tester.tap(find.byKey(const Key('waste-spoiled')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('saveWaste')));
      await tester.pumpAndSettle();
      expect(find_(container, 'bananas').wasteReason, WasteReason.spoiled);
      expect(find_(container, 'bananas').wasteNote, isNull);
    });

    testWidgets('Cancel changes nothing and returns to the item', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await openDialog(tester, 'bananas');
      await tester.tap(find.byKey(const Key('waste-spoiled')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('إلغاء'));
      await tester.pumpAndSettle();
      expect(find_(container, 'bananas').status, ItemStatus.inStock);
      expect(find.byKey(const Key('markWasted')), findsOneWidget);
    });

    testWidgets('Undo restores the item to the pantry with no reason', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      await throwAway(tester, 'bananas');
      await tester.tap(find.text('تراجع'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantry-bananas')), findsOneWidget);
      expect(find_(container, 'bananas').status, ItemStatus.inStock);
      expect(find_(container, 'bananas').wasteReason, isNull);
    });

    testWidgets('a thrown-away item also leaves Home "use these first"', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await throwAway(tester, 'bananas');
      await tester.tap(find.text('الرئيسية'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantry-bananas')), findsNothing);
      expect(find.byKey(const Key('pantry-milk')), findsOneWidget);
    });

    testWidgets('the search result updates after throwing the only match away', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await tester.enterText(find.byKey(const Key('pantrySearch')), 'موز');
      await tester.pumpAndSettle();
      await throwAway(tester, 'bananas');
      expect(find.text('مفيش أكل بالاسم ده.'), findsOneWidget);
    });

    testWidgets('works in English', (tester) async {
      final container = await pumpApp(tester);
      container.read(settingsProvider.notifier).setLanguage('en');
      await tester.pumpAndSettle();
      await openPantry(tester, tab: 'Pantry');
      await openDialog(tester, 'bananas');
      expect(find.text('Why was it thrown away?'), findsOneWidget);
      await tester.tap(find.text('Cooked too much'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('saveWaste')));
      await tester.pumpAndSettle();
      expect(find.textContaining('waste rate'), findsOneWidget);
    });
  });
}
