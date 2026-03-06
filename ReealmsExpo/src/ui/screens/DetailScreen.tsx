import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
import { gradients, palette } from '../../core/theme';
import { ApiService } from '../../data/services/apiService';
import type { Episode, Movie } from '../../data/models/media';
import type { AnimePlaybackManifest } from '../../data/models/playback';
import { useAppState } from '../../logic/AppStateContext';
import { ActionButton } from '../components/ActionButton';
import { EmptyState } from '../components/EmptyState';
import { AnimeWebViewScreen } from './AnimeWebViewScreen';
import { ComicReaderScreen } from './ComicReaderScreen';
import { DramaPlayerScreen } from './DramaPlayerScreen';
import { buildAnimeWebViewSession, type AnimeWebViewSession } from './playerQualitySessionUtils';

type DetailScreenProps = {
  movie: Movie;
  onBack: () => void;
};

const episodeRangeSize = 30;

function buildSynopsis(movie: Movie) {
  if (movie.synopsis.startsWith('http')) {
    return 'Episode dan playback untuk judul ini diambil langsung dari halaman penyedia saat dibuka.';
  }

  if (movie.synopsis) {
    return movie.synopsis;
  }

  return 'Belum ada deskripsi untuk konten ini.';
}

function prettySourceLabel(sourceType: string) {
  switch (sourceType) {
    case 'dramabox':
      return 'Drama';
    case 'otakudesu':
      return 'Anime';
    case 'komik':
      return 'Komik';
    default:
      return sourceType;
  }
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
  const [animeSession, setAnimeSession] = React.useState<AnimeWebViewSession | null>(null);
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
        const directFallbackUrls =
          playbackManifest?.qualityOptions
            .filter((option) => option.mode === 'direct')
            .map((option) => option.url) ?? [];
        const session = buildAnimeWebViewSession({
          episodeTitle: episode.title,
          initialUrl: playbackManifest?.initialUrl ?? '',
          fallbackUrls: [...(playbackManifest?.fallbackUrls ?? []), ...directFallbackUrls],
          qualityOptions: playbackManifest?.qualityOptions ?? [],
        });

        if (session) {
          setAnimeSession(session);
          return;
        }

        Alert.alert('Playback unavailable', 'Episode ini belum punya stream langsung yang bisa diputar di dalam app.');
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

  if (animeSession) {
    return (
      <AnimeWebViewScreen
        fallbackUrls={animeSession.fallbackUrls}
        initialUrl={animeSession.initialUrl}
        onBack={() => setAnimeSession(null)}
        qualityOptions={animeSession.qualityOptions}
        title={animeSession.title}
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
            <Text style={styles.loadingText}>Memuat daftar episode...</Text>
          </View>
        ) : (
          <EmptyState
            description="Banyak episode akan segera hadir."
            icon="albums-outline"
            title="Daftar belum tersedia"
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

          <LinearGradient
            colors={gradients.heroPanel}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[styles.heroCard, width >= 760 ? styles.heroCardWide : null]}
          >
            {movie.posterUrl ? (
              <Image source={{ uri: movie.posterUrl }} style={[styles.poster, width >= 760 ? styles.posterWide : null]} />
            ) : (
              <View style={[styles.posterFallback, width >= 760 ? styles.posterWide : null]}>
                <Text style={styles.posterFallbackText}>{movie.title.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>{prettySourceLabel(movie.sourceType).toUpperCase()}</Text>
              <Text style={styles.title}>{movie.title}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{prettySourceLabel(movie.sourceType)}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{movie.year || 'Tahun tidak diketahui'}</Text>
                </View>
                {movie.rating > 0 ? (
                  <View style={styles.metaPill}>
                    <Ionicons color={palette.accentGold} name="star" size={12} />
                    <Text style={styles.metaPillText}>{movie.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
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
                  label={isFavorite ? 'Tersimpan' : 'Simpan favorit'}
                  onPress={() => void toggleFavorite(movie)}
                  variant="secondary"
                  style={styles.actionButton}
                />
                <ActionButton
                  label="Tambah ke riwayat"
                  onPress={() => void addToHistory(movie)}
                  variant="ghost"
                  style={styles.actionButton}
                />
              </View>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionEyebrow}>Daftar</Text>
              <Text style={styles.sectionTitle}>{movie.sourceType === 'komik' ? 'Daftar Chapter' : 'Episode'}</Text>
              <Text style={styles.sectionSubtitle}>{episodes.length} tersedia dari sumber aktif</Text>
            </View>
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{episodes.length}</Text>
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
                    ? 'Tap untuk buka chapter'
                    : movie.sourceType === 'otakudesu'
                      ? 'Tap untuk putar anime'
                      : 'Tap untuk mulai video'}
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
    marginBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroCard: {
    gap: 0,
    marginBottom: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  heroCardWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  poster: {
    width: '100%',
    aspectRatio: 0.72,
    backgroundColor: palette.surfaceRaised,
  },
  posterWide: {
    width: 230,
  },
  posterFallback: {
    width: '100%',
    aspectRatio: 0.72,
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
    padding: 16,
  },
  eyebrow: {
    color: palette.accentStrong,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metaPillText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  synopsis: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
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
    backgroundColor: palette.surfaceOverlay,
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
    gap: 10,
  },
  actionButton: {
    minWidth: 156,
  },
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionEyebrow: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    lineHeight: 20,
  },
  sectionCountPill: {
    minWidth: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.34)',
  },
  sectionCountText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  rangeRow: {
    gap: 10,
    marginBottom: 8,
  },
  rangePill: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rangePillSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    borderColor: 'rgba(108, 92, 231, 0.34)',
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
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    fontWeight: '500',
  },
  episodeListCard: {
    minHeight: 80,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(108, 92, 231, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeIndexText: {
    color: palette.accentStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  episodeListCopy: {
    flex: 1,
    gap: 4,
  },
  episodeTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  episodeCaption: {
    color: palette.textMuted,
    fontSize: 12,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 52,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
});
