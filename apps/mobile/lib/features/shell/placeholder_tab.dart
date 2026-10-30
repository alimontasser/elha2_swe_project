import 'package:flutter/material.dart';

import '../../app/labels.dart';
import '../common/widgets.dart';

enum PlaceholderKind { deals, donate, impact }

/// Tabs whose stories are scheduled for Sprint 2 or 3 (SRS §6.6.2).
class PlaceholderTab extends StatelessWidget {
  const PlaceholderTab({super.key, required this.kind});

  final PlaceholderKind kind;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final (icon, text, sprint) = switch (kind) {
      PlaceholderKind.deals => (Icons.storefront_outlined, l.dealsSoon, 2),
      PlaceholderKind.donate => (Icons.volunteer_activism_outlined, l.donateSoon, 3),
      PlaceholderKind.impact => (Icons.eco_outlined, l.impactSoon, 3),
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 72, color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.6)),
            const SizedBox(height: 16),
            Text(l.comingSoon, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(text, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            SprintChip(sprint),
          ],
        ),
      ),
    );
  }
}
