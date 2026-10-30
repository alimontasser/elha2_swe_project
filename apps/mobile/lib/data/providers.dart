import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/settings.dart';
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

final receiptAiServiceProvider = Provider<ReceiptAiService>(
  (ref) => MockReceiptAiService(shouldFail: () => ref.read(settingsProvider).simulateAiFailure),
);

final notificationServiceProvider = Provider<NotificationService>((ref) => MockNotificationService());
