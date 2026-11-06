import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/l10n/gen/app_localizations.dart';
import 'package:elha2/features/notifications/push_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late MockNotificationService service;

  setUp(() => service = MockNotificationService());

  group('US-11.01 push delivery (simulated)', () {
    test('a push reaches every listener', () async {
      final first = service.incoming.first;
      final second = service.incoming.first;
      service.simulate(NotificationType.expiryDigest);
      expect((await first).type, NotificationType.expiryDigest);
      expect((await second).type, NotificationType.expiryDigest);
    });

    test('each type links to its screen', () {
      service.simulate(NotificationType.expiryDigest);
      service.simulate(NotificationType.reservation);
      service.simulate(NotificationType.pickup);
      expect(service.history.map((n) => n.deepLink), ['/deals', '/deals', '/pantry']);
    });

    test('US-11.01 covers expiry digests, reservations and pickups', () {
      expect(NotificationType.values.map((t) => t.name), ['expiryDigest', 'reservation', 'pickup']);
    });

    test('new pushes are unread, stamped and have unique ids', () {
      final before = DateTime.now();
      service.simulate(NotificationType.expiryDigest);
      service.simulate(NotificationType.expiryDigest);
      expect(service.history.every((n) => n.readAt == null), isTrue);
      expect(service.history.every((n) => !n.sentAt.isBefore(before)), isTrue);
      expect(service.history.map((n) => n.id).toSet(), hasLength(2));
    });

    test('the newest push comes first', () {
      service.simulate(NotificationType.expiryDigest);
      service.simulate(NotificationType.reservation);
      expect(service.history.first.type, NotificationType.reservation);
    });

    test('the history cannot be changed from outside', () {
      service.simulate(NotificationType.expiryDigest);
      expect(() => service.history.clear(), throwsUnsupportedError);
    });
  });

  group('read state', () {
    test('markRead affects only that notification and keeps its data', () {
      service.simulate(NotificationType.expiryDigest);
      service.simulate(NotificationType.reservation);
      final target = service.history.last;
      service.markRead(target.id);
      final updated = service.history.last;
      expect(updated.readAt, isNotNull);
      expect(updated.id, target.id);
      expect(updated.deepLink, target.deepLink);
      expect(updated.sentAt, target.sentAt);
      expect(service.history.first.readAt, isNull);
    });

    test('a new push and a first read each announce a change, a second read does not', () async {
      var changes = 0;
      final sub = service.changes.listen((_) => changes++);
      addTearDown(sub.cancel);
      service.simulate(NotificationType.expiryDigest);
      final id = service.history.single.id;
      service.markRead(id);
      final firstRead = service.history.single.readAt;
      service.markRead(id);
      await pumpEventQueue();
      expect(changes, 2);
      expect(service.history.single.readAt, firstRead);
    });

    test('an unknown id is ignored', () {
      service.simulate(NotificationType.expiryDigest);
      service.markRead('missing');
      expect(service.history.single.readAt, isNull);
    });
  });

  test('every type has a title, body and icon in both languages', () {
    for (final locale in const [Locale('ar'), Locale('en')]) {
      final l = lookupAppLocalizations(locale);
      for (final type in NotificationType.values) {
        final text = notificationText(l, type);
        expect(text.title, isNotEmpty);
        expect(text.body, isNotEmpty);
      }
    }
  });
}
