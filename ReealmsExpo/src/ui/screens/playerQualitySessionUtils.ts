import type { AnimePlaybackManifest } from '../../data/models/playback';

export function getEpisodeManifest(
  manifests: Record<string, AnimePlaybackManifest> | undefined,
  episodeId: string,
): AnimePlaybackManifest | null {
  if (!manifests || !episodeId) {
    return null;
  }

  return manifests[episodeId] ?? null;
}
