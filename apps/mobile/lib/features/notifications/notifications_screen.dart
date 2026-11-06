import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/providers.dart';
import 'push_banner.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final service = ref.watch(notificationServiceProvider);
    final fmt = Fmt.watch(ref, context);
    return Scaffold(
      appBar: AppBar(title: Text(l.notificationsTitle)),
      body: StreamBuilder(
        stream: service.changes,
        builder: (context, _) {
          final list = service.history;
          if (list.isEmpty) return Center(child: Text(l.noNotifications));
          return ListView.separated(
            itemCount: list.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final n = list[i];
              final text = notificationText(l, n.type);
              return ListTile(
                leading: Icon(text.icon, color: n.readAt == null ? Theme.of(context).colorScheme.primary : Colors.black38),
                title: Text(text.title, style: TextStyle(fontWeight: n.readAt == null ? FontWeight.bold : FontWeight.normal)),
                subtitle: Text('${text.body}\n${fmt.time(n.sentAt)}'),
                isThreeLine: true,
                onTap: () {
                  service.markRead(n.id);
                  context.go(n.deepLink);
                },
              );
            },
          );
        },
      ),
    );
  }
}
