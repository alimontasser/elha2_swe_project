import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../state/settings.dart';
import 'api/api_cooking_assistant.dart';
import 'api/api_receipt_ai_service.dart';
import 'mock/mock_services.dart';
import 'repositories.dart';
import 'supabase/supabase_auth_repository.dart';

// The one place the app chooses its implementations. Each real adapter is switched on by a
// --dart-define; without it the demo mock is used, so `flutter run` works with no setup.
//
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY   real phone sign-in (Supabase Auth)
//   ELHA2_API_URL                            the NestJS backend (receipt reading, cooking assistant)
//   ELHA2_DEV_TOKEN                          a local backend token when Supabase is off

const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabasePublishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
const supabaseEnabled = supabaseUrl != '' && supabasePublishableKey != '';

const _apiUrl = String.fromEnvironment('ELHA2_API_URL');
const _devToken = String.fromEnvironment('ELHA2_DEV_TOKEN');

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => supabaseEnabled
      ? SupabaseAuthRepository(SupabaseOtpGateway(sb.Supabase.instance.client.auth), store: SharedPrefsLimiterStore())
      : MockAuthRepository(),
);

/// The token sent to the backend: the signed-in Supabase session's, else the local dev token.
final apiTokenProvider = Provider<String? Function()>(
  (ref) => supabaseEnabled ? () => sb.Supabase.instance.client.auth.currentSession?.accessToken : () => _devToken,
);

final locationServiceProvider = Provider<LocationService>((ref) => MockLocationService());

final catalogueRepositoryProvider = Provider<CatalogueRepository>((ref) => AssetCatalogueRepository());

final pantryRepositoryProvider = Provider<PantryRepository>((ref) => InMemoryPantryRepository());

final ocrServiceProvider = Provider<OcrService>((ref) => MockOcrService());

final receiptAiServiceProvider = Provider<ReceiptAiService>(
  (ref) => _apiUrl.isNotEmpty
      ? ApiReceiptAiService(baseUrl: _apiUrl, token: ref.watch(apiTokenProvider))
      : MockReceiptAiService(shouldFail: () => ref.read(settingsProvider).simulateAiFailure),
);

final cookingAssistantProvider = Provider<CookingAssistant>(
  (ref) => _apiUrl.isNotEmpty
      ? ApiCookingAssistant(baseUrl: _apiUrl, token: ref.watch(apiTokenProvider))
      : MockCookingAssistant(shouldFail: () => ref.read(settingsProvider).simulateAiFailure),
);

final notificationServiceProvider = Provider<NotificationService>((ref) => MockNotificationService());
