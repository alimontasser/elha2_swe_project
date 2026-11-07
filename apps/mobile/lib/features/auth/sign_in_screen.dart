import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/labels.dart';
import '../../data/providers.dart';
import '../../data/repositories.dart';
import '../common/widgets.dart';

/// US-1.01: sign up or in with an Egyptian mobile number.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _phone = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final normalised = await ref.read(authRepositoryProvider).sendCode(_phone.text);
      if (mounted) context.push('/otp?phone=$normalised');
    } on AuthException catch (e) {
      if (!mounted) return;
      final l = context.l10n;
      setState(
        () => _error = switch (e.code) {
          'locked' => l.locked(Fmt.read(ref, context).time(e.retryAt!)),
          'rateLimited' => l.authRateLimited,
          'unavailable' => l.authUnavailable,
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
      body: SafeArea(
        child: Column(
          children: [
            const DemoBanner(),
            const Align(alignment: AlignmentDirectional.centerEnd, child: LanguageButton()),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const Align(alignment: AlignmentDirectional.centerStart, child: BrandMark()),
                  const SizedBox(height: 24),
                  Text(l.signInTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(l.signInSubtitle, style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 32),
                  TextField(
                    key: const Key('phoneField'),
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    textDirection: TextDirection.ltr,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    decoration: InputDecoration(
                      labelText: l.phoneLabel,
                      hintText: l.phoneHint,
                      prefixIcon: const Icon(Icons.phone_iphone),
                      errorText: _error,
                      errorMaxLines: 3,
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    key: const Key('sendCode'),
                    onPressed: _busy ? null : _send,
                    icon: _busy
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.sms_outlined),
                    label: Text(l.sendCode),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
