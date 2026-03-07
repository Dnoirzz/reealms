import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:reealms_mobile/core/runtime_config.dart';

class AuthService {
  final _supabase = Supabase.instance.client;

  User? get currentUser => _supabase.auth.currentUser;

  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  Future<AuthResponse> signInWithEmail(String email, String password) async {
    return await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<AuthResponse> signUpWithEmail(
    String email,
    String password, {
    String? username,
    String? phoneNumber,
  }) async {
    final data = <String, dynamic>{};
    if ((username ?? '').trim().isNotEmpty) {
      final trimmedUsername = username!.trim();
      data['username'] = trimmedUsername;
      data['name'] = trimmedUsername;
      data['full_name'] = trimmedUsername;
      data['display_name'] = trimmedUsername;
    }
    if ((phoneNumber ?? '').trim().isNotEmpty) {
      final trimmedPhone = phoneNumber!.trim();
      data['phone_number'] = trimmedPhone;
      data['phone'] = trimmedPhone;
    }

    return await _supabase.auth.signUp(
      email: email,
      password: password,
      emailRedirectTo: RuntimeConfig.authEmailRedirectTo.trim().isEmpty
          ? null
          : RuntimeConfig.authEmailRedirectTo.trim(),
      data: data.isEmpty ? null : data,
    );
  }

  Future<void> signOut() async {
    await _supabase.auth.signOut(scope: SignOutScope.local);
  }

  Future<AuthResponse> signInAnonymously() async {
    return await _supabase.auth.signInAnonymously();
  }

  Future<void> resendSignUpVerificationEmail(String email) async {
    await _supabase.auth.resend(
      type: OtpType.signup,
      email: email,
      emailRedirectTo: RuntimeConfig.authEmailRedirectTo.trim().isEmpty
          ? null
          : RuntimeConfig.authEmailRedirectTo.trim(),
    );
  }
}
