import 'dart:convert';
import 'dart:io';

import 'package:elha2/core/pii_masker.dart';
import 'package:elha2/data/mock/mock_data.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final fixture = jsonDecode(File('test/fixtures/pii_cases.json').readAsStringSync()) as Map<String, dynamic>;
  const masker = PiiMasker();

  group('PiiMasker (US-14.03)', () {
    for (final c in fixture['masked'] as List) {
      test('masks "${c['in']}"', () {
        final r = masker.mask([c['in'] as String]);
        expect(r.lines.single, c['out']);
        expect(r.maskedCount, greaterThan(0));
      });
    }

    for (final line in fixture['kept'] as List) {
      test('keeps "$line"', () {
        final r = masker.mask([line as String]);
        expect(r.maskedCount, 0);
        expect(r.lines.single.replaceAll(RegExp(r'\s+'), ' '), line.replaceAll(RegExp(r'\s+'), ' '));
      });
    }

    test('no personal detail from the sample receipts survives masking', () {
      for (final receipt in sampleReceipts) {
        final masked = masker.mask(receipt.ocrLines).lines.join('\n');
        for (final secret in ['منى أحمد', '0101 234 5678', 'Karim', 'Sara Mostafa', '112 345 6789', '4417', '9921', 'محمد علي']) {
          expect(masked.contains(secret), isFalse, reason: '$secret leaked from ${receipt.id}');
        }
      }
    });
  });
}
