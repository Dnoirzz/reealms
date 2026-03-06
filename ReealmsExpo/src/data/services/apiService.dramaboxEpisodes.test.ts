import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiService } from './apiService';

test('getEpisodes falls back to the official DramaBox page data when the sansekai proxy fails', async () => {
  const api = new ApiService();
  api.setSource('dramabox');

  const originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === 'https://dramabox.sansekai.my.id/api/dramabox/allepisode?bookId=42000004357&lang=in') {
      return new Response('bad gateway', { status: 502 });
    }

    if (url === 'https://www.dramaboxdb.com/movie/42000004357/reealms-fallback') {
      return new Response(
        `
          <html>
            <body>
              <script id="__NEXT_DATA__" type="application/json">
                ${JSON.stringify({
                  props: {
                    pageProps: {
                      chapterList: [
                        {
                          id: '700280810',
                          index: 0,
                          indexStr: '001',
                          m3u8Url: 'https://stream.example.com/episode-1.m3u8',
                          mp4: 'https://stream.example.com/episode-1.mp4',
                          duration: 120673,
                        },
                        {
                          id: '700280811',
                          index: 1,
                          indexStr: '002',
                          m3u8Url: 'https://stream.example.com/episode-2.m3u8',
                          mp4: 'https://stream.example.com/episode-2.mp4',
                          duration: 74953,
                        },
                      ],
                    },
                  },
                })}
              </script>
            </body>
          </html>
        `,
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      );
    }

    return new Response('', { status: 404 });
  }) as typeof fetch;

  try {
    const episodes = await api.getEpisodes('42000004357');

    assert.equal(episodes.length, 2);
    assert.deepEqual(episodes.map((episode) => episode.id), ['700280810', '700280811']);
    assert.deepEqual(episodes.map((episode) => episode.title), ['Episode 1', 'Episode 2']);
    assert.deepEqual(episodes.map((episode) => episode.order), [1, 2]);
    assert.deepEqual(episodes.map((episode) => episode.streamUrl), [
      'https://stream.example.com/episode-1.m3u8',
      'https://stream.example.com/episode-2.m3u8',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
