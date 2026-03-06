export interface OtakudesuMirrorReference {
  provider: string;
  href: string;
  dataContent: string;
}

export interface DirectPlaybackQualityOption {
  label: string;
  rank: number;
  mode: 'direct';
  url: string;
}

export interface DeferredPlaybackQualityOption {
  label: string;
  rank: number;
  mode: 'deferred';
  episodeUrl: string;
  mirrors: OtakudesuMirrorReference[];
}

export type PlaybackQualityOption = DirectPlaybackQualityOption | DeferredPlaybackQualityOption;

export interface ResolvedPlayableSource {
  url: string;
  qualityOptions: DirectPlaybackQualityOption[];
}

export interface AnimePlaybackManifest {
  initialUrl: string;
  qualityOptions: PlaybackQualityOption[];
}
