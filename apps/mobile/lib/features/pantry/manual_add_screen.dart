import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/labels.dart';
import '../../core/expiry_rules.dart';
import '../../data/models.dart';
import '../../state/pantry.dart';

// Shown before the user types, so an item can be added in 3 taps: Add food → Type it → item.
const _commonIds = [
  'baladi-bread',
  'tomatoes',
  'eggs',
  'milk',
  'white-cheese',
  'laban-rayeb',
  'potatoes',
  'onions',
  'cucumbers',
  'chicken-whole',
  'rice',
  'ful',
  'yogurt',
  'bananas',
  'lemons',
  'pasta',
];

/// US-2.07: add an item by hand with Arabic and English autocomplete, in 3 taps or fewer.
class ManualAddScreen extends ConsumerStatefulWidget {
  const ManualAddScreen({super.key});

  @override
  ConsumerState<ManualAddScreen> createState() => _ManualAddScreenState();
}

class _ManualAddScreenState extends ConsumerState<ManualAddScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _added(PantryItem item) {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final controller = ref.read(pantryProvider.notifier);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(l.itemAdded(item.name(context.lang))),
        duration: const Duration(seconds: 10),
        action: SnackBarAction(label: l.undo, onPressed: () => controller.delete(item.id)),
      ),
    );
    _query.clear();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final catalogue = ref.watch(catalogueProvider);
    final fmt = Fmt.watch(ref, context);
    return Scaffold(
      appBar: AppBar(title: Text(l.manualTitle)),
      body: catalogue.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (all) {
          final text = _query.text.trim();
          final byId = {for (final c in all) c.id: c};
          final results = text.isEmpty
              ? [
                  for (final id in _commonIds)
                    if (byId[id] != null) byId[id]!,
                ]
              : searchCatalogue(all, text);
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  key: const Key('manualSearch'),
                  controller: _query,
                  autofocus: false,
                  decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: l.manualSearchHint),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              if (text.isEmpty)
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 16, bottom: 4),
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(l.commonItems, style: Theme.of(context).textTheme.labelLarge),
                  ),
                ),
              Expanded(
                child: ListView(
                  children: [
                    for (final c in results)
                      ListTile(
                        key: Key('suggest-${c.id}'),
                        minTileHeight: 56,
                        leading: Icon(storageIcon(c.defaultStorage)),
                        title: Text(c.name(context.lang)),
                        subtitle: Text(
                          '${c.name(context.lang == 'ar' ? 'en' : 'ar')} · ${fmt.qty(c.defaultQuantity, c.unit)} · ${storageLabel(l, c.defaultStorage)}',
                        ),
                        trailing: const Icon(Icons.add_circle_outline),
                        onTap: () async => _added(await ref.read(pantryProvider.notifier).addFromCatalogue(c)),
                      ),
                    if (text.isNotEmpty)
                      ListTile(
                        key: const Key('addCustom'),
                        leading: const Icon(Icons.edit_note),
                        title: Text(l.addCustom(text)),
                        onTap: () async => _added(await ref.read(pantryProvider.notifier).addCustom(text)),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
