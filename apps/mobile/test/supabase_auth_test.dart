import 'package:elha2/core/attempt_limiter.dart';
import 'package:elha2/data/repositories.dart';
import 'package:elha2/data/supabase/supabase_auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeGateway implements OtpGateway {
  final sent = <String>[];
  String code = '654321';
  OtpFailure? sendFailure;
  OtpFailure? verifyFailure;

  @override
  Future<void> sendOtp(String phone) async {
    if (sendFailure != null) throw OtpGatewayException(sendFailure!);
    sent.add(phone);
  }

  @override
  Future<void> verifyOtp(String phone, String code) async {
    if (verifyFailure != null) throw OtpGatewayException(verifyFailure!);
    if (code != this.code) throw const OtpGatewayException(OtpFailure.wrongCode);
  }

  @override
  Future<void> signOut() async {}
}

class MemoryStore implements LimiterStore {
  String? value;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String v) async => value = v;
}

Matcher authError(String code) => throwsA(isA<AuthException>().having((e) => e.code, 'code', code));

void main() {
  test('sends the code to the number in international form and signs in with it', () async {
    final gateway = FakeGateway();
    final auth = SupabaseAuthRepository(gateway);
    expect(await auth.sendCode('010 1234 5678'), '01012345678');
    expect(gateway.sent, ['201012345678']);
    expect((await auth.verifyCode('01012345678', ' 654321 ')).phone, '01012345678');
  });

  test('rejects a number that is not an Egyptian mobile before calling Supabase', () async {
    final gateway = FakeGateway();
    await expectLater(SupabaseAuthRepository(gateway).sendCode('0221234567'), authError('invalidPhone'));
    expect(gateway.sent, isEmpty);
  });

  test('US-1.01: 5 wrong codes in an hour lock the number, and the lock survives a restart', () async {
    var now = DateTime(2026, 11, 7, 10);
    final store = MemoryStore();
    final gateway = FakeGateway();
    final auth = SupabaseAuthRepository(gateway, store: store, limiter: AttemptLimiter(clock: () => now));
    for (var left = 4; left >= 1; left--) {
      await expectLater(
        auth.verifyCode('01012345678', '000000'),
        throwsA(isA<AuthException>().having((e) => e.remainingAttempts, 'left', left)),
      );
    }
    await expectLater(auth.verifyCode('01012345678', '000000'), authError('locked'));

    // A new app start reads the counter back: still locked, even with the right code.
    final restarted = SupabaseAuthRepository(gateway, store: store, limiter: AttemptLimiter(clock: () => now));
    await expectLater(restarted.verifyCode('01012345678', '654321'), authError('locked'));
    await expectLater(restarted.sendCode('01012345678'), authError('locked'));

    now = now.add(const Duration(hours: 1, minutes: 1));
    expect((await restarted.verifyCode('01012345678', '654321')).phone, '01012345678');
  });

  test('maps Supabase rate limits and outages to their own messages', () async {
    final gateway = FakeGateway()..sendFailure = OtpFailure.rateLimited;
    final auth = SupabaseAuthRepository(gateway);
    await expectLater(auth.sendCode('01012345678'), authError('rateLimited'));
    gateway
      ..sendFailure = null
      ..verifyFailure = OtpFailure.unavailable;
    await expectLater(auth.verifyCode('01012345678', '654321'), authError('unavailable'));
  });
}
