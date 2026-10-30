import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../core/expiry_rules.dart';
import '../../data/models.dart';
import '../../state/pantry.dart';
import '../common/widgets.dart';
import 'item_sheet.dart';
import 'pantry_widgets.dart';

/// US-2.11: the pantry grouped by storage place and sorted by expiry, with search and filter.
class PantryScreen extends ConsumerStatefulWidget {
  const PantryScreen({super.key});

  @override
  ConsumerState<PantryScreen> createState() => _PantryScreenState();
}

class _PantryScreenState extends ConsumerState<PantryScreen> {
  StoragePlace? _filter;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final now = DateTime.now();
    final pantry = ref.watch(pantryProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: pantry.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (items) {
          final q = normaliseArabic(_query.trim().toLowerCase());
          final visible = items.where((i) => q.isEmpty || normaliseArabic(i.nameAr).contains(q) || i.nameEn.toLowerCase().contains(q));
          final groups = groupPantry(visible);
          final places = _filter == null ? StoragePlace.values : [_filter!];
          final anyInStock = items.any((i) => i.status == ItemStatus.inStock);
          final anyVisible = places.any((p) => groups[p]!.isNotEmpty);
          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                sliver: SliverToBoxAdapter(
                  child: TextField(
                    key: const Key('pantrySearch'),
                    decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: l.searchFood, isDense: true),
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      ChoiceChip(label: Text(l.filterAll), selected: _filter == null, onSelected: (_) => setState(() => _filter = null)),
                      for (final p in StoragePlace.values) ...[
                        const SizedBox(width: 8),
                        ChoiceChip(
                          avatar: Icon(storageIcon(p), size: 18),
                          label: Text(storageLabel(l, p)),
                          selected: _filter == p,
                          onSelected: (_) => setState(() => _filter = _filter == p ? null : p),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(child: Text(l.urgencyLegend, style: Theme.of(context).textTheme.bodySmall)),
              ),
              if (!anyInStock)
                SliverFillRemaining(hasScrollBody: false, child: Center(child: Text(l.emptyPantry)))
              else if (!anyVisible)
                SliverFillRemaining(hasScrollBody: false, child: Center(child: Text(l.noResults)))
              else
                for (final p in places)
                  if (groups[p]!.isNotEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      sliver: SliverToBoxAdapter(
                        child: Card(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Padding(
                                padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 4),
                                child: Row(
                                  children: [
                                    Icon(storageIcon(p), size: 20),
                                    const SizedBox(width: 8),
                                    Text(
                                      storageLabel(l, p),
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                    ),
                                    const Spacer(),
                                    Text(Fmt.watch(ref, context).digits('${groups[p]!.length}')),
                                  ],
                                ),
                              ),
                              for (final item in groups[p]!)
                                PantryItemTile(item: item, now: now, onTap: () => showItemSheet(context, item)),
                            ],
                          ),
                        ),
                      ),
                    ),
              const SliverToBoxAdapter(child: SizedBox(height: 96)),
            ],
          );
        },
      ),
    );
  }
}

/// Lives in the shell's Scaffold so it floats above snackbars (the Undo bar would otherwise cover it).
class AddFoodButton extends StatelessWidget {
  const AddFoodButton({super.key});

  @override
  Widget build(BuildContext context) => FloatingActionButton.extended(
    key: const Key('addFood'),
    onPressed: () => showAddFoodSheet(context),
    icon: const Icon(Icons.add),
    label: Text(context.l10n.addFood),
  );
}

/// The "Add food" sheet with the five capture methods (SRS §3.1). Receipt and manual work in Sprint 1.
void showAddFoodSheet(BuildContext context) {
  final l = context.l10n;
  // An Undo bar from the previous action must not cover the next screen's buttons.
  ScaffoldMessenger.of(context).hideCurrentSnackBar();
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) {
      Widget option(Key key, IconData icon, String label, {String? route, int? sprint}) => ListTile(
        key: key,
        minTileHeight: 56,
        leading: Icon(icon),
        title: Text(label),
        enabled: route != null,
        trailing: sprint != null ? SprintChip(sprint) : const Icon(Icons.chevron_right),
        onTap: route == null
            ? null
            : () {
                Navigator.of(sheetContext).pop();
                context.push(route);
              },
      );
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l.addSheetTitle, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            option(const Key('captureReceipt'), Icons.receipt_long, l.captureReceipt, route: '/add/receipt'),
            option(const Key('captureManual'), Icons.keyboard, l.captureManual, route: '/add/manual'),
            option(const Key('captureBarcode'), Icons.qr_code_scanner, l.captureBarcode, sprint: 2),
            option(const Key('capturePhoto'), Icons.photo_camera_outlined, l.capturePhoto, sprint: 3),
            option(const Key('captureVoice'), Icons.mic_none, l.captureVoice, sprint: 3),
          ],
        ),
      );
    },
  );
}
