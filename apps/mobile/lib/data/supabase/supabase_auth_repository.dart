import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../../core/attempt_limiter.dart';
import '../../core/phone.dart';
import '../models.dart';
import '../repositories.dart';

/// Why a Supabase phone-code call failed, in the app's terms.
enum OtpFailure { wrongCode, rateLimited, unavailable }

class OtpGatewayException implements Exception {
  const OtpGatewayException(this.failure);
  final OtpFailure failure;
}

/// The two Supabase Auth calls the app makes, behind an interface so the rules around them
/// (number format, attempt limit, error mapping) are tested without a network.
abstract interface class OtpGateway {
  /// [phone] is in international form without the plus sign, e.g. 201012345678.
  Future<void> sendOtp(String phone);

  Future<void> verifyOtp(String phone, String code);

  Future<void> signOut();
}

/// Keeps the wrong-code counter between app restarts.
abstract interface class LimiterStore {
  Future<String?> read();

  Future<void> write(String value);
}

class SharedPrefsLimiterStore implements LimiterStore {
  static const _key = 'elha2.otpFailures';
  final _prefs = SharedPreferencesAsync();

  @override
  Future<String?> read() => _prefs.getString(_key);

  @override
  Future<void> write(String value) => _prefs.setString(_key, value);
}

/// US-1.01 through Supabase Auth: SMS one-time code, expiry set in the project (5 min).
/// Supabase limits code checks per IP; the per-number limit (5 wrong codes per hour) is kept here.
class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(this._gateway, {this.store, AttemptLimiter? limiter}) : _limiter = limiter ?? AttemptLimiter();

  final OtpGateway _gateway;
  final LimiterStore? store;
  final AttemptLimiter _limiter;
  bool _loaded = false;

  static String _international(String local) => '20${local.substring(1)}';

  Future<void> _load() async {
    if (_loaded) return;
    _loaded = true;
    _limiter.loadJson(await store?.read());
  }

  Future<void> _save() async => store?.write(_limiter.toJson());

  Future<String> _checked(String phone) async {
    final normalised = normaliseEgyptianMobile(phone);
    if (normalised == null) throw const AuthException('invalidPhone');
    await _load();
    final until = _limiter.lockedUntil(normalised);
    if (until != null) throw AuthException('locked', retryAt: until);
    return normalised;
  }

  @override
  Future<String> sendCode(String phone) async {
    final normalised = await _checked(phone);
    try {
      await _gateway.sendOtp(_international(normalised));
    } on OtpGatewayException catch (e) {
      throw AuthException(e.failure == OtpFailure.rateLimited ? 'rateLimited' : 'unavailable');
    }
    return normalised;
  }

  @override
  Future<Session> verifyCode(String phone, String code) async {
    final normalised = await _checked(phone);
    try {
      await _gateway.verifyOtp(_international(normalised), code.trim());
    } on OtpGatewayException catch (e) {
      switch (e.failure) {
        case OtpFailure.wrongCode:
          final remaining = _limiter.recordFailure(normalised);
          await _save();
          final until = _limiter.lockedUntil(normalised);
          if (until != null) throw AuthException('locked', retryAt: until);
          throw AuthException('wrongCode', remainingAttempts: remaining);
        case OtpFailure.rateLimited:
          throw const AuthException('rateLimited');
        case OtpFailure.unavailable:
          throw const AuthException('unavailable');
      }
    }
    _limiter.clear(normalised);
    await _save();
    return Session(phone: normalised);
  }

  @override
  Future<void> signOut() => _gateway.signOut();
}

/// The real gateway over supabase_flutter.
class SupabaseOtpGateway implements OtpGateway {
  SupabaseOtpGateway(this._auth);

  final sb.GoTrueClient _auth;

  static OtpGatewayException _map(Object e, {required bool verifying}) {
    if (e is sb.AuthException) {
      if (e.statusCode == '429' || (e.code?.startsWith('over_') ?? false)) {
        return const OtpGatewayException(OtpFailure.rateLimited);
      }
      // Supabase answers a wrong or expired code with otp_expired (403).
      if (verifying && (e.code == 'otp_expired' || e.code == 'invalid_credentials' || e.statusCode == '403')) {
        return const OtpGatewayException(OtpFailure.wrongCode);
      }
    }
    return const OtpGatewayException(OtpFailure.unavailable);
  }

  @override
  Future<void> sendOtp(String phone) async {
    try {
      await _auth.signInWithOtp(phone: '+$phone');
    } catch (e) {
      throw _map(e, verifying: false);
    }
  }

  @override
  Future<void> verifyOtp(String phone, String code) async {
    try {
      await _auth.verifyOTP(phone: '+$phone', token: code, type: sb.OtpType.sms);
    } catch (e) {
      throw _map(e, verifying: true);
    }
  }

  @override
  Future<void> signOut() => _auth.signOut();
}
