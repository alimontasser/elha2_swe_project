import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../state/auth.dart';
import '../../state/pantry.dart';
import '../../state/settings.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final settings = ref.watch(settingsProvider);
    final session = ref.watch(authProvider);
    final notifier = ref.read(settingsProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: Text(l.settingsTitle)),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.phone_iphone),
            title: Text(Fmt.watch(ref, context).digits(session?.phone ?? ''), textDirection: TextDirection.ltr),
          ),
          const Divider(),
          ListTile(leading: const Icon(Icons.translate), title: Text(l.language)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SegmentedButton<String>(
              key: const Key('languageSegment'),
              segments: const [
                ButtonSegment(value: 'ar', label: Text('العربية')),
                ButtonSegment(value: 'en', label: Text('English')),
              ],
              selected: {settings.locale.languageCode},
              onSelectionChanged: (s) => notifier.setLanguage(s.first),
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.pin_outlined),
            title: Text(l.arabicDigits),
            value: settings.arabicDigits,
            onChanged: context.lang == 'ar' ? notifier.setArabicDigits : null,
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.location_on_outlined),
            title: Text(l.area),
            subtitle: Text('${session?.area == null ? '—' : areaLabel(l, session!.area!)}\n${l.areaPrivacy}'),
            isThreeLine: true,
            trailing: const Icon(Icons.edit_outlined),
            onTap: () => context.push('/location'),
          ),
          const Divider(),
          ListTile(title: Text(l.demoTools, style: Theme.of(context).textTheme.titleSmall)),
          SwitchListTile(
            secondary: const Icon(Icons.cloud_off_outlined),
            title: Text(l.simulateAiFailure),
            value: settings.simulateAiFailure,
            onChanged: notifier.setSimulateAiFailure,
          ),
          ListTile(
            leading: const Icon(Icons.notifications_active_outlined),
            title: Text(l.sendExpiryPush),
            onTap: () => ref.read(notificationServiceProvider).simulate(NotificationType.expiryDigest),
          ),
          ListTile(
            leading: const Icon(Icons.shopping_bag_outlined),
            title: Text(l.sendReservationPush),
            onTap: () => ref.read(notificationServiceProvider).simulate(NotificationType.reservation),
          ),
          ListTile(
            leading: const Icon(Icons.restart_alt),
            title: Text(l.resetDemo),
            onTap: () => ref.read(pantryProvider.notifier).reset(),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: Text(l.signOut, style: const TextStyle(color: Colors.red)),
            onTap: () => ref.read(authProvider.notifier).signOut(),
          ),
        ],
      ),
    );
  }
}
