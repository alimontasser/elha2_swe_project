import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/settings.dart';
import 'api/api_receipt_ai_service.dart';
import 'mock/mock_services.dart';
import 'repositories.dart';

// The one place the app chooses its implementations.
// Sprint 1 demo: everything is mocked. Real build: replace each Mock* with the
// Supabase / NestJS API / ML Kit / FCM adapter; screens do not change.

final authRepositoryProvider = Provider<AuthRepository>((ref) => MockAuthRepository());

final locationServiceProvider = Provider<LocationService>((ref) => MockLocationService());

final catalogueRepositoryProvider = Provider<CatalogueRepository>((ref) => AssetCatalogueRepository());

final pantryRepositoryProvider = Provider<PantryRepository>((ref) => InMemoryPantryRepository());

final ocrServiceProvider = Provider<OcrService>((ref) => MockOcrService());

// Build with --dart-define=ELHA2_API_URL=http://localhost:3000 --dart-define=ELHA2_DEV_TOKEN=<token>
// to read receipts through the real backend; without them the demo mock is used.
const _apiUrl = String.fromEnvironment('ELHA2_API_URL');
const _devToken = String.fromEnvironment('ELHA2_DEV_TOKEN');

final receiptAiServiceProvider = Provider<ReceiptAiService>(
  (ref) => _apiUrl.isNotEmpty
      ? ApiReceiptAiService(baseUrl: _apiUrl, token: _devToken)
      : MockReceiptAiService(shouldFail: () => ref.read(settingsProvider).simulateAiFailure),
);

final notificationServiceProvider = Provider<NotificationService>((ref) => MockNotificationService());
