import 'dart:async';

import '../api/api_notifications_backend.dart';
import '../models.dart';
import '../repositories.dart';
import 'push_client.dart';

/// US-11.01 over Firebase Cloud Messaging. Pushes that arrive while the app is open feed the
/// banner; tapped ones open their screen. With a backend, the device is registered at sign-in
/// and removed at sign-out, and the demo buttons ask the backend to push.
class FcmNotificationService implements NotificationService {
  FcmNotificationService(this._client, {this.backend, DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final PushClient _client;
  final NotificationsBackend? backend;
  final DateTime Function() _clock;
  final _incoming = StreamController<AppNotification>.broadcast();
  final _opened = StreamController<AppNotification>.broadcast();
  final _changes = StreamController<void>.broadcast();
  final _history = <AppNotification>[];
  StreamSubscription<RemotePush>? _fg;
  StreamSubscription<RemotePush>? _tap;
  String? _token;
  var _seq = 0;

  @override
  Stream<AppNotification> get incoming => _incoming.stream;

  @override
  Stream<AppNotification> get opened => _opened.stream;

  @override
  Stream<void> get changes => _changes.stream;

  @override
  List<AppNotification> get history => List.unmodifiable(_history);

  @override
  String? get deviceToken => _token;

  AppNotification _record(RemotePush push) {
    final existing = push.id == null ? -1 : _history.indexWhere((n) => n.id == push.id);
    if (existing >= 0) return _history[existing];
    final n = AppNotification(id: push.id ?? 'local-${_seq++}', type: push.type, deepLink: push.deepLink, sentAt: _clock());
    _history.insert(0, n);
    _changes.add(null);
    return n;
  }

  @override
  Future<void> start() async {
    try {
      _fg ??= _client.foreground.listen((p) => _incoming.add(_record(p)));
      _tap ??= _client.opened.listen((p) => _opened.add(_record(p)));
      _token = await _client.start();
      _changes.add(null);
      final token = _token;
      if (token != null) await backend?.registerDevice(token, _client.platform);
    } catch (_) {
      // Permission refused, browser without push, or backend unreachable: the app works without pushes.
    }
  }

  @override
  Future<void> stop() async {
    final token = _token;
    _token = null;
    _changes.add(null);
    if (token == null) return;
    try {
      await backend?.removeDevice(token);
      await _client.deleteToken();
    } catch (_) {
      // Best effort: FCM drops tokens that stop being used, and the backend forgets them then.
    }
  }

  @override
  void simulate(NotificationType type) {
    final b = backend;
    if (b != null && _token != null) {
      // The real path: the backend sends it through FCM and it comes back as a push.
      b.sendTest(type).catchError((Object _) => _simulateLocally(type));
    } else {
      _simulateLocally(type);
    }
  }

  void _simulateLocally(NotificationType type) =>
      _incoming.add(_record(RemotePush(type: type, deepLink: type == NotificationType.expiryDigest ? '/pantry' : '/deals')));

  @override
  void markRead(String id) {
    final i = _history.indexWhere((n) => n.id == id);
    if (i < 0 || _history[i].readAt != null) return;
    final n = _history[i];
    _history[i] = AppNotification(id: n.id, type: n.type, deepLink: n.deepLink, sentAt: n.sentAt, readAt: _clock());
    _changes.add(null);
    if (!id.startsWith('local-')) backend?.markRead(id).catchError((Object _) {});
  }
}
