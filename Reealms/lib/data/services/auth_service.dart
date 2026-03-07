import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import 'package:reealms_mobile/core/runtime_config.dart';
import 'package:reealms_mobile/data/models/login_device_entry.dart';

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

  Future<void> sendPasswordResetEmail(String email) async {
    await _supabase.auth.resetPasswordForEmail(
      email,
      redirectTo: RuntimeConfig.authEmailRedirectTo.trim().isEmpty
          ? null
          : RuntimeConfig.authEmailRedirectTo.trim(),
    );
  }

  Future<void> updatePassword(String newPassword) async {
    await _supabase.auth.updateUser(UserAttributes(password: newPassword));
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null || user.isAnonymous) {
      throw Exception('Sesi login tidak valid.');
    }

    final email = (user.email ?? '').trim();
    if (email.isEmpty) {
      throw Exception('Email akun tidak ditemukan.');
    }

    await _supabase.auth.signInWithPassword(
      email: email,
      password: currentPassword.trim(),
    );
    await _supabase.auth.updateUser(UserAttributes(password: newPassword));
  }

  Future<void> signOutAllDevices() async {
    await _supabase.auth.signOut(scope: SignOutScope.global);
  }

  Future<void> deleteCurrentAccount() async {
    Session? session;
    try {
      final refreshed = await _supabase.auth.refreshSession();
      session = refreshed.session ?? _supabase.auth.currentSession;
    } catch (_) {
      session = _supabase.auth.currentSession;
    }

    final accessToken = session?.accessToken ?? '';
    if (accessToken.trim().isEmpty) {
      throw Exception('Sesi login tidak valid. Silakan login ulang.');
    }

    try {
      final response = await _supabase.functions.invoke(
        'delete-my-account',
        body: {'access_token': accessToken},
      );
      final status = response.status;
      if (status != 200) {
        final backendError = _extractBackendFunctionError(response.data);
        if (backendError.isNotEmpty) {
          throw Exception(backendError);
        }
        if (status == 404) {
          throw Exception(
            'Fungsi delete-my-account tidak ditemukan di server (belum di-deploy).',
          );
        }
        if (status == 401 || status == 403) {
          throw Exception('Sesi login tidak valid. Silakan login ulang.');
        }
        throw Exception('Gagal menghapus akun (status: $status).');
      }
    } on FunctionException catch (error) {
      final details = error.details;
      if (details != null && details.toString().trim().isNotEmpty) {
        throw Exception(details.toString());
      }
      throw Exception('Gagal memanggil server hapus akun.');
    }

    await _supabase.auth.signOut(scope: SignOutScope.local);
  }

  String _extractBackendFunctionError(dynamic rawData) {
    if (rawData == null) return '';
    if (rawData is Map<String, dynamic>) {
      final value = rawData['error'];
      if (value != null) return value.toString();
      return '';
    }
    if (rawData is String) {
      final text = rawData.trim();
      if (text.isEmpty) return '';
      try {
        final decoded = jsonDecode(text);
        if (decoded is Map<String, dynamic> && decoded['error'] != null) {
          return decoded['error'].toString();
        }
      } catch (_) {}
      return text;
    }
    return rawData.toString();
  }

  Future<void> logLoginEvent() async {
    final user = _supabase.auth.currentUser;
    if (user == null || user.isAnonymous) return;

    try {
      await _supabase.from('user_login_history').insert({
        'user_id': user.id,
        'device_label': _deviceLabel(),
        'platform': _platformName(),
        'logged_at': DateTime.now().toUtc().toIso8601String(),
      });
    } catch (e) {
      debugPrint('AuthService logLoginEvent error: $e');
    }
  }

  Future<List<LoginDeviceEntry>> getLoginHistory({int limit = 50}) async {
    final user = _supabase.auth.currentUser;
    if (user == null || user.isAnonymous) return [];

    final response = await _supabase
        .from('user_login_history')
        .select('id, device_label, platform, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', ascending: false)
        .limit(limit);

    return (response as List)
        .map(
          (item) => LoginDeviceEntry.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  String _platformName() {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.windows:
        return 'windows';
      case TargetPlatform.macOS:
        return 'macos';
      case TargetPlatform.linux:
        return 'linux';
      case TargetPlatform.fuchsia:
        return 'fuchsia';
    }
  }

  String _deviceLabel() {
    switch (_platformName()) {
      case 'android':
        return 'Android Device';
      case 'ios':
        return 'iPhone / iPad';
      case 'windows':
        return 'Windows Device';
      case 'macos':
        return 'Mac Device';
      case 'linux':
        return 'Linux Device';
      case 'web':
        return 'Web Browser';
      default:
        return 'Perangkat';
    }
  }
}
