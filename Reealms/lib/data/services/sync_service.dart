import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:reealms_mobile/data/models/movie.dart';

class SyncService {
  final _supabase = Supabase.instance.client;

  Future<void> saveHistory(List<Movie> movies) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    try {
      final data = movies
          .map(
            (m) => {
              'user_id': user.id,
              'movie_id': m.id,
              'movie_data': m.toJson(),
              'type': 'history',
              'updated_at': DateTime.now().toIso8601String(),
            },
          )
          .toList();

      await _supabase
          .from('user_interactions')
          .upsert(data, onConflict: 'user_id, movie_id, type');
    } catch (e) {
      print("SyncService Error: $e");
    }
  }

  Future<void> saveFavorite(Movie movie, bool isFavorite) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    try {
      if (isFavorite) {
        await _supabase.from('user_interactions').upsert({
          'user_id': user.id,
          'movie_id': movie.id,
          'movie_data': movie.toJson(),
          'type': 'favorite',
          'updated_at': DateTime.now().toIso8601String(),
        });
      } else {
        await _supabase.from('user_interactions').delete().match({
          'user_id': user.id,
          'movie_id': movie.id,
          'type': 'favorite',
        });
      }
    } catch (e) {
      print("SyncService Favorite Error: $e");
    }
  }

  Future<List<Movie>> pullHistory() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    try {
      final response = await _supabase
          .from('user_interactions')
          .select('movie_data')
          .eq('user_id', user.id)
          .eq('type', 'history')
          .order('updated_at', ascending: false);

      return (response as List).map((item) {
        final data = item['movie_data'] as Map<String, dynamic>;
        return Movie.fromJson(data, data['source_type'] ?? 'unknown');
      }).toList();
    } catch (e) {
      print("SyncService pull error: $e");
      return [];
    }
  }

  Future<List<Movie>> pullFavorites() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    try {
      final response = await _supabase
          .from('user_interactions')
          .select('movie_data')
          .eq('user_id', user.id)
          .eq('type', 'favorite')
          .order('updated_at', ascending: false);

      return (response as List).map((item) {
        final data = item['movie_data'] as Map<String, dynamic>;
        return Movie.fromJson(data, data['source_type'] ?? 'unknown');
      }).toList();
    } catch (e) {
      print("SyncService pull favorites error: $e");
      return [];
    }
  }
}
