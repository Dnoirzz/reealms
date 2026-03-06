import { supabase } from '../../lib/supabase';
import { isJsonRecord, movieFromJson, movieToJson, type Movie } from '../models/media';

export class SyncService {
  async saveHistory(movies: Movie[]) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const payload = movies.map((movie) => ({
      user_id: user.id,
      movie_id: movie.id,
      movie_data: movieToJson(movie),
      type: 'history',
      updated_at: new Date().toISOString(),
    }));

    if (payload.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('user_interactions')
      .upsert(payload, { onConflict: 'user_id,movie_id,type' });

    if (error) {
      throw error;
    }
  }

  async saveFavorite(movie: Movie, isFavorite: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    if (isFavorite) {
      const { error } = await supabase.from('user_interactions').upsert({
        user_id: user.id,
        movie_id: movie.id,
        movie_data: movieToJson(movie),
        type: 'favorite',
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      return;
    }

    const { error } = await supabase
      .from('user_interactions')
      .delete()
      .match({ user_id: user.id, movie_id: movie.id, type: 'favorite' });

    if (error) {
      throw error;
    }
  }

  async pullHistory() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_interactions')
      .select('movie_data')
      .eq('user_id', user.id)
      .eq('type', 'history')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((entry) => (isJsonRecord(entry.movie_data) ? entry.movie_data : null))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => movieFromJson(entry, String(entry.source_type ?? 'unknown')));
  }

  async pullFavorites() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_interactions')
      .select('movie_data')
      .eq('user_id', user.id)
      .eq('type', 'favorite')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((entry) => (isJsonRecord(entry.movie_data) ? entry.movie_data : null))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => movieFromJson(entry, String(entry.source_type ?? 'unknown')));
  }
}
