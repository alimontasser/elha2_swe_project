import 'package:elha2/app/labels.dart';
import 'package:elha2/app/theme.dart';
import 'package:elha2/core/expiry_rules.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

CatalogueItem food(String id, String ar, String en, {List<String> aliases = const []}) => CatalogueItem(
  id: id,
  nameAr: ar,
  nameEn: en,
  category: FoodCategory.dry,
  unit: Unit.piece,
  defaultQuantity: 1,
  defaultStorage: StoragePlace.cupboard,
  shelfLifeDays: const {StoragePlace.cupboard: 10},
  receiptAliases: aliases,
);

PantryItem item(String en, StoragePlace storage, DateTime expiry, {ItemStatus status = ItemStatus.inStock}) => PantryItem(
  id: en,
  nameAr: en,
  nameEn: en,
  category: FoodCategory.dry,
  quantity: 1,
  unit: Unit.piece,
  storage: storage,
  expiryDate: expiry,
  expirySource: ExpirySource.estimated,
  addedBy: CaptureMethod.manual,
  addedOn: expiry,
  status: status,
);

void main() {
  // Mid-November: no daylight-saving change nearby, so these isolate the rule itself.
  final now = DateTime(2026, 11, 10, 15);

  group('US-2.11 urgency boundaries', () {
    for (final (days, expected) in [
      (-30, Urgency.expired),
      (-1, Urgency.expired),
      (0, Urgency.today),
      (1, Urgency.soon),
      (3, Urgency.soon),
      (4, Urgency.later),
      (365, Urgency.later),
    ]) {
      test('$days days away is ${expected.name}', () {
        expect(urgencyOf(DateTime(2026, 11, 10 + days), now), expected);
      });
    }

    test('the time of day is ignored, only the calendar day counts', () {
      expect(daysUntil(DateTime(2026, 11, 11), DateTime(2026, 11, 10, 23, 59)), 1);
      expect(daysUntil(DateTime(2026, 11, 10, 0, 1), DateTime(2026, 11, 10, 23, 59)), 0);
    });

    test('counts across month and year ends', () {
      expect(daysUntil(DateTime(2026, 12, 1), DateTime(2026, 11, 30)), 1);
      expect(daysUntil(DateTime(2027, 1, 1), DateTime(2026, 12, 31)), 1);
    });
  });

  group('NFR-17 urgency is never colour alone', () {
    test('each colour level has its own icon', () {
      final icons = {urgencyStyle(Urgency.today).icon, urgencyStyle(Urgency.soon).icon, urgencyStyle(Urgency.later).icon};
      expect(icons, hasLength(3));
    });

    test('red, orange and green follow the SRS', () {
      expect(urgencyStyle(Urgency.today).fg, Elha2Colors.red);
      expect(urgencyStyle(Urgency.expired).fg, Elha2Colors.red);
      expect(urgencyStyle(Urgency.soon).fg, Elha2Colors.orange);
      expect(urgencyStyle(Urgency.later).fg, Elha2Colors.green);
    });
  });

  group('US-2.11 expiry text', () {
    final en = lookupAppLocalizations(const Locale('en'));
    final ar = lookupAppLocalizations(const Locale('ar'));
    DateTime inDays(int d) => DateTime(2026, 11, 10 + d);

    test('English', () {
      expect(expiryLabel(en, inDays(-1), now), 'Expired');
      expect(expiryLabel(en, inDays(0), now), 'Expires today');
      expect(expiryLabel(en, inDays(1), now), 'Expires tomorrow');
      expect(expiryLabel(en, inDays(5), now), 'Expires in 5 days');
    });

    test('Arabic uses the right plural form', () {
      expect(expiryLabel(ar, inDays(-1), now), 'خلصت صلاحيته');
      expect(expiryLabel(ar, inDays(0), now), 'بيخلص النهارده');
      expect(expiryLabel(ar, inDays(1), now), 'بيخلص بكرة');
      expect(expiryLabel(ar, inDays(2), now), 'بيخلص بعد يومين');
      expect(expiryLabel(ar, inDays(3), now), 'بيخلص بعد 3 أيام');
      expect(expiryLabel(ar, inDays(10), now), 'بيخلص بعد 10 أيام');
      expect(expiryLabel(ar, inDays(11), now), 'بيخلص بعد 11 يوم');
    });
  });

  group('US-2.11 grouping and "use first" order', () {
    test('every storage place is present, even when empty', () {
      final groups = groupPantry(const []);
      expect(groups.keys, StoragePlace.values);
      expect(groups.values.every((g) => g.isEmpty), isTrue);
    });

    test('items land in their own group, soonest expiry first', () {
      final groups = groupPantry([
        item('late', StoragePlace.fridge, DateTime(2026, 12, 1)),
        item('early', StoragePlace.fridge, DateTime(2026, 11, 11)),
        item('frozen', StoragePlace.freezer, DateTime(2027, 1, 1)),
      ]);
      expect(groups[StoragePlace.fridge]!.map((i) => i.id), ['early', 'late']);
      expect(groups[StoragePlace.freezer]!.map((i) => i.id), ['frozen']);
      expect(groups[StoragePlace.cupboard], isEmpty);
    });

    test('same expiry date sorts by name, so the order is stable', () {
      final d = DateTime(2026, 11, 20);
      final groups = groupPantry([item('b', StoragePlace.fridge, d), item('a', StoragePlace.fridge, d)]);
      expect(groups[StoragePlace.fridge]!.map((i) => i.id), ['a', 'b']);
    });

    test('used, donated and wasted items are hidden', () {
      final d = DateTime(2026, 11, 20);
      final groups = groupPantry([
        for (final s in ItemStatus.values) item(s.name, StoragePlace.fridge, d, status: s),
      ]);
      expect(groups[StoragePlace.fridge]!.map((i) => i.id), ['inStock']);
    });
  });

  group('US-2.07 expiry estimate', () {
    final tomatoes = CatalogueItem(
      id: 'tomatoes',
      nameAr: 'طماطم',
      nameEn: 'Tomatoes',
      category: FoodCategory.produce,
      unit: Unit.kg,
      defaultQuantity: 1,
      defaultStorage: StoragePlace.fridge,
      shelfLifeDays: const {StoragePlace.fridge: 7, StoragePlace.freezer: 100},
    );

    test('summer shortens by 20% at the month boundaries, the freezer never', () {
      expect(estimateExpiry(tomatoes, StoragePlace.fridge, DateTime(2026, 4, 1)), DateTime(2026, 4, 8));
      expect(estimateExpiry(tomatoes, StoragePlace.fridge, DateTime(2026, 5, 1)), DateTime(2026, 5, 6));
      expect(estimateExpiry(tomatoes, StoragePlace.fridge, DateTime(2026, 9, 1)), DateTime(2026, 9, 6));
      expect(estimateExpiry(tomatoes, StoragePlace.freezer, DateTime(2026, 7, 1)), DateTime(2026, 10, 9));
    });

    test('a 1-day item never drops to 0 days in summer', () {
      final fresh = CatalogueItem(
        id: 'x',
        nameAr: 'x',
        nameEn: 'x',
        category: FoodCategory.cooked,
        unit: Unit.piece,
        defaultQuantity: 1,
        defaultStorage: StoragePlace.fridge,
        shelfLifeDays: const {StoragePlace.fridge: 1},
      );
      expect(estimateExpiry(fresh, StoragePlace.fridge, DateTime(2026, 7, 1)), DateTime(2026, 7, 2));
    });
  });

  group('daysAfter', () {
    test('moves by calendar days and drops the time', () {
      expect(daysAfter(DateTime(2026, 11, 10, 15), 3), DateTime(2026, 11, 13));
      expect(daysAfter(DateTime(2026, 11, 10, 15), -2), DateTime(2026, 11, 8));
    });

    test('rolls over month and year ends', () {
      expect(daysAfter(DateTime(2026, 12, 30), 3), DateTime(2027, 1, 2));
      expect(daysAfter(DateTime(2028, 2, 28), 1), DateTime(2028, 2, 29));
    });
  });

  group('US-2.07 autocomplete', () {
    final catalogue = [
      food('white-cheese', 'جبنة بيضا', 'White cheese'),
      food('olive-oil', 'زيت زيتون', 'Olive oil', aliases: ['OIL OLV']),
      food('foil', 'ورق فويل', 'Foil'),
    ];

    test('blank input suggests nothing', () {
      expect(searchCatalogue(catalogue, '   '), isEmpty);
    });

    test('ignores case and surrounding spaces', () {
      expect(searchCatalogue(catalogue, '  WHITE ').single.id, 'white-cheese');
    });

    test('folds Arabic spelling variants and vowel marks', () {
      expect(searchCatalogue(catalogue, 'جبنه').single.id, 'white-cheese');
      expect(searchCatalogue(catalogue, 'جُبنة').single.id, 'white-cheese');
      expect(normaliseArabic('أإآ'), 'ااا');
      expect(normaliseArabic('مكرونة'), 'مكرونه');
      expect(normaliseArabic('مستشفى'), 'مستشفي');
    });

    test('matches the start of any word', () {
      expect(searchCatalogue(catalogue, 'زيتون').single.id, 'olive-oil');
      expect(searchCatalogue(catalogue, 'cheese').single.id, 'white-cheese');
    });

    test('word-start matches rank above matches inside a word', () {
      expect(searchCatalogue(catalogue, 'oil').map((c) => c.id), ['olive-oil', 'foil']);
    });

    test('unknown food finds nothing', () {
      expect(searchCatalogue(catalogue, 'xyz'), isEmpty);
    });

    test('caps the list at the limit', () {
      final many = [for (var i = 0; i < 20; i++) food('f$i', 'طعام $i', 'Food $i')];
      expect(searchCatalogue(many, 'food'), hasLength(8));
      expect(searchCatalogue(many, 'food', limit: 3), hasLength(3));
    });
  });
}
