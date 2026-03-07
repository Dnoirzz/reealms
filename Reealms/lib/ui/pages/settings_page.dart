import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:reealms_mobile/data/models/app_preferences.dart';
import 'package:reealms_mobile/logic/app_state.dart';
import 'package:reealms_mobile/ui/pages/change_password_page.dart';
import 'package:reealms_mobile/ui/pages/login_device_history_page.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _isSigningOutAllDevices = false;
  bool _isDeletingAccount = false;
  bool _isClearingCache = false;

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<bool> _confirmAction({
    required String title,
    required String message,
    required String confirmText,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: const Color(0xFF171726),
          title: Text(title, style: const TextStyle(color: Colors.white)),
          content: Text(message, style: const TextStyle(color: Colors.white70)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text("Batal"),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent.withOpacity(0.85),
                foregroundColor: Colors.white,
              ),
              child: Text(
                confirmText,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  String _friendlyError(Object error) {
    final rawFull = error.toString();
    final raw = rawFull.toLowerCase();
    if (raw.contains('delete-my-account') &&
        (raw.contains('not found') || raw.contains('404'))) {
      return "Fitur hapus akun belum aktif di server. Pastikan Edge Function delete-my-account sudah di-deploy.";
    }
    if (raw.contains('fungsi delete-my-account tidak ditemukan')) {
      return "Fitur hapus akun belum aktif di server. Pastikan Edge Function delete-my-account sudah di-deploy.";
    }
    if (raw.contains('missing authorization token') ||
        raw.contains('invalid jwt') ||
        raw.contains('invalid or expired session token') ||
        raw.contains('sesi login tidak valid')) {
      return "Sesi login Anda tidak valid. Silakan logout lalu login kembali.\nDetail: $rawFull";
    }
    if (raw.contains('missing supabase environment variables')) {
      return "Konfigurasi Edge Function belum lengkap. Periksa environment Supabase Function.";
    }
    if (raw.contains('permission denied') || raw.contains('not authorized')) {
      return "Akses ditolak oleh server. Periksa policy dan konfigurasi Supabase.";
    }
    if (raw.contains('user_login_history') &&
        (raw.contains('does not exist') || raw.contains('relation'))) {
      return "Tabel riwayat perangkat login belum tersedia di database.";
    }
    return "Terjadi kesalahan: $rawFull";
  }

  bool _ensureMemberAccess(AppState state, String featureName) {
    if (state.isMemberLoggedIn) return true;
    _showMessage("$featureName hanya tersedia untuk akun yang sudah login.");
    return false;
  }

  Future<void> _onSignOutAllDevices(AppState state) async {
    if (!_ensureMemberAccess(state, "Fitur ini")) return;
    if (_isSigningOutAllDevices) return;
    final confirmed = await _confirmAction(
      title: "Keluar dari Semua Perangkat",
      message:
          "Anda akan dikeluarkan dari semua perangkat yang sedang login. Lanjutkan?",
      confirmText: "Ya, Keluar",
    );
    if (!confirmed) return;

    setState(() => _isSigningOutAllDevices = true);
    try {
      await state.signOutAllDevices();
      if (!mounted) return;
      _showMessage("Berhasil keluar dari semua perangkat.");
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (error) {
      _showMessage(_friendlyError(error));
    } finally {
      if (mounted) {
        setState(() => _isSigningOutAllDevices = false);
      }
    }
  }

  Future<void> _onDeleteAccount(AppState state) async {
    if (!_ensureMemberAccess(state, "Hapus akun")) return;
    if (_isDeletingAccount) return;
    final confirmed = await _confirmAction(
      title: "Hapus Akun",
      message:
          "Akun beserta data terkait akan dihapus permanen dan tidak bisa dipulihkan. Lanjutkan?",
      confirmText: "Hapus Permanen",
    );
    if (!confirmed) return;

    setState(() => _isDeletingAccount = true);
    try {
      await state.deleteAccount();
      if (!mounted) return;
      _showMessage("Akun berhasil dihapus.");
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (error) {
      _showMessage(_friendlyError(error));
    } finally {
      if (mounted) {
        setState(() => _isDeletingAccount = false);
      }
    }
  }

  Future<void> _onClearCache(AppState state) async {
    if (_isClearingCache) return;
    setState(() => _isClearingCache = true);
    try {
      await state.clearImageCache();
      _showMessage("Cache berhasil dibersihkan.");
    } catch (_) {
      _showMessage("Gagal membersihkan cache.");
    } finally {
      if (mounted) {
        setState(() => _isClearingCache = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, child) {
        return Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: Text(
              "Pengaturan",
              style: GoogleFonts.outfit(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
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
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                _SettingsSection(
                  title: "Akun",
                  child: Column(
                    children: [
                      _ActionTile(
                        icon: Icons.lock_outline,
                        title: "Ubah Kata Sandi",
                        onTap: () {
                          if (!_ensureMemberAccess(state, "Ubah kata sandi")) {
                            return;
                          }
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ChangePasswordPage(),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 10),
                      _ActionTile(
                        icon: Icons.delete_outline,
                        title: "Hapus Akun",
                        trailing: _isDeletingAccount
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(
                                Icons.chevron_right,
                                color: Colors.white30,
                              ),
                        onTap: () => _onDeleteAccount(state),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SettingsSection(
                  title: "Preferensi Aplikasi",
                  child: Column(
                    children: [
                      _QualityPicker(
                        value: state.defaultVideoQuality,
                        onChanged: (value) {
                          if (value == null) return;
                          state.updateDefaultQuality(value);
                        },
                      ),
                      const SizedBox(height: 8),
                      _SwitchTile(
                        title: "Autoplay episode berikutnya",
                        value: state.autoplayNextEpisode,
                        onChanged: (value) => state.toggleAutoplayNext(value),
                      ),
                      const SizedBox(height: 8),
                      _SwitchTile(
                        title: "Putar landscape otomatis",
                        value: state.autoLandscapeOnStart,
                        onChanged: (value) => state.toggleAutoLandscape(value),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SettingsSection(
                  title: "Privasi & Keamanan",
                  child: Column(
                    children: [
                      _ActionTile(
                        icon: Icons.logout,
                        title: "Keluar dari semua perangkat",
                        trailing: _isSigningOutAllDevices
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(
                                Icons.chevron_right,
                                color: Colors.white30,
                              ),
                        onTap: () => _onSignOutAllDevices(state),
                      ),
                      const SizedBox(height: 10),
                      _ActionTile(
                        icon: Icons.devices_outlined,
                        title: "Riwayat perangkat login",
                        onTap: () {
                          if (!_ensureMemberAccess(state, "Riwayat login")) {
                            return;
                          }
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const LoginDeviceHistoryPage(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SettingsSection(
                  title: "Penyimpanan",
                  child: _ActionTile(
                    icon: Icons.cleaning_services_outlined,
                    title: "Hapus cache",
                    trailing: _isClearingCache
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(
                            Icons.chevron_right,
                            color: Colors.white30,
                          ),
                    onTap: () => _onClearCache(state),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final Widget child;

  const _SettingsSection({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: Colors.white.withOpacity(0.04),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.white70, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(color: Colors.white, fontSize: 14),
              ),
            ),
            trailing ??
                const Icon(
                  Icons.chevron_right,
                  color: Colors.white30,
                  size: 20,
                ),
          ],
        ),
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchTile({
    required this.title,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withOpacity(0.04),
      ),
      child: SwitchListTile(
        title: Text(
          title,
          style: const TextStyle(color: Colors.white, fontSize: 14),
        ),
        value: value,
        onChanged: onChanged,
        activeThumbColor: Theme.of(context).primaryColor,
      ),
    );
  }
}

class _QualityPicker extends StatelessWidget {
  final String value;
  final ValueChanged<String?> onChanged;

  const _QualityPicker({required this.value, required this.onChanged});

  String _labelFor(String quality) {
    switch (quality) {
      case AppPreferences.quality480p:
        return "480p";
      case AppPreferences.quality720p:
        return "720p";
      default:
        return "Auto";
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white.withOpacity(0.04),
      ),
      child: Row(
        children: [
          const Icon(Icons.hd_outlined, color: Colors.white70, size: 20),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              "Kualitas video default",
              style: TextStyle(color: Colors.white, fontSize: 14),
            ),
          ),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: AppPreferences.normalizeQuality(value),
              dropdownColor: const Color(0xFF1D1D2E),
              style: const TextStyle(color: Colors.white),
              items: AppPreferences.allowedQualities
                  .map(
                    (quality) => DropdownMenuItem<String>(
                      value: quality,
                      child: Text(_labelFor(quality)),
                    ),
                  )
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}
