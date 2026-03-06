import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
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
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { palette } from '../../core/theme';
import type { PlaybackQualityOption } from '../../data/models/playback';
import { ApiService } from '../../data/services/apiService';
import { buildAnimeWebViewPlayerHtml } from './animeWebViewPlayerHtml';
import {
  createInitialAnimeWebViewMessageState,
  reduceAnimeWebViewMessage,
  type AnimeWebViewMessage,
} from './animeWebViewMessageUtils';
import {
  buildAnimeSelectableQualityItems,
  buildAnimeSourceOrder,
  cacheResolvedAnimeQualityUrl,
  getCachedAnimeQualityUrl,
} from './playerQualitySessionUtils';
import { buildQualityStatusMessage } from './playerQualitySwitchUtils';

type AnimeWebViewScreenProps = {
  initialUrl: string;
  fallbackUrls: string[];
  qualityOptions: PlaybackQualityOption[];
  title: string;
  onBack: () => void;
};

export function AnimeWebViewScreen({
  initialUrl,
  fallbackUrls,
  qualityOptions,
  title,
  onBack,
}: AnimeWebViewScreenProps) {
  const insets = useSafeAreaInsets();
  const apiService = React.useRef(new ApiService()).current;
  const [pageLoaded, setPageLoaded] = React.useState(false);
  const [webKey, setWebKey] = React.useState(0);
  const [messageState, setMessageState] = React.useState(() => createInitialAnimeWebViewMessageState());
  const [selectedQualityLabel, setSelectedQualityLabel] = React.useState('Auto');
  const [showQualityTray, setShowQualityTray] = React.useState(false);
  const [resolvedQualityCache, setResolvedQualityCache] = React.useState<Record<string, string>>({});
  const [resolvingQualityLabel, setResolvingQualityLabel] = React.useState<string | null>(null);
  const [qualityFeedback, setQualityFeedback] = React.useState<string | null>(null);
  const [sourceOrder, setSourceOrder] = React.useState(() =>
    buildAnimeSourceOrder({
      initialUrl,
      fallbackUrls,
      selectedLabel: 'Auto',
    }),
  );
  const qualityItems = React.useMemo(() => buildAnimeSelectableQualityItems(qualityOptions), [qualityOptions]);
  const sourceKey = React.useMemo(() => JSON.stringify(sourceOrder), [sourceOrder]);
  const playerHtml = React.useMemo(
    () =>
      buildAnimeWebViewPlayerHtml({
        title,
        initialUrl: sourceOrder[0] ?? '',
        fallbackUrls: sourceOrder.slice(1),
      }),
    [sourceOrder, title],
  );

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [onBack]);

  React.useEffect(() => {
    void (async () => {
      try {
        if (messageState.orientationMode === 'landscape') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.unlockAsync();
        }
      } catch (error) {
        console.warn('Anime orientation update failed:', error);
      }
    })();
  }, [messageState.orientationMode]);

  React.useEffect(() => {
    return () => {
      void ScreenOrientation.unlockAsync().catch(() => {
        // Ignore orientation cleanup errors during screen teardown.
      });
    };
  }, []);

  React.useEffect(() => {
    setSelectedQualityLabel('Auto');
    setShowQualityTray(false);
    setResolvedQualityCache({});
    setResolvingQualityLabel(null);
    setQualityFeedback(null);
    setSourceOrder(
      buildAnimeSourceOrder({
        initialUrl,
        fallbackUrls,
        selectedLabel: 'Auto',
      }),
    );
  }, [fallbackUrls, initialUrl, qualityOptions]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as AnimeWebViewMessage;
      setMessageState((currentState) => reduceAnimeWebViewMessage(currentState, data));
    } catch {
      // Ignore malformed WebView messages.
    }
  }

  async function handleQualitySelect(option: PlaybackQualityOption) {
    setShowQualityTray(false);
    setQualityFeedback(null);

    if (option.label === selectedQualityLabel && option.mode === 'direct') {
      return;
    }

    if (option.label === 'Auto') {
      setSelectedQualityLabel('Auto');
      setSourceOrder(
        buildAnimeSourceOrder({
          initialUrl,
          fallbackUrls,
          selectedLabel: 'Auto',
        }),
      );
      return;
    }

    if (option.mode === 'direct') {
      setSelectedQualityLabel(option.label);
      setSourceOrder(
        buildAnimeSourceOrder({
          initialUrl,
          fallbackUrls,
          selectedLabel: option.label,
          selectedDirectUrl: option.url,
        }),
      );
      return;
    }

    const cachedUrl = getCachedAnimeQualityUrl(resolvedQualityCache, option.label);
    if (cachedUrl) {
      setSelectedQualityLabel(option.label);
      setSourceOrder(
        buildAnimeSourceOrder({
          initialUrl,
          fallbackUrls,
          selectedLabel: option.label,
          selectedDirectUrl: cachedUrl,
        }),
      );
      return;
    }

    setResolvingQualityLabel(option.label);

    try {
      const resolved = await apiService.resolveOtakudesuQualityOption(option);
      if (!resolved?.url) {
        setQualityFeedback(buildQualityStatusMessage({ failedLabel: option.label }));
        return;
      }

      setResolvedQualityCache((currentCache) =>
        cacheResolvedAnimeQualityUrl(currentCache, option.label, resolved.url),
      );
      setSelectedQualityLabel(option.label);
      setSourceOrder(
        buildAnimeSourceOrder({
          initialUrl,
          fallbackUrls,
          prioritizedFallbackUrls: resolved.fallbackUrls,
          selectedLabel: option.label,
          selectedDirectUrl: resolved.url,
        }),
      );
    } catch (error) {
      setQualityFeedback(
        buildQualityStatusMessage({
          failedLabel: option.label,
        }),
      );
      console.warn('Anime quality resolve failed:', error);
    } finally {
      setResolvingQualityLabel(null);
    }
  }

  const visibleStatusMessage = resolvingQualityLabel
    ? buildQualityStatusMessage({ resolvingLabel: resolvingQualityLabel })
    : qualityFeedback ?? messageState.statusMessage;

  return (
    <View style={styles.root}>
      {!messageState.isFullscreen ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onBack} style={styles.iconButton}>
            <Ionicons color={palette.textPrimary} name="arrow-back" size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              Playback anime langsung
            </Text>
          </View>
          <View style={styles.headerMetaColumn}>
            {qualityItems.length > 1 ? (
              <Pressable
                onPress={() => setShowQualityTray((currentValue) => !currentValue)}
                style={[styles.qualityTrigger, showQualityTray ? styles.qualityTriggerActive : null]}
              >
                <Ionicons color={palette.textPrimary} name="options-outline" size={14} />
                <Text style={styles.qualityTriggerText}>{selectedQualityLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setWebKey((value) => value + 1)} style={styles.iconButton}>
              <Ionicons color={palette.textPrimary} name="refresh" size={18} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {!messageState.isFullscreen && showQualityTray && qualityItems.length > 1 ? (
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
                disabled={Boolean(resolvingQualityLabel)}
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

      <View style={styles.webCard}>
        <WebView
          allowsBackForwardNavigationGestures={false}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          androidLayerType="hardware"
          domStorageEnabled
          javaScriptEnabled
          key={`anime-web-${webKey}-${sourceKey}`}
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="always"
          onLoadEnd={() => setPageLoaded(true)}
          onLoadStart={() => {
            setPageLoaded(false);
            setMessageState(createInitialAnimeWebViewMessageState());
          }}
          onMessage={handleMessage}
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          source={{ html: playerHtml, baseUrl: 'https://otakudesu.blog/' }}
          style={styles.webView}
        />

        {!pageLoaded || (!messageState.videoReady && !messageState.terminalError) ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingTitle}>Menyiapkan player anime</Text>
            <Text style={styles.loadingBody}>
              Memuat stream langsung di dalam aplikasi dan mencoba host alternatif saat dibutuhkan.
            </Text>
          </View>
        ) : null}
      </View>

      {!messageState.isFullscreen ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Status player</Text>
          <Text style={styles.statusBody}>{visibleStatusMessage}</Text>
        </View>
      ) : null}
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
  webCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  loadingTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingBody: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  statusCard: {
    marginTop: 18,
    marginBottom: 20,
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
});
