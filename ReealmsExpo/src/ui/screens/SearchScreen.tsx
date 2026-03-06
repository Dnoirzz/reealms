import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sourceOptions } from '../../core/constants';
import { palette } from '../../core/theme';
import type { Movie } from '../../data/models/media';
import { useAppState } from '../../logic/AppStateContext';
import { EmptyState } from '../components/EmptyState';
import { MovieCard } from '../components/MovieCard';

type SearchScreenProps = {
  onOpenMovie: (movie: Movie) => void;
};

export function SearchScreen({ onOpenMovie }: SearchScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentSource, favorites, searchMovies } = useAppState();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Movie[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchRequestId = React.useRef(0);

  const columnCount = width >= 980 ? 4 : width >= 720 ? 3 : 2;
  const gap = 14;
  const horizontalPadding = 20;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;
  const favoriteIds = React.useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);
  const activeSource = sourceOptions.find((option) => option.id === currentSource) ?? sourceOptions[0];

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;

    const timer = setTimeout(() => {
      void (async () => {
        setIsSearching(true);
        const nextResults = await searchMovies(trimmed);
        if (searchRequestId.current === requestId) {
          setResults(nextResults);
          setIsSearching(false);
        }
      })();
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [currentSource, query, searchMovies]);

  return (
    <>
      <FlatList
        contentContainerStyle={{
          paddingBottom: 28,
          paddingHorizontal: horizontalPadding,
          paddingTop: insets.top + 24,
        }}
        columnWrapperStyle={columnCount > 1 ? { justifyContent: 'space-between' } : undefined}
        data={results}
        key={columnCount}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim() ? (
            isSearching ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={palette.accentCool} size="small" />
                <Text style={styles.loadingText}>Searching {activeSource.label}...</Text>
              </View>
            ) : (
              <EmptyState
                description="Try another title or switch the source. Some providers are stricter about search terms."
                icon="search-outline"
                title="No results"
              />
            )
          ) : (
            <EmptyState
              description="Start with a title, keyword, or source switch. Search hits the same third-party APIs used by the Flutter app."
              icon="planet-outline"
              title="Search is ready"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.sectionTitle}>Search across the current source</Text>
            <Text style={styles.sectionSubtitle}>
              Active source: {activeSource.label}. Change it from the home screen when you want a different catalog.
            </Text>
            <View style={styles.searchField}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Cari judul..."
                placeholderTextColor={palette.textMuted}
                selectionColor={palette.accent}
                style={styles.input}
                value={query}
              />
            </View>
          </View>
        }
        numColumns={columnCount}
        renderItem={({ item }) => (
          <View style={{ marginBottom: gap, width: cardWidth }}>
            <MovieCard isFavorite={favoriteIds.has(item.id)} movie={item} onPress={() => onOpenMovie(item)} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 14,
    marginBottom: 20,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  searchField: {
    paddingHorizontal: 16,
    borderRadius: 22,
    minHeight: 58,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
  },
  input: {
    color: palette.textPrimary,
    fontSize: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
});
