import 'dart:convert';
import 'dart:typed_data';

import 'package:elha2/data/api/api_receipt_ai_service.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/data/repositories.dart';
import 'package:elha2/state/pantry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../support/harness.dart';

// A 1x1 PNG, enough for Image.memory.
final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

class FakeReceiptService implements ReceiptAiService {
  FakeReceiptService({this.confirmError});

  final ReceiptSaveException? confirmError;
  final photos = <String>[];
  List<({DraftItem draft, PantryItem item})>? confirmed;

  @override
  Future<ReceiptParseResult> parseReceipt(List<String> maskedLines, {required String sampleId}) async =>
      ReceiptParseResult(items: const [], fallbackUsed: true, maskedLines: maskedLines);

  @override
  Future<ReceiptParseResult> readPhoto(Uint8List bytes, {required String mimeType}) async {
    photos.add(mimeType);
    return ReceiptParseResult(
      draftId: 'draft-1',
      fallbackUsed: false,
      maskedLines: const ['FRESH MART', 'Member: [name]', 'EGGS WHT 10PC 55.00'],
      items: [
        DraftItem(
          id: 'item-1',
          sourceLine: 'EGGS WHT 10PC 55.00',
          catalogueId: 'eggs',
          nameAr: 'بيض',
          nameEn: 'Eggs',
          quantity: 10,
          unit: Unit.piece,
          category: FoodCategory.dairy,
          storage: StoragePlace.fridge,
          confidence: 0.95,
          expiryDate: DateTime(2026, 11, 28),
        ),
      ],
    );
  }

  @override
  Future<void> confirm(String draftId, List<({DraftItem draft, PantryItem item})> items) async {
    if (confirmError != null) throw confirmError!;
    confirmed = items;
  }
}

Future<void> openScan(WidgetTester tester) async {
  await signIn(tester);
  await tester.tap(find.text('المطبخ'));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('addFood')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('captureReceipt')));
  await tester.pumpAndSettle();
}

Future<void> photoToReview(WidgetTester tester, FakeReceiptService service) async {
  await pumpApp(
    tester,
    overrides: [
      receiptPhotosEnabledProvider.overrideWithValue(true),
      photoPickerProvider.overrideWithValue(({required bool camera}) async => (bytes: _png, mimeType: 'image/jpeg')),
      receiptAiServiceProvider.overrideWithValue(service),
    ],
  );
  await openScan(tester);
  expect(find.textContaining('Google Gemini'), findsOneWidget);
  await tester.tap(find.byKey(const Key('takePhoto')));
  await tester.pumpAndSettle();
}

void main() {
  group('US-2.01 receipt photo + US-2.02 saved through the backend', () {
    testWidgets('a photo is read by the backend; Confirm all saves there with the backend’s expiry, then in the app', (tester) async {
      final service = FakeReceiptService();
      await photoToReview(tester, service);
      expect(service.photos, ['image/jpeg']);
      expect(find.text('راجع الفاتورة'), findsOneWidget);

      await tester.tap(find.byKey(const Key('confirmAll')));
      await tester.pumpAndSettle();
      expect(service.confirmed!.single.draft.id, 'item-1');
      expect(service.confirmed!.single.item.expiryDate, DateTime(2026, 11, 28));
      expect(find.text('اتضافت حاجة واحدة'), findsOneWidget);
      expect(find.text('بيض'), findsWidgets);
    });

    testWidgets('if the backend cannot save, nothing is saved and the review stays open', (tester) async {
      final service = FakeReceiptService(confirmError: const ReceiptSaveException());
      final c = await pumpApp(
        tester,
        overrides: [
          receiptPhotosEnabledProvider.overrideWithValue(true),
          photoPickerProvider.overrideWithValue(({required bool camera}) async => (bytes: _png, mimeType: 'image/png')),
          receiptAiServiceProvider.overrideWithValue(service),
        ],
      );
      await openScan(tester);
      final before = c.read(pantryProvider).value!.length;
      await tester.tap(find.byKey(const Key('choosePhoto')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('confirmAll')));
      await tester.pumpAndSettle();
      expect(find.text('مقدرناش نحفظ الحاجات. اتأكد من النت ودوس «أكّد الكل» تاني.'), findsOneWidget);
      expect(find.byKey(const Key('confirmAll')), findsOneWidget);
      expect(c.read(pantryProvider).value!.length, before);
    });

    testWidgets('a draft older than 24 hours asks to scan again', (tester) async {
      await photoToReview(tester, FakeReceiptService(confirmError: const ReceiptSaveException(expired: true)));
      await tester.tap(find.byKey(const Key('confirmAll')));
      await tester.pumpAndSettle();
      expect(find.text('الفاتورة دي اتقرت من أكتر من 24 ساعة. صوّرها تاني.'), findsOneWidget);
    });

    testWidgets('without the backend, the photo buttons are hidden and samples remain', (tester) async {
      await pumpApp(tester);
      await openScan(tester);
      expect(find.byKey(const Key('takePhoto')), findsNothing);
      expect(find.text('قراية الصور محتاجة سيرفر إلحق. جرّب فاتورة تجريبية بدالها.'), findsOneWidget);
      expect(find.byKey(const Key('readReceipt')), findsOneWidget);
    });
  });

  group('ApiReceiptAiService', () {
    final draftJson = {
      'id': 'd1',
      'fallbackUsed': false,
      'lines': ['Member: [name]', 'EGGS 10PC 55.00'],
      'items': [
        {
          'id': 'i1', 'sourceLine': 'EGGS 10PC 55.00', 'catalogueId': 'eggs', 'nameAr': 'بيض', 'nameEn': 'Eggs', 'quantity': 10, 'unit': 'piece',
          'category': 'dairy', 'storage': 'fridge', 'expiryDate': '2026-11-28', 'expirySource': 'estimated', 'confidence': 0.95,
        },
      ],
    };

    test('uploads the photo as multipart and reads the draft id and expiry back', () async {
      late http.BaseRequest seen;
      late String body;
      final client = MockClient((req) async {
        seen = req;
        body = latin1.decode(req.bodyBytes);
        return http.Response.bytes(utf8.encode(jsonEncode(draftJson)), 201);
      });
      final api = ApiReceiptAiService(baseUrl: 'http://api', token: () => 'tok', client: client);
      final result = await api.readPhoto(Uint8List.fromList(_png), mimeType: 'image/png');
      expect(seen.url.path, '/api/v1/pantry/receipts/photo');
      expect(seen.headers['authorization'], 'Bearer tok');
      expect(seen.headers['content-type'], startsWith('multipart/form-data'));
      expect(body, contains('name="photo"'));
      expect(body, contains('content-type: image/png'));
      expect(result.draftId, 'd1');
      expect(result.items.single.expiryDate, DateTime(2026, 11, 28));
    });

    test('Confirm all sends the reviewed items with storage and expiry; a 410 means the draft expired', () async {
      late Map<String, dynamic> sent;
      var status = 201;
      final client = MockClient((req) async {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        return http.Response('{}', status);
      });
      final api = ApiReceiptAiService(baseUrl: 'http://api', token: () => 'tok', client: client);
      final parsed = await ApiReceiptAiService(
        baseUrl: 'http://api',
        token: () => 'tok',
        client: MockClient((_) async => http.Response.bytes(utf8.encode(jsonEncode(draftJson)), 201)),
      ).parseReceipt(const ['x'], sampleId: 's');
      final draft = parsed.items.single;
      final item = PantryItem(
        id: 'p1', catalogueId: 'eggs', nameAr: 'بيض', nameEn: 'Eggs', category: FoodCategory.dairy, quantity: 10, unit: Unit.piece,
        storage: StoragePlace.fridge, expiryDate: DateTime(2026, 11, 28), expirySource: ExpirySource.estimated,
        addedBy: CaptureMethod.receipt, addedOn: DateTime(2026, 11, 7),
      );
      await api.confirm('d1', [(draft: draft, item: item)]);
      expect(sent['items'], [
        {'id': 'i1', 'catalogueId': 'eggs', 'nameAr': 'بيض', 'nameEn': 'Eggs', 'quantity': 10.0, 'unit': 'piece', 'category': 'dairy', 'storage': 'fridge', 'expiryDate': '2026-11-28'},
      ]);
      status = 410;
      await expectLater(api.confirm('d1', [(draft: draft, item: item)]), throwsA(isA<ReceiptSaveException>().having((e) => e.expired, 'expired', true)));
    });
  });
}
