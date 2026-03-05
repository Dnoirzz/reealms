import 'dart:async';

import 'package:flutter/material.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:reealms_mobile/data/services/api_service.dart';
import 'package:reealms_mobile/data/services/storage_service.dart';
import 'package:reealms_mobile/data/services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:reealms_mobile/data/services/sync_service.dart';

class AppState extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();
  final AuthService _authService = AuthService();
  final SyncService _syncService = SyncService();

  List<Movie> _homeMovies = [];
  List<Movie> _history = [];
  List<Movie> _favorites = [];
  bool _isLoading = false;
  String _currentSource = "dramabox";
  User? _currentUser;
  bool _isAuthReady = false;
  bool _allowAnonymousForCurrentLaunch = false;
  bool _isClearingAnonymousSession = false;

  List<Movie> get homeMovies => _homeMovies;
  List<Movie> get history => _history;
  List<Movie> get favorites => _favorites;
  bool get isLoading => _isLoading;
  String get currentSource => _currentSource;
  String get source => _currentSource;
  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;
  bool get isMemberLoggedIn =>
      _currentUser != null && !(_currentUser?.isAnonymous ?? true);
  bool get isAuthReady => _isAuthReady;
  bool get canEnterMainNavigation {
    final user = _currentUser;
    if (user == null) return false;
    if (!user.isAnonymous) return true;
    return _allowAnonymousForCurrentLaunch;
  }

  AppState() {
    unawaited(_initAuth());
    refreshHome();
    loadHistory();
    loadFavorites();
  }

  Future<void> _initAuth() async {
    _currentUser = _authService.currentUser;
    if (_currentUser?.isAnonymous ?? false) {
      await _clearAnonymousSession(notify: false);
    }

    _authService.authStateChanges.listen((data) {
      unawaited(_handleAuthStateChange(data));
    });

    _isAuthReady = true;
    notifyListeners();
  }

  Future<void> _handleAuthStateChange(AuthState data) async {
    final incomingUser = data.session?.user;
    if ((incomingUser?.isAnonymous ?? false) &&
        !_allowAnonymousForCurrentLaunch) {
      await _clearAnonymousSession();
      return;
    }

    final prevUser = _currentUser;
    _currentUser = incomingUser;

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
      _homeMovies = await _apiService.getHomeContent();
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
    await _storageService.toggleFavorite(movie);
    await loadFavorites();

    if (isMemberLoggedIn) {
      final isFavNow = await isFavorite(movie.id);
      await _syncService.saveFavorite(movie, isFavNow);
    }
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

  void setSource(String source) {
    if (_currentSource != source) {
      _currentSource = source;
      _apiService.setSource(source);
      refreshHome();
    }
  }

  Future<List<Movie>> searchMovies(String query) async {
    try {
      return await _apiService.search(query);
    } catch (e) {
      print("AppState: Error searching movies: $e");
      return [];
    }
  }

  // --- Auth Actions ---
  Future<void> signIn(String email, String password) async {
    _allowAnonymousForCurrentLaunch = false;
    await _authService.signInWithEmail(email, password);
  }

  Future<void> signUp(String email, String password) async {
    _allowAnonymousForCurrentLaunch = false;
    await _authService.signUpWithEmail(email, password);
  }

  Future<void> signOut() async {
    _allowAnonymousForCurrentLaunch = false;
    await _authService.signOut();
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
}
