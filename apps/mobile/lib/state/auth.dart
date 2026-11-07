import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models.dart';
import '../data/providers.dart';

class AuthNotifier extends Notifier<Session?> {
  @override
  Session? build() => null;

  void signedIn(Session session) {
    state = session;
    // US-11.01: register this device for pushes; failures leave the app working without them.
    unawaited(ref.read(notificationServiceProvider).start());
  }

  /// US-1.04: only the area is stored for display; others see an approximate distance.
  void setArea(Area area) {
    final s = state;
    if (s != null) state = s.withArea(area);
  }

  Future<void> signOut() async {
    // While still signed in, so the backend accepts the request to forget this device.
    await ref.read(notificationServiceProvider).stop();
    await ref.read(authRepositoryProvider).signOut();
    state = null;
  }
}

final authProvider = NotifierProvider<AuthNotifier, Session?>(AuthNotifier.new);
