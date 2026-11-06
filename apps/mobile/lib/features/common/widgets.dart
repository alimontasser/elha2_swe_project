import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/labels.dart';
import '../../app/theme.dart';
import '../../state/settings.dart';

class DemoBanner extends StatelessWidget {
  const DemoBanner({super.key});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    color: Elha2Colors.orangeSoft,
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    child: Row(
      children: [
        const Icon(Icons.science_outlined, size: 16, color: Elha2Colors.orange),
        const SizedBox(width: 6),
        Expanded(
          child: Text(context.l10n.demoBanner, style: const TextStyle(color: Elha2Colors.orange, fontSize: 12)),
        ),
      ],
    ),
  );
}

/// SRS §3.1: says what went wrong and how to fix it, and never shows raw exception text.
class LoadError extends StatelessWidget {
  const LoadError({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, size: 48, color: Elha2Colors.orange),
          const SizedBox(height: 12),
          Text(context.l10n.loadFailed, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(
            key: const Key('retryLoad'),
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(context.l10n.retry),
          ),
        ],
      ),
    ),
  );
}

/// SRS §3.1: a failed change is reported in a snackbar, replacing any Undo offer on screen.
void showSaveFailed(ScaffoldMessengerState messenger, String message) {
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(content: Text(message)));
}

class LanguageButton extends ConsumerWidget {
  const LanguageButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAr = context.lang == 'ar';
    return TextButton.icon(
      onPressed: () => ref.read(settingsProvider.notifier).toggleLanguage(),
      icon: const Icon(Icons.translate),
      label: Text(isAr ? 'English' : 'العربية'),
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: Elha2Colors.green, borderRadius: BorderRadius.circular(size / 4)),
    child: Icon(Icons.eco, color: Colors.white, size: size * 0.6),
  );
}

/// Explains a feature that is scheduled for a later sprint.
class SprintChip extends StatelessWidget {
  const SprintChip(this.sprint, {super.key});

  final int sprint;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(color: const Color(0xFFEFE9DD), borderRadius: BorderRadius.circular(999)),
    child: Text(context.l10n.comingSprint(sprint), style: const TextStyle(fontSize: 11)),
  );
}
