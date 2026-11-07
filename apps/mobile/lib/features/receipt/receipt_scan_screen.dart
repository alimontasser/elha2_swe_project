import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../app/theme.dart';
import '../../core/pii_masker.dart';
import '../../data/mock/mock_data.dart';
import '../../data/models.dart';
import '../../data/providers.dart';

/// US-2.01 + US-14.03. With the backend: take or choose a photo, which the backend has the AI
/// read and then masks. Without it, or as a demo: pick a sample receipt, masked on the phone.
class ReceiptScanScreen extends ConsumerStatefulWidget {
  const ReceiptScanScreen({super.key});

  @override
  ConsumerState<ReceiptScanScreen> createState() => _ReceiptScanScreenState();
}

class _ReceiptScanScreenState extends ConsumerState<ReceiptScanScreen> {
  SampleReceipt _receipt = sampleReceipts.first;
  MaskResult? _masked;
  Uint8List? _photo;
  bool _busy = false;

  /// US-2.01 from a real photo: the backend reads it and masks the lines (US-14.03).
  Future<void> _readPhoto({required bool camera}) async {
    final picked = await ref.read(photoPickerProvider)(camera: camera);
    if (picked == null || !mounted) return;
    setState(() {
      _busy = true;
      _photo = picked.bytes;
    });
    final result = await ref.read(receiptAiServiceProvider).readPhoto(picked.bytes, mimeType: picked.mimeType);
    if (!mounted) return;
    setState(() => _busy = false);
    context.pushReplacement('/add/receipt/review', extra: result);
  }

  Future<void> _read() async {
    setState(() {
      _busy = true;
      _masked = null;
    });
    final lines = await ref.read(ocrServiceProvider).readReceipt(_receipt);
    final masked = const PiiMasker().mask(lines);
    if (!mounted) return;
    setState(() => _masked = masked);
    final result = await ref.read(receiptAiServiceProvider).parseReceipt(masked.lines, sampleId: _receipt.id);
    if (!mounted) return;
    setState(() => _busy = false);
    context.pushReplacement('/add/receipt/review', extra: result);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.receiptTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_photo != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.memory(_photo!, height: 320, fit: BoxFit.contain),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 12),
                Text(l.readingReceipt),
              ],
            ),
          ] else if (_masked == null) ...[
            if (ref.watch(receiptPhotosEnabledProvider)) ...[
              Card(
                color: Elha2Colors.greenSoft,
                child: ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined, color: Elha2Colors.green),
                  title: Text(l.receiptPhotoPrivacy),
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    key: const Key('takePhoto'),
                    onPressed: _busy ? null : () => _readPhoto(camera: true),
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: Text(l.receiptTakePhoto),
                  ),
                  OutlinedButton.icon(
                    key: const Key('choosePhoto'),
                    onPressed: _busy ? null : () => _readPhoto(camera: false),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: Text(l.receiptChoosePhoto),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(l.receiptTrySample, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
            ] else ...[
              Text(l.receiptPhotoUnavailable, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 12),
            ],
            Text(l.receiptChoose, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: [
                for (final r in sampleReceipts)
                  ButtonSegment(
                    value: r.id,
                    label: Text(r.shopName, overflow: TextOverflow.ellipsis),
                  ),
              ],
              selected: {_receipt.id},
              onSelectionChanged: _busy ? null : (s) => setState(() => _receipt = sampleReceipts.firstWhere((r) => r.id == s.first)),
            ),
            const SizedBox(height: 16),
            PaperReceipt(lines: _receipt.ocrLines),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('readReceipt'),
              onPressed: _busy ? null : _read,
              icon: const Icon(Icons.document_scanner_outlined),
              label: Text(l.receiptRead),
            ),
          ] else ...[
            Card(
              color: Elha2Colors.greenSoft,
              child: ListTile(
                leading: const Icon(Icons.shield, color: Elha2Colors.green),
                title: Text(l.maskedTitle, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${l.maskedCount(_masked!.maskedCount)}\n${l.privacyNote}'),
                isThreeLine: true,
              ),
            ),
            const SizedBox(height: 8),
            PaperReceipt(lines: _masked!.lines, highlightMasked: true),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 12),
                Text(l.readingReceipt),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A thermal-paper style rendering of receipt lines. Masked tokens are highlighted.
class PaperReceipt extends StatelessWidget {
  const PaperReceipt({super.key, required this.lines, this.highlightMasked = false});

  final List<String> lines;
  final bool highlightMasked;

  static final _token = RegExp(r'\[(name|phone|card|email)\]');

  @override
  Widget build(BuildContext context) {
    // Inherits the bundled Cairo face: a 'monospace' family would make Flutter web fetch a fallback font.
    const base = TextStyle(fontSize: 13, height: 1.5, color: Color(0xFF333333));
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDF7),
        borderRadius: BorderRadius.circular(6),
        boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final line in lines)
            Text.rich(
              TextSpan(children: _spans(line, base)),
              textDirection: RegExp('[؀-ۿ]').hasMatch(line) ? TextDirection.rtl : TextDirection.ltr,
            ),
        ],
      ),
    );
  }

  List<InlineSpan> _spans(String line, TextStyle base) {
    if (!highlightMasked) return [TextSpan(text: line, style: base)];
    final spans = <InlineSpan>[];
    var last = 0;
    for (final m in _token.allMatches(line)) {
      if (m.start > last) spans.add(TextSpan(text: line.substring(last, m.start), style: base));
      spans.add(
        TextSpan(
          text: m[0],
          style: base.copyWith(backgroundColor: const Color(0xFF1D2420), color: Colors.white, fontWeight: FontWeight.bold),
        ),
      );
      last = m.end;
    }
    if (last < line.length) spans.add(TextSpan(text: line.substring(last), style: base));
    return spans;
  }
}
