import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models.dart';

/// The backend's Notifications endpoints (US-11.01).
abstract interface class NotificationsBackend {
  Future<void> registerDevice(String token, String platform);

  Future<void> removeDevice(String token);

  /// Demo only: asks the backend to push a sample of [type] to this user's devices.
  Future<void> sendTest(NotificationType type);

  Future<void> markRead(String id);
}

class ApiNotificationsBackend implements NotificationsBackend {
  ApiNotificationsBackend({required this.baseUrl, required this.token, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final String? Function() token;
  final http.Client _client;

  Map<String, String> get _headers => {'content-type': 'application/json', 'authorization': 'Bearer ${token() ?? ''}'};

  Future<void> _check(Future<http.Response> request) async {
    final res = await request.timeout(const Duration(seconds: 20));
    if (res.statusCode >= 300) throw http.ClientException('HTTP ${res.statusCode}', res.request?.url);
  }

  @override
  Future<void> registerDevice(String token, String platform) => _check(
    _client.post(Uri.parse('$baseUrl/api/v1/notifications/devices'), headers: _headers, body: jsonEncode({'token': token, 'platform': platform})),
  );

  @override
  Future<void> removeDevice(String token) =>
      _check(_client.delete(Uri.parse('$baseUrl/api/v1/notifications/devices/${Uri.encodeComponent(token)}'), headers: _headers));

  @override
  Future<void> sendTest(NotificationType type) =>
      _check(_client.post(Uri.parse('$baseUrl/api/v1/notifications/test'), headers: _headers, body: jsonEncode({'type': type.name})));

  @override
  Future<void> markRead(String id) => _check(_client.post(Uri.parse('$baseUrl/api/v1/notifications/$id/read'), headers: _headers));
}
