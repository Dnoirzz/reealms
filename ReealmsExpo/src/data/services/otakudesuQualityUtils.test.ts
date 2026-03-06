import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeAnimeQualityOptions,
  parseOtakudesuQualitySections,
} from './otakudesuQualityUtils';

const html = `
  <ul class="m360p"><li><a href="#" data-content="360-filedon">filedon</a></li></ul>
  <ul class="m480p"><li><a href="#" data-content="480-ondesu">ondesu</a></li></ul>
  <ul class="m720p"><li><a href="#" data-content="720-filedon">filedon</a></li></ul>
`;

test('parseOtakudesuQualitySections reads all mirrored quality groups', () => {
  const sections = parseOtakudesuQualitySections(html, 'https://otakudesu.blog/episode/test/');
  assert.deepEqual(
    sections.map((entry) => entry.label),
    ['360p', '480p', '720p'],
  );
});

test('mergeAnimeQualityOptions keeps Auto first and prefers direct options over fallback entries', () => {
  const merged = mergeAnimeQualityOptions({
    initialUrl: 'https://cdn.example.com/anime-720.mp4',
    directOptions: [
      { label: '720p', url: 'https://cdn.example.com/anime-720.mp4', rank: 720, mode: 'direct' },
    ],
    fallbackOptions: [
      {
        label: '1080p',
        rank: 1080,
        mode: 'deferred',
        episodeUrl: 'https://otakudesu.blog/episode/test/',
        mirrors: [],
      },
      {
        label: '720p',
        rank: 720,
        mode: 'deferred',
        episodeUrl: 'https://otakudesu.blog/episode/test/',
        mirrors: [],
      },
    ],
  });

  assert.deepEqual(
    merged.map((entry) => [entry.label, entry.mode]),
    [['Auto', 'direct'], ['720p', 'direct'], ['1080p', 'deferred']],
  );
});
