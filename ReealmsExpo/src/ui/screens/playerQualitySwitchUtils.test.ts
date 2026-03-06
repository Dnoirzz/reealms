import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQualityStatusMessage, buildSelectableQualityItems } from './playerQualitySwitchUtils';

test('buildSelectableQualityItems keeps Auto first and marks deferred qualities as unresolved', () => {
  const items = buildSelectableQualityItems([
    { label: 'Auto', rank: 9999, mode: 'direct', url: 'https://cdn.example.com/a.mp4' },
    {
      label: '1080p',
      rank: 1080,
      mode: 'deferred',
      episodeUrl: 'https://otakudesu.blog/episode/test/',
      mirrors: [],
    },
  ]);

  assert.deepEqual(
    items.map((entry) => [entry.label, entry.isDeferred]),
    [['Auto', false], ['1080p', true]],
  );
});

test('buildQualityStatusMessage formats a compact fallback resolution failure', () => {
  assert.equal(buildQualityStatusMessage({ failedLabel: '1080p' }), '1080p could not be resolved.');
});

test('buildQualityStatusMessage includes the native player error when a stream fails', () => {
  assert.equal(
    buildQualityStatusMessage({ streamFailed: true, errorMessage: 'Source error' }),
    'Stream failed. Source error',
  );
});
