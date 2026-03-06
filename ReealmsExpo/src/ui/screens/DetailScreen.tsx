import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../core/theme';
import { ApiService } from '../../data/services/apiService';
import type { Episode, Movie } from '../../data/models/media';
import type { AnimePlaybackManifest } from '../../data/models/playback';
import { useAppState } from '../../logic/AppStateContext';
import { ActionButton } from '../components/ActionButton';
import { EmptyState } from '../components/EmptyState';
import { ComicReaderScreen } from './ComicReaderScreen';
import { DramaPlayerScreen } from './DramaPlayerScreen';

type DetailScreenProps = {
  movie: Movie;
  onBack: () => void;
};

const episodeRangeSize = 30;

function buildSynopsis(movie: Movie) {
  if (movie.synopsis.startsWith('http')) {
    return 'This title uses a provider page URL as its source reference. Episodes and playback are resolved from the provider at runtime.';
  }

  if (movie.synopsis) {
    return movie.synopsis;
  }

  return 'Belum ada deskripsi untuk konten ini.';
}

function episodeSortKey(episode: Episode) {
  if (episode.order > 0) {
    return episode.order;
  }

  const match = episode.title.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function DetailScreen({ movie, onBack }: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { addToHistory, favorites, toggleFavorite } = useAppState();
  const apiService = React.useRef(new ApiService()).current;
  const [episodes, setEpisodes] = React.useState<Episode[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionBusyId, setActionBusyId] = React.useState<string | null>(null);
  const [selectedRangeIndex, setSelectedRangeIndex] = React.useState<number | null>(null);
  const [comicSession, setComicSession] = React.useState<{
    imageUrls: string[];
    title: string;
  } | null>(null);
  const [videoQueueState, setVideoQueueState] = React.useState<{
    episodes: Episode[];
    initialIndex: number;
    qualityManifestsByEpisodeId?: Record<string, AnimePlaybackManifest>;
  } | null>(null);

  const isFavorite = favorites.some((entry) => entry.id === movie.id);
  const useGridLayout = movie.sourceType !== 'komik';
  const orderedEpisodes = React.useMemo(() => {
    const next = [...episodes];
    next.sort((left, right) => episodeSortKey(left) - episodeSortKey(right));
    return next;
  }, [episodes]);
  const episodeRanges = React.useMemo(() => {
    const ranges: Episode[][] = [];
    for (let index = 0; index < orderedEpisodes.length; index += episodeRangeSize) {
      ranges.push(orderedEpisodes.slice(index, index + episodeRangeSize));
    }
    return ranges;
  }, [orderedEpisodes]);
  const visibleEpisodes = React.useMemo(() => {
    if (selectedRangeIndex === null || !episodeRanges[selectedRangeIndex]) {
      return orderedEpisodes;
    }

    return episodeRanges[selectedRangeIndex];
  }, [episodeRanges, orderedEpisodes, selectedRangeIndex]);
  const crossAxisCount = width >= 900 ? 8 : width >= 620 ? 6 : 5;
  const baseOrder = ((selectedRangeIndex ?? 0) * episodeRangeSize) + 1;

  React.useEffect(() => {
    let mounted = true;

    void (async () => {
      setIsLoading(true);
      try {
        apiService.setSource(movie.sourceType);
        let nextEpisodes: Episode[] = [];

        if (movie.sourceType === 'otakudesu' && movie.synopsis.startsWith('http')) {
          nextEpisodes = await apiService.scrapeOtakudesuEpisodes(movie.synopsis);
        }

        if (nextEpisodes.length === 0) {
          nextEpisodes = await apiService.getEpisodes(movie.id);
        }

        if (movie.sourceType === 'otakudesu' && nextEpisodes.length === 0 && movie.totalChapters > 0) {
          nextEpisodes = apiService.generateEpisodesForAnime(movie.id, movie.totalChapters);
        }

        if (mounted) {
          setEpisodes(nextEpisodes);
          setSelectedRangeIndex(null);
        }
      } catch (error) {
        console.warn('Detail episodes failed:', error);
        if (mounted) {
          setEpisodes([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiService, movie.id, movie.sourceType, movie.totalChapters]);

  async function handleEpisodePress(episode: Episode) {
    setActionBusyId(episode.id || episode.title);
    try {
      await addToHistory(movie);

      if (movie.sourceType === 'komik') {
        const images = await apiService.getComicImages(episode.id);
        if (images.length === 0) {
          Alert.alert('Chapter unavailable', 'Chapter pages tidak ditemukan.');
          return;
        }

        setComicSession({
          imageUrls: images,
          title: episode.title,
        });
        return;
      }

      if (movie.sourceType === 'otakudesu') {
        const playbackManifest = await apiService.getOtakudesuPlaybackManifest(episode.id);
        const directPlayableUrl = playbackManifest?.initialUrl ?? '';

        if (directPlayableUrl && directPlayableUrl.startsWith('http')) {
          setVideoQueueState({
            episodes: [{ ...episode, streamUrl: directPlayableUrl }],
            initialIndex: 0,
            qualityManifestsByEpisodeId: playbackManifest
              ? {
                  [episode.id]: playbackManifest,
                }
              : undefined,
          });
          return;
        }

        Alert.alert('Playback unavailable', 'Episode ini belum punya stream langsung yang bisa diputar tanpa halaman iklan.');
        return;
      }

      if (episode.streamUrl) {
        const playableEpisodes = orderedEpisodes.filter((entry) => entry.streamUrl.trim().length > 0);
        const matchedIndex = playableEpisodes.findIndex(
          (entry) =>
            entry.id === episode.id ||
            (entry.id.length === 0 &&
              episode.id.length === 0 &&
              entry.order === episode.order &&
              entry.title === episode.title),
        );

        setVideoQueueState({
          episodes: playableEpisodes,
          initialIndex: matchedIndex >= 0 ? matchedIndex : 0,
        });
        return;
      }

      Alert.alert('Link unavailable', 'Episode link tidak ditemukan.');
    } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setActionBusyId(null);
    }
  }

  const gridCellSize = (width - 40 - (crossAxisCount - 1) * 10) / crossAxisCount;

  if (videoQueueState) {
    return (
      <DramaPlayerScreen
        episodes={videoQueueState.episodes}
        initialIndex={videoQueueState.initialIndex}
        onBack={() => setVideoQueueState(null)}
        qualityManifestsByEpisodeId={videoQueueState.qualityManifestsByEpisodeId}
      />
    );
  }

  if (comicSession) {
    return (
      <ComicReaderScreen
        imageUrls={comicSession.imageUrls}
        onBack={() => setComicSession(null)}
        title={comicSession.title}
      />
    );
  }

  return (
    <FlatList
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>Loading episodes and chapters...</Text>
          </View>
        ) : (
          <EmptyState
            description="The list did not come back from the provider yet. This can happen with rate limits or missing source data."
            icon="albums-outline"
            title="No entries found"
          />
        )
      }
      ListHeaderComponent={
        <View
          style={{
            paddingBottom: 24,
            paddingHorizontal: 20,
            paddingTop: insets.top + 10,
          }}
        >
          <View style={styles.topBar}>
            <Pressable onPress={onBack} style={styles.iconButton}>
              <Ionicons color={palette.textPrimary} name="arrow-back" size={20} />
            </Pressable>
            <Pressable onPress={() => void toggleFavorite(movie)} style={styles.iconButton}>
              <Ionicons
                color={isFavorite ? palette.accent : palette.textPrimary}
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
              />
            </Pressable>
          </View>

          <View style={[styles.heroCard, width >= 760 ? styles.heroCardWide : null]}>
            {movie.posterUrl ? (
              <Image source={{ uri: movie.posterUrl }} style={[styles.poster, width >= 760 ? styles.posterWide : null]} />
            ) : (
              <View style={[styles.posterFallback, width >= 760 ? styles.posterWide : null]}>
                <Text style={styles.posterFallbackText}>{movie.title.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{movie.sourceType.toUpperCase()}</Text>
              </View>
              <Text style={styles.title}>{movie.title}</Text>
              <Text style={styles.metaText}>
                {movie.year || 'Unknown year'}
                {movie.rating > 0 ? `  •  ${movie.rating.toFixed(1)}` : ''}
              </Text>
              <Text style={styles.synopsis}>{buildSynopsis(movie)}</Text>

              {movie.genres.length > 0 ? (
                <View style={styles.genreRow}>
                  {movie.genres.slice(0, 5).map((genre) => (
                    <View key={genre} style={styles.genrePill}>
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <ActionButton
                  label={isFavorite ? 'Remove favorite' : 'Save favorite'}
                  onPress={() => void toggleFavorite(movie)}
                  variant="secondary"
                />
                <ActionButton label="Save to history" onPress={() => void addToHistory(movie)} />
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{movie.sourceType === 'komik' ? 'Chapters' : 'Episodes'}</Text>
              <Text style={styles.sectionSubtitle}>{episodes.length} loaded from the current provider</Text>
            </View>
          </View>

          {useGridLayout && episodeRanges.length > 1 ? (
            <FlatList
              horizontal
              contentContainerStyle={styles.rangeRow}
              data={episodeRanges}
              keyExtractor={(_, index) => `range-${index}`}
              renderItem={({ item: range, index }) => {
                const start = index * episodeRangeSize + 1;
                const end = start + range.length - 1;
                const selected = selectedRangeIndex === index;
                return (
                  <Pressable
                    onPress={() => setSelectedRangeIndex(selected ? null : index)}
                    style={[styles.rangePill, selected ? styles.rangePillSelected : null]}
                  >
                    <Text style={[styles.rangeText, selected ? styles.rangeTextSelected : null]}>
                      {start}-{end}
                    </Text>
                  </Pressable>
                );
              }}
              showsHorizontalScrollIndicator={false}
            />
          ) : null}
        </View>
      }
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 28, 28), paddingHorizontal: 20 }}
      data={visibleEpisodes}
      key={useGridLayout ? `grid-${crossAxisCount}` : 'list'}
      keyExtractor={(item, index) => `${item.id || item.title}-${index}`}
      numColumns={useGridLayout ? crossAxisCount : 1}
      renderItem={({ item, index }) =>
        useGridLayout ? (
          <Pressable
            onPress={() => void handleEpisodePress(item)}
            style={[
              styles.episodeGridCard,
              {
                width: gridCellSize,
                height: gridCellSize,
                marginBottom: 10,
                marginRight: (index + 1) % crossAxisCount === 0 ? 0 : 10,
              },
            ]}
          >
            {actionBusyId === (item.id || item.title) ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : (
              <>
                <Text style={styles.episodeNumber}>{episodeSortKey(item) || baseOrder + index}</Text>
                {item.streamUrl ? (
                  <Ionicons color={palette.accentCool} name="play-circle-outline" size={14} style={styles.episodeGridIcon} />
                ) : null}
              </>
            )}
          </Pressable>
        ) : (
          <Pressable onPress={() => void handleEpisodePress(item)} style={styles.episodeListCard}>
            <View style={styles.episodeListLeft}>
              <View style={styles.episodeIndexCircle}>
                {actionBusyId === (item.id || item.title) ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : (
                  <Text style={styles.episodeIndexText}>{episodeSortKey(item) || index + 1}</Text>
                )}
              </View>
              <View style={styles.episodeListCopy}>
                <Text numberOfLines={1} style={styles.episodeTitle}>
                  {item.title}
                </Text>
                <Text style={styles.episodeCaption}>
                  {movie.sourceType === 'komik'
                    ? 'Tap to open reader'
                    : movie.sourceType === 'otakudesu'
                      ? 'Tap to play directly'
                      : 'Tap to prepare playback'}
                </Text>
              </View>
            </View>
            <Ionicons color={palette.textMuted} name="chevron-forward" size={18} />
          </Pressable>
        )
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroCard: {
    gap: 18,
    marginBottom: 24,
  },
  heroCardWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  poster: {
    width: '100%',
    aspectRatio: 0.74,
    borderRadius: 30,
    backgroundColor: palette.surfaceRaised,
  },
  posterWide: {
    width: 220,
  },
  posterFallback: {
    width: '100%',
    aspectRatio: 0.74,
    borderRadius: 30,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFallbackText: {
    color: palette.textPrimary,
    fontSize: 48,
    fontWeight: '700',
  },
  heroCopy: {
    flex: 1,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  badgeText: {
    color: palette.accentCool,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  metaText: {
    color: palette.textMuted,
    fontSize: 13,
  },
  synopsis: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genrePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  genreText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  rangeRow: {
    gap: 10,
    marginBottom: 8,
  },
  rangePill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rangePillSelected: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderStrong,
  },
  rangeText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  rangeTextSelected: {
    color: palette.textPrimary,
  },
  episodeGridCard: {
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeGridIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  episodeNumber: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  episodeListCard: {
    minHeight: 80,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  episodeListLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  episodeIndexCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeIndexText: {
    color: palette.accentCool,
    fontSize: 16,
    fontWeight: '700',
  },
  episodeListCopy: {
    flex: 1,
    gap: 4,
  },
  episodeTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  episodeCaption: {
    color: palette.textMuted,
    fontSize: 12,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 44,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
});
