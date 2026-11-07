import 'dart:convert';

import 'package:elha2/data/api/api_pantry_repository.dart';
import 'package:elha2/data/models.dart';
import 'package:elha2/state/pantry.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class MemoryCache implements PantryCacheStore {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}

/// A stand-in for /api/v1/pantry/items that can go offline.
class FakeServer {
  final rows = <String, Map<String, dynamic>>{};
  var online = true;
  final calls = <String>[];

  late final client = MockClient((req) async {
    if (!online) throw http.ClientException('offline');
    calls.add('${req.method} ${req.url.path}');
    final id = req.url.pathSegments.length > 4 ? req.url.pathSegments[4] : null;
    switch (req.method) {
      case 'GET':
        return http.Response.bytes(utf8.encode(jsonEncode({'items': rows.values.toList()})), 200);
      case 'POST':
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        rows.putIfAbsent(body['id'] as String, () => body);
        return http.Response.bytes(utf8.encode(jsonEncode(rows[body['id']])), 201);
      case 'PATCH':
        if (!rows.containsKey(id)) return http.Response('{"code":"item_not_found"}', 404);
        rows[id!] = {...rows[id]!, ...jsonDecode(req.body) as Map<String, dynamic>};
        return http.Response.bytes(utf8.encode(jsonEncode(rows[id])), 200);
      case 'DELETE':
        rows.remove(id);
        return http.Response('', 204);
    }
    return http.Response('', 405);
  });
}

PantryItem milk({String? id, ItemStatus status = ItemStatus.inStock}) => PantryItem(
  id: id ?? newItemId(),
  catalogueId: 'milk',
  nameAr: 'لبن',
  nameEn: 'Milk',
  category: FoodCategory.dairy,
  quantity: 1,
  unit: Unit.l,
  storage: StoragePlace.fridge,
  expiryDate: DateTime(2026, 11, 12),
  expirySource: ExpirySource.estimated,
  addedBy: CaptureMethod.barcode,
  addedOn: DateTime(2026, 11, 7, 10),
  status: status,
);

void main() {
  ApiPantryRepository repo(FakeServer server, MemoryCache cache) =>
      ApiPantryRepository(baseUrl: 'http://api', token: () => 'tok', client: server.client, cache: cache);

  test('items added in one app start load from the backend in the next', () async {
    final server = FakeServer();
    final item = milk();
    await repo(server, MemoryCache()).add(item);
    final next = await repo(server, MemoryCache()).items();
    expect(next.single.id, item.id);
    expect(next.single.addedBy, CaptureMethod.barcode);
    expect(next.single.expiryDate, DateTime(2026, 11, 12));
  });

  test('offline: the change shows at once, waits in a queue that survives a restart, and is sent later', () async {
    final server = FakeServer();
    final cache = MemoryCache();
    final first = repo(server, cache);
    final item = milk();
    await first.add(item);

    server.online = false;
    await first.update(item.copyWith(status: ItemStatus.wasted, wasteReason: WasteReason.other, wasteNote: 'نسيته'));
    final extra = milk();
    await first.add(extra);
    expect((await first.items()).map((i) => i.id), [item.id, extra.id]);
    expect(first.pendingChanges, 2);

    // The app restarts while still offline: the last list and the queued changes are shown.
    final restarted = repo(server, cache);
    final offlineList = await restarted.items();
    expect(offlineList.firstWhere((i) => i.id == item.id).wasteNote, 'نسيته');
    expect(offlineList, hasLength(2));

    server.online = true;
    await restarted.reload();
    expect(restarted.pendingChanges, 0);
    expect(server.rows[item.id]!['status'], 'wasted');
    expect(server.rows[item.id]!['wasteNote'], 'نسيته');
    expect(server.rows.containsKey(extra.id), isTrue);
  });

  test('Undo of an add deletes it on the backend too', () async {
    final server = FakeServer();
    final r = repo(server, MemoryCache());
    final item = milk();
    await r.add(item);
    await r.delete(item.id);
    expect(server.rows, isEmpty);
    expect(await r.items(), isEmpty);
  });

  test('a change the backend refuses for good is dropped, so it never blocks later ones', () async {
    final server = FakeServer();
    final r = repo(server, MemoryCache());
    await r.items();
    await r.update(milk(id: 'not-on-server'));
    final item = milk();
    await r.add(item);
    expect(r.pendingChanges, 0);
    expect(server.rows.containsKey(item.id), isTrue);
  });

  test('"Reset demo data" never wipes a real pantry', () async {
    final server = FakeServer();
    final r = repo(server, MemoryCache());
    await r.add(milk());
    await r.reset();
    expect(server.rows, hasLength(1));
  });
}
