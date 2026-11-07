import 'package:elha2/data/fcm/fcm_notification_service.dart';
import 'package:elha2/data/fcm/push_client.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/data/providers.dart';
import 'package:elha2/state/settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/harness.dart';
import '../unit/fcm_notification_service_test.dart' show FakeBackend, FakePushClient;

const expiryTitle = '٣ حاجات قربت تخلص';
const reservedTitle = 'الشنطة اتحجزت';

Future<void> push(WidgetTester tester, ProviderContainer c, NotificationType type) async {
  c.read(notificationServiceProvider).simulate(type);
  await tester.pumpAndSettle();
}

Badge bell(WidgetTester tester) => tester.widget<Badge>(find.byType(Badge));

void main() {
  group('US-11.01 receive push notifications (simulated delivery)', () {
    testWidgets('the Settings demo button delivers a banner', (tester) async {
      await pumpApp(tester);
      await signIn(tester);
      await tester.tap(find.byTooltip('الإعدادات'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('ابعت إشعار صلاحية'));
      await tester.pumpAndSettle();
      expect(find.text(expiryTitle), findsOneWidget);
      await flushBannerTimer(tester);
    });

    testWidgets('an expiry push opens the Pantry', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await push(tester, c, NotificationType.expiryDigest);
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantrySearch')), findsOneWidget);
      expect(find.text(expiryTitle), findsNothing);
      await flushBannerTimer(tester);
    });

    testWidgets('a reservation push opens Deals', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await push(tester, c, NotificationType.reservation);
      expect(find.text(reservedTitle), findsOneWidget);
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(find.text('عروض الأكل الفائض اللي جنبك جاية في سبرنت ٢.'), findsWidgets);
      await flushBannerTimer(tester);
    });

    testWidgets('a pickup push shows its own text and opens Deals', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await tester.tap(find.byTooltip('الإعدادات'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('ابعت إشعار استلام'));
      await tester.pumpAndSettle();
      expect(find.text('وقت الاستلام قرب يخلص'), findsOneWidget);
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(find.text('عروض الأكل الفائض اللي جنبك جاية في سبرنت ٢.'), findsWidgets);
      expect(c.read(notificationServiceProvider).history.single.type, NotificationType.pickup);
      await flushBannerTimer(tester);
    });

    testWidgets('the deep link also works from a screen above the tabs', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await tester.tap(find.byTooltip('الإعدادات'));
      await tester.pumpAndSettle();
      await push(tester, c, NotificationType.expiryDigest);
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantrySearch')), findsOneWidget);
      await flushBannerTimer(tester);
    });

    testWidgets('Close dismisses the banner and stays on the screen', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await push(tester, c, NotificationType.expiryDigest);
      await tester.tap(find.byType(TextButton).last);
      await tester.pumpAndSettle();
      expect(find.text(expiryTitle), findsNothing);
      expect(find.text('استخدم دول الأول'), findsOneWidget);
      await flushBannerTimer(tester);
    });

    testWidgets('an ignored banner hides itself after 8 s', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await push(tester, c, NotificationType.expiryDigest);
      await tester.pump(const Duration(seconds: 7));
      expect(find.text(expiryTitle), findsOneWidget);
      await flushBannerTimer(tester);
      expect(find.text(expiryTitle), findsNothing);
    });

    testWidgets('the bell counts unread pushes', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      expect(bell(tester).isLabelVisible, isFalse);
      await push(tester, c, NotificationType.expiryDigest);
      await push(tester, c, NotificationType.reservation);
      expect(bell(tester).isLabelVisible, isTrue);
      expect(find.descendant(of: find.byType(Badge), matching: find.text('2')), findsOneWidget);
      await flushBannerTimer(tester);
    });

    testWidgets('the notification list shows pushes, newest first', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await push(tester, c, NotificationType.expiryDigest);
      await flushBannerTimer(tester);
      await push(tester, c, NotificationType.reservation);
      await flushBannerTimer(tester);
      await tester.tap(find.byTooltip('الإشعارات'));
      await tester.pumpAndSettle();
      final top = tester.getTopLeft(find.text(reservedTitle)).dy;
      final next = tester.getTopLeft(find.text(expiryTitle)).dy;
      expect(top, lessThan(next));
    });

    testWidgets('the list is empty before any push', (tester) async {
      await pumpApp(tester);
      await signIn(tester);
      await tester.tap(find.byTooltip('الإشعارات'));
      await tester.pumpAndSettle();
      expect(find.text('مفيش إشعارات لسه.'), findsOneWidget);
    });

    testWidgets('a push arriving on the list screen appears at once', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await tester.tap(find.byTooltip('الإشعارات'));
      await tester.pumpAndSettle();
      await push(tester, c, NotificationType.expiryDigest);
      expect(find.widgetWithText(ListTile, expiryTitle), findsOneWidget);
      await flushBannerTimer(tester);
    });

    testWidgets('tapping a list row opens its screen and marks it read', (tester) async {
      final c = await pumpApp(tester);
      await signIn(tester);
      await push(tester, c, NotificationType.expiryDigest);
      await flushBannerTimer(tester);
      await tester.tap(find.byTooltip('الإشعارات'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(expiryTitle));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantrySearch')), findsOneWidget);
      expect(c.read(notificationServiceProvider).history.single.readAt, isNotNull);
    });

    testWidgets('a push while signed out cannot bypass sign-in', (tester) async {
      final c = await pumpApp(tester);
      await push(tester, c, NotificationType.expiryDigest);
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('phoneField')), findsOneWidget);
      expect(find.byKey(const Key('pantrySearch')), findsNothing);
      await flushBannerTimer(tester);
    });

    testWidgets('the banner follows the app language', (tester) async {
      final c = await pumpApp(tester);
      c.read(settingsProvider.notifier).setLanguage('en');
      await tester.pumpAndSettle();
      await signIn(tester);
      await push(tester, c, NotificationType.reservation);
      expect(find.text('Bag reserved'), findsOneWidget);
      expect(find.text('Open'), findsOneWidget);
      await flushBannerTimer(tester);
    });
  });

  group('US-11.01 over FCM (fake Firebase)', () {
    testWidgets('signing in registers the device; a push tapped in the tray opens its screen; signing out forgets the device', (tester) async {
      final client = FakePushClient();
      final backend = FakeBackend();
      final c = await pumpApp(tester, overrides: [notificationServiceProvider.overrideWithValue(FcmNotificationService(client, backend: backend))]);
      await signIn(tester);
      expect(backend.registered, ['fcm-token-1@web']);

      client.openedCtl.add(const RemotePush(id: 'n-1', type: NotificationType.expiryDigest, deepLink: '/pantry'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pantrySearch')), findsOneWidget);
      expect(c.read(notificationServiceProvider).history.single.readAt, isNotNull);

      await tester.tap(find.byTooltip('الإعدادات'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('deviceToken')), findsOneWidget);
      await tester.tap(find.text('اخرج'));
      await tester.pumpAndSettle();
      expect(backend.removed, ['fcm-token-1']);
    });
  });
}
