import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBloggerPlayableVariants,
  isDirectPlayableVideoUrl,
} from './animePlaybackUtils';

test('extractBloggerPlayableVariants repairs escaped googlevideo query separators', () => {
  const variants = extractBloggerPlayableVariants(
    'https://rr2---sn-npoeenl7.googlevideo.com/videoplayback?expire\\=1772844982\\&mime\\=video%2Fmp4\\&itag\\=22\\&source\\=blogger',
  );

  assert.equal(variants.length, 1);
  assert.equal(
    variants[0]?.url,
    'https://rr2---sn-npoeenl7.googlevideo.com/videoplayback?expire=1772844982&mime=video%2Fmp4&itag=22&source=blogger',
  );
  assert.equal(variants[0]?.itag, 22);
});

test('isDirectPlayableVideoUrl rejects embed pages that only look like mp4 assets', () => {
  assert.equal(isDirectPlayableVideoUrl('https://filedon.co/embed/Otakudesu.io_SnF.S2--06_720p.mp4'), false);
  assert.equal(
    isDirectPlayableVideoUrl(
      'https://filedon.4ee42e7b34bf3c2aec4681b9c17de08f.r2.cloudflarestorage.com/users/467/Complate/Domestic/Otakudesu.io_SnF.S2--06_720p.mp4?X-Amz-Signature=test',
    ),
    true,
  );
});
