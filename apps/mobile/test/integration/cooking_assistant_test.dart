import 'dart:convert';

import 'package:elha2/data/api/api_cooking_assistant.dart';
import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../support/harness.dart';

Future<void> openAssistant(WidgetTester tester) async {
  await signIn(tester);
  await tester.tap(find.byKey(const Key('openAssistant')));
  await tester.pumpAndSettle();
}

void main() {
  group('US-4.02 cooking assistant', () {
    testWidgets('a suggested question gets a pantry answer with a reheating safety note', (tester) async {
      await pumpApp(
        tester,
        screen: phoneScreen,
        overrides: [cookingAssistantProvider.overrideWithValue(MockCookingAssistant(shouldFail: () => false, latency: Duration.zero))],
      );
      await openAssistant(tester);
      expect(find.text('مساعد الطبخ'), findsWidgets);
      expect(find.text('الإجابات اقتراحات من الذكاء الاصطناعي. بص على أكلك قبل ما تطبخه.'), findsOneWidget);

      await tester.tap(find.text('أعمل إيه بالرز والفراخ اللي فاضلين؟'));
      await tester.pumpAndSettle();
      expect(find.textContaining('ابدأ بـ'), findsOneWidget);
      expect(find.byKey(const Key('assistantSafetyNote')), findsOneWidget);
      expect(find.textContaining('بيستخدم:'), findsOneWidget);
    });

    testWidgets('declines a question that is not about food', (tester) async {
      final container = await pumpApp(
        tester,
        screen: phoneScreen,
        overrides: [cookingAssistantProvider.overrideWithValue(MockCookingAssistant(shouldFail: () => false, latency: Duration.zero))],
      );
      await openAssistant(tester);
      container.read(settingsProvider.notifier).setLanguage('en');
      await tester.pumpAndSettle();
      expect(find.text('Cooking assistant'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('assistantInput')), 'Who will win the match tonight?');
      await tester.tap(find.byKey(const Key('assistantSend')));
      await tester.pumpAndSettle();
      expect(find.textContaining('I can only help with cooking'), findsOneWidget);
      expect(find.byKey(const Key('assistantSafetyNote')), findsNothing);
    });

    testWidgets('NFR-22: without the AI it still points at the items closest to expiry', (tester) async {
      await pumpApp(
        tester,
        screen: phoneScreen,
        overrides: [cookingAssistantProvider.overrideWithValue(MockCookingAssistant(shouldFail: () => true, latency: Duration.zero))],
      );
      await openAssistant(tester);
      await tester.enterText(find.byKey(const Key('assistantInput')), 'أطبخ إيه؟');
      await tester.tap(find.byKey(const Key('assistantSend')));
      await tester.pumpAndSettle();
      expect(find.text('المساعد مش متاح دلوقتي، فده اقتراح بسيط.'), findsOneWidget);
    });
  });

  group('ApiCookingAssistant', () {
    final item = PantryItem(
      id: 'p1',
      nameAr: 'رز مطبوخ',
      nameEn: 'Cooked rice',
      category: FoodCategory.cooked,
      quantity: 1,
      unit: Unit.kg,
      storage: StoragePlace.fridge,
      expiryDate: DateTime(2026, 11, 8),
      expirySource: ExpirySource.estimated,
      addedBy: CaptureMethod.manual,
      addedOn: DateTime(2026, 11, 6),
    );

    test('sends the question with the pantry and reads the answer', () async {
      late Map<String, dynamic> sent;
      late String auth;
      final client = MockClient((req) async {
        sent = jsonDecode(req.body) as Map<String, dynamic>;
        auth = req.headers['authorization']!;
        return http.Response.bytes(
          utf8.encode(jsonEncode({'onTopic': true, 'answer': 'اعمل فتة.', 'reheatingNote': 'سخّنه مرة واحدة.', 'usedItems': ['رز مطبوخ'], 'fallbackUsed': false})),
          200,
        );
      });
      final assistant = ApiCookingAssistant(baseUrl: 'http://api', token: () => 'tok', client: client, clock: () => DateTime(2026, 11, 7, 9));
      final reply = await assistant.ask('أطبخ إيه؟', language: 'ar', items: [item]);
      expect(auth, 'Bearer tok');
      expect(sent['items'], [
        {'name': 'رز مطبوخ', 'daysLeft': 1, 'cooked': true},
      ]);
      expect(reply.answer, 'اعمل فتة.');
      expect(reply.reheatingNote, 'سخّنه مرة واحدة.');
      expect(reply.usedItems, ['رز مطبوخ']);
    });

    test('an unreachable backend becomes an "unreachable" reply, never an exception', () async {
      final assistant = ApiCookingAssistant(baseUrl: 'http://api', token: () => null, client: MockClient((_) async => http.Response('', 503)));
      final reply = await assistant.ask('what to cook?', language: 'en', items: const []);
      expect(reply.unreachable, isTrue);
    });
  });
}
