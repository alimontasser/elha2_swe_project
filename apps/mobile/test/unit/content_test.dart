import 'dart:convert';
import 'dart:io';

import 'package:elha2/core/expiry_rules.dart';
import 'package:elha2/data/models.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> arb(String lang) => jsonDecode(File('lib/l10n/app_$lang.arb').readAsStringSync()) as Map<String, dynamic>;

Iterable<String> keysOf(Map<String, dynamic> m) => m.keys.where((k) => !k.startsWith('@'));

Set<String> placeholders(String text) => RegExp(r'\{(\w+)[,}]').allMatches(text).map((m) => m[1]!).toSet();

void main() {
  group('Definition of Done: Arabic and English text', () {
    final ar = arb('ar');
    final en = arb('en');

    test('both languages have the same keys', () {
      expect(keysOf(ar).toSet(), keysOf(en).toSet());
    });

    test('no text is empty', () {
      for (final file in [ar, en]) {
        for (final k in keysOf(file)) {
          expect((file[k] as String).trim(), isNotEmpty, reason: k);
        }
      }
    });

    test('placeholders match between languages', () {
      for (final k in keysOf(en)) {
        expect(placeholders(ar[k] as String), placeholders(en[k] as String), reason: k);
      }
    });
  });

  group('US-2.07 food catalogue', () {
    final raw = jsonDecode(File('assets/catalogue.json').readAsStringSync()) as Map<String, dynamic>;
    final catalogue = [for (final e in raw['items'] as List) CatalogueItem.fromJson(e as Map<String, dynamic>)];
    final arabic = RegExp(r'[؀-ۿ]');

    test('ids are unique', () {
      expect(catalogue.map((c) => c.id).toSet(), hasLength(catalogue.length));
    });

    test('every entry has an Arabic and an English name', () {
      for (final c in catalogue) {
        expect(arabic.hasMatch(c.nameAr), isTrue, reason: c.id);
        expect(c.nameEn.trim(), isNotEmpty, reason: c.id);
      }
    });

    test('every entry has a default quantity and a shelf life for its default place', () {
      for (final c in catalogue) {
        expect(c.defaultQuantity, greaterThan(0), reason: c.id);
        expect(c.shelfLifeDays[c.defaultStorage], isNotNull, reason: c.id);
        expect(c.baseShelfLife(c.defaultStorage), greaterThan(0), reason: c.id);
      }
    });

    test('every entry can be estimated in every storage place', () {
      for (final c in catalogue) {
        for (final s in StoragePlace.values) {
          final d = estimateExpiry(c, s, DateTime(2026, 7, 1));
          expect(d.isAfter(DateTime(2026, 7, 1)), isTrue, reason: '${c.id} ${s.name}');
        }
      }
    });

    for (final term in ['عيش', 'فول', 'طعمية', 'ملوخية', 'جبنة', 'كشري', 'رز', 'tomato', 'bread', 'rice']) {
      test('common Egyptian food "$term" is suggested', () {
        expect(searchCatalogue(catalogue, term), isNotEmpty);
      });
    }
  });
}
