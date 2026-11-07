import 'dart:convert';

import 'package:elha2/data/models.dart';
import 'package:elha2/data/product_lookup.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/state/pantry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../support/harness.dart';

class MemoryProductCache implements ProductCacheStore {
  final values = <String, String>{};

  @override
  Future<String?> read(String barcode) async => values[barcode];

  @override
  Future<void> write(String barcode, String json) async => values[barcode] = json;
}

/// Answers from the demo products until it goes offline.
class FlakyLookup implements ProductLookup {
  final inner = MockProductLookup();
  var online = true;

  @override
  Future<ProductLookupResult> lookup(String barcode) async => online ? inner.lookup(barcode) : const ProductLookupResult.failed();

  @override
  Future<void> suggest(String barcode, {required String nameAr, String? nameEn}) => inner.suggest(barcode, nameAr: nameAr, nameEn: nameEn);
}

Future<void> openBarcode(WidgetTester tester) async {
  await openPantry(tester);
  await tester.tap(find.byKey(const Key('addFood')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('captureBarcode')));
  await tester.pumpAndSettle();
}

Future<void> typeBarcode(WidgetTester tester, String code) async {
  await tester.enterText(find.byKey(const Key('barcodeField')), code);
  await tester.tap(find.byKey(const Key('barcodeFind')));
  await tester.pumpAndSettle();
}

void main() {
  group('US-2.03 scan a barcode', () {
    late FlakyLookup lookup;
    late MemoryProductCache cache;

    Future<dynamic> pump(WidgetTester tester) {
      lookup = FlakyLookup();
      cache = MemoryProductCache();
      return pumpApp(
        tester,
        overrides: [
          barcodeCameraProvider.overrideWithValue(false),
          productLookupProvider.overrideWithValue(CachedProductLookup(lookup, cache: cache)),
        ],
      );
    }

    testWidgets('a known product fills in by itself and is added from the barcode', (tester) async {
      final c = await pump(tester);
      await openBarcode(tester);
      await typeBarcode(tester, '6223000000017');
      expect(find.byKey(const Key('barcodeFound')), findsOneWidget);
      expect(find.text('لبن جهينة كامل الدسم'), findsOneWidget);
      expect(find.textContaining('الصلاحية المتوقعة'), findsOneWidget);

      await tester.tap(find.byKey(const Key('barcodeAdd')));
      await tester.pumpAndSettle();
      final added = (c.read(pantryProvider).value as List<PantryItem>).where((i) => i.nameAr == 'لبن جهينة كامل الدسم').single;
      expect(added.addedBy, CaptureMethod.barcode);
      expect(added.catalogueId, 'milk');
      expect(added.unit, Unit.l);
      expect(find.byKey(const Key('barcodeField')), findsOneWidget, reason: 'ready for the next product');
    });

    testWidgets('an unknown barcode is named by the user, added, and sent for review', (tester) async {
      final c = await pump(tester);
      await openBarcode(tester);
      await typeBarcode(tester, '6220000099999');
      expect(find.text('لسه منعرفش المنتج ده. اكتب اسمه عشان تضيفه، وهنراجعه عشان غيرك يقدر يمسحه.'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('barcodeName')), 'جبنة رومي');
      await tester.tap(find.byKey(const Key('barcodeAddUnknown')));
      await tester.pumpAndSettle();
      expect(lookup.inner.suggestions['6220000099999'], 'جبنة رومي');
      final added = (c.read(pantryProvider).value as List<PantryItem>).where((i) => i.nameAr == 'جبنة رومي').single;
      expect(added.addedBy, CaptureMethod.barcode);
    });

    testWidgets('a product scanned before is found offline, from the phone', (tester) async {
      await pump(tester);
      await openBarcode(tester);
      await typeBarcode(tester, '5449000000996');
      expect(find.text('كوكاكولا'), findsOneWidget);
      await tester.tap(find.byKey(const Key('barcodeAdd')));
      await tester.pumpAndSettle();

      lookup.online = false;
      await typeBarcode(tester, '5449000000996');
      expect(find.text('كوكاكولا'), findsOneWidget);
      await typeBarcode(tester, '6220000012345');
      expect(find.text('إنت أوفلاين والمنتج ده مش محفوظ على الموبايل. اكتب اسمه عشان تضيفه.'), findsOneWidget);
    });

    testWidgets('a number that is not a barcode says so', (tester) async {
      await pump(tester);
      await openBarcode(tester);
      await typeBarcode(tester, '12345');
      expect(find.text('الباركود من 8 لـ 14 رقم.'), findsOneWidget);
    });
  });

  group('ApiProductLookup', () {
    ApiProductLookup api(int status, Object body) => ApiProductLookup(
      baseUrl: 'http://api',
      token: () => 'tok',
      client: MockClient((req) async => http.Response.bytes(utf8.encode(jsonEncode(body)), status)),
    );

    test('reads a found product, an unknown one, and a failed lookup', () async {
      final found = await api(200, {
        'barcode': '5449000000996', 'found': true, 'nameAr': 'كوكاكولا', 'nameEn': 'Coca-Cola', 'brand': 'Coca-Cola',
        'catalogueId': 'soda', 'category': 'drinks', 'unit': 'ml', 'quantity': 330, 'storage': 'cupboard',
      }).lookup('5449000000996');
      expect(found.product!.quantity, 330);
      expect(found.product!.unit, Unit.ml);
      expect((await api(200, {'barcode': 'x', 'found': false, 'lookupFailed': false}).lookup('6220000099999')).product, isNull);
      expect((await api(200, {'barcode': 'x', 'found': false, 'lookupFailed': true}).lookup('6220000099999')).lookupFailed, isTrue);
      expect((await api(503, {}).lookup('6220000099999')).lookupFailed, isTrue);
    });
  });
}
