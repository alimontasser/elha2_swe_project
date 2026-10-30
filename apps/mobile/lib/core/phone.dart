const _arabicDigits = '٠١٢٣٤٥٦٧٨٩';

/// Egyptian mobile numbers: 010, 011, 012 or 015 followed by 8 digits.
/// Accepts +20 / 0020 prefixes, spaces and Arabic-Indic digits; returns the local 11-digit form.
String? normaliseEgyptianMobile(String input) {
  var digits = input.split('').map((c) {
    final i = _arabicDigits.indexOf(c);
    return i >= 0 ? '$i' : c;
  }).join();
  digits = digits.replaceAll(RegExp(r'[\s\-()]'), '');
  if (digits.startsWith('+20')) {
    digits = '0${digits.substring(3)}';
  } else if (digits.startsWith('0020')) {
    digits = '0${digits.substring(4)}';
  } else if (digits.startsWith('20') && digits.length == 12) {
    digits = '0${digits.substring(2)}';
  }
  return RegExp(r'^01[0125]\d{8}$').hasMatch(digits) ? digits : null;
}

/// Shows digits as Arabic-Indic (٠١٢) when the user turns that option on (US-1.02).
/// Converts both ways, because some locale formatters already emit Arabic-Indic digits.
String localiseDigits(String s, {required bool arabicIndic}) {
  if (arabicIndic) return s.replaceAllMapped(RegExp('[0-9]'), (m) => _arabicDigits[int.parse(m[0]!)]);
  return s.replaceAllMapped(RegExp('[٠-٩]'), (m) => '${_arabicDigits.indexOf(m[0]!)}');
}
