import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { SourcePill } from '../components/SourcePill';

type HomeScreenProps = {
  onOpenMovie: (movie: Movie) => void;
};

function getRailTitle(sourceId: string) {
  switch (sourceId) {
    case 'dramabox':
      return 'Drama pilihan';
    case 'otakudesu':
      return 'Anime terbaru';
    case 'komik':
      return 'Komik pilihan';
    default:
      return 'Katalog pilihan';
  }
}

function getRailSubtitle(sourceId: string) {
  switch (sourceId) {
    case 'dramabox':
      return 'Cerita vertikal yang lagi ramai di Dramabox.';
    case 'otakudesu':
      return 'Episode dan rilisan anime terbaru dari Otakudesu.';
    case 'komik':
      return 'Chapter dan seri komik yang lagi update.';
    default:
      return 'Konten pilihan yang siap Anda buka sekarang.';
  }
}

export function HomeScreen({ onOpenMovie }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    currentSource,
    favorites,
    history,
    homeMovies,
    isLoading,
    refreshHome,
    setSource,
  } = useAppState();

  const columnCount = width >= 980 ? 4 : width >= 720 ? 3 : 2;
  const gap = 14;
  const horizontalPadding = 20;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;
  const favoriteIds = React.useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);
  const activeSource = sourceOptions.find((option) => option.id === currentSource) ?? sourceOptions[0];
  const featuredMovie = history[0] ?? homeMovies[0] ?? null;
  const heroDescription =
    featuredMovie?.synopsis?.trim() ||
    `Pilihan ${activeSource.label.toLowerCase()} terbaru yang siap dilanjutkan di Reealms.`;

  return (
    <FlatList
      contentContainerStyle={{
        paddingBottom: 28,
        paddingHorizontal: horizontalPadding,
        paddingTop: insets.top + 24,
      }}
      columnWrapperStyle={columnCount > 1 ? { justifyContent: 'space-between' } : undefined}
      data={homeMovies}
      key={columnCount}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>
              Memuat katalog {activeSource.label.toLowerCase()} untuk Anda...
            </Text>
          </View>
        ) : (
          <EmptyState
            description="Sumber yang dipilih belum mengembalikan katalog. Tarik untuk muat ulang atau pindah sumber."
            icon="cloud-offline-outline"
            title="Konten belum tersedia"
          />
        )
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <Pressable
            disabled={!featuredMovie}
            onPress={() => {
              if (featuredMovie) {
                onOpenMovie(featuredMovie);
              }
            }}
            style={({ pressed }) => [styles.heroCard, pressed ? styles.heroCardPressed : null]}
          >
            {featuredMovie?.posterUrl ? (
              <Image resizeMode="cover" source={{ uri: featuredMovie.posterUrl }} style={styles.heroPoster} />
            ) : null}
            <LinearGradient colors={gradients.heroPanel} style={styles.heroGradient} />
            <LinearGradient colors={gradients.heroScrim} style={styles.heroScrim} />
            <View style={styles.heroTopRow}>
              <View style={styles.brandLockup}>
                <Image source={require('../../../assets/branding/logo.png')} style={styles.logo} />
                <View style={styles.brandCopy}>
                  <Text style={styles.eyebrow}>Reealms</Text>
                  <Text style={styles.brandTitle}>Pilihan premium</Text>
                </View>
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{activeSource.label}</Text>
              </View>
            </View>

            <View style={styles.heroContent}>
              <Text style={styles.heroHeadline}>
                {featuredMovie ? featuredMovie.title : `Masuk ke dunia ${activeSource.label.toLowerCase()}`}
              </Text>
              <Text numberOfLines={3} style={styles.heroBody}>
                {heroDescription}
              </Text>
              <View style={styles.heroInfoRow}>
                <View style={styles.heroInfoPill}>
                  <Ionicons color={palette.accentGold} name="sparkles" size={12} />
                  <Text style={styles.heroInfoText}>
                    {featuredMovie?.year || `Katalog ${activeSource.label}`}
                  </Text>
                </View>
                {featuredMovie?.rating ? (
                  <View style={styles.heroInfoPill}>
                    <Ionicons color={palette.accentGold} name="star" size={12} />
                    <Text style={styles.heroInfoText}>{featuredMovie.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
                <View style={styles.heroInfoPill}>
                  <Ionicons color={palette.accentCool} name="layers-outline" size={12} />
                  <Text style={styles.heroInfoText}>{homeMovies.length} judul</Text>
                </View>
              </View>
              {history[0] ? (
                <View style={styles.recentCard}>
                  <Text style={styles.recentLabel}>Lanjutkan tontonan</Text>
                  <Text numberOfLines={1} style={styles.recentTitle}>
                    {history[0].title}
                  </Text>
                  <Text numberOfLines={1} style={styles.recentHint}>
                    Kembali ke detail dan lanjutkan dari koleksi terakhir Anda.
                  </Text>
                </View>
              ) : null}
              {featuredMovie ? (
                <View style={styles.heroActionRow}>
                  <Text style={styles.heroActionText}>Buka detail</Text>
                  <Ionicons color={palette.textPrimary} name="arrow-forward" size={16} />
                </View>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.sectionLead}>
            <Text style={styles.sectionEyebrow}>Jelajah</Text>
            <Text style={styles.sectionTitle}>Pilih dunia favorit Anda</Text>
            <Text style={styles.sectionSubtitle}>
              Setiap sumber punya karakter yang berbeda, tapi tetap terasa satu rumah.
            </Text>
          </View>

          <View style={styles.selectorShell}>
            <ScrollView
              horizontal
              contentContainerStyle={styles.sourceRow}
              showsHorizontalScrollIndicator={false}
            >
              {sourceOptions.map((option) => (
                <SourcePill
                  key={option.id}
                  onPress={() => setSource(option.id)}
                  option={option}
                  selected={option.id === currentSource}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{getRailTitle(currentSource)}</Text>
              <Text style={styles.sectionSubtitle}>{getRailSubtitle(currentSource)}</Text>
            </View>
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{homeMovies.length}</Text>
            </View>
          </View>
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
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 24,
    marginBottom: 24,
  },
  heroCard: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    minHeight: 310,
    padding: 24,
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
  },
  heroCardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  heroPoster: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 1,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandCopy: {
    gap: 4,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 20,
  },
  eyebrow: {
    color: palette.accentGold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  brandTitle: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  liveBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  liveBadgeText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  heroContent: {
    gap: 14,
    zIndex: 1,
  },
  heroHeadline: {
    color: palette.textPrimary,
    fontSize: 29,
    fontWeight: '700',
    lineHeight: 36,
  },
  heroBody: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 23,
  },
  heroInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroInfoText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  recentCard: {
    gap: 5,
    padding: 15,
    borderRadius: 22,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  recentLabel: {
    color: palette.textFaint,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  recentTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  recentHint: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroActionText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLead: {
    gap: 6,
  },
  sectionEyebrow: {
    color: palette.accentGold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  selectorShell: {
    marginHorizontal: -4,
  },
  sourceRow: {
    gap: 12,
    paddingHorizontal: 4,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 20,
  },
  sectionCountPill: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sectionCountText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 52,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
