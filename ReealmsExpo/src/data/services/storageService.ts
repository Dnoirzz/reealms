import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKeys } from '../../core/constants';
import { isJsonRecord, movieFromJson, movieToJson, type Movie } from '../models/media';

export class StorageService {
  private async readMovieList(key: string): Promise<Movie[]> {
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(isJsonRecord)
        .map((entry) => movieFromJson(entry, String(entry.source_type ?? entry.sourceType ?? 'unknown')));
    } catch (error) {
      console.warn(`Storage parse failed for ${key}:`, error);
      return [];
    }
  }

  private async writeMovieList(key: string, movies: Movie[]) {
    await AsyncStorage.setItem(key, JSON.stringify(movies.map(movieToJson)));
  }

  async addToHistory(movie: Movie) {
    const history = await this.readMovieList(storageKeys.history);
    const nextHistory = history.filter((entry) => entry.id !== movie.id);
    nextHistory.unshift(movie);
    await this.writeMovieList(storageKeys.history, nextHistory.slice(0, 50));
  }

  async getHistory() {
    return this.readMovieList(storageKeys.history);
  }

  async removeFromHistory(movieId: string) {
    const history = await this.readMovieList(storageKeys.history);
    await this.writeMovieList(
      storageKeys.history,
      history.filter((entry) => entry.id !== movieId),
    );
  }

  async clearHistory() {
    await AsyncStorage.removeItem(storageKeys.history);
  }

  async toggleFavorite(movie: Movie) {
    const favorites = await this.readMovieList(storageKeys.favorites);
    const exists = favorites.some((entry) => entry.id === movie.id);
    const nextFavorites = exists
      ? favorites.filter((entry) => entry.id !== movie.id)
      : [movie, ...favorites];
    await this.writeMovieList(storageKeys.favorites, nextFavorites);
  }

  async isFavorite(movieId: string) {
    const favorites = await this.readMovieList(storageKeys.favorites);
    return favorites.some((entry) => entry.id === movieId);
  }

  async getFavorites() {
    return this.readMovieList(storageKeys.favorites);
  }
}
