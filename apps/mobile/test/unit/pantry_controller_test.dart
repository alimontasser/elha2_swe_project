import 'package:elha2/core/expiry_rules.dart';
import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/state/pantry.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const tomatoes = CatalogueItem(
  id: 'tomatoes',
  nameAr: 'طماطم',
  nameEn: 'Tomatoes',
  category: FoodCategory.produce,
  unit: Unit.kg,
  defaultQuantity: 1.5,
  defaultStorage: StoragePlace.fridge,
  shelfLifeDays: {StoragePlace.fridge: 7},
);

void main() {
  late InMemoryPantryRepository repo;
  late ProviderContainer container;
  late PantryController controller;

  List<PantryItem> state() => container.read(pantryProvider).requireValue;
  PantryItem byId(String id) => state().firstWhere((i) => i.id == id);

  setUp(() async {
    repo = InMemoryPantryRepository(clock: () => DateTime(2026, 11, 10, 15));
    container = ProviderContainer(overrides: [pantryRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(container.dispose);
    await container.read(pantryProvider.future);
    controller = container.read(pantryProvider.notifier);
  });

  test('starts from the repository contents', () async {
    expect(state().length, (await repo.items()).length);
  });

  group('US-2.07 add an item manually', () {
    test('uses the catalogue defaults and an estimated expiry', () async {
      final added = await controller.addFromCatalogue(tomatoes, now: DateTime(2026, 11, 10, 15));
      expect(added.catalogueId, 'tomatoes');
      expect(added.nameAr, 'طماطم');
      expect(added.nameEn, 'Tomatoes');
      expect(added.quantity, 1.5);
      expect(added.unit, Unit.kg);
      expect(added.storage, StoragePlace.fridge);
      expect(added.expiryDate, DateTime(2026, 11, 17));
      expect(added.expirySource, ExpirySource.estimated);
      expect(added.addedBy, CaptureMethod.manual);
      expect(added.status, ItemStatus.inStock);
    });

    test('is saved and published to the screens', () async {
      final before = state().length;
      final added = await controller.addFromCatalogue(tomatoes);
      expect(state(), hasLength(before + 1));
      expect((await repo.items()).any((i) => i.id == added.id), isTrue);
    });

    test('a free-text item goes in the cupboard as one piece, for 3 days', () async {
      final added = await controller.addCustom('كنافة');
      expect(added.catalogueId, isNull);
      expect(added.nameAr, 'كنافة');
      expect(added.nameEn, 'كنافة');
      expect(added.quantity, 1);
      expect(added.unit, Unit.piece);
      expect(added.storage, StoragePlace.cupboard);
      expect(added.addedBy, CaptureMethod.manual);
      expect(daysUntil(added.expiryDate, DateTime.now()), 3);
    });

    test('every add gets its own id, even in the same instant', () async {
      final ids = {for (var i = 0; i < 50; i++) (await controller.addFromCatalogue(tomatoes)).id};
      expect(ids, hasLength(50));
    });

    test('Undo removes the added item', () async {
      final before = state().length;
      final added = await controller.addFromCatalogue(tomatoes);
      await controller.delete(added.id);
      expect(state(), hasLength(before));
      expect(state().any((i) => i.id == added.id), isFalse);
    });
  });

  group('US-2.10 record thrown-away food', () {
    for (final reason in WasteReason.values) {
      test('stores the reason ${reason.name}', () async {
        await controller.markWasted(byId('milk'), reason, note: reason == WasteReason.other ? 'وقع' : null);
        final saved = (await repo.items()).firstWhere((i) => i.id == 'milk');
        expect(saved.status, ItemStatus.wasted);
        expect(saved.wasteReason, reason);
        expect(saved.wasteNote, reason == WasteReason.other ? 'وقع' : isNull);
      });
    }

    test('the fixed list is the SRS list plus other', () {
      expect(WasteReason.values.map((r) => r.name), ['spoiled', 'forgotten', 'cookedTooMuch', 'other']);
    });

    test('the record is kept for the waste rate, only hidden from the pantry', () async {
      final before = state().length;
      await controller.markWasted(byId('milk'), WasteReason.spoiled);
      expect(state(), hasLength(before));
      expect(groupPantry(state()).values.expand((g) => g).any((i) => i.id == 'milk'), isFalse);
    });

    test('touches no other item', () async {
      final others = state().where((i) => i.id != 'milk').map((i) => i.status).toList();
      await controller.markWasted(byId('milk'), WasteReason.forgotten);
      expect(state().where((i) => i.id != 'milk').map((i) => i.status), others);
    });

    test('keeps the quantity, name and expiry', () async {
      final original = byId('eggs');
      await controller.markWasted(original, WasteReason.spoiled);
      final saved = byId('eggs');
      expect(saved.quantity, original.quantity);
      expect(saved.nameAr, original.nameAr);
      expect(saved.expiryDate, original.expiryDate);
    });

    test('Undo puts the item back with no waste data', () async {
      final original = byId('milk');
      await controller.markWasted(original, WasteReason.other, note: 'وقع');
      await controller.restore(original);
      final restored = byId('milk');
      expect(restored.status, ItemStatus.inStock);
      expect(restored.wasteReason, isNull);
      expect(restored.wasteNote, isNull);
    });

    test('used is a different outcome and carries no reason', () async {
      await controller.markUsed(byId('milk'));
      expect(byId('milk').status, ItemStatus.used);
      expect(byId('milk').wasteReason, isNull);
    });
  });

  test('Undo after delete brings the item back', () async {
    final original = byId('rice');
    await controller.delete('rice');
    expect(state().any((i) => i.id == 'rice'), isFalse);
    await controller.restore(original);
    expect(byId('rice').status, ItemStatus.inStock);
  });

  test('reset returns to the seed data', () async {
    final before = state().length;
    await controller.addFromCatalogue(tomatoes);
    await controller.markWasted(byId('milk'), WasteReason.spoiled);
    await controller.reset();
    expect(state(), hasLength(before));
    expect(byId('milk').status, ItemStatus.inStock);
  });
}
