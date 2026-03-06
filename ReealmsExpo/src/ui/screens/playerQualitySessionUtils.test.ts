import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnimeSelectableQualityItems,
  buildAnimeSourceOrder,
  buildAnimeWebViewSession,
  cacheResolvedAnimeQualityUrl,
  getCachedAnimeQualityUrl,
  getEpisodeManifest,
  pickNextFallbackUrl,
} from './playerQualitySessionUtils';

test('getEpisodeManifest returns the manifest for the active episode and falls back to null safely', () => {
  const manifest = { initialUrl: 'https://cdn.example.com/a.mp4', qualityOptions: [] };
  const lookup = { 'episode-1': manifest };

  assert.equal(getEpisodeManifest(lookup, 'episode-1'), manifest);
  assert.equal(getEpisodeManifest(lookup, 'episode-2'), null);
});

test('pickNextFallbackUrl skips the active source and already-tried alternates', () => {
  const next = pickNextFallbackUrl({
    activeSourceUrl: 'https://cdn.example.com/primary.mp4',
    fallbackUrls: [
      'https://cdn.example.com/primary.mp4',
      'https://cdn.example.com/backup-a.mp4',
      'https://cdn.example.com/backup-b.mp4',
    ],
    triedUrls: new Set(['https://cdn.example.com/backup-a.mp4']),
  });

  assert.equal(next, 'https://cdn.example.com/backup-b.mp4');
});

test('buildAnimeWebViewSession returns a webview payload when an anime manifest has a direct URL', () => {
  const session = buildAnimeWebViewSession({
    episodeTitle: 'Episode 1',
    initialUrl: 'https://cdn.example.com/primary.mp4',
    fallbackUrls: ['https://cdn.example.com/backup.mp4'],
    qualityOptions: [
      { label: 'Auto', rank: 9999, mode: 'direct', url: 'https://cdn.example.com/primary.mp4' },
      { label: '720p', rank: 720, mode: 'direct', url: 'https://cdn.example.com/720.mp4' },
    ],
  });

  assert.deepEqual(session, {
    title: 'Episode 1',
    initialUrl: 'https://cdn.example.com/primary.mp4',
    fallbackUrls: ['https://cdn.example.com/backup.mp4'],
    qualityOptions: [
      { label: 'Auto', rank: 9999, mode: 'direct', url: 'https://cdn.example.com/primary.mp4' },
      { label: '720p', rank: 720, mode: 'direct', url: 'https://cdn.example.com/720.mp4' },
    ],
  });
});

test('buildAnimeSelectableQualityItems keeps Auto first and sorts the remaining qualities by rank', () => {
  const items = buildAnimeSelectableQualityItems([
    { label: '480p', rank: 480, mode: 'direct', url: 'https://cdn.example.com/480.mp4' },
    { label: 'Auto', rank: 9999, mode: 'direct', url: 'https://cdn.example.com/auto.mp4' },
    { label: '1080p', rank: 1080, mode: 'deferred', episodeUrl: 'https://example.com/ep', mirrors: [] },
    { label: '720p', rank: 720, mode: 'direct', url: 'https://cdn.example.com/720.mp4' },
  ]);

  assert.deepEqual(
    items.map((item) => [item.label, item.isDeferred]),
    [
      ['Auto', false],
      ['1080p', true],
      ['720p', false],
      ['480p', false],
    ],
  );
});

test('buildAnimeSourceOrder keeps Auto using the initial url then fallback urls', () => {
  const order = buildAnimeSourceOrder({
    initialUrl: 'https://cdn.example.com/auto.mp4',
    fallbackUrls: ['https://cdn.example.com/fallback-a.mp4', 'https://cdn.example.com/fallback-b.mp4'],
    selectedLabel: 'Auto',
  });

  assert.deepEqual(order, [
    'https://cdn.example.com/auto.mp4',
    'https://cdn.example.com/fallback-a.mp4',
    'https://cdn.example.com/fallback-b.mp4',
  ]);
});

test('buildAnimeSourceOrder prioritizes the selected direct quality before the fallback chain', () => {
  const order = buildAnimeSourceOrder({
    initialUrl: 'https://cdn.example.com/auto.mp4',
    fallbackUrls: ['https://cdn.example.com/fallback-a.mp4', 'https://cdn.example.com/720.mp4'],
    selectedLabel: '720p',
    selectedDirectUrl: 'https://cdn.example.com/720.mp4',
  });

  assert.deepEqual(order, [
    'https://cdn.example.com/720.mp4',
    'https://cdn.example.com/auto.mp4',
    'https://cdn.example.com/fallback-a.mp4',
  ]);
});

test('buildAnimeSourceOrder keeps quality-specific fallback urls directly behind the selected quality', () => {
  const order = buildAnimeSourceOrder({
    initialUrl: 'https://cdn.example.com/auto.mp4',
    fallbackUrls: ['https://cdn.example.com/fallback-a.mp4'],
    prioritizedFallbackUrls: ['https://cdn.example.com/1080-backup.mp4'],
    selectedLabel: '1080p',
    selectedDirectUrl: 'https://cdn.example.com/1080.mp4',
  });

  assert.deepEqual(order, [
    'https://cdn.example.com/1080.mp4',
    'https://cdn.example.com/1080-backup.mp4',
    'https://cdn.example.com/auto.mp4',
    'https://cdn.example.com/fallback-a.mp4',
  ]);
});

test('cacheResolvedAnimeQualityUrl stores resolved deferred qualities by label', () => {
  const cache = cacheResolvedAnimeQualityUrl({}, '1080p', 'https://cdn.example.com/1080.mp4');

  assert.deepEqual(cache, {
    '1080p': 'https://cdn.example.com/1080.mp4',
  });
});

test('getCachedAnimeQualityUrl reuses the cached deferred quality for the same label', () => {
  const cache = {
    '1080p': 'https://cdn.example.com/1080.mp4',
  };

  assert.equal(getCachedAnimeQualityUrl(cache, '1080p'), 'https://cdn.example.com/1080.mp4');
  assert.equal(getCachedAnimeQualityUrl(cache, '720p'), null);
});
