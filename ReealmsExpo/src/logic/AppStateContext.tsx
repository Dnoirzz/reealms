import React from 'react';
import type { User } from '@supabase/supabase-js';
import { AppState as NativeAppState } from 'react-native';
import { AuthService } from '../data/services/authService';
import { ApiService } from '../data/services/apiService';
import { StorageService } from '../data/services/storageService';
import { SyncService } from '../data/services/syncService';
import type { ContentSource, Movie } from '../data/models/media';

type AppStateContextValue = {
  homeMovies: Movie[];
  history: Movie[];
  favorites: Movie[];
  isLoading: boolean;
  currentSource: ContentSource;
  currentUser: User | null;
  isLoggedIn: boolean;
  isMemberLoggedIn: boolean;
  isAuthReady: boolean;
  canEnterMainNavigation: boolean;
  refreshHome: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  addToHistory: (movie: Movie) => Promise<void>;
  toggleFavorite: (movie: Movie) => Promise<void>;
  removeFromHistory: (movieId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  isFavorite: (movieId: string) => Promise<boolean>;
  setSource: (source: ContentSource) => void;
  searchMovies: (query: string) => Promise<Movie[]>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInGuest: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
};

const AppStateContext = React.createContext<AppStateContextValue | null>(null);

function isAnonymousUser(user: User | null | undefined) {
  return Boolean(user?.is_anonymous);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const services = React.useRef({
    apiService: new ApiService(),
    storageService: new StorageService(),
    authService: new AuthService(),
    syncService: new SyncService(),
  }).current;

  const [homeMovies, setHomeMovies] = React.useState<Movie[]>([]);
  const [history, setHistory] = React.useState<Movie[]>([]);
  const [favorites, setFavorites] = React.useState<Movie[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentSource, setCurrentSource] = React.useState<ContentSource>('dramabox');
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [allowAnonymousForCurrentLaunch, setAllowAnonymousForCurrentLaunch] = React.useState(false);
  const currentUserRef = React.useRef<User | null>(null);
  const allowAnonymousRef = React.useRef(false);

  const isLoggedIn = currentUser !== null;
  const isMemberLoggedIn = Boolean(currentUser && !isAnonymousUser(currentUser));
  const canEnterMainNavigation = Boolean(
    currentUser && (!isAnonymousUser(currentUser) || allowAnonymousForCurrentLaunch),
  );

  const loadHistory = React.useCallback(async () => {
    const nextHistory = await services.storageService.getHistory();
    setHistory(nextHistory);
  }, [services.storageService]);

  const loadFavorites = React.useCallback(async () => {
    const nextFavorites = await services.storageService.getFavorites();
    setFavorites(nextFavorites);
  }, [services.storageService]);

  const refreshHome = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const nextHomeMovies = await services.apiService.getHomeContent();
      setHomeMovies(nextHomeMovies);
    } catch (error) {
      console.warn('refreshHome failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [services.apiService]);

  const isFavorite = React.useCallback(async (movieId: string) => {
    return services.storageService.isFavorite(movieId);
  }, [services.storageService]);

  const syncFromCloud = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [cloudHistory, cloudFavorites] = await Promise.all([
        services.syncService.pullHistory(),
        services.syncService.pullFavorites(),
      ]);

      for (const movie of [...cloudHistory].reverse()) {
        await services.storageService.addToHistory(movie);
      }

      for (const movie of [...cloudFavorites].reverse()) {
        if (!(await services.storageService.isFavorite(movie.id))) {
          await services.storageService.toggleFavorite(movie);
        }
      }

      await Promise.all([loadHistory(), loadFavorites()]);
    } finally {
      setIsLoading(false);
    }
  }, [loadFavorites, loadHistory, services.storageService, services.syncService]);

  const addToHistory = React.useCallback(
    async (movie: Movie) => {
      await services.storageService.addToHistory(movie);
      await loadHistory();

      if (isMemberLoggedIn) {
        const latestHistory = await services.storageService.getHistory();
        await services.syncService.saveHistory(latestHistory);
      }
    },
    [isMemberLoggedIn, loadHistory, services.storageService, services.syncService],
  );

  const toggleFavorite = React.useCallback(
    async (movie: Movie) => {
      await services.storageService.toggleFavorite(movie);
      await loadFavorites();

      if (isMemberLoggedIn) {
        const favoriteNow = await services.storageService.isFavorite(movie.id);
        await services.syncService.saveFavorite(movie, favoriteNow);
      }
    },
    [isMemberLoggedIn, loadFavorites, services.storageService, services.syncService],
  );

  const removeFromHistory = React.useCallback(
    async (movieId: string) => {
      await services.storageService.removeFromHistory(movieId);
      await loadHistory();
    },
    [loadHistory, services.storageService],
  );

  const clearHistory = React.useCallback(async () => {
    await services.storageService.clearHistory();
    await loadHistory();
  }, [loadHistory, services.storageService]);

  const setSource = React.useCallback(
    (source: ContentSource) => {
      setCurrentSource((previousSource) => {
        if (previousSource === source) {
          return previousSource;
        }

        services.apiService.setSource(source);
        return source;
      });
    },
    [services.apiService],
  );

  const searchMovies = React.useCallback(async (query: string) => {
    try {
      return await services.apiService.search(query);
    } catch (error) {
      console.warn('searchMovies failed:', error);
      return [];
    }
  }, [services.apiService]);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      setAllowAnonymousForCurrentLaunch(false);
      await services.authService.signInWithEmail(email, password);
    },
    [services.authService],
  );

  const signUp = React.useCallback(
    async (email: string, password: string) => {
      setAllowAnonymousForCurrentLaunch(false);
      await services.authService.signUpWithEmail(email, password);
    },
    [services.authService],
  );

  const signOut = React.useCallback(async () => {
    setAllowAnonymousForCurrentLaunch(false);
    await services.authService.signOut();
  }, [services.authService]);

  const signInGuest = React.useCallback(async () => {
    setAllowAnonymousForCurrentLaunch(true);
    try {
      await services.authService.signInAnonymously();
    } catch (error) {
      setAllowAnonymousForCurrentLaunch(false);
      throw error;
    }
  }, [services.authService]);

  const clearGuestSessionIfNeeded = React.useCallback(async () => {
    if (!isAnonymousUser(currentUser)) {
      return;
    }

    try {
      await services.authService.signOut();
    } catch (error) {
      console.warn('Guest sign-out failed:', error);
    } finally {
      setCurrentUser(null);
      setAllowAnonymousForCurrentLaunch(false);
    }
  }, [currentUser, services.authService]);

  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  React.useEffect(() => {
    allowAnonymousRef.current = allowAnonymousForCurrentLaunch;
  }, [allowAnonymousForCurrentLaunch]);

  React.useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const [user] = await Promise.all([
          services.authService.getCurrentUser(),
          loadHistory(),
          loadFavorites(),
        ]);

        if (!mounted) {
          return;
        }

        if (isAnonymousUser(user)) {
          try {
            await services.authService.signOut();
          } catch (error) {
            console.warn('Anonymous cleanup on launch failed:', error);
          }
          setCurrentUser(null);
          setAllowAnonymousForCurrentLaunch(false);
        } else {
          setCurrentUser(user);
        }
      } catch (error) {
        console.warn('App bootstrap failed:', error);
      } finally {
        if (mounted) {
          setIsAuthReady(true);
        }
      }
    })();

    const subscription = services.authService.onAuthStateChange((_event, session) => {
      void (async () => {
        const incomingUser = session?.user ?? null;

        if (isAnonymousUser(incomingUser) && !allowAnonymousRef.current) {
          try {
            await services.authService.signOut();
          } catch (error) {
            console.warn('Anonymous auth change cleanup failed:', error);
          }
          return;
        }

        const wasMember = Boolean(currentUserRef.current && !isAnonymousUser(currentUserRef.current));
        const isMemberNow = Boolean(incomingUser && !isAnonymousUser(incomingUser));

        if (mounted) {
          setCurrentUser(incomingUser);
        }

        if (isMemberNow && !wasMember) {
          await syncFromCloud();
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadFavorites, loadHistory, services.authService, syncFromCloud]);

  React.useEffect(() => {
    void refreshHome();
  }, [currentSource, refreshHome]);

  React.useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        void clearGuestSessionIfNeeded();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [clearGuestSessionIfNeeded]);

  const contextValue = React.useMemo<AppStateContextValue>(
    () => ({
      homeMovies,
      history,
      favorites,
      isLoading,
      currentSource,
      currentUser,
      isLoggedIn,
      isMemberLoggedIn,
      isAuthReady,
      canEnterMainNavigation,
      refreshHome,
      loadHistory,
      loadFavorites,
      addToHistory,
      toggleFavorite,
      removeFromHistory,
      clearHistory,
      isFavorite,
      setSource,
      searchMovies,
      signIn,
      signUp,
      signOut,
      signInGuest,
      syncFromCloud,
    }),
    [
      addToHistory,
      canEnterMainNavigation,
      clearHistory,
      currentSource,
      currentUser,
      favorites,
      history,
      homeMovies,
      isAuthReady,
      isFavorite,
      isLoading,
      isLoggedIn,
      isMemberLoggedIn,
      loadFavorites,
      loadHistory,
      refreshHome,
      removeFromHistory,
      searchMovies,
      setSource,
      signIn,
      signInGuest,
      signOut,
      signUp,
      syncFromCloud,
      toggleFavorite,
    ],
  );

  return <AppStateContext.Provider value={contextValue}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = React.useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }

  return value;
}
