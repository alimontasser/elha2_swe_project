import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../app/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/repositories.dart';
import '../../state/pantry.dart';
import 'receipt_scan_screen.dart';

/// US-2.02: every AI-extracted item shows a confidence; low ones are orange; edit or delete in one tap;
/// "Confirm all" saves everything. Nothing is saved before the user confirms (NFR-30).
class ReceiptReviewScreen extends ConsumerStatefulWidget {
  const ReceiptReviewScreen({super.key, required this.result});

  final ReceiptParseResult? result;

  @override
  ConsumerState<ReceiptReviewScreen> createState() => _ReceiptReviewScreenState();
}

class _ReceiptReviewScreenState extends ConsumerState<ReceiptReviewScreen> {
  late List<DraftItem> _items = [...?widget.result?.items];
  bool _saving = false;

  static bool _isUnknown(DraftItem d) => d.catalogueId == null && d.nameEn == '?';

  Future<void> _edit(DraftItem item) async {
    final updated = await showDialog<DraftItem>(
      context: context,
      builder: (_) => _EditDraftDialog(item: item),
    );
    if (updated != null) setState(() => _items = [for (final i in _items) i.id == item.id ? updated : i]);
  }

  Future<void> _confirm() async {
    setState(() => _saving = true);
    final pantry = ref.read(pantryProvider.notifier);
    final confirmed = await pantry.itemsFromDrafts(_items.where((i) => !_isUnknown(i)).toList());
    final draftId = widget.result?.draftId;
    if (draftId != null) {
      // Read by the backend: save there first, in one transaction. On failure nothing is saved.
      try {
        await ref.read(receiptAiServiceProvider).confirm(draftId, confirmed);
      } on ReceiptSaveException catch (e) {
        if (!mounted) return;
        setState(() => _saving = false);
        final l = context.l10n;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(e.expired ? l.receiptDraftExpired : l.receiptSaveFailed)));
        return;
      }
    }
    if (draftId != null && ref.read(pantryRepositoryProvider).syncsWithBackend) {
      // The backend already saved them with the receipt; adding them here would duplicate them.
      await pantry.reload();
    } else {
      await pantry.addConfirmed([for (final c in confirmed) c.item]);
    }
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final message = context.l10n.itemsAdded(confirmed.length);
    context.go('/pantry');
    messenger.showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final result = widget.result;
    final fmt = Fmt.watch(ref, context);

    // A rule-based reading (AI unavailable) still has items to review; only an empty one needs manual entry.
    if (result == null || (result.fallbackUsed && result.items.isEmpty)) {
      return Scaffold(
        appBar: AppBar(title: Text(l.reviewTitle)),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: Elha2Colors.orangeSoft,
              child: ListTile(
                leading: const Icon(Icons.cloud_off, color: Elha2Colors.orange),
                title: Text(l.aiFailedTitle, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(l.aiFailedBody),
              ),
            ),
            const SizedBox(height: 12),
            if (result != null) PaperReceipt(lines: result.maskedLines, highlightMasked: true),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('fallbackByHand'),
              onPressed: () => context.pushReplacement('/add/manual'),
              icon: const Icon(Icons.keyboard),
              label: Text(l.byHand),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.reviewTitle)),
      // In the bottom bar so snackbars float above the buttons instead of covering them.
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => context.push('/add/manual'),
                  icon: const Icon(Icons.keyboard),
                  label: Text(l.byHand),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton.icon(
                  key: const Key('confirmAll'),
                  onPressed: _saving || _items.isEmpty ? null : _confirm,
                  icon: const Icon(Icons.done_all),
                  label: Text(l.confirmAll),
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(child: Text(fmt.digits(l.itemsFound(_items.length)), style: Theme.of(context).textTheme.titleMedium)),
                Container(
                  width: 12,
                  height: 12,
                  decoration: const BoxDecoration(color: Elha2Colors.orange, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Text(l.lowConfidenceHint, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, size: 16, color: Colors.black54),
                const SizedBox(width: 6),
                Expanded(child: Text(l.aiSuggestion, style: Theme.of(context).textTheme.bodySmall)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final item in _items)
                  Dismissible(
                    key: Key('draft-${item.id}'),
                    onDismissed: (_) => setState(() => _items = _items.where((i) => i.id != item.id).toList()),
                    background: Container(
                      alignment: AlignmentDirectional.centerEnd,
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      color: Elha2Colors.redSoft,
                      child: const Icon(Icons.delete_outline, color: Elha2Colors.red),
                    ),
                    child: Card(
                      color: item.isLowConfidence ? Elha2Colors.orangeSoft : null,
                      child: ListTile(
                        minTileHeight: 64,
                        onTap: () => _edit(item),
                        leading: item.isLowConfidence
                            ? const Icon(Icons.help_outline, color: Elha2Colors.orange)
                            : const Icon(Icons.check_circle_outline, color: Elha2Colors.green),
                        title: Text(
                          _isUnknown(item) ? l.unknownLine : item.name(context.lang),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          _isUnknown(item)
                              ? '“${item.sourceLine}”\n${l.unknownLineHint}'
                              : '${fmt.qty(item.quantity, item.unit)} · ${storageLabel(l, item.storage)}',
                        ),
                        isThreeLine: _isUnknown(item),
                        trailing: Text(
                          fmt.digits(l.confidence((item.confidence * 100).round())),
                          style: TextStyle(
                            color: item.isLowConfidence ? Elha2Colors.orange : Elha2Colors.green,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EditDraftDialog extends StatefulWidget {
  const _EditDraftDialog({required this.item});

  final DraftItem item;

  @override
  State<_EditDraftDialog> createState() => _EditDraftDialogState();
}

class _EditDraftDialogState extends State<_EditDraftDialog> {
  late final _name = TextEditingController(text: widget.item.nameEn == '?' ? '' : null);
  late final _qty = TextEditingController(text: _fmtQty(widget.item.quantity));
  late Unit _unit = widget.item.unit;
  late StoragePlace _storage = widget.item.storage;

  static String _fmtQty(double q) => q == q.roundToDouble() ? '${q.toInt()}' : '$q';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_name.text.isEmpty && widget.item.nameEn != '?') _name.text = widget.item.name(context.lang);
  }

  @override
  void dispose() {
    _name.dispose();
    _qty.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final qty = double.tryParse(_qty.text.replaceAll(',', '.'));
    final valid = _name.text.trim().isNotEmpty && qty != null && qty > 0;
    return AlertDialog(
      title: Text(l.editItem),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _name,
              decoration: InputDecoration(labelText: l.itemName),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _qty,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: l.quantity),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 8),
                DropdownButton<Unit>(
                  value: _unit,
                  items: [for (final u in Unit.values) DropdownMenuItem(value: u, child: Text(unitLabel(l, u)))],
                  onChanged: (u) => setState(() => _unit = u ?? _unit),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SegmentedButton<StoragePlace>(
              segments: [
                for (final s in StoragePlace.values) ButtonSegment(value: s, icon: Icon(storageIcon(s)), tooltip: storageLabel(l, s)),
              ],
              selected: {_storage},
              onSelectionChanged: (s) => setState(() => _storage = s.first),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l.cancel)),
        FilledButton(
          onPressed: !valid
              ? null
              : () {
                  final name = _name.text.trim();
                  final isAr = context.lang == 'ar';
                  final renamed = name != widget.item.name(context.lang);
                  Navigator.of(context).pop(
                    widget.item.copyWith(
                      nameAr: isAr || renamed && widget.item.nameAr == '؟' ? name : null,
                      nameEn: !isAr || renamed && widget.item.nameEn == '?' ? name : null,
                      quantity: qty,
                      unit: _unit,
                      storage: _storage,
                      // A person checked it, so it is no longer "uncertain".
                      confidence: 1,
                    ),
                  );
                },
          child: Text(l.save),
        ),
      ],
    );
  }
}
