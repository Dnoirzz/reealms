import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:reealms_mobile/logic/app_state.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _usernameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLogin = true;
  bool _isSubmitting = false;
  DateTime? _signupCooldownUntil;

  static const String _signupVerificationMessage =
      "Pendaftaran berhasil. Silakan verifikasi email Anda sebelum login.\nCek folder Inbox, Spam, atau Promosi.";
  static const String _emailNotVerifiedMessage =
      "Email Anda belum terverifikasi. Buka email verifikasi lalu klik tautannya, kemudian coba login lagi.";

  @override
  void dispose() {
    _usernameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (_isSubmitting) {
      _showInfo("Permintaan sedang diproses, mohon tunggu.");
      return;
    }

    if (!_isLogin && _signupCooldownUntil != null) {
      final remaining = _signupCooldownUntil!.difference(DateTime.now());
      if (remaining.inSeconds > 0) {
        _showInfo(
          "Terlalu sering menekan daftar. Coba lagi dalam ${remaining.inSeconds} detik.",
        );
        return;
      }
    }

    final state = Provider.of<AppState>(context, listen: false);
    final username = _usernameController.text.trim();
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      _showInfo("Email dan password harus diisi");
      return;
    }

    if (!_isLogin) {
      if (username.isEmpty || phone.isEmpty) {
        _showInfo("Username dan No HP harus diisi");
        return;
      }

      final normalizedPhone = phone.replaceAll(RegExp(r'[\s\-]'), '');
      final phoneRegex = RegExp(r'^\+?[0-9]{8,15}$');
      if (!phoneRegex.hasMatch(normalizedPhone)) {
        _showInfo("Format No HP tidak valid");
        return;
      }
    }

    setState(() => _isSubmitting = true);
    try {
      if (_isLogin) {
        await state.signIn(email, password);
      } else {
        await state.signUp(
          email,
          password,
          username: username,
          phoneNumber: phone.replaceAll(RegExp(r'[\s\-]'), ''),
        );
        _signupCooldownUntil = DateTime.now().add(const Duration(seconds: 60));
        _showInfo(_signupVerificationMessage);
      }
    } catch (e) {
      final rawError = e.toString().toLowerCase();
      final isEmailNotConfirmed =
          rawError.contains('email_not_confirmed') ||
          rawError.contains('email not confirmed');
      final isEmailRateLimited =
          rawError.contains('over_email_send_rate_limit') ||
          rawError.contains('email rate limit exceeded');

      if (isEmailNotConfirmed) {
        _showInfo(_emailNotVerifiedMessage);
      } else if (!_isLogin && isEmailRateLimited) {
        final retrySeconds = _extractRetrySeconds(rawError) ?? 60;
        _signupCooldownUntil = DateTime.now().add(
          Duration(seconds: retrySeconds),
        );
        _showInfo(
          "Terlalu banyak permintaan verifikasi email. Coba lagi dalam $retrySeconds detik.\nJika email belum masuk, periksa folder Spam/Promosi.",
        );
      } else {
        _showInfo("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  int? _extractRetrySeconds(String rawError) {
    final match = RegExp(r'after\s+(\d+)\s+seconds').firstMatch(rawError);
    if (match == null) return null;
    return int.tryParse(match.group(1) ?? '');
  }

  void _showInfo(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).primaryColor.withOpacity(0.05),
              Colors.black,
            ],
          ),
        ),
        child: SafeArea(child: _buildAuthForm()),
      ),
    );
  }

  Widget _buildAuthForm() {
    return Padding(
      padding: const EdgeInsets.all(32.0),
      child: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _isLogin
                    ? "Selamat Datang di Reealms"
                    : "Mulai coba Reealms",
                style: GoogleFonts.outfit(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _isLogin
                    ? "Masuk sekarang dan lanjutkan tontonan favoritmu kapan saja dan dimana saja."
                    : "Buat akun untuk simpan konten favoritmu, lanjutkan tontonan terakhir, dan jelajahi drama, anime, serta komik kesukaanmu.",
                style: const TextStyle(color: Colors.white54, fontSize: 14),
              ),
              const SizedBox(height: 48),
              if (!_isLogin) ...[
                TextField(
                  controller: _usernameController,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(
                    "Username",
                    Icons.person_outline,
                  ),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration("No HP", Icons.phone_outlined),
                ),
                const SizedBox(height: 20),
              ],
              TextField(
                controller: _emailController,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration(
                  "Alamat Email",
                  Icons.email_outlined,
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _passwordController,
                obscureText: true,
                style: const TextStyle(color: Colors.white),
                decoration: _inputDecoration("Kata Sandi", Icons.lock_outline),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 5,
                    shadowColor: Theme.of(
                      context,
                    ).primaryColor.withOpacity(0.3),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          _isLogin ? "Masuk & Lanjutkan" : "Daftar",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: () {
                    setState(() => _isLogin = !_isLogin);
                    if (_isLogin) {
                      _usernameController.clear();
                      _phoneController.clear();
                    }
                  },
                  child: Text(
                    _isLogin
                        ? "Belum punya akun? Daftar"
                        : "Sudah punya akun? Masuk",
                    style: TextStyle(
                      color: Theme.of(context).primaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              if (_isLogin) ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Divider(color: Colors.white.withOpacity(0.1)),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        "Atau",
                        style: TextStyle(color: Colors.white24, fontSize: 12),
                      ),
                    ),
                    Expanded(
                      child: Divider(color: Colors.white.withOpacity(0.1)),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Provider.of<AppState>(
                      context,
                      listen: false,
                    ).signInGuest(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      side: BorderSide(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: const Text(
                      "Lanjutkan Sebagai Tamu",
                      style: TextStyle(color: Colors.white70),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white54, fontSize: 14),
      prefixIcon: Icon(icon, color: Colors.white38, size: 20),
      filled: true,
      fillColor: Colors.white.withOpacity(0.05),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.transparent),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: Theme.of(context).primaryColor,
          width: 1.5,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
    );
  }
}
