import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';
import '../repositories.dart';

/// Where the pantry is kept on the phone between app starts: the last list from the server and
/// the changes not sent yet.
abstract interface class PantryCacheStore {
  Future<String?> read(String key);

  Future<void> write(String key, String value);
}

class SharedPrefsPantryCache implements PantryCacheStore {
  final _prefs = SharedPreferencesAsync();

  @override
  Future<String?> read(String key) => _prefs.getString('elha2.pantry.$key');

  @override
  Future<void> write(String key, String value) => _prefs.setString('elha2.pantry.$key', value);
}

/// A change made on the phone, waiting to reach the backend.
class _PendingWrite {
  const _PendingWrite(this.op, this.id, [this.item]);

  final String op; // create, update or delete
  final String id;
  final PantryItem? item;

  Map<String, dynamic> toJson() => {'op': op, 'id': id, if (item != null) 'item': pantryItemToJson(item!)};

  static _PendingWrite fromJson(Map<String, dynamic> j) =>
      _PendingWrite(j['op'] as String, j['id'] as String, j['item'] == null ? null : pantryItemFromJson(j['item'] as Map<String, dynamic>));
}

String _date(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Map<String, dynamic> pantryItemToJson(PantryItem i) => {
  'id': i.id,
  'catalogueId': i.catalogueId,
  'nameAr': i.nameAr,
  'nameEn': i.nameEn,
  'category': i.category.name,
  'quantity': i.quantity,
  'unit': i.unit.name,
  'storage': i.storage.name,
  'expiryDate': _date(i.expiryDate),
  'expirySource': i.expirySource.name,
  'status': i.status.name,
  'wasteReason': i.wasteReason?.name,
  'wasteNote': i.wasteNote,
  'addedBy': i.addedBy.name,
  'addedOn': i.addedOn.toUtc().toIso8601String(),
};

PantryItem pantryItemFromJson(Map<String, dynamic> j) {
  final expiry = DateTime.parse(j['expiryDate'] as String);
  final waste = j['wasteReason'] as String?;
  return PantryItem(
    id: j['id'] as String,
    catalogueId: j['catalogueId'] as String?,
    nameAr: j['nameAr'] as String,
    nameEn: j['nameEn'] as String,
    category: FoodCategory.values.byName(j['category'] as String),
    quantity: (j['quantity'] as num).toDouble(),
    unit: unitFromJson(j['unit'] as String),
    storage: StoragePlace.values.byName(j['storage'] as String),
    expiryDate: DateTime(expiry.year, expiry.month, expiry.day),
    expirySource: ExpirySource.values.byName(j['expirySource'] as String),
    status: ItemStatus.values.byName(j['status'] as String? ?? 'inStock'),
    wasteReason: waste == null ? null : WasteReason.values.byName(waste),
    wasteNote: j['wasteNote'] as String?,
    addedBy: CaptureMethod.values.byName(j['addedBy'] as String),
    addedOn: DateTime.parse(j['addedOn'] as String).toLocal(),
  );
}

/// The pantry on the backend (US-2.07, 2.10, 2.11), local first: a change shows at once and is sent
/// in the background. Without a connection, changes wait in a queue kept on the phone and the last
/// list is shown, so the pantry works offline (NFR-21); the queue is sent on the next load.
class ApiPantryRepository implements PantryRepository {
  ApiPantryRepository({required this.baseUrl, required this.token, http.Client? client, PantryCacheStore? cache})
    : _client = client ?? http.Client(),
      _cache = cache ?? SharedPrefsPantryCache();

  final String baseUrl;
  final String? Function() token;
  final http.Client _client;
  final PantryCacheStore _cache;
  List<PantryItem>? _items;
  List<_PendingWrite>? _queue;

  @override
  bool get syncsWithBackend => true;

  /// Changes made offline that have not reached the backend yet.
  int get pendingChanges => _queue?.length ?? 0;

  Map<String, String> get _headers => {'content-type': 'application/json', 'authorization': 'Bearer ${token() ?? ''}'};
  Uri _url(String path) => Uri.parse('$baseUrl/api/v1/pantry/items$path');

  Future<List<_PendingWrite>> _pending() async {
    if (_queue != null) return _queue!;
    final raw = await _cache.read('queue');
    _queue = raw == null ? [] : [for (final j in jsonDecode(raw) as List) _PendingWrite.fromJson(j as Map<String, dynamic>)];
    return _queue!;
  }

  Future<void> _saveQueue() async => _cache.write('queue', jsonEncode([for (final w in _queue!) w.toJson()]));

  Future<void> _saveList() async => _cache.write('items', jsonEncode([for (final i in _items!) pantryItemToJson(i)]));

  /// Sends one change. True when it is done (sent, or refused for good); false to retry later.
  Future<bool> _send(_PendingWrite w) async {
    final http.Response res;
    try {
      res = await switch (w.op) {
        'create' => _client.post(_url(''), headers: _headers, body: jsonEncode(pantryItemToJson(w.item!))),
        'update' => _client.patch(
          _url('/${w.id}'),
          headers: _headers,
          body: jsonEncode(Map.of(pantryItemToJson(w.item!))..removeWhere((k, _) => const {'id', 'catalogueId', 'category', 'addedBy', 'addedOn'}.contains(k))),
        ),
        _ => _client.delete(_url('/${w.id}'), headers: _headers),
      }.timeout(const Duration(seconds: 15));
    } catch (_) {
      return false;
    }
    if (res.statusCode < 300) return true;
    // Signed out or the server is down: keep it. Any other refusal would never succeed, so drop it.
    return !(res.statusCode == 401 || res.statusCode == 408 || res.statusCode == 429 || res.statusCode >= 500);
  }

  /// Sends queued changes in order, stopping at the first that has to wait.
  Future<void> _flush() async {
    final queue = await _pending();
    while (queue.isNotEmpty) {
      if (!await _send(queue.first)) break;
      queue.removeAt(0);
      await _saveQueue();
    }
  }

  Future<void> _write(_PendingWrite w) async {
    final queue = await _pending();
    if (queue.isEmpty && await _send(w)) return;
    queue.add(w);
    await _saveQueue();
    await _flush();
  }

  List<PantryItem> _applyQueue(List<PantryItem> base, List<_PendingWrite> queue) {
    var list = [...base];
    for (final w in queue) {
      list = switch (w.op) {
        'create' => [...list.where((i) => i.id != w.id), w.item!],
        'update' => [for (final i in list) i.id == w.id ? w.item! : i],
        _ => list.where((i) => i.id != w.id).toList(),
      };
    }
    return list;
  }

  @override
  Future<void> reload() async {
    await _flush();
    final queue = await _pending();
    try {
      final res = await _client.get(_url(''), headers: _headers).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) throw http.ClientException('HTTP ${res.statusCode}');
      final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      final server = [for (final j in body['items'] as List) pantryItemFromJson(j as Map<String, dynamic>)];
      _items = _applyQueue(server, queue);
    } catch (_) {
      // Offline: the last list we had, with the changes still waiting.
      final raw = await _cache.read('items');
      final cached = raw == null ? <PantryItem>[] : [for (final j in jsonDecode(raw) as List) pantryItemFromJson(j as Map<String, dynamic>)];
      _items = _items ?? _applyQueue(cached, queue);
    }
    await _saveList();
  }

  @override
  Future<List<PantryItem>> items() async {
    if (_items == null) await reload();
    return List.unmodifiable(_items!);
  }

  @override
  Future<PantryItem> add(PantryItem item) async {
    await items();
    _items = [..._items!, item];
    await _saveList();
    await _write(_PendingWrite('create', item.id, item));
    return item;
  }

  @override
  Future<List<PantryItem>> addAll(List<PantryItem> items) async {
    for (final i in items) {
      await add(i);
    }
    return items;
  }

  @override
  Future<PantryItem> update(PantryItem item) async {
    await items();
    _items = [for (final i in _items!) i.id == item.id ? item : i];
    await _saveList();
    await _write(_PendingWrite('update', item.id, item));
    return item;
  }

  @override
  Future<void> delete(String id) async {
    await items();
    _items = _items!.where((i) => i.id != id).toList();
    await _saveList();
    await _write(_PendingWrite('delete', id));
  }

  /// "Reset demo data" never wipes a real account's pantry.
  @override
  Future<void> reset() async {}
}
