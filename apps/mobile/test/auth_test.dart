import 'package:elha2/data/mock/mock_services.dart';
import 'package:elha2/data/repositories.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('demo OTP signs in and returns the normalised number', () async {
    final auth = MockAuthRepository(latency: Duration.zero);
    await auth.sendCode('+20 101 234 5678');
    final session = await auth.verifyCode('01012345678', MockAuthRepository.demoOtp);
    expect(session.phone, '01012345678');
  });

  test('5 wrong codes lock the number for an hour (NFR-12)', () async {
    var now = DateTime(2026, 10, 30, 10);
    final auth = MockAuthRepository(latency: Duration.zero, clock: () => now);
    await auth.sendCode('01012345678');
    for (var remaining = 4; remaining >= 1; remaining--) {
      await expectLater(
        auth.verifyCode('01012345678', '000000'),
        throwsA(isA<AuthException>().having((e) => e.remainingAttempts, 'remaining', remaining)),
      );
    }
    await expectLater(auth.verifyCode('01012345678', '000000'), throwsA(isA<AuthException>().having((e) => e.code, 'code', 'locked')));
    await expectLater(auth.verifyCode('01012345678', MockAuthRepository.demoOtp), throwsA(isA<AuthException>().having((e) => e.code, 'code', 'locked')));
    now = now.add(const Duration(hours: 1, seconds: 1));
    await auth.sendCode('01012345678');
    expect((await auth.verifyCode('01012345678', MockAuthRepository.demoOtp)).phone, '01012345678');
  });

  test('rejects numbers that are not Egyptian mobiles', () async {
    final auth = MockAuthRepository(latency: Duration.zero);
    await expectLater(auth.sendCode('12345'), throwsA(isA<AuthException>()));
  });
}
