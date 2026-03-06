import assert from 'node:assert/strict';
import test from 'node:test';
import { getEpisodeManifest } from './playerQualitySessionUtils';

test('getEpisodeManifest returns the manifest for the active episode and falls back to null safely', () => {
  const manifest = { initialUrl: 'https://cdn.example.com/a.mp4', qualityOptions: [] };
  const lookup = { 'episode-1': manifest };

  assert.equal(getEpisodeManifest(lookup, 'episode-1'), manifest);
  assert.equal(getEpisodeManifest(lookup, 'episode-2'), null);
});
