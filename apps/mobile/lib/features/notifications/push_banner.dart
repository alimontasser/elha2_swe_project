import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/models.dart';
import '../../l10n/gen/app_localizations.dart';

({String title, String body, IconData icon}) notificationText(AppLocalizations l, NotificationType t) => switch (t) {
  NotificationType.expiryDigest => (title: l.pushExpiryTitle, body: l.pushExpiryBody, icon: Icons.schedule),
  NotificationType.reservation => (title: l.pushReservedTitle, body: l.pushReservedBody, icon: Icons.shopping_bag_outlined),
  NotificationType.pickup => (title: l.pushPickupTitle, body: l.pushPickupBody, icon: Icons.storefront_outlined),
};

// One timer for the one banner on screen: a new push restarts it, so an older push cannot hide a newer banner.
Timer? _hideBanner;

/// Demo stand-in for an FCM push received in the foreground. [onOpen] runs when the user taps Open.
void showPushBanner(GlobalKey<ScaffoldMessengerState> messengerKey, AppNotification n, GoRouter router, {required VoidCallback onOpen}) {
  final messenger = messengerKey.currentState;
  if (messenger == null) return;
  _hideBanner?.cancel();
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
              onOpen();
              router.go(n.deepLink);
            },
            child: Text(context.l10n.open),
          ),
        ),
      ],
    ),
  );
  _hideBanner = Timer(const Duration(seconds: 8), () {
    if (messengerKey.currentState?.mounted ?? false) messenger.hideCurrentMaterialBanner();
  });
}
