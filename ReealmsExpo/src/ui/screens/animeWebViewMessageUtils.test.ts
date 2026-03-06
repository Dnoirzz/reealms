import assert from 'node:assert/strict';
import test from 'node:test';
import { reduceAnimeWebViewMessage } from './animeWebViewMessageUtils';

test('reduceAnimeWebViewMessage requests landscape mode when anime fullscreen starts', () => {
  const state = reduceAnimeWebViewMessage(
    {
      isFullscreen: false,
      statusMessage: 'Preparing direct anime stream inside the app wrapper.',
      terminalError: null,
      videoReady: true,
      orientationMode: 'default',
    },
    { type: 'enterFullscreen', payload: {} },
  );

  assert.deepEqual(state, {
    isFullscreen: true,
    statusMessage: 'Direct stream ready. If autoplay is blocked, tap play inside the video.',
    terminalError: null,
    videoReady: true,
    orientationMode: 'landscape',
  });
});

test('reduceAnimeWebViewMessage restores default orientation when anime fullscreen ends', () => {
  const state = reduceAnimeWebViewMessage(
    {
      isFullscreen: true,
      statusMessage: 'Direct stream ready. If autoplay is blocked, tap play inside the video.',
      terminalError: null,
      videoReady: true,
      orientationMode: 'landscape',
    },
    { type: 'exitFullscreen', payload: {} },
  );

  assert.deepEqual(state, {
    isFullscreen: false,
    statusMessage: 'Direct stream ready. If autoplay is blocked, tap play inside the video.',
    terminalError: null,
    videoReady: true,
    orientationMode: 'default',
  });
});
