import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  FlatList,
  Image,
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

  return (
    <>
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
              <Text style={styles.loadingText}>Fetching the first Expo feed from {activeSource.label}...</Text>
            </View>
          ) : (
            <EmptyState
              description="The selected source did not return content right now. Pull to retry or switch source."
              icon="cloud-offline-outline"
              title="No content yet"
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <LinearGradient
              colors={gradients.cardGlow}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.brandLockup}>
                  <Image source={require('../../../assets/branding/logo.png')} style={styles.logo} />
                  <View style={styles.brandCopy}>
                    <Text style={styles.eyebrow}>Expo migration</Text>
                    <Text style={styles.brandTitle}>Reealms</Text>
                  </View>
                </View>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>Live data</Text>
                </View>
              </View>
              <Text style={styles.heroHeadline}>Drama, anime, and comics now loaded from a TypeScript shell.</Text>
              <Text style={styles.heroBody}>
                This first phase keeps the backend shape and replaces the Flutter home flow with Expo-native state and storage.
              </Text>
              {history[0] ? (
                <View style={styles.recentCard}>
                  <Text style={styles.recentLabel}>Recent pick</Text>
                  <Text numberOfLines={1} style={styles.recentTitle}>
                    {history[0].title}
                  </Text>
                </View>
              ) : null}
            </LinearGradient>

            <Text style={styles.sectionTitle}>Sources</Text>
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

            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionTitle}>Now loading</Text>
                <Text style={styles.sectionSubtitle}>{activeSource.blurb}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: 20,
    marginBottom: 20,
  },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    padding: 22,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandCopy: {
    gap: 2,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  eyebrow: {
    color: palette.accentCool,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  brandTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  liveBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(4, 5, 10, 0.46)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  liveBadgeText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  heroHeadline: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
  },
  heroBody: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  recentCard: {
    gap: 4,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(4, 5, 10, 0.4)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  recentLabel: {
    color: palette.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  recentTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sourceRow: {
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 40,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
