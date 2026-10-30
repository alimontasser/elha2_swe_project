import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models.dart';
import '../data/providers.dart';

class AuthNotifier extends Notifier<Session?> {
  @override
  Session? build() => null;

  void signedIn(Session session) => state = session;

  /// US-1.04: only the area is stored for display; others see an approximate distance.
  void setArea(Area area) {
    final s = state;
    if (s != null) state = s.withArea(area);
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    state = null;
  }
}

final authProvider = NotifierProvider<AuthNotifier, Session?>(AuthNotifier.new);
