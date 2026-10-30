import 'package:elha2/app/router.dart';
import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/main.dart';
import 'package:elha2/state/pantry.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<ProviderContainer> pumpApp(WidgetTester tester, {bool aiFails = false}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(overrides: [
    authRepositoryProvider.overrideWithValue(MockAuthRepository(latency: Duration.zero)),
    receiptAiServiceProvider.overrideWith((ref) => MockReceiptAiService(
          shouldFail: () => ref.read(settingsProvider).simulateAiFailure,
          latency: const Duration(milliseconds: 500),
        )),
  ]);
  addTearDown(container.dispose);
  if (aiFails) container.read(settingsProvider.notifier).setSimulateAiFailure(true);
  // Asset loading is real I/O, which the fake test clock does not wait for.
  await tester.runAsync(() => container.read(catalogueProvider.future));
  await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const Elha2App()));
  await tester.pumpAndSettle();
  return container;
}

Future<void> signIn(WidgetTester tester) async {
  await tester.enterText(find.byKey(const Key('phoneField')), '010 1234 5678');
  await tester.tap(find.byKey(const Key('sendCode')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('otpField')), '123456');
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('useGps')));
  await tester.pump(const Duration(seconds: 1));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('saveLocation')));
  await tester.pumpAndSettle();
}

TextDirection directionOf(WidgetTester tester) => Directionality.of(tester.element(find.byType(Scaffold).first));

void main() {
  testWidgets('opens in Arabic, right to left, and switches to English instantly (US-1.02)', (tester) async {
    await pumpApp(tester);
    expect(directionOf(tester), TextDirection.rtl);
    expect(find.text('أهلاً بيك في إلحق'), findsOneWidget);
    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();
    expect(directionOf(tester), TextDirection.ltr);
    expect(find.text('Welcome to Elha2'), findsOneWidget);
  });

  testWidgets('signs in, sets an area and lands on Home (US-1.01, 1.04)', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    expect(find.text('استخدم دول الأول'), findsOneWidget);
  });

  testWidgets('wrong code shows the remaining attempts', (tester) async {
    await pumpApp(tester);
    await tester.enterText(find.byKey(const Key('phoneField')), '01012345678');
    await tester.tap(find.byKey(const Key('sendCode')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('otpField')), '999999');
    await tester.pumpAndSettle();
    expect(find.textContaining('فاضل 4 محاولات'), findsOneWidget);
  });

  testWidgets('adds an item by hand in 3 taps (US-2.07)', (tester) async {
    final container = await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('المطبخ'));
    await tester.pumpAndSettle();
    expect(find.text('فول مدمس'), findsNothing);

    await tester.tap(find.byKey(const Key('addFood'))); // 1
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('captureManual'))); // 2
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.byKey(const Key('suggest-ful')), 200, scrollable: find.byType(Scrollable).last);
    await tester.tap(find.byKey(const Key('suggest-ful'))); // 3
    await tester.pumpAndSettle();
    expect(find.text('اتضاف فول مدمس'), findsOneWidget);

    container.read(routerProvider).pop();
    await tester.pumpAndSettle();
    expect(find.text('فول مدمس'), findsOneWidget);
  });

  testWidgets('records thrown-away food with a reason (US-2.10)', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('المطبخ'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('pantrySearch')), 'موز');
    await tester.pumpAndSettle();
    await tester.tap(find.text('موز').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('markWasted')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('saveWaste')), findsOneWidget);
    await tester.tap(find.byKey(const Key('waste-spoiled')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('saveWaste')));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ListTile, 'موز'), findsNothing);
    expect(find.textContaining('نسبة الهدر'), findsOneWidget);
  });

  testWidgets('scans a receipt, masks it, reviews and confirms all (US-2.01, 2.02, 14.03)', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.text('المطبخ'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('addFood')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('captureReceipt')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('readReceipt')));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    expect(find.textContaining('[name]', findRichText: true), findsWidgets);
    await tester.pumpAndSettle();

    expect(find.text('راجع الفاتورة'), findsOneWidget);
    expect(find.text('سطر مش واضح'), findsOneWidget);
    expect(find.text('متأكدين 62%'), findsOneWidget);
    await tester.tap(find.byKey(const Key('confirmAll')));
    await tester.pumpAndSettle();
    expect(find.text('اتضافت 6 حاجات'), findsOneWidget);
    expect(find.text('فرخة'), findsOneWidget);
  });

  testWidgets('falls back to the raw lines when the AI fails (NFR-22)', (tester) async {
    await pumpApp(tester, aiFails: true);
    await signIn(tester);
    await tester.tap(find.text('المطبخ'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('addFood')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('captureReceipt')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('readReceipt')));
    await tester.pumpAndSettle();
    expect(find.text('ما قدرناش نقرا الحاجات'), findsOneWidget);
    expect(find.byKey(const Key('fallbackByHand')), findsOneWidget);
  });
}
