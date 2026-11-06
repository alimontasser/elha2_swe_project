import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/labels.dart';
import '../../data/models.dart';
import '../../state/pantry.dart';
import '../common/widgets.dart';

/// Item details with "used it", "thrown away" (US-2.10) and delete, each with an Undo.
void showItemSheet(BuildContext context, PantryItem item) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _ItemSheet(item: item, hostContext: context),
  );
}

class _ItemSheet extends ConsumerWidget {
  const _ItemSheet({required this.item, required this.hostContext});

  final PantryItem item;
  final BuildContext hostContext;

  /// Closes the sheet, applies the change, then offers Undo for 10 s or reports the failure.
  Future<void> _apply(
    BuildContext sheetContext,
    WidgetRef ref,
    String message,
    Future<void> Function(PantryController controller) change,
  ) async {
    // Read everything first: the sheet is gone by the time a slow save returns.
    final l = hostContext.l10n;
    final messenger = ScaffoldMessenger.of(hostContext);
    final controller = ref.read(pantryProvider.notifier);
    Navigator.of(sheetContext).pop();
    try {
      await change(controller);
    } on Exception {
      showSaveFailed(messenger, l.saveFailed);
      return;
    }
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 10),
        persist: false, // a snackbar with an action otherwise stays until dismissed; the SRS gives Undo 10 s
        action: SnackBarAction(
          label: l.undo,
          onPressed: () async {
            try {
              await controller.restore(item);
            } on Exception {
              showSaveFailed(messenger, l.saveFailed);
            }
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final fmt = Fmt.watch(ref, context);
    final source = switch (item.expirySource) {
      ExpirySource.printed => l.printed,
      ExpirySource.estimated => l.estimated,
      ExpirySource.userSet => '',
    };
    return SafeArea(
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(item.name(context.lang), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _row(Icons.scale_outlined, l.quantity, fmt.qty(item.quantity, item.unit)),
            _row(storageIcon(item.storage), l.storage, storageLabel(l, item.storage)),
            _row(Icons.event_outlined, l.expiry, '${fmt.date(item.expiryDate)}${source.isEmpty ? '' : ' · $source'}'),
            _row(Icons.category_outlined, l.category, categoryLabel(l, item.category)),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('markUsed'),
              icon: const Icon(Icons.check),
              label: Text(l.markUsed),
              onPressed: () => _apply(context, ref, l.usedRecorded, (c) => c.markUsed(item)),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              key: const Key('markWasted'),
              icon: const Icon(Icons.delete_sweep_outlined),
              label: Text(l.markThrownAway),
              onPressed: () async {
                final result = await showWasteReasonDialog(context);
                if (result == null || !context.mounted) return;
                await _apply(context, ref, l.wasteRecorded, (c) => c.markWasted(item, result.reason, note: result.note));
              },
            ),
            TextButton.icon(
              icon: const Icon(Icons.delete_outline),
              label: Text(l.deleteItem),
              onPressed: () => _apply(context, ref, l.deleted, (c) => c.delete(item.id)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Icon(icon, size: 20, color: Colors.black54),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(color: Colors.black54)),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

/// US-2.10: a fixed reason list plus "other" with free text.
Future<({WasteReason reason, String? note})?> showWasteReasonDialog(BuildContext context) {
  return showDialog<({WasteReason reason, String? note})>(context: context, builder: (_) => const _WasteDialog());
}

class _WasteDialog extends StatefulWidget {
  const _WasteDialog();

  @override
  State<_WasteDialog> createState() => _WasteDialogState();
}

class _WasteDialogState extends State<_WasteDialog> {
  WasteReason? _reason;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final valid = _reason != null && (_reason != WasteReason.other || _note.text.trim().isNotEmpty);
    return AlertDialog(
      title: Text(l.wasteTitle),
      content: SingleChildScrollView(
        child: RadioGroup<WasteReason>(
          groupValue: _reason,
          onChanged: (v) => setState(() => _reason = v),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final r in WasteReason.values)
                RadioListTile<WasteReason>(key: Key('waste-${r.name}'), value: r, title: Text(wasteLabel(l, r))),
              if (_reason == WasteReason.other)
                TextField(
                  controller: _note,
                  autofocus: true,
                  decoration: InputDecoration(hintText: l.wasteOtherHint),
                  onChanged: (_) => setState(() {}),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l.cancel)),
        FilledButton(
          key: const Key('saveWaste'),
          onPressed: valid
              ? () => Navigator.of(context).pop((reason: _reason!, note: _reason == WasteReason.other ? _note.text.trim() : null))
              : null,
          child: Text(l.save),
        ),
      ],
    );
  }
}
