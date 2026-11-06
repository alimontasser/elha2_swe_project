import '../data/models.dart';

/// Rule-based expiry estimate (SDD v1.0 Algorithm 3, kept as the non-ML fallback in v1.1):
/// base shelf life for the storage place, shortened in the Egyptian summer outside the freezer.
/// The ML shelf-life model refines this in Sprint 2 (US-3.01).
DateTime estimateExpiry(CatalogueItem item, StoragePlace storage, DateTime purchasedOn, {double summerFactor = 0.8}) {
  var days = item.baseShelfLife(storage);
  final isSummer = purchasedOn.month >= 5 && purchasedOn.month <= 9;
  if (storage != StoragePlace.freezer && isSummer) {
    days = (days * summerFactor).floor().clamp(1, days);
  }
  return daysAfter(purchasedOn, days);
}

/// The calendar date [days] after [from]. Adding a Duration would land on the wrong day when
/// Egypt's clocks change, because that local day is 23 or 25 hours long.
DateTime daysAfter(DateTime from, int days) => DateTime(from.year, from.month, from.day + days);

enum Urgency { expired, today, soon, later }

/// US-2.11: red = expires today (or already expired), orange = within 3 days, green = later.
Urgency urgencyOf(DateTime expiry, DateTime now) {
  final days = daysUntil(expiry, now);
  if (days < 0) return Urgency.expired;
  if (days == 0) return Urgency.today;
  if (days <= 3) return Urgency.soon;
  return Urgency.later;
}

int daysUntil(DateTime expiry, DateTime now) {
  // UTC days are always 24 hours, so a clock change cannot shorten the count.
  final a = DateTime.utc(now.year, now.month, now.day);
  final b = DateTime.utc(expiry.year, expiry.month, expiry.day);
  return b.difference(a).inDays;
}

/// In-stock items grouped by storage place, each group sorted by expiry ("use first").
Map<StoragePlace, List<PantryItem>> groupPantry(Iterable<PantryItem> items) {
  final groups = {for (final s in StoragePlace.values) s: <PantryItem>[]};
  for (final item in items.where((i) => i.status == ItemStatus.inStock)) {
    groups[item.storage]!.add(item);
  }
  for (final list in groups.values) {
    list.sort((a, b) {
      final byDate = a.expiryDate.compareTo(b.expiryDate);
      return byDate != 0 ? byDate : a.nameEn.compareTo(b.nameEn);
    });
  }
  return groups;
}

/// Simple bilingual matching for autocomplete: prefix matches first, then contains.
List<CatalogueItem> searchCatalogue(List<CatalogueItem> catalogue, String query, {int limit = 8}) {
  final q = normaliseArabic(query.trim().toLowerCase());
  if (q.isEmpty) return const [];
  final prefix = <CatalogueItem>[];
  final contains = <CatalogueItem>[];
  for (final item in catalogue) {
    final names = [
      normaliseArabic(item.nameAr),
      item.nameEn.toLowerCase(),
      ...item.receiptAliases.map((a) => normaliseArabic(a.toLowerCase())),
    ];
    if (names.any((n) => n.startsWith(q) || n.split(' ').any((w) => w.startsWith(q)))) {
      prefix.add(item);
    } else if (names.any((n) => n.contains(q))) {
      contains.add(item);
    }
  }
  return [...prefix, ...contains].take(limit).toList();
}

/// Folds common Arabic spelling variants (أ/إ/آ → ا, ة → ه, ى → ي) so "جبنه" finds "جبنة".
String normaliseArabic(String s) =>
    s.replaceAll(RegExp('[أإآ]'), 'ا').replaceAll('ة', 'ه').replaceAll('ى', 'ي').replaceAll(RegExp(r'[\u064B-\u0652]'), '');
