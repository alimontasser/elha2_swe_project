import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'data/providers.dart';
import 'features/notifications/push_banner.dart';
import 'l10n/gen/app_localizations.dart';
import 'state/settings.dart';

void main() => runApp(const ProviderScope(child: Elha2App()));

class Elha2App extends ConsumerStatefulWidget {
  const Elha2App({super.key});

  @override
  ConsumerState<Elha2App> createState() => _Elha2AppState();
}

class _Elha2AppState extends ConsumerState<Elha2App> {
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  StreamSubscription<Object>? _pushes;

  @override
  void initState() {
    super.initState();
    // US-11.01: a push arriving while the app is open shows a banner that deep-links to its screen.
    _pushes = ref.read(notificationServiceProvider).incoming.listen((n) {
      showPushBanner(_messengerKey, n, ref.read(routerProvider));
    });
  }

  @override
  void dispose() {
    _pushes?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: _messengerKey,
      theme: buildTheme(),
      locale: settings.locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: ref.watch(routerProvider),
    );
  }
}
