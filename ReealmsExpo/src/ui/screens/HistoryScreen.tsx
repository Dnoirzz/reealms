import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, palette } from '../../core/theme';
import type { Movie } from '../../data/models/media';
import { useAppState } from '../../logic/AppStateContext';
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
  } = useAppState();
  const [mode, setMode] = React.useState<HistoryMode>('history');

  const data = mode === 'history' ? history : favorites;
  const favoriteIds = React.useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);
  const columnCount = width >= 900 ? 4 : width >= 560 ? 3 : 2;
  const gap = 8;
  const horizontalPadding = 12;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;

  function confirmClearHistory() {
    Alert.alert(
      'Hapus Riwayat',
      'Apakah Anda yakin ingin menghapus semua riwayat tontonan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void clearHistory();
          },
        },
      ],
    );
  }

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
        data={data}
        key={`${mode}-${columnCount}`}
        keyExtractor={(item) => `${mode}-${item.id}`}
        ListEmptyComponent={
          <EmptyState
            description={
              mode === 'history'
                ? 'Mulai tonton konten menarik untuk mengisi riwayat Anda.'
                : 'Simpan konten yang Anda suka agar mudah ditemukan kembali.'
            }
            icon={mode === 'history' ? 'time-outline' : 'bookmark-outline'}
            title={mode === 'history' ? 'Belum ada riwayat' : 'Belum ada favorit'}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Koleksi Saya</Text>
              {history.length > 0 ? (
                <Pressable onPress={confirmClearHistory} style={styles.deleteButton}>
                  <Ionicons color={palette.textSecondary} name="trash-outline" size={20} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setMode('history')}
                style={[styles.tabButton, mode === 'history' ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabText, mode === 'history' ? styles.tabTextActive : null]}>Riwayat</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('favorites')}
                style={[styles.tabButton, mode === 'favorites' ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabText, mode === 'favorites' ? styles.tabTextActive : null]}>Favorit</Text>
              </Pressable>
            </View>
          </View>
        }
        numColumns={columnCount}
        refreshControl={
          <RefreshControl
            onRefresh={mode === 'history' ? loadHistory : loadFavorites}
            refreshing={false}
            tintColor={palette.accent}
          />
        }
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
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  titleRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabButtonActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(108, 92, 231, 0.22)',
  },
  tabText: {
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  tabTextActive: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
});
