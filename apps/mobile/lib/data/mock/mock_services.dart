import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';

import '../../core/phone.dart';
import '../models.dart';
import '../repositories.dart';
import 'mock_data.dart';

// Demo implementations. Nothing here talks to a network.

/// Fake Supabase phone OTP: the code is always [demoOtp]; 5 wrong codes in 1 h lock the number (NFR-12).
class MockAuthRepository implements AuthRepository {
  MockAuthRepository({DateTime Function()? clock, this.latency = const Duration(milliseconds: 400)}) : _clock = clock ?? DateTime.now;

  static const demoOtp = '654321';
  static const maxAttempts = 5;
  static const lockWindow = Duration(hours: 1);

  final DateTime Function() _clock;
  final Duration latency;
  final _failures = <String, List<DateTime>>{};
  final _sent = <String>{};

  List<DateTime> _recent(String phone) {
    final cutoff = _clock().subtract(lockWindow);
    final list = (_failures[phone] ?? []).where((t) => t.isAfter(cutoff)).toList();
    _failures[phone] = list;
    return list;
  }

  void _assertNotLocked(String phone) {
    final recent = _recent(phone);
    if (recent.length >= maxAttempts) throw AuthException('locked', retryAt: recent.first.add(lockWindow));
  }

  @override
  Future<String> sendCode(String phone) async {
    await Future<void>.delayed(latency);
    final normalised = normaliseEgyptianMobile(phone);
    if (normalised == null) throw const AuthException('invalidPhone');
    _assertNotLocked(normalised);
    _sent.add(normalised);
    return normalised;
  }

  @override
  Future<Session> verifyCode(String phone, String code) async {
    await Future<void>.delayed(latency);
    final normalised = normaliseEgyptianMobile(phone);
    if (normalised == null) throw const AuthException('invalidPhone');
    _assertNotLocked(normalised);
    if (!_sent.contains(normalised)) throw const AuthException('codeNotSent');
    if (code.trim() != demoOtp) {
      final failures = [..._recent(normalised), _clock()];
      _failures[normalised] = failures;
      _assertNotLocked(normalised);
      throw AuthException('wrongCode', remainingAttempts: maxAttempts - failures.length);
    }
    _failures.remove(normalised);
    _sent.remove(normalised);
    return Session(phone: normalised);
  }

  @override
  Future<void> signOut() async {}
}

class MockLocationService implements LocationService {
  @override
  Future<Area> currentArea() async {
    await Future<void>.delayed(const Duration(milliseconds: 800));
    return Area.newCairo;
  }
}

class AssetCatalogueRepository implements CatalogueRepository {
  AssetCatalogueRepository({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;
  List<CatalogueItem>? _cache;

  @override
  Future<List<CatalogueItem>> all() async {
    if (_cache != null) return _cache!;
    final raw = jsonDecode(await _bundle.loadString('assets/catalogue.json')) as Map<String, dynamic>;
    return _cache = [for (final e in raw['items'] as List) CatalogueItem.fromJson(e as Map<String, dynamic>)];
  }
}

class InMemoryPantryRepository implements PantryRepository {
  InMemoryPantryRepository({DateTime Function()? clock}) : _clock = clock ?? DateTime.now {
    _items = seedPantry(_clock());
  }

  final DateTime Function() _clock;
  late List<PantryItem> _items;

  @override
  Future<List<PantryItem>> items() async => List.unmodifiable(_items);

  @override
  Future<PantryItem> add(PantryItem item) async {
    _items = [..._items, item];
    return item;
  }

  @override
  Future<List<PantryItem>> addAll(List<PantryItem> items) async {
    _items = [..._items, ...items];
    return items;
  }

  @override
  Future<PantryItem> update(PantryItem item) async {
    _items = [for (final i in _items) i.id == item.id ? item : i];
    return item;
  }

  @override
  Future<void> delete(String id) async {
    _items = _items.where((i) => i.id != id).toList();
  }

  @override
  Future<void> reset() async {
    _items = seedPantry(_clock());
  }
}

class MockOcrService implements OcrService {
  @override
  Future<List<String>> readReceipt(SampleReceipt receipt) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return receipt.ocrLines;
  }
}

/// Stands in for the AI gateway call parseReceipt (Gemini → Groq → non-AI fallback).
class MockReceiptAiService implements ReceiptAiService {
  MockReceiptAiService({required this.shouldFail, this.latency = const Duration(milliseconds: 1500)});

  final bool Function() shouldFail;
  final Duration latency;

  @override
  Future<ReceiptParseResult> parseReceipt(List<String> maskedLines, {required String sampleId}) async {
    await Future<void>.delayed(latency);
    if (shouldFail()) {
      return ReceiptParseResult(items: const [], fallbackUsed: true, maskedLines: maskedLines);
    }
    return ReceiptParseResult(items: cannedReceiptResults[sampleId] ?? const [], fallbackUsed: false, maskedLines: maskedLines);
  }
}

class MockNotificationService implements NotificationService {
  final _controller = StreamController<AppNotification>.broadcast();
  final _history = <AppNotification>[];
  var _seq = 0;

  @override
  Stream<AppNotification> get incoming => _controller.stream;

  @override
  List<AppNotification> get history => List.unmodifiable(_history);

  @override
  void simulate(NotificationType type) {
    final n = AppNotification(
      id: 'n${_seq++}',
      type: type,
      deepLink: type == NotificationType.expiryDigest ? '/pantry' : '/deals',
      sentAt: DateTime.now(),
    );
    _history.insert(0, n);
    _controller.add(n);
  }

  @override
  void markRead(String id) {
    final i = _history.indexWhere((n) => n.id == id);
    if (i < 0) return;
    final n = _history[i];
    _history[i] = AppNotification(id: n.id, type: n.type, deepLink: n.deepLink, sentAt: n.sentAt, readAt: DateTime.now());
  }
}
