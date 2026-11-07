// Domain models mirroring the SDD v1.1 data dictionary (PantryItem, FoodCatalogueItem,
// ReceiptDraft, Notification). Enumerations follow Figure 4.1.

enum StoragePlace { fridge, freezer, cupboard }

enum ItemStatus { inStock, used, donated, wasted }

enum ExpirySource { printed, estimated, userSet }

enum CaptureMethod { receipt, barcode, order, photo, voice, manual }

enum WasteReason { spoiled, forgotten, cookedTooMuch, other }

enum Unit { piece, kg, g, l, ml, pack, loaf }

enum FoodCategory { bakery, produce, dairy, meat, cooked, dry, drinks }

enum Area { newCairo, maadi, zamalek, heliopolis, nasrCity, dokki, mohandessin, sheikhZayed, october, downtown }

Unit unitFromJson(String raw) => switch (raw) {
  'L' || 'l' => Unit.l,
  'ml' => Unit.ml,
  'kg' => Unit.kg,
  'g' => Unit.g,
  'pack' => Unit.pack,
  'loaf' => Unit.loaf,
  _ => Unit.piece,
};

class CatalogueItem {
  const CatalogueItem({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.category,
    required this.unit,
    required this.defaultQuantity,
    required this.defaultStorage,
    required this.shelfLifeDays,
    this.receiptAliases = const [],
  });

  factory CatalogueItem.fromJson(Map<String, dynamic> json) => CatalogueItem(
    id: json['id'] as String,
    nameAr: json['nameAr'] as String,
    nameEn: json['nameEn'] as String,
    category: FoodCategory.values.byName(json['category'] as String),
    unit: unitFromJson(json['unit'] as String),
    defaultQuantity: (json['defaultQuantity'] as num).toDouble(),
    defaultStorage: StoragePlace.values.byName(json['defaultStorage'] as String),
    shelfLifeDays: {
      for (final e in (json['shelfLifeDays'] as Map<String, dynamic>).entries) StoragePlace.values.byName(e.key): (e.value as num).toInt(),
    },
    receiptAliases: [for (final a in json['receiptAliases'] as List) a as String],
  );

  final String id;
  final String nameAr;
  final String nameEn;
  final FoodCategory category;
  final Unit unit;
  final double defaultQuantity;
  final StoragePlace defaultStorage;
  final Map<StoragePlace, int> shelfLifeDays;
  final List<String> receiptAliases;

  String name(String languageCode) => languageCode == 'ar' ? nameAr : nameEn;

  /// Base shelf life for a storage place; falls back to the default storage place.
  int baseShelfLife(StoragePlace storage) => shelfLifeDays[storage] ?? shelfLifeDays[defaultStorage]!;
}

class PantryItem {
  const PantryItem({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.category,
    required this.quantity,
    required this.unit,
    required this.storage,
    required this.expiryDate,
    required this.expirySource,
    required this.addedBy,
    required this.addedOn,
    this.catalogueId,
    this.status = ItemStatus.inStock,
    this.wasteReason,
    this.wasteNote,
  });

  final String id;
  final String? catalogueId;
  final String nameAr;
  final String nameEn;
  final FoodCategory category;
  final double quantity;
  final Unit unit;
  final StoragePlace storage;
  final DateTime expiryDate;
  final ExpirySource expirySource;
  final CaptureMethod addedBy;
  final DateTime addedOn;
  final ItemStatus status;
  final WasteReason? wasteReason;
  final String? wasteNote;

  String name(String languageCode) => languageCode == 'ar' ? nameAr : nameEn;

  PantryItem copyWith({
    String? nameAr,
    String? nameEn,
    double? quantity,
    Unit? unit,
    StoragePlace? storage,
    DateTime? expiryDate,
    ExpirySource? expirySource,
    ItemStatus? status,
    WasteReason? wasteReason,
    String? wasteNote,
  }) => PantryItem(
    id: id,
    catalogueId: catalogueId,
    nameAr: nameAr ?? this.nameAr,
    nameEn: nameEn ?? this.nameEn,
    category: category,
    quantity: quantity ?? this.quantity,
    unit: unit ?? this.unit,
    storage: storage ?? this.storage,
    expiryDate: expiryDate ?? this.expiryDate,
    expirySource: expirySource ?? this.expirySource,
    addedBy: addedBy,
    addedOn: addedOn,
    status: status ?? this.status,
    wasteReason: wasteReason ?? this.wasteReason,
    wasteNote: wasteNote ?? this.wasteNote,
  );
}

/// One line of an AI-read receipt waiting for the user's review (ReceiptDraft.items).
class DraftItem {
  const DraftItem({
    required this.id,
    required this.sourceLine,
    required this.nameAr,
    required this.nameEn,
    required this.quantity,
    required this.unit,
    required this.category,
    required this.storage,
    required this.confidence,
    this.catalogueId,
    this.expiryDate,
  });

  final String id;
  final String sourceLine;
  final String? catalogueId;
  final String nameAr;
  final String nameEn;
  final double quantity;
  final Unit unit;
  final FoodCategory category;
  final StoragePlace storage;

  /// 0..1 as returned by the AI gateway.
  final double confidence;

  /// The backend's expiry estimate for this item, when the receipt was read by the backend.
  final DateTime? expiryDate;

  bool get isLowConfidence => confidence < 0.7;

  String name(String languageCode) => languageCode == 'ar' ? nameAr : nameEn;

  DraftItem copyWith({String? nameAr, String? nameEn, double? quantity, Unit? unit, StoragePlace? storage, double? confidence}) =>
      DraftItem(
        id: id,
        sourceLine: sourceLine,
        catalogueId: catalogueId,
        nameAr: nameAr ?? this.nameAr,
        nameEn: nameEn ?? this.nameEn,
        quantity: quantity ?? this.quantity,
        unit: unit ?? this.unit,
        category: category,
        storage: storage ?? this.storage,
        confidence: confidence ?? this.confidence,
        expiryDate: expiryDate,
      );
}

/// Result of the AI gateway call: items, or the non-AI fallback with the raw lines (NFR-22).
class ReceiptParseResult {
  const ReceiptParseResult({required this.items, required this.fallbackUsed, required this.maskedLines, this.draftId});

  /// The backend's draft (kept 24 h); "Confirm all" saves it through the backend. Null in the demo.
  final String? draftId;
  final List<DraftItem> items;
  final bool fallbackUsed;
  final List<String> maskedLines;
}

/// A sample receipt for the demo camera.
class SampleReceipt {
  const SampleReceipt({required this.id, required this.shopName, required this.ocrLines});

  final String id;
  final String shopName;
  final List<String> ocrLines;
}

enum NotificationType { expiryDigest, reservation, pickup }

class AppNotification {
  const AppNotification({required this.id, required this.type, required this.deepLink, required this.sentAt, this.readAt});

  final String id;
  final NotificationType type;
  final String deepLink;
  final DateTime sentAt;
  final DateTime? readAt;
}

class Session {
  const Session({required this.phone, this.area});

  final String phone;
  final Area? area;

  Session withArea(Area area) => Session(phone: phone, area: area);
}

/// US-4.02: one answer from the cooking assistant.
class AssistantReply {
  const AssistantReply({
    required this.answer,
    this.reheatingNote = '',
    this.onTopic = true,
    this.usedItems = const [],
    this.fallbackUsed = false,
    this.unreachable = false,
  });

  /// The assistant could not be reached at all; the screen shows its own message.
  const AssistantReply.unreachable() : this(answer: '', fallbackUsed: true, unreachable: true);

  final String answer;

  /// A reheating safety sentence for leftovers (NFR-07), or empty.
  final String reheatingNote;
  final bool onTopic;
  final List<String> usedItems;

  /// True when no AI answer was available and a simple rule-based suggestion was given (NFR-22).
  final bool fallbackUsed;
  final bool unreachable;
}
