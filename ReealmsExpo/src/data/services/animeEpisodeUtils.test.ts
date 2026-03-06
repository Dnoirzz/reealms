import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOtakudesuEpisodeEntry,
  extractOtakudesuEpisodeNumber,
} from './animeEpisodeUtils';

test('extractOtakudesuEpisodeNumber prefers explicit episode markers over season tags', () => {
  assert.equal(extractOtakudesuEpisodeNumber('Sousou no Frieren S2 Episode 7 Subtitle Indonesia'), 7);
  assert.equal(extractOtakudesuEpisodeNumber('Jujutsu Kaisen S3 Episode 3 Subtitle Indonesia'), 3);
});

test('extractOtakudesuEpisodeNumber reads the real episode number from season-tagged slugs', () => {
  assert.equal(extractOtakudesuEpisodeNumber('https://otakudesu.blog/episode/snf-s2-episode-7-sub-indo/'), 7);
  assert.equal(
    extractOtakudesuEpisodeNumber('https://otakudesu.blog/episode/jujutsu-kaisen-s3-episode-3-sub-indo/'),
    3,
  );
});

test('buildOtakudesuEpisodeEntry normalizes the label from the resolved episode number', () => {
  const episode = buildOtakudesuEpisodeEntry({
    rawTitle: 'Sousou no Frieren S2 Episode 7 Subtitle Indonesia',
    url: 'https://otakudesu.blog/episode/snf-s2-episode-7-sub-indo/',
    fallbackOrder: 1,
  });

  assert.equal(episode.title, 'Episode 7');
  assert.equal(episode.order, 7);
  assert.equal(episode.id, 'https://otakudesu.blog/episode/snf-s2-episode-7-sub-indo/');
});
