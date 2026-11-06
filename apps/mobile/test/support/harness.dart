import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/data/repositories.dart';
import 'package:elha2/main.dart';
import 'package:elha2/state/pantry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

/// Tall enough that every pantry row is built without scrolling.
const tallScreen = Size(1080, 6000);

/// A real phone: 412 x 915 dp.
const phoneScreen = Size(1030, 2288);

/// Boots the whole app: real router, screens, controllers and in-memory repository.
Future<ProviderContainer> pumpApp(
  WidgetTester tester, {
  Size screen = tallScreen,
  String language = 'ar',
  PantryRepository? pantry,
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = screen;
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(MockAuthRepository(latency: Duration.zero)),
      if (pantry != null) pantryRepositoryProvider.overrideWithValue(pantry),
      ...overrides,
    ],
    // Riverpod retries failed providers by default; the tests want the first failure.
    retry: (_, _) => null,
  );
  addTearDown(container.dispose);
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
  await tester.enterText(find.byKey(const Key('otpField')), '654321');
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('useGps')));
  await tester.pump(const Duration(seconds: 1));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('saveLocation')));
  await tester.pumpAndSettle();
}

/// Signs in and opens the Pantry tab (tab label by language).
Future<void> openPantry(WidgetTester tester, {String tab = 'المطبخ'}) async {
  await signIn(tester);
  await tester.tap(find.text(tab));
  await tester.pumpAndSettle();
}

Future<void> openItem(WidgetTester tester, String id) async {
  await tester.tap(find.byKey(Key('pantry-$id')));
  await tester.pumpAndSettle();
}

/// Item sheet → Thrown away → reason → Save.
Future<void> throwAway(WidgetTester tester, String id, {String reason = 'spoiled'}) async {
  await openItem(tester, id);
  await tester.tap(find.byKey(const Key('markWasted')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(Key('waste-$reason')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('saveWaste')));
  await tester.pumpAndSettle();
}

/// The push banner schedules an 8 s hide, which must run before a test may end.
Future<void> flushBannerTimer(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 9));
  await tester.pumpAndSettle();
}

Iterable<String> visiblePantryIds(WidgetTester tester) => tester
    .widgetList<ListTile>(find.byType(ListTile))
    .map((t) => t.key)
    .whereType<ValueKey<String>>()
    .map((k) => k.value)
    .where((v) => v.startsWith('pantry-'))
    .map((v) => v.substring('pantry-'.length));
