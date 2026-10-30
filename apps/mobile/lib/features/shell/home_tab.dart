import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../core/expiry_rules.dart';
import '../../state/pantry.dart';
import '../common/widgets.dart';
import '../pantry/pantry_widgets.dart';

/// Home: the items closest to expiry ("use first"). Recipes and deals arrive in Sprint 2.
class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final now = DateTime.now();
    final pantry = ref.watch(pantryProvider);
    return pantry.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (items) {
        final atRisk = groupPantry(items).values.expand((g) => g).where((i) => daysUntil(i.expiryDate, now) <= 3).toList()
          ..sort((a, b) => a.expiryDate.compareTo(b.expiryDate));
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(l.homeUseFirst, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            if (atRisk.isEmpty)
              Card(
                child: Padding(padding: const EdgeInsets.all(16), child: Text(l.homeNoRisk)),
              )
            else
              Card(
                child: Column(
                  children: [for (final item in atRisk) PantryItemTile(item: item, now: now, onTap: () => context.go('/pantry'))],
                ),
              ),
            const SizedBox(height: 16),
            Card(
              child: ListTile(leading: const Icon(Icons.restaurant_menu), title: Text(l.recipesSoon), trailing: const SprintChip(2)),
            ),
            Card(
              child: ListTile(leading: const Icon(Icons.local_offer_outlined), title: Text(l.dealsSoon), trailing: const SprintChip(2)),
            ),
          ],
        );
      },
    );
  }
}
