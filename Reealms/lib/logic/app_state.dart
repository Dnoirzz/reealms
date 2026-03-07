import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:reealms_mobile/data/models/app_preferences.dart';
import 'package:reealms_mobile/data/models/login_device_entry.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:reealms_mobile/data/services/api_service.dart';
import 'package:reealms_mobile/data/services/storage_service.dart';
import 'package:reealms_mobile/data/services/auth_service.dart';
import 'package:reealms_mobile/data/services/settings_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:reealms_mobile/data/services/sync_service.dart';

class AppState extends ChangeNotifier {
  final ApiService _homeApiService = ApiService();
  final ApiService _searchApiService = ApiService();
  final StorageService _storageService = StorageService();
  final AuthService _authService = AuthService();
  final SyncService _syncService = SyncService();
  final SettingsService _settingsService = SettingsService();

  List<Movie> _homeMovies = [];
  List<Movie> _history = [];
  List<Movie> _favorites = [];
  bool _isLoading = false;
  String _homeSource = "dramabox";
  String _searchSource = "dramabox";
  User? _currentUser;
  bool _isAuthReady = false;
  bool _allowAnonymousForCurrentLaunch = false;
  bool _isClearingAnonymousSession = false;
  bool _isPasswordRecoveryFlowActive = false;
  AppPreferences _preferences = AppPreferences.defaults;

  List<Movie> get homeMovies => _homeMovies;
  List<Movie> get history => _history;
  List<Movie> get favorites => _favorites;
  bool get isLoading => _isLoading;
  String get currentSource => _homeSource;
  String get source => _searchSource;
  String get homeSource => _homeSource;
  String get searchSource => _searchSource;
  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;
  bool get isMemberLoggedIn =>
      _currentUser != null && !(_currentUser?.isAnonymous ?? true);
  bool get isAuthReady => _isAuthReady;
  bool get isPasswordRecoveryFlowActive => _isPasswordRecoveryFlowActive;
  AppPreferences get preferences => _preferences;
  String get defaultVideoQuality => _preferences.defaultQuality;
  bool get autoplayNextEpisode => _preferences.autoplayNextEpisode;
  bool get autoLandscapeOnStart => _preferences.autoLandscapeOnStart;
  bool get canEnterMainNavigation {
    final user = _currentUser;
    if (user == null) return false;
    if (!user.isAnonymous) return true;
    return _allowAnonymousForCurrentLaunch;
  }

  AppState() {
    unawaited(_initAuth());
    refreshHome();
  }

  Future<void> _initAuth() async {
    _currentUser = _authService.currentUser;
    if (_currentUser?.isAnonymous ?? false) {
      await _clearAnonymousSession(notify: false);
    }
    await loadSettings(notify: false);
    _storageService.setScope(_storageScopeForUser(_currentUser));
    await loadHistory();
    await loadFavorites();

    _authService.authStateChanges.listen((data) {
      unawaited(_handleAuthStateChange(data));
    });

    _isAuthReady = true;
    notifyListeners();
  }

  Future<void> _handleAuthStateChange(AuthState data) async {
    if (data.event == AuthChangeEvent.passwordRecovery) {
      _isPasswordRecoveryFlowActive = true;
    } else if (data.event == AuthChangeEvent.signedOut) {
      _isPasswordRecoveryFlowActive = false;
    }

    final incomingUser = data.session?.user;
    if ((incomingUser?.isAnonymous ?? false) &&
        !_allowAnonymousForCurrentLaunch) {
      await _clearAnonymousSession();
      return;
    }

    final prevUser = _currentUser;
    _currentUser = incomingUser;
    final prevScope = _storageScopeForUser(prevUser);
    final nextScope = _storageScopeForUser(_currentUser);
    if (prevScope != nextScope) {
      _storageService.setScope(nextScope);
      await loadHistory();
      await loadFavorites();
    }

    final isMemberNow =
        _currentUser != null && !(_currentUser?.isAnonymous ?? true);
    final wasMember = prevUser != null && !(prevUser.isAnonymous);

    // Sync only for authenticated non-guest accounts.
    if (isMemberNow && !wasMember) {
      unawaited(syncFromCloud());
    }

    notifyListeners();
  }

  Future<void> _clearAnonymousSession({bool notify = true}) async {
    if (_isClearingAnonymousSession) return;
    _isClearingAnonymousSession = true;
    try {
      await _authService.signOut();
    } catch (_) {}
    _currentUser = null;
    _allowAnonymousForCurrentLaunch = false;
    _isClearingAnonymousSession = false;
    if (notify) {
      notifyListeners();
    }
  }

  Future<void> clearGuestSessionIfNeeded() async {
    if (_currentUser?.isAnonymous ?? false) {
      await _clearAnonymousSession();
    }
  }

  String _storageScopeForUser(User? user) {
    if (user == null || user.isAnonymous) return 'guest';
    return 'user_${user.id}';
  }

  Future<void> syncFromCloud() async {
    _isLoading = true;
    notifyListeners();

    try {
      final cloudHistory = await _syncService.pullHistory();
      if (cloudHistory.isNotEmpty) {
        for (var movie in cloudHistory.reversed) {
          await _storageService.addToHistory(movie);
        }
        await loadHistory();
      }

      final cloudFavorites = await _syncService.pullFavorites();
      if (cloudFavorites.isNotEmpty) {
        for (var movie in cloudFavorites.reversed) {
          if (!(await _storageService.isFavorite(movie.id))) {
            await _storageService.toggleFavorite(movie);
          }
        }
        await loadFavorites();
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshHome() async {
    _isLoading = true;
    notifyListeners();

    try {
      _homeApiService.setSource(_homeSource);
      _homeMovies = await _homeApiService.getHomeContent();
    } catch (e) {
      print("Error in AppState.refreshHome: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadHistory() async {
    _history = await _storageService.getHistory();
    notifyListeners();
  }

  Future<void> loadFavorites() async {
    _favorites = await _storageService.getFavorites();
    notifyListeners();
  }

  Future<void> addToHistory(Movie movie) async {
    await _storageService.addToHistory(movie);
    await loadHistory();

    if (isMemberLoggedIn) {
      await _syncService.saveHistory(_history);
    }
  }

  Future<void> toggleFavorite(Movie movie) async {
    // Guest accounts are read-only for favorites.
    if (!isMemberLoggedIn) return;

    await _storageService.toggleFavorite(movie);
    await loadFavorites();

    final isFavNow = await isFavorite(movie.id);
    await _syncService.saveFavorite(movie, isFavNow);
  }

  Future<void> removeFromHistory(String movieId) async {
    await _storageService.removeFromHistory(movieId);
    await loadHistory();
  }

  Future<void> clearHistory() async {
    await _storageService.clearHistory();
    await loadHistory();
  }

  Future<bool> isFavorite(String movieId) async {
    return await _storageService.isFavorite(movieId);
  }

  void setHomeSource(String source) {
    final normalized = source.toLowerCase();
    if (_homeSource != normalized) {
      _homeSource = normalized;
      _homeApiService.setSource(normalized);
      refreshHome();
    }
  }

  void setSearchSource(String source) {
    final normalized = source.toLowerCase();
    if (_searchSource != normalized) {
      _searchSource = normalized;
      notifyListeners();
    }
  }

  // Backward-compatible alias. New code should use setHomeSource/setSearchSource.
  void setSource(String source) {
    setHomeSource(source);
  }

  Future<List<Movie>> searchMovies(String query) async {
    try {
      _searchApiService.setSource(_searchSource);
      return await _searchApiService.search(query);
    } catch (e) {
      print("AppState: Error searching movies: $e");
      return [];
    }
  }

  // --- Auth Actions ---
  Future<void> signIn(String email, String password) async {
    _allowAnonymousForCurrentLaunch = false;
    await _authService.signInWithEmail(email, password);
    await _authService.logLoginEvent();
  }

  Future<void> signUp(
    String email,
    String password, {
    String? username,
    String? phoneNumber,
  }) async {
    _allowAnonymousForCurrentLaunch = false;
    await _authService.signUpWithEmail(
      email,
      password,
      username: username,
      phoneNumber: phoneNumber,
    );
  }

  Future<void> signOut() async {
    _allowAnonymousForCurrentLaunch = false;
    _isPasswordRecoveryFlowActive = false;
    await _authService.signOut();
  }

  Future<void> signOutAllDevices() async {
    _allowAnonymousForCurrentLaunch = false;
    _isPasswordRecoveryFlowActive = false;
    await _authService.signOutAllDevices();
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _authService.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
    );
  }

  Future<void> deleteAccount() async {
    _allowAnonymousForCurrentLaunch = false;
    _isPasswordRecoveryFlowActive = false;
    await _authService.deleteCurrentAccount();
    _currentUser = null;
    _storageService.setScope(_storageScopeForUser(null));
    _history = [];
    _favorites = [];
    notifyListeners();
  }

  Future<List<LoginDeviceEntry>> getLoginHistory() async {
    return await _authService.getLoginHistory();
  }

  Future<void> clearImageCache() async {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
    await DefaultCacheManager().emptyCache();
  }

  Future<void> loadSettings({bool notify = true}) async {
    _preferences = await _settingsService.loadPreferences();
    if (notify) {
      notifyListeners();
    }
  }

  Future<void> updateDefaultQuality(String quality) async {
    final normalized = AppPreferences.normalizeQuality(quality);
    await _settingsService.saveDefaultQuality(normalized);
    _preferences = _preferences.copyWith(defaultQuality: normalized);
    notifyListeners();
  }

  Future<void> toggleAutoplayNext(bool enabled) async {
    await _settingsService.saveAutoplayNextEpisode(enabled);
    _preferences = _preferences.copyWith(autoplayNextEpisode: enabled);
    notifyListeners();
  }

  Future<void> toggleAutoLandscape(bool enabled) async {
    await _settingsService.saveAutoLandscapeOnStart(enabled);
    _preferences = _preferences.copyWith(autoLandscapeOnStart: enabled);
    notifyListeners();
  }

  Future<void> signInGuest() async {
    _allowAnonymousForCurrentLaunch = true;
    try {
      await _authService.signInAnonymously();
    } catch (e) {
      _allowAnonymousForCurrentLaunch = false;
      rethrow;
    }
  }

  Future<void> resendEmailVerification(String email) async {
    await _authService.resendSignUpVerificationEmail(email);
  }

  Future<void> requestPasswordReset(String email) async {
    await _authService.sendPasswordResetEmail(email);
  }

  Future<void> updateRecoveredPassword(String newPassword) async {
    await _authService.updatePassword(newPassword);
    _isPasswordRecoveryFlowActive = false;
    notifyListeners();
  }
}
