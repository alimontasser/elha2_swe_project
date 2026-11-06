import 'package:elha2/app/theme.dart';
import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/state/pantry.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';

Finder tile(String id) => find.byKey(Key('pantry-$id'));

Future<void> search(WidgetTester tester, String text) async {
  await tester.enterText(find.byKey(const Key('pantrySearch')), text);
  await tester.pumpAndSettle();
}

Future<void> tapChip(WidgetTester tester, String label) async {
  // The chip row scrolls sideways; the last chip starts off screen.
  await tester.ensureVisible(find.widgetWithText(ChoiceChip, label));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(ChoiceChip, label));
  await tester.pumpAndSettle();
}

void main() {
  group('US-2.11 grouping and sorting', () {
    testWidgets('shows fridge, then freezer, then cupboard, soonest expiry first', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      expect(visiblePantryIds(tester), [
        'yogurt', 'milk', 'tomatoes', 'laban-rayeb', 'eggs', 'white-cheese', //
        'chicken-breast', 'peas-frozen',
        'baladi-bread', 'bananas', 'lentils', 'rice',
      ]);
    });

    testWidgets('each group header shows its name and item count', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      final fridge = find.ancestor(of: tile('milk'), matching: find.byType(Card));
      expect(find.descendant(of: fridge, matching: find.text('التلاجة')), findsOneWidget);
      expect(find.descendant(of: fridge, matching: find.text('6')), findsOneWidget);
    });
  });

  group('US-2.11 urgency: colour, icon and text', () {
    for (final (id, label, icon, colour) in [
      ('yogurt', 'خلصت صلاحيته', Icons.error_outline, Elha2Colors.red),
      ('milk', 'بيخلص النهارده', Icons.error_outline, Elha2Colors.red),
      ('tomatoes', 'بيخلص بعد يومين', Icons.schedule, Elha2Colors.orange),
      ('laban-rayeb', 'بيخلص بعد 3 أيام', Icons.schedule, Elha2Colors.orange),
      ('eggs', 'بيخلص بعد 9 أيام', Icons.check_circle_outline, Elha2Colors.green),
    ]) {
      testWidgets('$id shows "$label"', (tester) async {
        await pumpApp(tester);
        await openPantry(tester);
        expect(find.descendant(of: tile(id), matching: find.text(label)), findsOneWidget);
        expect(find.descendant(of: tile(id), matching: find.byIcon(icon)), findsOneWidget);
        final text = tester.widget<Text>(find.descendant(of: tile(id), matching: find.text(label)));
        expect(text.style?.color, colour);
      });
    }

    testWidgets('the colour legend is on screen', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      expect(find.textContaining('أحمر = النهارده'), findsOneWidget);
    });
  });

  group('US-2.11 search', () {
    for (final (query, expected) in [
      ('موز', ['bananas']),
      ('tomato', ['tomatoes']),
      ('TOMATO', ['tomatoes']),
      ('  موز  ', ['bananas']),
      ('جبنه', ['white-cheese']), // ة typed as ه
      ('لبن', ['milk', 'laban-rayeb']),
    ]) {
      testWidgets('"$query" finds $expected', (tester) async {
        await pumpApp(tester);
        await openPantry(tester);
        await search(tester, query);
        expect(visiblePantryIds(tester), expected);
      });
    }

    testWidgets('no match shows the no-results message', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await search(tester, 'بيتزا');
      expect(visiblePantryIds(tester), isEmpty);
      expect(find.text('مفيش أكل بالاسم ده.'), findsOneWidget);
    });

    testWidgets('clearing the search brings everything back', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await search(tester, 'موز');
      await search(tester, '');
      expect(visiblePantryIds(tester), hasLength(12));
    });
  });

  group('US-2.11 filter', () {
    for (final (label, count) in [('التلاجة', 6), ('الفريزر', 2), ('الدولاب', 4)]) {
      testWidgets('"$label" shows only its $count items', (tester) async {
        await pumpApp(tester);
        await openPantry(tester);
        await tapChip(tester, label);
        expect(visiblePantryIds(tester), hasLength(count));
      });
    }

    testWidgets('tapping the active filter again, or All, shows everything', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await tapChip(tester, 'الفريزر');
      await tapChip(tester, 'الفريزر');
      expect(visiblePantryIds(tester), hasLength(12));
      await tapChip(tester, 'الفريزر');
      await tapChip(tester, 'الكل');
      expect(visiblePantryIds(tester), hasLength(12));
    });

    testWidgets('search and filter combine', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await tapChip(tester, 'الفريزر');
      await search(tester, 'موز');
      expect(visiblePantryIds(tester), isEmpty);
      expect(find.text('مفيش أكل بالاسم ده.'), findsOneWidget);
      await tapChip(tester, 'الدولاب');
      expect(visiblePantryIds(tester), ['bananas']);
    });
  });

  group('US-2.11 states and languages', () {
    testWidgets('an empty pantry invites the user to add food', (tester) async {
      final repo = InMemoryPantryRepository();
      for (final i in await repo.items()) {
        await repo.delete(i.id);
      }
      await pumpApp(tester, pantry: repo);
      await openPantry(tester);
      expect(find.text('مطبخك فاضي. دوس على أضف أكل علشان تبدأ.'), findsOneWidget);
    });

    testWidgets('a pantry with only used items counts as empty', (tester) async {
      final repo = InMemoryPantryRepository();
      for (final i in await repo.items()) {
        await repo.update(i.copyWith(status: ItemStatus.used));
      }
      await pumpApp(tester, pantry: repo);
      await openPantry(tester);
      expect(find.text('مطبخك فاضي. دوس على أضف أكل علشان تبدأ.'), findsOneWidget);
    });

    testWidgets('Arabic is right to left: the icon sits on the right of the name', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      final icon = tester.getCenter(find.descendant(of: tile('eggs'), matching: find.byType(CircleAvatar)));
      final name = tester.getCenter(find.descendant(of: tile('eggs'), matching: find.text('بيض')));
      expect(icon.dx, greaterThan(name.dx));
    });

    testWidgets('English is left to right, with English names and labels', (tester) async {
      final container = await pumpApp(tester);
      container.read(settingsProvider.notifier).setLanguage('en');
      await tester.pumpAndSettle();
      await openPantry(tester, tab: 'Pantry');
      final icon = tester.getCenter(find.descendant(of: tile('eggs'), matching: find.byType(CircleAvatar)));
      final name = tester.getCenter(find.descendant(of: tile('eggs'), matching: find.text('Eggs')));
      expect(icon.dx, lessThan(name.dx));
      expect(find.descendant(of: tile('eggs'), matching: find.text('Expires in 9 days')), findsOneWidget);
    });

    testWidgets('the Arabic-Indic digit option applies to expiry and quantity', (tester) async {
      final container = await pumpApp(tester);
      await openPantry(tester);
      container.read(settingsProvider.notifier).setArabicDigits(true);
      await tester.pumpAndSettle();
      expect(find.descendant(of: tile('eggs'), matching: find.text('بيخلص بعد ٩ أيام')), findsOneWidget);
      expect(find.descendant(of: tile('eggs'), matching: find.text('١٠ قطعة')), findsOneWidget);
    });

    testWidgets('tapping a row shows the item details', (tester) async {
      await pumpApp(tester);
      await openPantry(tester);
      await openItem(tester, 'tomatoes');
      expect(find.text('الكمية'), findsOneWidget);
      expect(find.text('1 كجم'), findsWidgets);
      expect(find.text('فاكهة وخضار'), findsOneWidget);
      expect(find.textContaining('تقديري'), findsOneWidget);
    });

    testWidgets('a change made elsewhere reaches the pantry and Home', (tester) async {
      final container = await pumpApp(tester);
      await signIn(tester);
      expect(tile('milk'), findsOneWidget); // Home "use these first"
      final milk = container.read(pantryProvider).requireValue.firstWhere((i) => i.id == 'milk');
      await container.read(pantryProvider.notifier).markUsed(milk);
      await tester.pumpAndSettle();
      expect(tile('milk'), findsNothing);
      await tester.tap(find.text('المطبخ'));
      await tester.pumpAndSettle();
      expect(tile('milk'), findsNothing);
    });
  });
}
