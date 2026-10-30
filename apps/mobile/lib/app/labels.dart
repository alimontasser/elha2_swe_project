import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/expiry_rules.dart';
import '../core/phone.dart';
import '../data/models.dart';
import '../l10n/gen/app_localizations.dart';
import '../state/settings.dart';

extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
  String get lang => Localizations.localeOf(this).languageCode;
}

String areaLabel(AppLocalizations l, Area a) => switch (a) {
  Area.newCairo => l.areaNewCairo,
  Area.maadi => l.areaMaadi,
  Area.zamalek => l.areaZamalek,
  Area.heliopolis => l.areaHeliopolis,
  Area.nasrCity => l.areaNasrCity,
  Area.dokki => l.areaDokki,
  Area.mohandessin => l.areaMohandessin,
  Area.sheikhZayed => l.areaSheikhZayed,
  Area.october => l.areaOctober,
  Area.downtown => l.areaDowntown,
};

String storageLabel(AppLocalizations l, StoragePlace s) => switch (s) {
  StoragePlace.fridge => l.storageFridge,
  StoragePlace.freezer => l.storageFreezer,
  StoragePlace.cupboard => l.storageCupboard,
};

IconData storageIcon(StoragePlace s) => switch (s) {
  StoragePlace.fridge => Icons.kitchen_outlined,
  StoragePlace.freezer => Icons.ac_unit,
  StoragePlace.cupboard => Icons.shelves,
};

String unitLabel(AppLocalizations l, Unit u) => switch (u) {
  Unit.piece => l.unitPiece,
  Unit.kg => l.unitKg,
  Unit.g => l.unitG,
  Unit.l => l.unitL,
  Unit.ml => l.unitMl,
  Unit.pack => l.unitPack,
  Unit.loaf => l.unitLoaf,
};

String categoryLabel(AppLocalizations l, FoodCategory c) => switch (c) {
  FoodCategory.bakery => l.catBakery,
  FoodCategory.produce => l.catProduce,
  FoodCategory.dairy => l.catDairy,
  FoodCategory.meat => l.catMeat,
  FoodCategory.cooked => l.catCooked,
  FoodCategory.dry => l.catDry,
  FoodCategory.drinks => l.catDrinks,
};

String wasteLabel(AppLocalizations l, WasteReason r) => switch (r) {
  WasteReason.spoiled => l.wasteSpoiled,
  WasteReason.forgotten => l.wasteForgotten,
  WasteReason.cookedTooMuch => l.wasteCookedTooMuch,
  WasteReason.other => l.wasteOther,
};

String expiryLabel(AppLocalizations l, DateTime expiry, DateTime now) {
  final days = daysUntil(expiry, now);
  if (days < 0) return l.expired;
  if (days == 0) return l.expiresToday;
  return l.expiresInDays(days);
}

/// Numbers follow the user's digit choice (Western or Arabic-Indic, US-1.02).
/// Use [Fmt.watch] in build methods and [Fmt.read] in callbacks.
class Fmt {
  Fmt._(this.context, this._arabicDigits);

  factory Fmt.watch(WidgetRef ref, BuildContext context) =>
      Fmt._(context, ref.watch(settingsProvider).arabicDigits && context.lang == 'ar');

  factory Fmt.read(WidgetRef ref, BuildContext context) => Fmt._(context, ref.read(settingsProvider).arabicDigits && context.lang == 'ar');

  final BuildContext context;
  final bool _arabicDigits;

  String digits(String s) => localiseDigits(s, arabicIndic: _arabicDigits);

  String qty(double q, Unit u) {
    final String n;
    if (q == q.roundToDouble()) {
      n = q.toInt().toString();
    } else {
      n = q.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
    }
    return digits('$n ${unitLabel(context.l10n, u)}');
  }

  String date(DateTime d) => digits(DateFormat.yMMMd(context.lang).format(d));

  String time(DateTime d) => digits(DateFormat.Hm(context.lang).format(d));
}
