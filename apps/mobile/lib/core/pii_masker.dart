// US-14.03: hide names, phone numbers and card digits in receipt text on the phone,
// before anything is uploaded (SDD v1.1 §3.2.2, "Personal-data masker").
// The AI gateway repeats this check server-side (context-builder step 4).

class MaskResult {
  const MaskResult(this.lines, this.maskedCount);

  final List<String> lines;

  /// Number of personal details hidden.
  final int maskedCount;
}

class PiiMasker {
  const PiiMasker();

  static const nameToken = '[name]';
  static const phoneToken = '[phone]';
  static const cardToken = '[card]';
  static const emailToken = '[email]';

  static final _arabicDigits = RegExp('[٠-٩]');

  // Labels after which a person's name follows, in Arabic and English.
  static final _nameLabel = RegExp(
    r'((?:customer|client|cashier|name|member|delivered to|اسم العميل|العميل|الكاشير|كاشير|الاسم|اسم|السيد|السيدة|عضو)\s*[:：\-]?\s*)'
    r'([^\d:：\n]{1,40}?)\s*$',
    caseSensitive: false,
  );

  static final _email = RegExp(r'[\w.+-]+@[\w-]+\.[\w.-]+');

  // Card numbers: 13-19 digits, possibly grouped, or masked forms like **** 1234 / XXXX-XXXX-XXXX-1234.
  static final _card = RegExp(r'(?:(?:\d|[*xX]){4}[ \-]?){3}(?:\d|[*xX]){1,7}');
  static final _cardTail = RegExp(r'((?:card|visa|mastercard|meeza|بطاقة|كارت|فيزا)[^\d\n]{0,12})(\d{4})\b', caseSensitive: false);

  // Egyptian mobiles (01x xxxx xxxx, +20 / 0020) and Cairo / governorate landlines (02 xxxx xxxx, 0xx xxx xxxx).
  static final _phone = RegExp(
    r'(?<!\d)(?:(?:\+|00)20[\s\-]?|0)(?:1[0125](?:[\s\-]?\d){8}|2(?:[\s\-]?\d){8}|[3-9]\d(?:[\s\-]?\d){7})(?!\d)',
  );

  static bool _luhn(String digits) {
    var sum = 0;
    var alt = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = digits.codeUnitAt(i) - 48;
      if (alt) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      alt = !alt;
    }
    return sum % 10 == 0;
  }

  String _toAsciiDigits(String s) => s.replaceAllMapped(_arabicDigits, (m) => '${m[0]!.codeUnitAt(0) - 0x0660}');

  MaskResult mask(List<String> lines) {
    var count = 0;
    final out = <String>[];
    for (final raw in lines) {
      var line = _toAsciiDigits(raw);

      line = line.replaceAllMapped(_email, (_) {
        count++;
        return emailToken;
      });
      line = line.replaceAllMapped(_card, (m) {
        final digits = m[0]!.replaceAll(RegExp(r'[^\d*xX]'), '');
        final isMasked = digits.contains(RegExp('[*xX]'));
        // Pure digit runs must pass the Luhn check, so product barcodes (EAN-13) are usually kept.
        if (digits.length < 13 || (!isMasked && !_luhn(digits))) return m[0]!;
        count++;
        return cardToken;
      });
      line = line.replaceAllMapped(_cardTail, (m) {
        count++;
        return '${m[1]}$cardToken';
      });
      line = line.replaceAllMapped(_phone, (_) {
        count++;
        return phoneToken;
      });
      line = line.replaceAllMapped(_nameLabel, (m) {
        final value = m[2]!.trim();
        if (value.isEmpty || value.startsWith('[')) return m[0]!;
        count++;
        return '${m[1]}$nameToken';
      });
      out.add(line);
    }
    return MaskResult(out, count);
  }
}
