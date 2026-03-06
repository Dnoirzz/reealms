import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../core/theme';
import type { Movie } from '../../data/models/media';
import { useAppState } from '../../logic/AppStateContext';
import { ActionButton } from '../components/ActionButton';
import { EmptyState } from '../components/EmptyState';
import { MovieCard } from '../components/MovieCard';

type HistoryMode = 'history' | 'favorites';

type HistoryScreenProps = {
  onOpenMovie: (movie: Movie) => void;
};

export function HistoryScreen({ onOpenMovie }: HistoryScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    clearHistory,
    favorites,
    history,
    loadFavorites,
    loadHistory,
    removeFromHistory,
  } = useAppState();
  const [mode, setMode] = React.useState<HistoryMode>('history');

  const favoriteIds = React.useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);
  const data = mode === 'history' ? history : favorites;
  const columnCount = width >= 980 ? 4 : width >= 720 ? 3 : 2;
  const gap = 14;
  const horizontalPadding = 20;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;

  return (
    <>
      <FlatList
        contentContainerStyle={{
          paddingBottom: 28,
          paddingHorizontal: horizontalPadding,
          paddingTop: insets.top + 24,
        }}
        columnWrapperStyle={columnCount > 1 ? { justifyContent: 'space-between' } : undefined}
        data={data}
        key={`${mode}-${columnCount}`}
        keyExtractor={(item) => `${mode}-${item.id}`}
        ListEmptyComponent={
          <EmptyState
            description={
              mode === 'history'
                ? 'Open titles from Home or Search and they will appear here.'
                : 'Tap Save favorite in the preview sheet to build this collection.'
            }
            icon={mode === 'history' ? 'time-outline' : 'bookmark-outline'}
            title={mode === 'history' ? 'History is empty' : 'No favorites yet'}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View>
              <Text style={styles.title}>Collections</Text>
              <Text style={styles.subtitle}>Local persistence is already wired through AsyncStorage.</Text>
            </View>

            <View style={styles.segmentRow}>
              {(['history', 'favorites'] as HistoryMode[]).map((entry) => {
                const active = entry === mode;
                const label = entry === 'history' ? `History (${history.length})` : `Favorites (${favorites.length})`;
                return (
                  <Pressable
                    key={entry}
                    onPress={() => setMode(entry)}
                    style={[styles.segment, active ? styles.segmentActive : null]}
                  >
                    <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : null]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'history' && history.length > 0 ? (
              <ActionButton label="Clear history" onPress={() => void clearHistory()} variant="ghost" />
            ) : null}
          </View>
        }
        numColumns={columnCount}
        refreshControl={
          <RefreshControl
            onRefresh={mode === 'history' ? loadHistory : loadFavorites}
            refreshing={false}
            tintColor={palette.accentGold}
          />
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: gap, width: cardWidth }}>
            <MovieCard isFavorite={favoriteIds.has(item.id)} movie={item} onPress={() => onOpenMovie(item)} />
            {mode === 'history' ? (
              <Pressable onPress={() => void removeFromHistory(item.id)} style={styles.cardAction}>
                <Text style={styles.cardActionText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 16,
    marginBottom: 20,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentActive: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderStrong,
  },
  segmentLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: palette.textPrimary,
  },
  cardAction: {
    marginTop: 8,
    alignItems: 'center',
  },
  cardActionText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
});
