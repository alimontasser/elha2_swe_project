import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models.dart';
import '../repositories.dart';

/// Reads receipts through the backend's AI gateway and saves confirmed ones (US-2.01, US-2.02).
/// Typed lines are already masked on the phone (US-14.03); photos are masked on the server.
class ApiReceiptAiService implements ReceiptAiService {
  ApiReceiptAiService({required this.baseUrl, required this.token, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;

  /// The current login token: the Supabase session's, or a local dev token.
  final String? Function() token;
  final http.Client _client;

  Map<String, String> get _auth => {'authorization': 'Bearer ${token() ?? ''}'};

  static String _date(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Future<ReceiptParseResult> parseReceipt(List<String> maskedLines, {required String sampleId}) async {
    try {
      final res = await _client
          .post(
            Uri.parse('$baseUrl/api/v1/pantry/receipts'),
            headers: {..._auth, 'content-type': 'application/json'},
            body: jsonEncode({'lines': maskedLines}),
          )
          .timeout(const Duration(seconds: 45));
      return _toResult(res, fallbackLines: maskedLines);
    } catch (_) {
      // Network failure: the app shows the lines and offers manual entry (NFR-22).
      return ReceiptParseResult(items: const [], fallbackUsed: true, maskedLines: maskedLines);
    }
  }

  @override
  Future<ReceiptParseResult> readPhoto(Uint8List bytes, {required String mimeType}) async {
    try {
      final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/api/v1/pantry/receipts/photo'))
        ..headers.addAll(_auth)
        ..files.add(http.MultipartFile.fromBytes('photo', bytes, filename: 'receipt', contentType: MediaType.parse(mimeType)));
      final res = await http.Response.fromStream(await _client.send(request).timeout(const Duration(seconds: 60)));
      return _toResult(res, fallbackLines: const []);
    } catch (_) {
      return const ReceiptParseResult(items: [], fallbackUsed: true, maskedLines: []);
    }
  }

  ReceiptParseResult _toResult(http.Response res, {required List<String> fallbackLines}) {
    if (res.statusCode != 200 && res.statusCode != 201) {
      return ReceiptParseResult(items: const [], fallbackUsed: true, maskedLines: fallbackLines);
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    final items = [
      for (final raw in body['items'] as List)
        () {
          final i = raw as Map<String, dynamic>;
          final expiry = i['expiryDate'] as String?;
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
            expiryDate: expiry == null ? null : DateTime.parse(expiry),
          );
        }(),
    ];
    return ReceiptParseResult(
      draftId: body['id'] as String?,
      items: items,
      fallbackUsed: body['fallbackUsed'] as bool? ?? false,
      maskedLines: [for (final l in body['lines'] as List? ?? const []) l as String],
    );
  }

  @override
  Future<void> confirm(String draftId, List<({DraftItem draft, PantryItem item})> items) async {
    final http.Response res;
    try {
      res = await _client
          .post(
            Uri.parse('$baseUrl/api/v1/pantry/receipts/$draftId/confirm'),
            headers: {..._auth, 'content-type': 'application/json'},
            body: jsonEncode({
              'items': [
                for (final (:draft, :item) in items)
                  {
                    'id': draft.id,
                    'catalogueId': item.catalogueId,
                    'nameAr': item.nameAr,
                    'nameEn': item.nameEn,
                    'quantity': item.quantity,
                    'unit': item.unit.name,
                    'category': item.category.name,
                    'storage': item.storage.name,
                    'expiryDate': _date(item.expiryDate),
                  },
              ],
            }),
          )
          .timeout(const Duration(seconds: 30));
    } catch (_) {
      throw const ReceiptSaveException();
    }
    if (res.statusCode == 410 || res.statusCode == 404) throw const ReceiptSaveException(expired: true);
    if (res.statusCode != 200 && res.statusCode != 201) throw const ReceiptSaveException();
  }
}
