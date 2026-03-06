import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sourceOptions } from '../../core/constants';
import { gradients, palette } from '../../core/theme';
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
  const { currentSource, favorites, searchMovies, setSource } = useAppState();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Movie[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const searchRequestId = React.useRef(0);

  const columnCount = width >= 900 ? 4 : width >= 560 ? 3 : 2;
  const gap = 8;
  const horizontalPadding = 12;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;
  const favoriteIds = React.useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);

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
    }, 450);

    return () => clearTimeout(timer);
  }, [currentSource, query, searchMovies]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.shellBackdrop}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <FlatList
        contentContainerStyle={{
          paddingBottom: 20,
          paddingHorizontal: horizontalPadding,
          paddingTop: insets.top + 8,
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
                <ActivityIndicator color={palette.accent} size="small" />
                <Text style={styles.loadingText}>Mencari konten...</Text>
              </View>
            ) : (
              <EmptyState
                description="Coba kata kunci lain atau ganti sumber konten."
                icon="search-outline"
                title="Tidak ditemukan"
              />
            )
          ) : (
            <EmptyState
              description="Cari film, anime, atau komik dari sumber aktif."
              icon="planet-outline"
              title="Mulai pencarian"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Cari</Text>
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>{currentSource.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.searchField}>
              <Ionicons color={palette.textFaint} name="search" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                onSubmitEditing={() => setQuery((previous) => previous.trim())}
                placeholder="Cari drama, anime, atau komik..."
                placeholderTextColor={palette.textFaint}
                selectionColor={palette.accent}
                style={styles.input}
                value={query}
              />
              {query.trim() ? (
                <Pressable onPress={() => setQuery('')}>
                  <Ionicons color={palette.textFaint} name="close-circle" size={18} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.sourceRow}>
              {sourceOptions.map((option) => {
                const selected = option.id === currentSource;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setSource(option.id)}
                    style={[styles.sourceChip, selected ? styles.sourceChipSelected : null]}
                  >
                    <Ionicons
                      color={selected ? palette.textPrimary : palette.textFaint}
                      name={option.icon}
                      size={14}
                    />
                    <Text style={[styles.sourceChipText, selected ? styles.sourceChipTextSelected : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  headerBlock: {
    gap: 14,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  sourceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 92, 231, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.32)',
  },
  sourceBadgeText: {
    color: palette.accentStrong,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  searchField: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sourceChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceChipSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  sourceChipText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sourceChipTextSelected: {
    color: palette.textPrimary,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 13,
  },
});
