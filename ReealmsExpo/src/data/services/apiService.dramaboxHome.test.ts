import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiService } from './apiService';

test('getHomeContent falls back to the official DramaBox home page when the sansekai feed fails', async () => {
  const api = new ApiService();
  api.setSource('dramabox');

  const originalFetch = global.fetch;
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (
      url === 'https://dramabox.sansekai.my.id/api/dramabox/foryou?lang=in' ||
      url === 'https://dramabox.sansekai.my.id/api/dramabox/foryou'
    ) {
      return new Response('bad gateway', { status: 502 });
    }

    if (url === 'https://www.dramaboxdb.com/') {
      return new Response(
        `
          <html>
            <body>
              <script id="__NEXT_DATA__" type="application/json">
                ${JSON.stringify({
                  props: {
                    pageProps: {
                      bigList: [
                        {
                          bookId: '42000004357',
                          bookName: 'Watch Out! I Call the Final Shots',
                          cover: 'https://img.example.com/cover-1.jpg',
                          introduction: 'Drama synopsis one.',
                          tags: ['Urban', 'Secret Identity'],
                          chapterCount: 63,
                        },
                      ],
                      smallData: [
                        {
                          id: 1,
                          name: 'Must-sees',
                          style: 'SMALL_CARD_LIST',
                          items: [
                            {
                              bookId: '42000005745',
                              bookName: 'The Vanished Champ Strikes Back',
                              cover: 'https://img.example.com/cover-2.jpg',
                              introduction: 'Drama synopsis two.',
                              tags: ['Tough Guy', 'Modern'],
                              chapterCount: 56,
                            },
                            {
                              bookId: '42000004357',
                              bookName: 'Watch Out! I Call the Final Shots',
                              cover: 'https://img.example.com/cover-1.jpg',
                              introduction: 'Drama synopsis one.',
                              tags: ['Urban', 'Secret Identity'],
                              chapterCount: 63,
                            },
                          ],
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
    const movies = await api.getHomeContent();

    assert.equal(movies.length, 2);
    assert.deepEqual(
      movies.map((movie) => movie.id),
      ['42000004357', '42000005745'],
    );
    assert.deepEqual(
      movies.map((movie) => movie.posterUrl),
      ['https://img.example.com/cover-1.jpg', 'https://img.example.com/cover-2.jpg'],
    );
    assert.deepEqual(
      movies.map((movie) => movie.synopsis),
      ['Drama synopsis one.', 'Drama synopsis two.'],
    );
    assert.deepEqual(
      movies.map((movie) => movie.totalChapters),
      [63, 56],
    );
  } finally {
    global.fetch = originalFetch;
  }
});
