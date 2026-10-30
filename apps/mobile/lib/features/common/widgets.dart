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
