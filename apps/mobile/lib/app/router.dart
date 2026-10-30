import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/models.dart';
import '../features/auth/otp_screen.dart';
import '../features/auth/sign_in_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/pantry/manual_add_screen.dart';
import '../features/pantry/pantry_screen.dart';
import '../features/profile/location_screen.dart';
import '../features/profile/settings_screen.dart';
import '../features/receipt/receipt_review_screen.dart';
import '../features/receipt/receipt_scan_screen.dart';
import '../features/shell/home_shell.dart';
import '../features/shell/home_tab.dart';
import '../features/shell/placeholder_tab.dart';
import '../state/auth.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final session = ValueNotifier<Session?>(ref.read(authProvider));
  ref.listen(authProvider, (_, next) => session.value = next);
  ref.onDispose(session.dispose);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/home',
    refreshListenable: session,
    redirect: (context, state) {
      final s = session.value;
      final path = state.matchedLocation;
      final onAuth = path == '/signin' || path == '/otp';
      if (s == null) return onAuth ? null : '/signin';
      if (s.area == null) return path == '/location' ? null : '/location';
      if (onAuth) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/signin', builder: (_, _) => const SignInScreen()),
      GoRoute(
        path: '/otp',
        builder: (_, state) => OtpScreen(phone: state.uri.queryParameters['phone'] ?? ''),
      ),
      GoRoute(path: '/location', builder: (_, _) => const LocationScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/home', builder: (_, _) => const HomeTab())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/pantry', builder: (_, _) => const PantryScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/deals',
                builder: (_, _) => const PlaceholderTab(kind: PlaceholderKind.deals),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/donate',
                builder: (_, _) => const PlaceholderTab(kind: PlaceholderKind.donate),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/impact',
                builder: (_, _) => const PlaceholderTab(kind: PlaceholderKind.impact),
              ),
            ],
          ),
        ],
      ),
      GoRoute(path: '/add/manual', builder: (_, _) => const ManualAddScreen()),
      GoRoute(path: '/add/receipt', builder: (_, _) => const ReceiptScanScreen()),
      GoRoute(
        path: '/add/receipt/review',
        builder: (_, state) => ReceiptReviewScreen(result: state.extra as ReceiptParseResult?),
      ),
      GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
    ],
  );
});
