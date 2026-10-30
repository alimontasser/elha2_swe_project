import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/labels.dart';
import '../../app/theme.dart';
import '../../core/expiry_rules.dart';
import '../../data/models.dart';

/// One pantry row: the urgency is shown by colour, icon AND text (NFR-17: colour is never the only signal).
class PantryItemTile extends ConsumerWidget {
  const PantryItemTile({super.key, required this.item, required this.now, this.onTap});

  final PantryItem item;
  final DateTime now;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final fmt = Fmt.watch(ref, context);
    final style = urgencyStyle(urgencyOf(item.expiryDate, now));
    return ListTile(
      key: Key('pantry-${item.id}'),
      onTap: onTap,
      minTileHeight: 64,
      leading: CircleAvatar(
        backgroundColor: style.bg,
        child: Icon(style.icon, color: style.fg, size: 22),
      ),
      title: Text(item.name(context.lang), style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(fmt.qty(item.quantity, item.unit)),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
        child: Text(
          fmt.digits(expiryLabel(l, item.expiryDate, now)),
          style: TextStyle(color: style.fg, fontWeight: FontWeight.w600, fontSize: 12),
        ),
      ),
    );
  }
}
