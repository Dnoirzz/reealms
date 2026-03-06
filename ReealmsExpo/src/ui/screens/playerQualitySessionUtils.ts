import type { AnimePlaybackManifest, PlaybackQualityOption } from '../../data/models/playback';

export type AnimeWebViewSession = {
  title: string;
  initialUrl: string;
  fallbackUrls: string[];
  qualityOptions: PlaybackQualityOption[];
};

export type AnimeSelectableQualityItem = {
  label: string;
  isDeferred: boolean;
  option: PlaybackQualityOption;
};

export function getEpisodeManifest(
  manifests: Record<string, AnimePlaybackManifest> | undefined,
  episodeId: string,
): AnimePlaybackManifest | null {
  if (!manifests || !episodeId) {
    return null;
  }

  return manifests[episodeId] ?? null;
}

type BuildAnimeWebViewSessionInput = {
  episodeTitle: string;
  initialUrl: string;
  fallbackUrls: string[] | undefined;
  qualityOptions?: PlaybackQualityOption[];
};

export function buildAnimeWebViewSession({
  episodeTitle,
  initialUrl,
  fallbackUrls,
  qualityOptions,
}: BuildAnimeWebViewSessionInput): AnimeWebViewSession | null {
  const orderedUrls = [...new Set([initialUrl, ...(fallbackUrls ?? [])].map((url) => url.trim()))].filter((url) =>
    /^https?:\/\//i.test(url),
  );

  if (orderedUrls.length === 0) {
    return null;
  }

  return {
    title: episodeTitle.trim() || 'Anime episode',
    initialUrl: orderedUrls[0],
    fallbackUrls: orderedUrls.slice(1),
    qualityOptions: qualityOptions ?? [],
  };
}

export function buildAnimeSelectableQualityItems(options: PlaybackQualityOption[]): AnimeSelectableQualityItem[] {
  return [...options]
    .sort((left, right) => {
      if (left.label === 'Auto') {
        return -1;
      }

      if (right.label === 'Auto') {
        return 1;
      }

      return right.rank - left.rank;
    })
    .map((option) => ({
      label: option.label,
      isDeferred: option.mode === 'deferred',
      option,
    }));
}

type BuildAnimeSourceOrderInput = {
  initialUrl: string;
  fallbackUrls: string[] | undefined;
  prioritizedFallbackUrls?: string[] | undefined;
  selectedLabel: string;
  selectedDirectUrl?: string;
};

export function buildAnimeSourceOrder({
  initialUrl,
  fallbackUrls,
  prioritizedFallbackUrls,
  selectedLabel,
  selectedDirectUrl,
}: BuildAnimeSourceOrderInput) {
  const ordered = selectedLabel === 'Auto'
    ? [initialUrl, ...(fallbackUrls ?? [])]
    : [selectedDirectUrl ?? '', ...(prioritizedFallbackUrls ?? []), initialUrl, ...(fallbackUrls ?? [])];

  return [...new Set(ordered.map((url) => url.trim()).filter((url) => /^https?:\/\//i.test(url)))];
}

export type AnimeResolvedQualityCache = Record<string, string>;

export function cacheResolvedAnimeQualityUrl(
  cache: AnimeResolvedQualityCache,
  label: string,
  resolvedUrl: string,
): AnimeResolvedQualityCache {
  const normalizedLabel = label.trim();
  const normalizedUrl = resolvedUrl.trim();
  if (!normalizedLabel || !/^https?:\/\//i.test(normalizedUrl)) {
    return cache;
  }

  return {
    ...cache,
    [normalizedLabel]: normalizedUrl,
  };
}

export function getCachedAnimeQualityUrl(cache: AnimeResolvedQualityCache, label: string) {
  const normalized = cache[label.trim()]?.trim();
  return normalized && /^https?:\/\//i.test(normalized) ? normalized : null;
}

type PickNextFallbackUrlInput = {
  activeSourceUrl: string;
  fallbackUrls: string[] | undefined;
  triedUrls: Set<string>;
};

export function pickNextFallbackUrl({
  activeSourceUrl,
  fallbackUrls,
  triedUrls,
}: PickNextFallbackUrlInput) {
  if (!fallbackUrls?.length) {
    return null;
  }

  for (const candidate of fallbackUrls) {
    const normalized = candidate.trim();
    if (!normalized || normalized === activeSourceUrl || triedUrls.has(normalized)) {
      continue;
    }

    return normalized;
  }

  return null;
}
