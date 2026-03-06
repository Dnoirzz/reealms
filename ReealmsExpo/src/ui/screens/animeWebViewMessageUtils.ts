export type AnimeWebViewOrientationMode = 'default' | 'landscape';

export type AnimeWebViewMessage = {
  type?: string;
  payload?: {
    message?: string;
    index?: number;
    total?: number;
  };
};

export type AnimeWebViewMessageState = {
  isFullscreen: boolean;
  statusMessage: string;
  terminalError: string | null;
  videoReady: boolean;
  orientationMode: AnimeWebViewOrientationMode;
};

export function createInitialAnimeWebViewMessageState(): AnimeWebViewMessageState {
  return {
    isFullscreen: false,
    statusMessage: 'Preparing direct anime stream inside the app wrapper.',
    terminalError: null,
    videoReady: false,
    orientationMode: 'default',
  };
}

export function reduceAnimeWebViewMessage(
  currentState: AnimeWebViewMessageState,
  message: AnimeWebViewMessage,
): AnimeWebViewMessageState {
  const payload = message.payload ?? {};

  if (message.type === 'ready') {
    return {
      ...currentState,
      videoReady: true,
      terminalError: null,
      statusMessage: 'Direct stream ready. If autoplay is blocked, tap play inside the video.',
    };
  }

  if (message.type === 'fallback') {
    const attempt = typeof payload.index === 'number' ? payload.index + 1 : null;
    const total = typeof payload.total === 'number' ? payload.total : null;
    return {
      ...currentState,
      statusMessage:
        attempt && total
          ? `Trying alternate direct stream ${attempt} of ${total}.`
          : 'Trying alternate direct stream.',
    };
  }

  if (message.type === 'error') {
    const nextMessage = payload.message?.trim() || 'All direct anime sources failed.';
    return {
      ...currentState,
      videoReady: false,
      terminalError: nextMessage,
      statusMessage: nextMessage,
    };
  }

  if (message.type === 'enterFullscreen') {
    return {
      ...currentState,
      isFullscreen: true,
      orientationMode: 'landscape',
      statusMessage: currentState.videoReady
        ? 'Direct stream ready. If autoplay is blocked, tap play inside the video.'
        : currentState.statusMessage,
    };
  }

  if (message.type === 'exitFullscreen') {
    return {
      ...currentState,
      isFullscreen: false,
      orientationMode: 'default',
    };
  }

  return currentState;
}
