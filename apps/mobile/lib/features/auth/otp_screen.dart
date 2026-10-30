import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/labels.dart';
import '../../data/providers.dart';
import '../../data/repositories.dart';
import '../../state/auth.dart';
import '../common/widgets.dart';

/// US-1.01: enter the SMS code; 5 wrong codes in an hour lock the number (NFR-12).
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await ref.read(authRepositoryProvider).verifyCode(widget.phone, _code.text);
      ref.read(authProvider.notifier).signedIn(session);
    } on AuthException catch (e) {
      if (!mounted) return;
      final l = context.l10n;
      setState(
        () => _error = switch (e.code) {
          'locked' => l.locked(Fmt.read(ref, context).time(e.retryAt!)),
          'wrongCode' => l.wrongCode(e.remainingAttempts ?? 0),
          _ => l.invalidPhone,
        },
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.otpTitle), actions: const [LanguageButton()]),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(l.otpSentTo('\u2066${widget.phone}\u2069'), style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          TextField(
            key: const Key('otpField'),
            controller: _code,
            keyboardType: TextInputType.number,
            textDirection: TextDirection.ltr,
            textAlign: TextAlign.center,
            maxLength: 6,
            autofillHints: const [AutofillHints.oneTimeCode],
            style: const TextStyle(fontSize: 28, letterSpacing: 12),
            decoration: InputDecoration(helperText: l.otpHint, errorText: _error, errorMaxLines: 3, counterText: ''),
            onChanged: (v) {
              if (v.length == 6 && !_busy) _verify();
            },
          ),
          const SizedBox(height: 24),
          FilledButton(key: const Key('verify'), onPressed: _busy ? null : _verify, child: Text(l.verify)),
          TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l.changeNumber)),
        ],
      ),
    );
  }
}
