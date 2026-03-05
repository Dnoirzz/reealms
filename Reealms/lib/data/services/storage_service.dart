import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:reealms_mobile/data/models/movie.dart';

class StorageService {
  static const String _historyKey = 'watch_history';
  static const String _favoritesKey = 'favorites';

  // --- HISTORY ---

  Future<void> addToHistory(Movie movie) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> historyList = prefs.getStringList(_historyKey) ?? [];

    // Remove if already exists to move to top
    historyList.removeWhere((item) {
      final decoded = json.decode(item);
      return decoded['id'] == movie.id;
    });

    // Add to top (limit to 50 items)
    historyList.insert(0, json.encode(movie.toJson()));
    if (historyList.length > 50) historyList.removeLast();

    await prefs.setStringList(_historyKey, historyList);
  }

  Future<List<Movie>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> historyList = prefs.getStringList(_historyKey) ?? [];
    return historyList
        .map(
          (item) => Movie.fromJson(
            json.decode(item),
            json.decode(item)['source_type'] ?? 'unknown',
          ),
        )
        .toList();
  }

  Future<void> removeFromHistory(String movieId) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> historyList = prefs.getStringList(_historyKey) ?? [];
    historyList.removeWhere((item) => json.decode(item)['id'] == movieId);
    await prefs.setStringList(_historyKey, historyList);
  }

  Future<void> clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_historyKey);
  }

  // --- FAVORITES ---

  Future<void> toggleFavorite(Movie movie) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> favList = prefs.getStringList(_favoritesKey) ?? [];

    bool exists = favList.any((item) => json.decode(item)['id'] == movie.id);

    if (exists) {
      favList.removeWhere((item) => json.decode(item)['id'] == movie.id);
    } else {
      favList.insert(0, json.encode(movie.toJson()));
    }

    await prefs.setStringList(_favoritesKey, favList);
  }

  Future<bool> isFavorite(String movieId) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> favList = prefs.getStringList(_favoritesKey) ?? [];
    return favList.any((item) => json.decode(item)['id'] == movieId);
  }

  Future<List<Movie>> getFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> favList = prefs.getStringList(_favoritesKey) ?? [];
    return favList
        .map(
          (item) => Movie.fromJson(
            json.decode(item),
            json.decode(item)['source_type'] ?? 'unknown',
          ),
        )
        .toList();
  }
}
