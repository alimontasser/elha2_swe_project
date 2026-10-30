# Elha2 mobile app

Flutter app with Riverpod. The Sprint 1 demo runs on mock repositories; each implementation is chosen in `lib/data/providers.dart`.

```bash
flutter pub get
flutter run -d chrome
flutter analyze && flutter test
```

**Layout**

| Folder | What |
|---|---|
| `lib/app` | Theme, router, label helpers |
| `lib/core` | Pure logic: personal-data masker, expiry rules, phone numbers |
| `lib/data` | Models, repository interfaces, `mock/` implementations, `providers.dart` |
| `lib/state` | Riverpod notifiers |
| `lib/features` | Screens |
| `lib/l10n/*.arb` | Arabic (default) and English strings |
| `assets/catalogue.json` | Seed Egyptian food catalogue, for the team to review |
| `assets/fonts` | Cairo (SIL OFL 1.1) |
