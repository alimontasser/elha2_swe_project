import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../app/labels.dart';
import '../../app/theme.dart';
import '../../core/expiry_rules.dart';
import '../../data/models.dart';
import '../../data/product_lookup.dart';
import '../../data/providers.dart';
import '../../state/pantry.dart';
import '../common/widgets.dart';

/// US-2.03: scan or type a barcode; a known product fills in by itself, an unknown one is named by
/// the user and sent for admin review. The camera reads the code on the phone (ML Kit on Android).
class BarcodeScreen extends ConsumerStatefulWidget {
  const BarcodeScreen({super.key});

  @override
  ConsumerState<BarcodeScreen> createState() => _BarcodeScreenState();
}

class _BarcodeScreenState extends ConsumerState<BarcodeScreen> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  MobileScannerController? _camera;
  String? _barcode;
  ProductLookupResult? _result;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (ref.read(barcodeCameraProvider)) {
      _camera = MobileScannerController(
        formats: const [BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upcA, BarcodeFormat.upcE],
        detectionSpeed: DetectionSpeed.noDuplicates,
      );
    }
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _camera?.dispose();
    super.dispose();
  }

  Future<void> _lookup(String raw) async {
    final code = raw.replaceAll(RegExp(r'\s'), '');
    if (_busy || code == _barcode && _result != null) return;
    if (!isBarcode(code)) {
      setState(() => _error = context.l10n.barcodeInvalid);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _barcode = code;
      _result = null;
      _code.text = code;
    });
    final result = await ref.read(productLookupProvider).lookup(code);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _result = result;
    });
  }

  Future<void> _add(Future<PantryItem> Function(PantryController c) add) async {
    final l = context.l10n;
    final lang = context.lang;
    final messenger = ScaffoldMessenger.of(context);
    final controller = ref.read(pantryProvider.notifier);
    final PantryItem item;
    try {
      item = await add(controller);
    } on Exception {
      showSaveFailed(messenger, l.saveFailed);
      return;
    }
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(l.itemAdded(item.name(lang))),
        duration: const Duration(seconds: 10),
        persist: false,
        action: SnackBarAction(
          label: l.undo,
          onPressed: () async {
            try {
              await controller.delete(item.id);
            } on Exception {
              showSaveFailed(messenger, l.saveFailed);
            }
          },
        ),
      ),
    );
    if (!mounted) return;
    // Ready for the next product.
    setState(() {
      _barcode = null;
      _result = null;
      _code.clear();
      _name.clear();
    });
  }

  Future<void> _addUnknown() async {
    final name = _name.text.trim();
    final barcode = _barcode;
    if (name.isEmpty || barcode == null) return;
    if (!(_result?.lookupFailed ?? true)) {
      // Sent for admin review; it does not hold up adding the item.
      ref.read(productLookupProvider).suggest(barcode, nameAr: name, nameEn: name);
    }
    await _add((c) => c.addCustom(name, addedBy: CaptureMethod.barcode));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final camera = _camera;
    return Scaffold(
      appBar: AppBar(title: Text(l.barcodeTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (camera != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 240,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    MobileScanner(
                      controller: camera,
                      onDetect: (capture) {
                        final value = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
                        if (value != null) _lookup(value);
                      },
                      errorBuilder: (context, _) => ColoredBox(
                        color: Elha2Colors.sand,
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Text(context.l10n.barcodeCameraUnavailable, textAlign: TextAlign.center),
                          ),
                        ),
                      ),
                    ),
                    IgnorePointer(
                      child: Center(
                        child: Container(
                          width: 240,
                          height: 120,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white, width: 3),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Text(l.barcodeHint),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('barcodeField'),
                  controller: _code,
                  keyboardType: TextInputType.number,
                  textDirection: TextDirection.ltr,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(14)],
                  onSubmitted: _lookup,
                  decoration: InputDecoration(labelText: l.barcodeField, errorText: _error, border: const OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                key: const Key('barcodeFind'),
                onPressed: _busy ? null : () => _lookup(_code.text),
                icon: const Icon(Icons.search),
                label: Text(l.barcodeFind),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_busy)
            Row(
              children: [
                const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 12),
                Expanded(child: Text(l.barcodeLooking)),
              ],
            )
          else if (_result?.product case final product?)
            _FoundCard(product: product, onAdd: () => _add((c) => c.addScanned(product)))
          else if (_result != null) ...[
            Text(_result!.lookupFailed ? l.barcodeOffline : l.barcodeUnknown),
            const SizedBox(height: 12),
            TextField(
              key: const Key('barcodeName'),
              controller: _name,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _addUnknown(),
              decoration: InputDecoration(labelText: l.barcodeName, border: const OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(key: const Key('barcodeAddUnknown'), onPressed: _addUnknown, icon: const Icon(Icons.add), label: Text(l.barcodeAdd)),
          ],
        ],
      ),
    );
  }
}

class _FoundCard extends ConsumerWidget {
  const _FoundCard({required this.product, required this.onAdd});

  final ScannedProduct product;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final fmt = Fmt.watch(ref, context);
    final catalogue = ref.watch(catalogueProvider).value ?? const <CatalogueItem>[];
    final entry = catalogue.where((c) => c.id == product.catalogueId).firstOrNull;
    final today = DateTime.now();
    final expiry = entry != null ? estimateExpiry(entry, product.storage, today) : daysAfter(today, 3);
    return Card(
      key: const Key('barcodeFound'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(product.name(context.lang), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            if (product.brand != null) Text(product.brand!, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(storageIcon(product.storage), size: 18),
                const SizedBox(width: 6),
                Expanded(child: Text('${fmt.qty(product.quantity, product.unit)} · ${storageLabel(l, product.storage)}')),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.event_outlined, size: 18),
                const SizedBox(width: 6),
                Expanded(child: Text(l.barcodeExpiry(fmt.date(expiry)))),
              ],
            ),
            const SizedBox(height: 12),
            FilledButton.icon(key: const Key('barcodeAdd'), onPressed: onAdd, icon: const Icon(Icons.add), label: Text(l.barcodeAdd)),
          ],
        ),
      ),
    );
  }
}
