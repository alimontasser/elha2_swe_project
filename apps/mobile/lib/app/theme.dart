import 'package:flutter/material.dart';

import '../core/expiry_rules.dart';

// Elha2 palette, shared with the web portal.
class Elha2Colors {
  static const green = Color(0xFF1F6F4A);
  static const greenSoft = Color(0xFFE8F3EC);
  static const sand = Color(0xFFF7F4EE);
  static const orange = Color(0xFFB85C12);
  static const orangeSoft = Color(0xFFFBEFE2);
  static const red = Color(0xFFB3261E);
  static const redSoft = Color(0xFFFBE9E7);
  static const ink = Color(0xFF1D2420);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: Elha2Colors.green, primary: Elha2Colors.green, surface: Colors.white);
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Cairo',
    colorScheme: scheme,
    scaffoldBackgroundColor: Elha2Colors.sand,
    appBarTheme: const AppBarTheme(backgroundColor: Elha2Colors.sand, foregroundColor: Elha2Colors.ink, centerTitle: false),
    // Touch targets of at least 48 dp (NFR-17).
    materialTapTargetSize: MaterialTapTargetSize.padded,
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(48, 52))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 52))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE4DED2)),
      ),
    ),
  );
}

({Color fg, Color bg, IconData icon}) urgencyStyle(Urgency u) => switch (u) {
  Urgency.expired || Urgency.today => (fg: Elha2Colors.red, bg: Elha2Colors.redSoft, icon: Icons.error_outline),
  Urgency.soon => (fg: Elha2Colors.orange, bg: Elha2Colors.orangeSoft, icon: Icons.schedule),
  Urgency.later => (fg: Elha2Colors.green, bg: Elha2Colors.greenSoft, icon: Icons.check_circle_outline),
};
