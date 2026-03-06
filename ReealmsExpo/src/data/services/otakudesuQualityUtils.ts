import type {
  DeferredPlaybackQualityOption,
  DirectPlaybackQualityOption,
  OtakudesuMirrorReference,
  PlaybackQualityOption,
} from '../models/playback';

const QUALITY_GROUPS = [
  { className: 'm360p', label: '360p', rank: 360 },
  { className: 'm480p', label: '480p', rank: 480 },
  { className: 'm720p', label: '720p', rank: 720 },
  { className: 'm1080p', label: '1080p', rank: 1080 },
] as const;

function parseAttribute(attributes: string, attributeName: string) {
  const match = new RegExp(`${attributeName}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attributes);
  return match?.[1]?.trim() ?? '';
}

function parseMirrorReferences(sectionHtml: string): OtakudesuMirrorReference[] {
  return [...sectionHtml.matchAll(/<a([^>]*)>(.*?)<\/a>/gis)]
    .map((match) => {
      const attributes = match[1] ?? '';
      return {
        provider: (match[2] ?? '').replace(/<[^>]+>/g, ' ').trim().toLowerCase(),
        href: parseAttribute(attributes, 'href'),
        dataContent: parseAttribute(attributes, 'data-content'),
      };
    })
    .filter((entry) => entry.href.length > 0 || entry.dataContent.length > 0);
}

export function parseOtakudesuQualitySections(html: string, episodeUrl: string): DeferredPlaybackQualityOption[] {
  const parsed: DeferredPlaybackQualityOption[] = [];

  for (const quality of QUALITY_GROUPS) {
    const sectionHtml = new RegExp(
      `<ul[^>]*class=["'][^"']*\\b${quality.className}\\b[^"']*["'][^>]*>(.*?)</ul>`,
      'is',
    ).exec(html)?.[1];

    if (!sectionHtml) {
      continue;
    }

    const mirrors = parseMirrorReferences(sectionHtml);
    if (mirrors.length === 0) {
      continue;
    }

    parsed.push({
      label: quality.label,
      rank: quality.rank,
      mode: 'deferred',
      episodeUrl,
      mirrors,
    });
  }

  return parsed.sort((left, right) => left.rank - right.rank);
}

type MergeAnimeQualityOptionsInput = {
  initialUrl: string;
  directOptions: DirectPlaybackQualityOption[];
  fallbackOptions: DeferredPlaybackQualityOption[];
};

function dedupeDirectOptions(directOptions: DirectPlaybackQualityOption[]) {
  const byLabel = new Map<string, DirectPlaybackQualityOption>();

  for (const option of directOptions) {
    if (!option.label || !option.url) {
      continue;
    }

    const existing = byLabel.get(option.label);
    if (!existing || option.rank > existing.rank) {
      byLabel.set(option.label, option);
    }
  }

  return [...byLabel.values()].sort((left, right) => right.rank - left.rank);
}

function dedupeFallbackOptions(
  fallbackOptions: DeferredPlaybackQualityOption[],
  takenLabels: Set<string>,
) {
  const byLabel = new Map<string, DeferredPlaybackQualityOption>();

  for (const option of fallbackOptions) {
    if (!option.label || takenLabels.has(option.label)) {
      continue;
    }

    const existing = byLabel.get(option.label);
    if (!existing || option.rank > existing.rank) {
      byLabel.set(option.label, option);
    }
  }

  return [...byLabel.values()].sort((left, right) => right.rank - left.rank);
}

export function mergeAnimeQualityOptions({
  initialUrl,
  directOptions,
  fallbackOptions,
}: MergeAnimeQualityOptionsInput): PlaybackQualityOption[] {
  const merged: PlaybackQualityOption[] = [];
  const autoUrl = initialUrl.trim() || directOptions[0]?.url?.trim() || '';

  if (autoUrl) {
    merged.push({
      label: 'Auto',
      rank: 9999,
      mode: 'direct',
      url: autoUrl,
    });
  }

  const normalizedDirectOptions = dedupeDirectOptions(directOptions);
  const directLabels = new Set<string>(normalizedDirectOptions.map((option) => option.label));
  merged.push(...normalizedDirectOptions);
  merged.push(...dedupeFallbackOptions(fallbackOptions, directLabels));

  return merged;
}
