import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../models.dart';

/// One push as the app needs it: what it is about and which screen it opens.
class RemotePush {
  const RemotePush({required this.type, required this.deepLink, this.id});

  final String? id;
  final NotificationType type;
  final String deepLink;

  static const _defaultLinks = {
    NotificationType.expiryDigest: '/pantry',
    NotificationType.reservation: '/deals',
    NotificationType.pickup: '/deals',
  };

  /// Reads FCM message data; unknown types are ignored, and only plain app paths are followed.
  static RemotePush? fromData(Map<String, dynamic> data) {
    final type = NotificationType.values.asNameMap()[data['type']];
    if (type == null) return null;
    final link = data['deepLink'];
    final safe = link is String && RegExp(r'^/[a-z/]*$').hasMatch(link) ? link : _defaultLinks[type]!;
    final id = data['notificationId'];
    return RemotePush(type: type, deepLink: safe, id: id is String ? id : null);
  }
}

/// The FCM calls the app makes, behind an interface so the notification rules are tested
/// without Firebase.
abstract interface class PushClient {
  /// web, android or ios: sent with the token so the backend knows the device.
  String get platform;

  /// Starts Firebase, asks permission and returns this device's token, or null if refused.
  Future<String?> start();

  /// Pushes that arrive while the app is open.
  Stream<RemotePush> get foreground;

  /// Pushes the user tapped in the system tray.
  Stream<RemotePush> get opened;

  Future<void> deleteToken();
}

class FirebasePushClient implements PushClient {
  FirebasePushClient({required this.options, required this.vapidKey});

  final FirebaseOptions options;
  final String vapidKey;
  final _foreground = StreamController<RemotePush>.broadcast();
  final _opened = StreamController<RemotePush>.broadcast();
  StreamSubscription<RemoteMessage>? _onMessage;
  StreamSubscription<RemoteMessage>? _onOpened;

  @override
  String get platform => kIsWeb ? 'web' : (defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android');

  @override
  Stream<RemotePush> get foreground => _foreground.stream;

  @override
  Stream<RemotePush> get opened => _opened.stream;

  /// The web service worker gets the public config in its URL, so the config lives in one place.
  String get _serviceWorkerPath => Uri(
    path: 'fcm/firebase-messaging-sw.js',
    queryParameters: {
      'apiKey': options.apiKey,
      'appId': options.appId,
      'messagingSenderId': options.messagingSenderId,
      'projectId': options.projectId,
    },
  ).toString();

  void _emit(StreamController<RemotePush> to, RemoteMessage m) {
    final push = RemotePush.fromData(m.data);
    if (push != null) to.add(push);
  }

  @override
  Future<String?> start() async {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: options);
    final messaging = FirebaseMessaging.instance;
    final permission = await messaging.requestPermission();
    if (permission.authorizationStatus == AuthorizationStatus.denied) return null;
    _onMessage ??= FirebaseMessaging.onMessage.listen((m) => _emit(_foreground, m));
    _onOpened ??= FirebaseMessaging.onMessageOpenedApp.listen((m) => _emit(_opened, m));
    final initial = await messaging.getInitialMessage();
    if (initial != null) _emit(_opened, initial);
    // A registration token, which FCM HTTP v1 `message.token` and the console's test send expect.
    // The newer register()/onRegistered gives an installation ID for a different send API.
    // ignore: deprecated_member_use
    return messaging.getToken(vapidKey: kIsWeb ? vapidKey : null, serviceWorkerScriptPath: kIsWeb ? _serviceWorkerPath : null);
  }

  @override
  // ignore: deprecated_member_use
  Future<void> deleteToken() => FirebaseMessaging.instance.deleteToken();
}
