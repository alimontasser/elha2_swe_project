import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/models.dart';
import '../../l10n/gen/app_localizations.dart';

({String title, String body, IconData icon}) notificationText(AppLocalizations l, NotificationType t) => switch (t) {
  NotificationType.expiryDigest => (title: l.pushExpiryTitle, body: l.pushExpiryBody, icon: Icons.schedule),
  NotificationType.reservation => (title: l.pushReservedTitle, body: l.pushReservedBody, icon: Icons.shopping_bag_outlined),
};

/// Demo stand-in for an FCM push received in the foreground.
void showPushBanner(GlobalKey<ScaffoldMessengerState> messengerKey, AppNotification n, GoRouter router) {
  final messenger = messengerKey.currentState;
  if (messenger == null) return;
  messenger.clearMaterialBanners();
  messenger.showMaterialBanner(
    MaterialBanner(
      key: ValueKey(n.id),
      backgroundColor: Colors.white,
      elevation: 3,
      leading: Builder(
        builder: (context) => Icon(notificationText(context.l10n, n.type).icon, color: Theme.of(context).colorScheme.primary),
      ),
      content: Builder(
        builder: (context) {
          final text = notificationText(context.l10n, n.type);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(text.title, style: const TextStyle(fontWeight: FontWeight.bold)),
              Text(text.body),
            ],
          );
        },
      ),
      actions: [
        Builder(
          builder: (context) => TextButton(
            onPressed: () => messenger.hideCurrentMaterialBanner(),
            child: Text(MaterialLocalizations.of(context).closeButtonLabel),
          ),
        ),
        Builder(
          builder: (context) => FilledButton(
            onPressed: () {
              messenger.hideCurrentMaterialBanner();
              router.go(n.deepLink);
            },
            child: Text(context.l10n.open),
          ),
        ),
      ],
    ),
  );
  Future<void>.delayed(const Duration(seconds: 8), () {
    if (messengerKey.currentState?.mounted ?? false) messenger.hideCurrentMaterialBanner();
  });
}
