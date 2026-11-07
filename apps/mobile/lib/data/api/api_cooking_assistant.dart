import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/expiry_rules.dart';
import '../models.dart';
import '../repositories.dart';

/// Asks the backend's cooking assistant (POST /api/v1/recipes/assistant, US-4.02).
/// Until the pantry syncs to the server, the app sends the in-stock items it shows.
class ApiCookingAssistant implements CookingAssistant {
  ApiCookingAssistant({required this.baseUrl, required this.token, http.Client? client, DateTime Function()? clock})
    : _client = client ?? http.Client(),
      _clock = clock ?? DateTime.now;

  final String baseUrl;
  final String? Function() token;
  final http.Client _client;
  final DateTime Function() _clock;

  @override
  Future<AssistantReply> ask(String question, {required String language, required List<PantryItem> items}) async {
    final now = _clock();
    try {
      final res = await _client
          .post(
            Uri.parse('$baseUrl/api/v1/recipes/assistant'),
            headers: {'content-type': 'application/json', 'authorization': 'Bearer ${token() ?? ''}'},
            body: jsonEncode({
              'question': question,
              'language': language,
              'items': [
                for (final i in items)
                  {
                    'name': language == 'ar' ? i.nameAr : i.nameEn,
                    'daysLeft': daysUntil(i.expiryDate, now),
                    if (i.category == FoodCategory.cooked) 'cooked': true,
                  },
              ],
            }),
          )
          .timeout(const Duration(seconds: 45));
      if (res.statusCode != 200) return const AssistantReply.unreachable();
      final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      return AssistantReply(
        answer: body['answer'] as String,
        reheatingNote: body['reheatingNote'] as String? ?? '',
        onTopic: body['onTopic'] as bool? ?? true,
        usedItems: [for (final n in body['usedItems'] as List? ?? const []) n as String],
        fallbackUsed: body['fallbackUsed'] as bool? ?? false,
      );
    } catch (_) {
      // Network failure (NFR-22): the screen says the assistant can't be reached.
      return const AssistantReply.unreachable();
    }
  }
}
