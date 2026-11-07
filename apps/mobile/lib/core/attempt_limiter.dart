import 'dart:convert';

/// US-1.01: at most [maxAttempts] wrong codes per number within [window]; then the number is
/// locked until the oldest failure leaves the window. Pure, so the mock and the Supabase
/// adapter share it, and serialisable so the adapter can keep it across app restarts.
class AttemptLimiter {
  AttemptLimiter({DateTime Function()? clock, this.maxAttempts = 5, this.window = const Duration(hours: 1)})
    : _clock = clock ?? DateTime.now;

  final int maxAttempts;
  final Duration window;
  final DateTime Function() _clock;
  final _failures = <String, List<DateTime>>{};

  List<DateTime> _recent(String key) {
    final cutoff = _clock().subtract(window);
    final list = (_failures[key] ?? const <DateTime>[]).where((t) => t.isAfter(cutoff)).toList();
    if (list.isEmpty) {
      _failures.remove(key);
    } else {
      _failures[key] = list;
    }
    return list;
  }

  /// When the number can try again, or null if it is not locked.
  DateTime? lockedUntil(String key) {
    final recent = _recent(key);
    return recent.length >= maxAttempts ? recent.first.add(window) : null;
  }

  /// Records a wrong code and returns how many tries are left this hour.
  int recordFailure(String key) {
    final failures = [..._recent(key), _clock()];
    _failures[key] = failures;
    return maxAttempts - failures.length;
  }

  void clear(String key) => _failures.remove(key);

  String toJson() => jsonEncode({
    for (final e in _failures.entries) e.key: [for (final t in e.value) t.toUtc().toIso8601String()],
  });

  void loadJson(String? raw) {
    if (raw == null || raw.isEmpty) return;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      for (final e in map.entries) {
        _failures[e.key] = [for (final t in e.value as List) DateTime.parse(t as String)];
      }
    } on FormatException {
      // A corrupt store only loses the counter; it never blocks sign-in.
    }
  }
}
