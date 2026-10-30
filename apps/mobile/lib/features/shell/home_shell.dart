import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/providers.dart';
import '../common/widgets.dart';
import '../pantry/pantry_screen.dart';

/// Five tabs in a bottom bar (SRS §3.1): Home, Pantry, Deals, Donate, Impact.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final notifications = ref.watch(notificationServiceProvider);
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [const BrandMark(size: 32), const SizedBox(width: 10), Text(l.appName)]),
        actions: [
          StreamBuilder(
            stream: notifications.incoming,
            builder: (context, _) {
              final unread = notifications.history.where((n) => n.readAt == null).length;
              return IconButton(
                tooltip: l.notificationsTitle,
                onPressed: () => context.push('/notifications'),
                icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined)),
              );
            },
          ),
          IconButton(tooltip: l.settingsTitle, onPressed: () => context.push('/settings'), icon: const Icon(Icons.settings_outlined)),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(28), child: DemoBanner()),
      ),
      body: shell,
      floatingActionButton: shell.currentIndex == 1 ? const AddFoodButton() : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: l.tabHome),
          NavigationDestination(icon: const Icon(Icons.kitchen_outlined), selectedIcon: const Icon(Icons.kitchen), label: l.tabPantry),
          NavigationDestination(
            icon: const Icon(Icons.local_offer_outlined),
            selectedIcon: const Icon(Icons.local_offer),
            label: l.tabDeals,
          ),
          NavigationDestination(
            icon: const Icon(Icons.volunteer_activism_outlined),
            selectedIcon: const Icon(Icons.volunteer_activism),
            label: l.tabDonate,
          ),
          NavigationDestination(icon: const Icon(Icons.eco_outlined), selectedIcon: const Icon(Icons.eco), label: l.tabImpact),
        ],
      ),
    );
  }
}
