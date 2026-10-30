import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class Settings {
  const Settings({this.locale = const Locale('ar'), this.arabicDigits = false, this.simulateAiFailure = false});

  /// Arabic is the default (NFR-16).
  final Locale locale;
  final bool arabicDigits;

  /// Demo switch: make the AI gateway return the non-AI fallback (NFR-22).
  final bool simulateAiFailure;

  Settings copyWith({Locale? locale, bool? arabicDigits, bool? simulateAiFailure}) => Settings(
    locale: locale ?? this.locale,
    arabicDigits: arabicDigits ?? this.arabicDigits,
    simulateAiFailure: simulateAiFailure ?? this.simulateAiFailure,
  );
}

class SettingsNotifier extends Notifier<Settings> {
  @override
  Settings build() => const Settings();

  void setLanguage(String code) => state = state.copyWith(locale: Locale(code));

  void toggleLanguage() => setLanguage(state.locale.languageCode == 'ar' ? 'en' : 'ar');

  void setArabicDigits(bool value) => state = state.copyWith(arabicDigits: value);

  void setSimulateAiFailure(bool value) => state = state.copyWith(simulateAiFailure: value);
}

final settingsProvider = NotifierProvider<SettingsNotifier, Settings>(SettingsNotifier.new);
