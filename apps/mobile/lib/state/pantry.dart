import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/expiry_rules.dart';
import '../data/models.dart';
import '../data/providers.dart';

final catalogueProvider = FutureProvider<List<CatalogueItem>>((ref) => ref.watch(catalogueRepositoryProvider).all());

final _random = Random.secure();

/// A random UUID (v4): the backend stores items under the app's id, so Undo and retries hit the same row.
String newItemId() {
  final b = List<int>.generate(16, (_) => _random.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

String _newId() => newItemId();

class PantryController extends AsyncNotifier<List<PantryItem>> {
  @override
  Future<List<PantryItem>> build() => ref.read(pantryRepositoryProvider).items();

  Future<void> _refresh() async => state = AsyncData(await ref.read(pantryRepositoryProvider).items());

  /// US-2.07: add from the catalogue with its default quantity, storage place and estimated expiry.
  Future<PantryItem> addFromCatalogue(CatalogueItem c, {DateTime? now}) async {
    final today = now ?? DateTime.now();
    final item = PantryItem(
      id: _newId(),
      catalogueId: c.id,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      category: c.category,
      quantity: c.defaultQuantity,
      unit: c.unit,
      storage: c.defaultStorage,
      expiryDate: estimateExpiry(c, c.defaultStorage, today),
      expirySource: ExpirySource.estimated,
      addedBy: CaptureMethod.manual,
      addedOn: today,
    );
    await ref.read(pantryRepositoryProvider).add(item);
    await _refresh();
    return item;
  }

  /// A free-text item that is not in the catalogue: cupboard, one piece, a cautious 3-day estimate (US-3.01).
  Future<PantryItem> addCustom(String name) async {
    final today = DateTime.now();
    final item = PantryItem(
      id: _newId(),
      nameAr: name,
      nameEn: name,
      category: FoodCategory.dry,
      quantity: 1,
      unit: Unit.piece,
      storage: StoragePlace.cupboard,
      expiryDate: daysAfter(today, 3),
      expirySource: ExpirySource.estimated,
      addedBy: CaptureMethod.manual,
      addedOn: today,
    );
    await ref.read(pantryRepositoryProvider).add(item);
    await _refresh();
    return item;
  }

  /// US-2.02: the pantry items "Confirm all" will save, with an estimated expiry each
  /// (the backend's estimate when the receipt was read there).
  Future<List<({DraftItem draft, PantryItem item})>> itemsFromDrafts(List<DraftItem> drafts) async {
    final catalogue = await ref.read(catalogueRepositoryProvider).all();
    final today = DateTime.now();
    final byId = {for (final c in catalogue) c.id: c};
    return [
      for (final d in drafts)
        (
          draft: d,
          item: PantryItem(
            id: _newId(),
            catalogueId: d.catalogueId,
            nameAr: d.nameAr,
            nameEn: d.nameEn,
            category: d.category,
            quantity: d.quantity,
            unit: d.unit,
            storage: d.storage,
            expiryDate:
                d.expiryDate ?? (byId[d.catalogueId] != null ? estimateExpiry(byId[d.catalogueId]!, d.storage, today) : daysAfter(today, 3)),
            expirySource: ExpirySource.estimated,
            addedBy: CaptureMethod.receipt,
            addedOn: today,
          ),
        ),
    ];
  }

  /// US-2.02: "Confirm all" saves every reviewed draft item in one go.
  Future<int> confirmDraft(List<DraftItem> drafts) async {
    final items = await itemsFromDrafts(drafts);
    await addConfirmed([for (final i in items) i.item]);
    return items.length;
  }

  Future<void> addConfirmed(List<PantryItem> items) async {
    await ref.read(pantryRepositoryProvider).addAll(items);
    await _refresh();
  }

  /// US-2.10: thrown away with a reason from the fixed list (or "other" with a note).
  Future<void> markWasted(PantryItem item, WasteReason reason, {String? note}) async {
    await ref.read(pantryRepositoryProvider).update(item.copyWith(status: ItemStatus.wasted, wasteReason: reason, wasteNote: note));
    await _refresh();
  }

  Future<void> markUsed(PantryItem item) async {
    await ref.read(pantryRepositoryProvider).update(item.copyWith(status: ItemStatus.used));
    await _refresh();
  }

  Future<void> updateItem(PantryItem item) async {
    await ref.read(pantryRepositoryProvider).update(item);
    await _refresh();
  }

  Future<void> delete(String id) async {
    await ref.read(pantryRepositoryProvider).delete(id);
    await _refresh();
  }

  /// Undo for the last change (snackbar action).
  Future<void> restore(PantryItem previous) async {
    final repo = ref.read(pantryRepositoryProvider);
    final exists = (await repo.items()).any((i) => i.id == previous.id);
    exists ? await repo.update(previous) : await repo.add(previous);
    await _refresh();
  }

  /// The latest list from the backend, e.g. after it saved a receipt (no-op for the demo store).
  Future<void> reload() async {
    await ref.read(pantryRepositoryProvider).reload();
    await _refresh();
  }

  Future<void> reset() async {
    await ref.read(pantryRepositoryProvider).reset();
    await _refresh();
  }
}

final pantryProvider = AsyncNotifierProvider<PantryController, List<PantryItem>>(PantryController.new);
