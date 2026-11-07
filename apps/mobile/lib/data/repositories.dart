import 'models.dart';

// Interfaces the screens depend on (Repository pattern, SDD v1.1 §3.1.4).
// Sprint 1 demo: mock implementations in data/mock/. Real build: Supabase Auth,
// the NestJS /api/v1 client, ML Kit and FCM adapters, wired in data/providers.dart.

class AuthException implements Exception {
  const AuthException(this.code, {this.remainingAttempts, this.retryAt});

  /// invalidPhone, wrongCode, locked, codeNotSent
  final String code;
  final int? remainingAttempts;
  final DateTime? retryAt;
}

abstract interface class AuthRepository {
  /// US-1.01: send an SMS one-time code to an Egyptian mobile number.
  Future<String> sendCode(String phone);

  Future<Session> verifyCode(String phone, String code);

  Future<void> signOut();
}

abstract interface class LocationService {
  /// US-1.04: resolve the phone's GPS position to an area. Only the area is kept for display.
  Future<Area> currentArea();
}

abstract interface class CatalogueRepository {
  Future<List<CatalogueItem>> all();
}

abstract interface class PantryRepository {
  Future<List<PantryItem>> items();

  Future<PantryItem> add(PantryItem item);

  Future<List<PantryItem>> addAll(List<PantryItem> items);

  Future<PantryItem> update(PantryItem item);

  Future<void> delete(String id);

  Future<void> reset();
}

abstract interface class ReceiptAiService {
  /// US-2.01 via the AI gateway (US-14.01): masked lines in, draft items with confidence out,
  /// or the non-AI fallback with the lines only.
  Future<ReceiptParseResult> parseReceipt(List<String> maskedLines, {required String sampleId});
}

abstract interface class CookingAssistant {
  /// US-4.02 via the AI gateway: a cooking question answered from [items], in the question's
  /// language, with a reheating note for leftovers. Never throws: a failure gives a fallback reply.
  Future<AssistantReply> ask(String question, {required String language, required List<PantryItem> items});
}

abstract interface class OcrService {
  /// On-device text recognition (ML Kit in the real app).
  Future<List<String>> readReceipt(SampleReceipt receipt);
}

abstract interface class NotificationService {
  /// US-11.01: pushes arriving on this device while the app is open (FCM in the real app).
  Stream<AppNotification> get incoming;

  /// Pushes the user tapped in the system tray; the app opens their screen.
  Stream<AppNotification> get opened;

  /// This device's push token once registered, shown in Settings for test sends.
  String? get deviceToken;

  /// After sign-in: ask permission and register this device for pushes.
  Future<void> start();

  /// Before sign-out: this device stops receiving the user's pushes.
  Future<void> stop();

  /// Fires whenever [history] changes (a new push, or one marked read), so the bell stays correct.
  Stream<void> get changes;

  List<AppNotification> get history;

  void simulate(NotificationType type);

  void markRead(String id);
}
