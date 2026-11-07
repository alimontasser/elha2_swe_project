import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models.dart';
import '../repositories.dart';

/// Reads a receipt through the backend's AI gateway (POST /api/v1/pantry/receipts, US-2.01).
/// The lines are already masked on the phone (US-14.03); the server masks them again.
class ApiReceiptAiService implements ReceiptAiService {
  ApiReceiptAiService({required this.baseUrl, required this.token, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;

  /// The current login token: the Supabase session's, or a local dev token.
  final String? Function() token;
  final http.Client _client;

  @override
  Future<ReceiptParseResult> parseReceipt(List<String> maskedLines, {required String sampleId}) async {
    try {
      final res = await _client
          .post(
            Uri.parse('$baseUrl/api/v1/pantry/receipts'),
            headers: {'content-type': 'application/json', 'authorization': 'Bearer ${token() ?? ''}'},
            body: jsonEncode({'lines': maskedLines}),
          )
          .timeout(const Duration(seconds: 45));
      if (res.statusCode != 200 && res.statusCode != 201) {
        return ReceiptParseResult(items: const [], fallbackUsed: true, maskedLines: maskedLines);
      }
      final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      final items = [
        for (final raw in body['items'] as List)
          () {
            final i = raw as Map<String, dynamic>;
            return DraftItem(
              id: i['id'] as String,
              sourceLine: i['sourceLine'] as String? ?? '',
              catalogueId: i['catalogueId'] as String?,
              nameAr: i['nameAr'] as String,
              nameEn: i['nameEn'] as String,
              quantity: (i['quantity'] as num).toDouble(),
              unit: unitFromJson(i['unit'] as String),
              category: FoodCategory.values.byName(i['category'] as String),
              storage: StoragePlace.values.byName(i['storage'] as String),
              confidence: (i['confidence'] as num).toDouble(),
            );
          }(),
      ];
      return ReceiptParseResult(
        items: items,
        fallbackUsed: body['fallbackUsed'] as bool? ?? false,
        maskedLines: [for (final l in body['lines'] as List) l as String],
      );
    } catch (_) {
      // Network failure: the app shows the lines and offers manual entry (NFR-22).
      return ReceiptParseResult(items: const [], fallbackUsed: true, maskedLines: maskedLines);
    }
  }
}
