import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../state/auth.dart';

/// US-1.04: set a location by GPS or by choosing an area. Only the area is kept for display.
class LocationScreen extends ConsumerStatefulWidget {
  const LocationScreen({super.key});

  @override
  ConsumerState<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends ConsumerState<LocationScreen> {
  Area? _selected;
  bool _locating = false;

  Future<void> _useGps() async {
    setState(() => _locating = true);
    final area = await ref.read(locationServiceProvider).currentArea();
    if (!mounted) return;
    setState(() {
      _selected = area;
      _locating = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final current = ref.watch(authProvider)?.area;
    final selected = _selected ?? current;
    final editing = current != null;
    return Scaffold(
      appBar: AppBar(title: Text(l.locationTitle), automaticallyImplyLeading: editing),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.shield_outlined, color: Colors.black54),
              const SizedBox(width: 8),
              Expanded(child: Text(l.locationSubtitle)),
            ],
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            key: const Key('useGps'),
            onPressed: _locating ? null : _useGps,
            icon: _locating
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.my_location),
            label: Text(l.useGps),
          ),
          if (_selected != null && !_locating)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(l.gpsFound(areaLabel(l, _selected!)), style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          const SizedBox(height: 24),
          Text(l.chooseArea, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final a in Area.values)
                ChoiceChip(label: Text(areaLabel(l, a)), selected: selected == a, onSelected: (_) => setState(() => _selected = a)),
            ],
          ),
          const SizedBox(height: 32),
          FilledButton(
            key: const Key('saveLocation'),
            onPressed: selected == null
                ? null
                : () {
                    ref.read(authProvider.notifier).setArea(selected);
                    editing ? context.pop() : context.go('/home');
                  },
            child: Text(l.continueLabel),
          ),
        ],
      ),
    );
  }
}
