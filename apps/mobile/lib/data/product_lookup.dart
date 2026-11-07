import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

/// A packaged product found by its barcode (US-2.03).
class ScannedProduct {
  const ScannedProduct({
    required this.barcode,
    required this.nameAr,
    required this.nameEn,
    required this.category,
    required this.unit,
    required this.quantity,
    required this.storage,
    this.brand,
    this.catalogueId,
  });

  final String barcode;
  final String nameAr;
  final String nameEn;
  final String? brand;

  /// The catalogue item that gives the shelf life, when the product could be matched.
  final String? catalogueId;
  final FoodCategory category;
  final Unit unit;
  final double quantity;
  final StoragePlace storage;

  String name(String languageCode) => languageCode == 'ar' ? nameAr : nameEn;

  Map<String, dynamic> toJson() => {
    'barcode': barcode,
    'found': true,
    'nameAr': nameAr,
    'nameEn': nameEn,
    'brand': brand,
    'catalogueId': catalogueId,
    'category': category.name,
    'unit': unit.name,
    'quantity': quantity,
    'storage': storage.name,
  };

  static ScannedProduct fromJson(Map<String, dynamic> j) => ScannedProduct(
    barcode: j['barcode'] as String,
    nameAr: j['nameAr'] as String,
    nameEn: j['nameEn'] as String,
    brand: j['brand'] as String?,
    catalogueId: j['catalogueId'] as String?,
    category: FoodCategory.values.byName(j['category'] as String),
    unit: unitFromJson(j['unit'] as String),
    quantity: (j['quantity'] as num).toDouble(),
    storage: StoragePlace.values.byName(j['storage'] as String),
  );
}

class ProductLookupResult {
  const ProductLookupResult.found(ScannedProduct this.product) : lookupFailed = false;
  const ProductLookupResult.unknown() : product = null, lookupFailed = false;

  /// Offline, or the lookup could not finish: the product may exist, but we can't tell now.
  const ProductLookupResult.failed() : product = null, lookupFailed = true;

  final ScannedProduct? product;
  final bool lookupFailed;
}

/// "8 to 14 digits": EAN-8, UPC-A, EAN-13 and GTIN-14.
bool isBarcode(String value) => RegExp(r'^\d{8,14}$').hasMatch(value);

abstract interface class ProductLookup {
  Future<ProductLookupResult> lookup(String barcode);

  /// The user's name for an unknown barcode, sent for admin review. Never throws.
  Future<void> suggest(String barcode, {required String nameAr, String? nameEn});
}

/// The backend's product lookup (our products, then Open Food Facts).
class ApiProductLookup implements ProductLookup {
  ApiProductLookup({required this.baseUrl, required this.token, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final String? Function() token;
  final http.Client _client;

  Map<String, String> get _headers => {'content-type': 'application/json', 'authorization': 'Bearer ${token() ?? ''}'};

  @override
  Future<ProductLookupResult> lookup(String barcode) async {
    try {
      final res = await _client.get(Uri.parse('$baseUrl/api/v1/products/$barcode'), headers: _headers).timeout(const Duration(seconds: 3));
      if (res.statusCode != 200) return const ProductLookupResult.failed();
      final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      if (body['found'] == true) return ProductLookupResult.found(ScannedProduct.fromJson(body));
      return body['lookupFailed'] == true ? const ProductLookupResult.failed() : const ProductLookupResult.unknown();
    } catch (_) {
      return const ProductLookupResult.failed();
    }
  }

  @override
  Future<void> suggest(String barcode, {required String nameAr, String? nameEn}) async {
    try {
      await _client
          .post(
            Uri.parse('$baseUrl/api/v1/products/$barcode/suggestion'),
            headers: _headers,
            body: jsonEncode({'nameAr': nameAr, 'nameEn': ?nameEn}),
          )
          .timeout(const Duration(seconds: 10));
    } catch (_) {
      // The item is already in the pantry; a lost suggestion only means an admin doesn't see it.
    }
  }
}

abstract interface class ProductCacheStore {
  Future<String?> read(String barcode);

  Future<void> write(String barcode, String json);
}

class SharedPrefsProductCache implements ProductCacheStore {
  final _prefs = SharedPreferencesAsync();

  @override
  Future<String?> read(String barcode) => _prefs.getString('elha2.product.$barcode');

  @override
  Future<void> write(String barcode, String json) => _prefs.setString('elha2.product.$barcode', json);
}

/// Products seen before are answered from the phone: instant, and offline too (US-2.03, NFR-21).
class CachedProductLookup implements ProductLookup {
  CachedProductLookup(this._inner, {ProductCacheStore? cache}) : _cache = cache ?? SharedPrefsProductCache();

  final ProductLookup _inner;
  final ProductCacheStore _cache;

  @override
  Future<ProductLookupResult> lookup(String barcode) async {
    final cached = await _cache.read(barcode);
    if (cached != null) return ProductLookupResult.found(ScannedProduct.fromJson(jsonDecode(cached) as Map<String, dynamic>));
    final result = await _inner.lookup(barcode);
    final product = result.product;
    if (product != null) await _cache.write(barcode, jsonEncode(product.toJson()));
    return result;
  }

  @override
  Future<void> suggest(String barcode, {required String nameAr, String? nameEn}) => _inner.suggest(barcode, nameAr: nameAr, nameEn: nameEn);
}

/// Demo products, so scanning works without the backend.
class MockProductLookup implements ProductLookup {
  static const demo = {
    '6223000000017': ScannedProduct(
      barcode: '6223000000017',
      nameAr: 'لبن جهينة كامل الدسم',
      nameEn: 'Juhayna Full Cream Milk',
      brand: 'Juhayna',
      catalogueId: 'milk',
      category: FoodCategory.dairy,
      unit: Unit.l,
      quantity: 1,
      storage: StoragePlace.fridge,
    ),
    '5449000000996': ScannedProduct(
      barcode: '5449000000996',
      nameAr: 'كوكاكولا',
      nameEn: 'Coca-Cola',
      brand: 'Coca-Cola',
      catalogueId: 'soda',
      category: FoodCategory.drinks,
      unit: Unit.ml,
      quantity: 330,
      storage: StoragePlace.cupboard,
    ),
  };

  final suggestions = <String, String>{};

  @override
  Future<ProductLookupResult> lookup(String barcode) async {
    final p = demo[barcode];
    return p == null ? const ProductLookupResult.unknown() : ProductLookupResult.found(p);
  }

  @override
  Future<void> suggest(String barcode, {required String nameAr, String? nameEn}) async => suggestions[barcode] = nameAr;
}
