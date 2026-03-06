import type { PlaybackQualityOption } from '../../data/models/playback';

export type SelectableQualityItem = {
  label: string;
  isDeferred: boolean;
  option: PlaybackQualityOption;
};

type QualityStatusMessageInput = {
  failedLabel?: string;
  resolvingLabel?: string;
  streamFailed?: boolean;
  errorMessage?: string;
};

export function buildSelectableQualityItems(options: PlaybackQualityOption[]): SelectableQualityItem[] {
  return options.map((option) => ({
    label: option.label,
    isDeferred: option.mode === 'deferred',
    option,
  }));
}

export function buildQualityStatusMessage({
  failedLabel,
  resolvingLabel,
  streamFailed,
  errorMessage,
}: QualityStatusMessageInput) {
  if (failedLabel) {
    return `${failedLabel} could not be resolved.`;
  }

  if (resolvingLabel) {
    return `Resolving ${resolvingLabel}...`;
  }

  if (streamFailed) {
    if (errorMessage?.trim()) {
      return `Stream failed. ${errorMessage.trim()}`;
    }

    return 'Stream failed. Try another quality.';
  }

  return 'Stream resolved successfully. You can use native controls or the episode queue below.';
}
