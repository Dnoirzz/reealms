import React from 'react';
import { useEvent, useEventListener } from 'expo';
import { VideoView, createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../core/theme';
import type { Episode } from '../../data/models/media';
import type { AnimePlaybackManifest, PlaybackQualityOption } from '../../data/models/playback';
import { ApiService } from '../../data/services/apiService';
import { getEpisodeManifest, pickNextFallbackUrl } from './playerQualitySessionUtils';
import { buildQualityStatusMessage, buildSelectableQualityItems } from './playerQualitySwitchUtils';

type DramaPlayerScreenProps = {
  episodes: Episode[];
  initialIndex: number;
  onBack: () => void;
  qualityManifestsByEpisodeId?: Record<string, AnimePlaybackManifest>;
};

function buildAutoQualityOption(url: string): PlaybackQualityOption {
  return {
    label: 'Auto',
    rank: 9999,
    mode: 'direct',
    url,
  };
}

function buildQualityCacheKey(episodeId: string, label: string) {
  return `${episodeId}:${label}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function buildVideoSource(url: string): VideoSource {
  const normalized = url.toLowerCase();
  if (normalized.includes('.m3u8')) {
    return { uri: url, contentType: 'hls', useCaching: false };
  }

  return { uri: url, contentType: 'auto', useCaching: false };
}

function configurePlayer(player: VideoPlayer, shouldPlay: boolean, seekToSeconds?: number) {
  player.loop = false;
  player.timeUpdateEventInterval = 0.5;
  player.audioMixingMode = 'auto';
  player.keepScreenOnWhilePlaying = true;
  player.showNowPlayingNotification = false;

  if (typeof seekToSeconds === 'number' && Number.isFinite(seekToSeconds) && seekToSeconds > 0) {
    player.currentTime = seekToSeconds;
  }

  if (shouldPlay) {
    player.play();
  } else {
    player.pause();
  }
}

function buildPlayer(sourceUrl: string, shouldPlay: boolean, seekToSeconds?: number) {
  const player = createVideoPlayer(buildVideoSource(sourceUrl));
  configurePlayer(player, shouldPlay, seekToSeconds);
  return player;
}

export function DramaPlayerScreen({
  episodes,
  initialIndex,
  onBack,
  qualityManifestsByEpisodeId,
}: DramaPlayerScreenProps) {
  const insets = useSafeAreaInsets();
  const apiService = React.useRef(new ApiService()).current;
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const bootstrapEpisode = episodes[initialIndex] ?? episodes[0];
  const bootstrapManifest = getEpisodeManifest(qualityManifestsByEpisodeId, bootstrapEpisode?.id ?? '');
  const bootstrapSourceUrl = bootstrapManifest?.initialUrl || bootstrapEpisode?.streamUrl || '';
  const [activeSourceUrl, setActiveSourceUrl] = React.useState(bootstrapSourceUrl);
  const [selectedQualityLabel, setSelectedQualityLabel] = React.useState('Auto');
  const [showQualityTray, setShowQualityTray] = React.useState(false);
  const [isResolvingQuality, setIsResolvingQuality] = React.useState(false);
  const [resolvingQualityLabel, setResolvingQualityLabel] = React.useState<string | null>(null);
  const [qualityError, setQualityError] = React.useState<string | null>(null);
  const [resolvedQualityCache, setResolvedQualityCache] = React.useState<Record<string, string>>({});
  const previousEpisodeKeyRef = React.useRef(bootstrapEpisode?.id || `${initialIndex}`);
  const currentEpisode = episodes[currentIndex];
  const currentManifest = React.useMemo(
    () => getEpisodeManifest(qualityManifestsByEpisodeId, currentEpisode?.id ?? ''),
    [currentEpisode?.id, qualityManifestsByEpisodeId],
  );
  const qualityItems = React.useMemo(() => {
    const nextOptions = currentManifest?.qualityOptions ?? [buildAutoQualityOption(currentEpisode.streamUrl)];
    return buildSelectableQualityItems(nextOptions);
  }, [currentEpisode.streamUrl, currentManifest]);
  const [player, setPlayer] = React.useState(() =>
    buildPlayer(bootstrapSourceUrl || currentEpisode.streamUrl, true),
  );
  const playerRef = React.useRef(player);
  const playerPendingReleaseRef = React.useRef<VideoPlayer | null>(null);
  const triedSourceUrlsRef = React.useRef(
    new Set<string>((bootstrapSourceUrl || currentEpisode.streamUrl) ? [bootstrapSourceUrl || currentEpisode.streamUrl] : []),
  );

  React.useEffect(() => {
    playerRef.current = player;
    if (playerPendingReleaseRef.current && playerPendingReleaseRef.current !== player) {
      playerPendingReleaseRef.current.release();
      playerPendingReleaseRef.current = null;
    }
  }, [player]);

  React.useEffect(() => {
    return () => {
      if (playerPendingReleaseRef.current && playerPendingReleaseRef.current !== playerRef.current) {
        playerPendingReleaseRef.current.release();
        playerPendingReleaseRef.current = null;
      }
      playerRef.current.release();
    };
  }, []);

  const statusEvent = useEvent(player, 'statusChange', { status: player.status });
  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const sourceLoadEvent = useEvent(player, 'sourceLoad', {
    videoSource: null,
    duration: player.duration,
    availableAudioTracks: [],
    availableSubtitleTracks: [],
    availableVideoTracks: [],
  });
  const timeEvent = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: player.currentLiveTimestamp,
    currentOffsetFromLive: player.currentOffsetFromLive,
  });

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [onBack]);

  useEventListener(player, 'playToEnd', () => {
    setCurrentIndex((previousIndex) => {
      if (previousIndex >= episodes.length - 1) {
        return previousIndex;
      }

      return previousIndex + 1;
    });
  });

  async function replacePlayerSource(
    nextUrl: string,
    options: {
      seekToSeconds?: number;
      shouldPlay: boolean;
    },
  ) {
    if (!nextUrl) {
      return false;
    }

    try {
      setQualityError(null);
      const nextPlayer = buildPlayer(nextUrl, options.shouldPlay, options.seekToSeconds);
      const previousPlayer = playerRef.current;
      playerPendingReleaseRef.current = previousPlayer;
      playerRef.current = nextPlayer;
      setPlayer(nextPlayer);
      setActiveSourceUrl(nextUrl);
      triedSourceUrlsRef.current.add(nextUrl);
      return true;
    } catch (error) {
      console.warn('Player source replace failed:', error);
      return false;
    }
  }

  React.useEffect(() => {
    const episodeKey = currentEpisode.id || `${currentIndex}`;
    if (previousEpisodeKeyRef.current === episodeKey) {
      return;
    }

    previousEpisodeKeyRef.current = episodeKey;
    setShowQualityTray(false);
    setSelectedQualityLabel('Auto');
    setQualityError(null);
    setResolvingQualityLabel(null);
    setIsResolvingQuality(false);

    const nextSourceUrl = currentManifest?.initialUrl || currentEpisode.streamUrl;
    triedSourceUrlsRef.current = new Set<string>(nextSourceUrl ? [nextSourceUrl] : []);
    void replacePlayerSource(nextSourceUrl, { shouldPlay: true });
  }, [currentEpisode.id, currentEpisode.streamUrl, currentIndex, currentManifest?.initialUrl]);

  const duration = sourceLoadEvent?.duration ?? player.duration ?? 0;
  const currentTime = timeEvent?.currentTime ?? player.currentTime ?? 0;
  const bufferedPosition = timeEvent?.bufferedPosition ?? player.bufferedPosition ?? 0;
  const progressRatio = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const bufferRatio = duration > 0 ? Math.min(bufferedPosition / duration, 1) : 0;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < episodes.length - 1;
  const sourceLabel = activeSourceUrl.toLowerCase().includes('.m3u8') ? 'HLS' : 'Direct';

  function playPrevious() {
    if (!canGoPrevious) {
      return;
    }

    setCurrentIndex((previousIndex) => previousIndex - 1);
  }

  function playNext() {
    if (!canGoNext) {
      return;
    }

    setCurrentIndex((previousIndex) => previousIndex + 1);
  }

  function togglePlayback() {
    if (playingEvent?.isPlaying) {
      player.pause();
      return;
    }

    player.play();
  }

  function skipBy(seconds: number) {
    player.seekBy(seconds);
  }

  React.useEffect(() => {
    if (statusEvent?.status !== 'error') {
      return;
    }

    if (selectedQualityLabel !== 'Auto') {
      return;
    }

    if (!/\b403\b/.test(statusEvent.error?.message ?? '')) {
      return;
    }

    const nextFallbackUrl = pickNextFallbackUrl({
      activeSourceUrl,
      fallbackUrls: currentManifest?.fallbackUrls,
      triedUrls: triedSourceUrlsRef.current,
    });

    if (!nextFallbackUrl) {
      return;
    }

    void replacePlayerSource(nextFallbackUrl, {
      seekToSeconds: currentTime,
      shouldPlay: true,
    });
  }, [
    activeSourceUrl,
    currentManifest?.fallbackUrls,
    currentTime,
    selectedQualityLabel,
    statusEvent?.error?.message,
    statusEvent?.status,
  ]);

  async function handleQualitySelect(option: PlaybackQualityOption) {
    setShowQualityTray(false);
    setQualityError(null);

    const previousTime = player.currentTime;
    const shouldResumePlayback = playingEvent?.isPlaying ?? player.playing;

    if (option.mode === 'direct') {
      if (option.url === activeSourceUrl) {
        setSelectedQualityLabel(option.label);
        return;
      }

      const switched = await replacePlayerSource(option.url, {
        seekToSeconds: previousTime,
        shouldPlay: shouldResumePlayback,
      });
      if (switched) {
        setSelectedQualityLabel(option.label);
      }
      return;
    }

    const cacheKey = buildQualityCacheKey(currentEpisode.id, option.label);
    const cachedUrl = resolvedQualityCache[cacheKey];
    if (cachedUrl) {
      const switched = await replacePlayerSource(cachedUrl, {
        seekToSeconds: previousTime,
        shouldPlay: shouldResumePlayback,
      });
      if (switched) {
        setSelectedQualityLabel(option.label);
      }
      return;
    }

    setIsResolvingQuality(true);
    setResolvingQualityLabel(option.label);

    try {
      const resolved = await apiService.resolveOtakudesuQualityOption(option);
      if (!resolved?.url) {
        setQualityError(buildQualityStatusMessage({ failedLabel: option.label }));
        return;
      }

      const switched = await replacePlayerSource(resolved.url, {
        seekToSeconds: previousTime,
        shouldPlay: shouldResumePlayback,
      });
      if (!switched) {
        setQualityError(buildQualityStatusMessage({ failedLabel: option.label }));
        return;
      }

      setResolvedQualityCache((previous) => ({
        ...previous,
        [cacheKey]: resolved.url,
      }));
      setSelectedQualityLabel(option.label);
    } finally {
      setIsResolvingQuality(false);
      setResolvingQualityLabel(null);
    }
  }

  const statusMessage = qualityError
    ? qualityError
    : isResolvingQuality && resolvingQualityLabel
      ? buildQualityStatusMessage({ resolvingLabel: resolvingQualityLabel })
      : statusEvent?.status === 'error'
        ? buildQualityStatusMessage({ streamFailed: true, errorMessage: statusEvent.error?.message })
        : statusEvent?.status === 'readyToPlay'
          ? qualityItems.length > 1
            ? 'Stream resolved. You can switch quality above without leaving the player.'
            : buildQualityStatusMessage({})
          : 'Preparing the stream inside Expo Go.';

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <Ionicons color={palette.textPrimary} name="arrow-back" size={20} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.title}>
            {currentEpisode.title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Episode {currentIndex + 1} dari {episodes.length}
          </Text>
        </View>
        <View style={styles.headerMetaColumn}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{sourceLabel}</Text>
          </View>
          <Pressable
            onPress={() => setShowQualityTray((previous) => !previous)}
            style={[styles.qualityTrigger, showQualityTray ? styles.qualityTriggerActive : null]}
          >
            <Ionicons color={palette.textPrimary} name="options-outline" size={14} />
            <Text style={styles.qualityTriggerText}>{selectedQualityLabel}</Text>
          </Pressable>
        </View>
      </View>

      {showQualityTray ? (
        <ScrollView
          contentContainerStyle={styles.qualityTray}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.qualityTrayScroll}
        >
          {qualityItems.map((item) => {
            const isSelected = item.label === selectedQualityLabel;
            return (
              <Pressable
                key={item.label}
                disabled={isResolvingQuality}
                onPress={() => void handleQualitySelect(item.option)}
                style={[styles.qualityPill, isSelected ? styles.qualityPillActive : null]}
              >
                <Text style={[styles.qualityPillText, isSelected ? styles.qualityPillTextActive : null]}>
                  {item.label}
                </Text>
                {item.isDeferred ? (
                  <Ionicons
                    color={isSelected ? palette.background : palette.accentCool}
                    name="cloud-download-outline"
                    size={12}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.playerCard}>
        <VideoView
          allowsPictureInPicture={false}
          contentFit="contain"
          fullscreenOptions={{ enable: true, orientation: 'landscape', autoExitOnRotate: true }}
          nativeControls
          player={player}
          style={styles.video}
        />
        {statusEvent?.status === 'loading' ? (
          <View style={styles.videoOverlay}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.videoOverlayText}>Menyiapkan stream...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View style={[styles.bufferTrack, { width: `${bufferRatio * 100}%` }]} />
          <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressText}>{formatTime(currentTime)}</Text>
          <Text style={styles.progressText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={playPrevious} style={[styles.controlButton, !canGoPrevious ? styles.controlDisabled : null]}>
          <Ionicons color={palette.textPrimary} name="play-skip-back" size={18} />
          <Text style={styles.controlLabel}>Prev</Text>
        </Pressable>
        <Pressable onPress={() => skipBy(-10)} style={styles.controlButton}>
          <Ionicons color={palette.textPrimary} name="play-back" size={18} />
          <Text style={styles.controlLabel}>-10s</Text>
        </Pressable>
        <Pressable onPress={togglePlayback} style={[styles.controlButton, styles.controlButtonPrimary]}>
          <Ionicons
            color={palette.background}
            name={playingEvent?.isPlaying ? 'pause' : 'play'}
            size={18}
          />
          <Text style={styles.controlLabelPrimary}>{playingEvent?.isPlaying ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable onPress={() => skipBy(10)} style={styles.controlButton}>
          <Ionicons color={palette.textPrimary} name="play-forward" size={18} />
          <Text style={styles.controlLabel}>+10s</Text>
        </Pressable>
        <Pressable onPress={playNext} style={[styles.controlButton, !canGoNext ? styles.controlDisabled : null]}>
          <Ionicons color={palette.textPrimary} name="play-skip-forward" size={18} />
          <Text style={styles.controlLabel}>Next</Text>
        </Pressable>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Status player</Text>
        <Text style={styles.statusBody}>{statusMessage}</Text>
      </View>

      <Text style={styles.queueTitle}>Daftar episode</Text>
      <ScrollView
        contentContainerStyle={[styles.queueRow, { paddingBottom: Math.max(insets.bottom + 20, 20) }]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {episodes.map((episode, index) => {
          const active = index === currentIndex;
          return (
            <Pressable
              key={`${episode.id || episode.title}-${index}`}
              onPress={() => setCurrentIndex(index)}
              style={[styles.queueCard, active ? styles.queueCardActive : null]}
            >
              <Text style={[styles.queueIndex, active ? styles.queueIndexActive : null]}>
                {index + 1}
              </Text>
              <Text numberOfLines={2} style={[styles.queueEpisodeTitle, active ? styles.queueEpisodeTitleActive : null]}>
                {episode.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 18,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerMetaColumn: {
    alignItems: 'flex-end',
    gap: 10,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.textFaint,
    fontSize: 12,
  },
  headerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerBadgeText: {
    color: palette.accentCool,
    fontSize: 11,
    fontWeight: '700',
  },
  qualityTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  qualityTriggerActive: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderStrong,
  },
  qualityTriggerText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  qualityTrayScroll: {
    marginBottom: 16,
  },
  qualityTray: {
    gap: 10,
    paddingBottom: 4,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  qualityPillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accentStrong,
  },
  qualityPillText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  qualityPillTextActive: {
    color: palette.background,
  },
  playerCard: {
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
    aspectRatio: 16 / 9,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  videoOverlayText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  progressBlock: {
    marginTop: 18,
    gap: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.surfaceOverlay,
    overflow: 'hidden',
  },
  bufferTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.surfaceRaised,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  controlButton: {
    minWidth: 74,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
  },
  controlButtonPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accentStrong,
    minWidth: 92,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  controlLabel: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  controlLabelPrimary: {
    color: palette.background,
    fontSize: 11,
    fontWeight: '700',
  },
  statusCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 24,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  statusTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  statusBody: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  queueTitle: {
    marginTop: 20,
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  queueRow: {
    gap: 14,
    paddingTop: 14,
  },
  queueCard: {
    width: 158,
    minHeight: 100,
    padding: 15,
    borderRadius: 24,
    backgroundColor: palette.surfaceOverlay,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  queueCardActive: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderStrong,
  },
  queueIndex: {
    color: palette.accentCool,
    fontSize: 12,
    fontWeight: '700',
  },
  queueIndexActive: {
    color: palette.accent,
  },
  queueEpisodeTitle: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  queueEpisodeTitleActive: {
    color: palette.textPrimary,
  },
});
