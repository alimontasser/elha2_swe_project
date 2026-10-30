import 'package:elha2/core/expiry_rules.dart';
import 'package:elha2/core/phone.dart';
import 'package:elha2/data/mock/mock_data.dart';
import 'package:elha2/data/models.dart';
import 'package:flutter_test/flutter_test.dart';

const tomatoes = CatalogueItem(
  id: 'tomatoes',
  nameAr: 'طماطم',
  nameEn: 'Tomatoes',
  category: FoodCategory.produce,
  unit: Unit.kg,
  defaultQuantity: 1,
  defaultStorage: StoragePlace.fridge,
  shelfLifeDays: {StoragePlace.fridge: 7, StoragePlace.cupboard: 4},
  receiptAliases: ['TOM'],
);

void main() {
  final now = DateTime(2026, 10, 30, 15);

  test('urgency: red today or expired, orange within 3 days, green later (US-2.11)', () {
    expect(urgencyOf(DateTime(2026, 10, 29), now), Urgency.expired);
    expect(urgencyOf(DateTime(2026, 10, 30, 23), now), Urgency.today);
    expect(urgencyOf(DateTime(2026, 11, 2), now), Urgency.soon);
    expect(urgencyOf(DateTime(2026, 11, 3), now), Urgency.later);
  });

  test('pantry is grouped by storage place and sorted by expiry, in stock only', () {
    final items = seedPantry(now);
    final wasted = items.first.copyWith(status: ItemStatus.wasted);
    final groups = groupPantry([wasted, ...items.skip(1)]);
    expect(groups.keys, StoragePlace.values);
    for (final list in groups.values) {
      for (var i = 1; i < list.length; i++) {
        expect(list[i - 1].expiryDate.isAfter(list[i].expiryDate), isFalse);
      }
      expect(list.every((i) => i.status == ItemStatus.inStock), isTrue);
    }
    expect(groups.values.expand((g) => g).any((i) => i.id == wasted.id), isFalse);
  });

  test('expiry estimate uses storage place and the summer factor', () {
    expect(estimateExpiry(tomatoes, StoragePlace.fridge, DateTime(2026, 1, 10)), DateTime(2026, 1, 17));
    expect(estimateExpiry(tomatoes, StoragePlace.fridge, DateTime(2026, 7, 10)), DateTime(2026, 7, 15));
    // Unknown storage place falls back to the default storage place's shelf life.
    expect(estimateExpiry(tomatoes, StoragePlace.freezer, DateTime(2026, 1, 10)), DateTime(2026, 1, 17));
  });

  test('autocomplete finds Arabic spelling variants, English names and receipt aliases (US-2.07)', () {
    const cheese = CatalogueItem(
      id: 'white-cheese',
      nameAr: 'جبنة بيضا',
      nameEn: 'White cheese',
      category: FoodCategory.dairy,
      unit: Unit.kg,
      defaultQuantity: 0.5,
      defaultStorage: StoragePlace.fridge,
      shelfLifeDays: {StoragePlace.fridge: 14},
    );
    final catalogue = [tomatoes, cheese];
    expect(searchCatalogue(catalogue, 'جبنه').single.id, 'white-cheese');
    expect(searchCatalogue(catalogue, 'tom').single.id, 'tomatoes');
    expect(searchCatalogue(catalogue, 'cheese').single.id, 'white-cheese');
    expect(searchCatalogue(catalogue, ''), isEmpty);
  });

  test('Egyptian mobile numbers are normalised (US-1.01)', () {
    expect(normaliseEgyptianMobile('010 1234 5678'), '01012345678');
    expect(normaliseEgyptianMobile('+201123456789'), '01123456789');
    expect(normaliseEgyptianMobile('٠١٥١٢٣٤٥٦٧٨'), '01512345678');
    expect(normaliseEgyptianMobile('01312345678'), isNull);
    expect(normaliseEgyptianMobile('0223581234'), isNull);
  });

  test('digits switch between Western and Arabic-Indic', () {
    expect(localiseDigits('12 kg', arabicIndic: true), '١٢ kg');
    expect(localiseDigits('٣٠ أكتوبر', arabicIndic: false), '30 أكتوبر');
  });
}
