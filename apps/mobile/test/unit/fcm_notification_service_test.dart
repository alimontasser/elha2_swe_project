import 'dart:async';

import 'package:elha2/data/api/api_notifications_backend.dart';
import 'package:elha2/data/fcm/fcm_notification_service.dart';
import 'package:elha2/data/fcm/push_client.dart';
import 'package:elha2/data/models.dart';
import 'package:flutter_test/flutter_test.dart';

class FakePushClient implements PushClient {
  FakePushClient({this.token = 'fcm-token-1', this.fails = false});

  final String? token;
  final bool fails;
  final foregroundCtl = StreamController<RemotePush>.broadcast();
  final openedCtl = StreamController<RemotePush>.broadcast();
  var deleted = 0;

  @override
  String get platform => 'web';

  @override
  Future<String?> start() async {
    if (fails) throw StateError('no push in this browser');
    return token;
  }

  @override
  Stream<RemotePush> get foreground => foregroundCtl.stream;

  @override
  Stream<RemotePush> get opened => openedCtl.stream;

  @override
  Future<void> deleteToken() async => deleted++;
}

class FakeBackend implements NotificationsBackend {
  FakeBackend({this.failTest = false});

  final bool failTest;
  final registered = <String>[];
  final removed = <String>[];
  final tests = <NotificationType>[];
  final read = <String>[];

  @override
  Future<void> registerDevice(String token, String platform) async => registered.add('$token@$platform');

  @override
  Future<void> removeDevice(String token) async => removed.add(token);

  @override
  Future<void> sendTest(NotificationType type) async {
    if (failTest) throw Exception('offline');
    tests.add(type);
  }

  @override
  Future<void> markRead(String id) async => read.add(id);
}

const serverPush = RemotePush(id: '6f0c2a9e-0000-4000-8000-000000000001', type: NotificationType.expiryDigest, deepLink: '/pantry');

void main() {
  group('FcmNotificationService (US-11.01)', () {
    test('registers the device token with the backend at start, and forgets it at stop', () async {
      final client = FakePushClient();
      final backend = FakeBackend();
      final service = FcmNotificationService(client, backend: backend);
      await service.start();
      expect(service.deviceToken, 'fcm-token-1');
      expect(backend.registered, ['fcm-token-1@web']);

      await service.stop();
      expect(service.deviceToken, isNull);
      expect(backend.removed, ['fcm-token-1']);
      expect(client.deleted, 1);
    });

    test('a push while the app is open feeds the banner once, even if FCM repeats it', () async {
      final client = FakePushClient();
      final service = FcmNotificationService(client);
      await service.start();
      final banners = <AppNotification>[];
      service.incoming.listen(banners.add);
      client.foregroundCtl
        ..add(serverPush)
        ..add(serverPush);
      await pumpEventQueue();
      expect(banners.map((n) => n.deepLink), ['/pantry', '/pantry']);
      expect(service.history, hasLength(1));
    });

    test('a tapped push is reported on opened, so the app can open its screen', () async {
      final client = FakePushClient();
      final service = FcmNotificationService(client);
      await service.start();
      final taps = <AppNotification>[];
      service.opened.listen(taps.add);
      client.openedCtl.add(const RemotePush(type: NotificationType.reservation, deepLink: '/deals'));
      await pumpEventQueue();
      expect(taps.single.deepLink, '/deals');
    });

    test('demo buttons ask the backend to push; if it is unreachable the push is simulated', () async {
      final backend = FakeBackend();
      final service = FcmNotificationService(FakePushClient(), backend: backend);
      await service.start();
      service.simulate(NotificationType.pickup);
      await pumpEventQueue();
      expect(backend.tests, [NotificationType.pickup]);
      expect(service.history, isEmpty, reason: 'the real push arrives through FCM');

      final offline = FcmNotificationService(FakePushClient(), backend: FakeBackend(failTest: true));
      await offline.start();
      offline.simulate(NotificationType.pickup);
      await pumpEventQueue();
      expect(offline.history.single.type, NotificationType.pickup);
    });

    test('a browser without push support leaves the app working, with no token', () async {
      final backend = FakeBackend();
      final service = FcmNotificationService(FakePushClient(fails: true), backend: backend);
      await service.start();
      expect(service.deviceToken, isNull);
      expect(backend.registered, isEmpty);
      service.simulate(NotificationType.expiryDigest);
      expect(service.history, hasLength(1));
    });

    test('marking read reaches the backend only for notifications it sent', () async {
      final client = FakePushClient();
      final backend = FakeBackend();
      final service = FcmNotificationService(client, backend: backend);
      await service.start();
      client.foregroundCtl.add(serverPush);
      await pumpEventQueue();
      service.markRead(serverPush.id!);
      service.simulate(NotificationType.expiryDigest);
      await service.stop();
      service.simulate(NotificationType.expiryDigest);
      service.markRead(service.history.first.id);
      expect(backend.read, [serverPush.id]);
    });
  });

  group('RemotePush.fromData', () {
    test('reads the type and deep link the backend sends', () {
      final p = RemotePush.fromData({'type': 'reservation', 'deepLink': '/deals', 'notificationId': 'n1'})!;
      expect((p.type, p.deepLink, p.id), (NotificationType.reservation, '/deals', 'n1'));
    });

    test('ignores unknown types and never follows a link that is not an app path', () {
      expect(RemotePush.fromData({'type': 'promo'}), isNull);
      expect(RemotePush.fromData({'type': 'expiryDigest', 'deepLink': 'https://evil.example'})!.deepLink, '/pantry');
    });
  });
}
