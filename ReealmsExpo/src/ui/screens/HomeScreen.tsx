import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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

type HomeScreenProps = {
  onOpenMovie: (movie: Movie) => void;
};

function sourceIcon(sourceId: string): React.ComponentProps<typeof Ionicons>['name'] {
  switch (sourceId) {
    case 'otakudesu':
      return 'sparkles-outline';
    case 'komik':
      return 'book-outline';
    default:
      return 'film-outline';
  }
}

export function HomeScreen({ onOpenMovie }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    currentSource,
    favorites,
    homeMovies,
    isLoading,
    refreshHome,
    setSource,
  } = useAppState();
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const columnCount = width >= 900 ? 4 : width >= 560 ? 3 : 2;
  const gap = 8;
  const horizontalPadding = 12;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;
  const favoriteIds = React.useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);
  const activeSource = sourceOptions.find((option) => option.id === currentSource) ?? sourceOptions[0];

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
        data={homeMovies}
        key={columnCount}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={palette.accent} size="large" />
              <Text style={styles.loadingText}>Memuat konten...</Text>
            </View>
          ) : (
            <EmptyState
              description="Konten tidak tersedia saat ini. Tarik ke bawah untuk coba lagi."
              icon="cloud-offline-outline"
              title="Belum ada konten"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.topRow}>
              <View style={styles.brandRow}>
                <View style={styles.logoWrap}>
                  <Image source={require('../../../assets/branding/logo.png')} style={styles.logo} />
                </View>
                <Text style={styles.brandTitle}>Reealms</Text>
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => setPickerOpen(true)} style={styles.actionButton}>
                  <Ionicons color={palette.accent} name={sourceIcon(currentSource)} size={22} />
                </Pressable>
                <Pressable style={styles.actionButton}>
                  <Ionicons color={palette.textPrimary} name="notifications-outline" size={22} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.sourceHint}>
              Sumber aktif: <Text style={styles.sourceHintStrong}>{activeSource.label}</Text>
            </Text>
          </View>
        }
        numColumns={columnCount}
        refreshControl={<RefreshControl onRefresh={refreshHome} refreshing={isLoading} tintColor={palette.accent} />}
        renderItem={({ item }) => (
          <View style={{ marginBottom: gap, width: cardWidth }}>
            <MovieCard isFavorite={favoriteIds.has(item.id)} movie={item} onPress={() => onOpenMovie(item)} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        animationType="slide"
        transparent
        visible={pickerOpen}
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable onPress={() => {}} style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Pilih Konten</Text>
            <Text style={styles.sheetSubtitle}>Pilih sumber konten yang ingin ditampilkan.</Text>
            {sourceOptions.map((option) => {
              const selected = option.id === currentSource;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setSource(option.id);
                    setPickerOpen(false);
                  }}
                  style={[styles.sheetOption, selected ? styles.sheetOptionSelected : null]}
                >
                  <Ionicons color={selected ? palette.accent : palette.textMuted} name={option.icon} size={20} />
                  <View style={styles.sheetCopy}>
                    <Text style={[styles.sheetOptionLabel, selected ? styles.sheetOptionLabelSelected : null]}>
                      {option.label}
                    </Text>
                    <Text style={styles.sheetOptionBlurb}>{option.blurb}</Text>
                  </View>
                  {selected ? (
                    <Ionicons color={palette.accent} name="checkmark-circle" size={18} />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  headerBlock: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceHint: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 12,
  },
  sourceHintStrong: {
    color: palette.accentStrong,
    fontWeight: '700',
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 52,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: palette.surfaceRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 12,
  },
  sheetTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  sheetOption: {
    minHeight: 66,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetOptionSelected: {
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.34)',
    backgroundColor: 'rgba(108, 92, 231, 0.11)',
  },
  sheetCopy: {
    flex: 1,
    gap: 2,
  },
  sheetOptionLabel: {
    color: palette.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  sheetOptionLabelSelected: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  sheetOptionBlurb: {
    color: palette.textMuted,
    fontSize: 12,
  },
});
