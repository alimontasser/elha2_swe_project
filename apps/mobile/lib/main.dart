import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import 'app/router.dart';
import 'app/theme.dart';
import 'data/providers.dart';
import 'features/notifications/push_banner.dart';
import 'l10n/gen/app_localizations.dart';
import 'state/settings.dart';

Future<void> main() async {
  if (supabaseEnabled) {
    WidgetsFlutterBinding.ensureInitialized();
    await sb.Supabase.initialize(url: supabaseUrl, publishableKey: supabasePublishableKey);
  }
  runApp(const ProviderScope(child: Elha2App()));
}

class Elha2App extends ConsumerStatefulWidget {
  const Elha2App({super.key});

  @override
  ConsumerState<Elha2App> createState() => _Elha2AppState();
}

class _Elha2AppState extends ConsumerState<Elha2App> {
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  StreamSubscription<Object>? _pushes;
  StreamSubscription<Object>? _taps;

  @override
  void initState() {
    super.initState();
    // US-11.01: a push arriving while the app is open shows a banner that deep-links to its screen.
    final notifications = ref.read(notificationServiceProvider);
    _pushes = notifications.incoming.listen((n) {
      showPushBanner(_messengerKey, n, ref.read(routerProvider), onOpen: () => notifications.markRead(n.id));
    });
    // A push tapped in the system tray opens its screen directly.
    _taps = notifications.opened.listen((n) {
      notifications.markRead(n.id);
      ref.read(routerProvider).go(n.deepLink);
    });
  }

  @override
  void dispose() {
    _pushes?.cancel();
    _taps?.cancel();
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
