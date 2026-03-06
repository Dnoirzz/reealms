import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiService } from './apiService';

test('getOtakudesuPlaybackManifest returns Auto plus fallback qualities from the episode page', async () => {
  const api = new ApiService();
  api.setSource('otakudesu');

  const originalFetch = global.fetch;
  const encodedMirrorHtml = Buffer.from('<iframe src="https://filedon.example.com/720-player"></iframe>').toString(
    'base64',
  );

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : '';

    if (url === 'https://otakudesu.blog/episode/test-episode/' && (!init?.method || init.method === 'GET')) {
      return new Response(
        `
          <script>
            data: { action: "aa1208d27f29ca340c92c66d1926f13f" };
            nonce: window.__x__nonce, action: "2a3505c93b0035d3f455df82bf976b84";
          </script>
          <ul class="m360p"><li><a href="#" data-content="eyJpZCI6MSwiaSI6MCwicSI6IjM2MHAifQ==">filedon</a></li></ul>
          <ul class="m480p"><li><a href="#" data-content="eyJpZCI6MSwiaSI6MCwicSI6IjQ4MHAifQ==">filedon</a></li></ul>
          <ul class="m720p"><li><a href="#" data-content="eyJpZCI6MSwiaSI6MCwicSI6IjcyMHAifQ==">filedon</a></li></ul>
        `,
        { status: 200 },
      );
    }

    if (url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' && body === 'action=aa1208d27f29ca340c92c66d1926f13f') {
      return new Response(JSON.stringify({ data: 'nonce-token' }), { status: 200 });
    }

    if (
      url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' &&
      body.includes('action=2a3505c93b0035d3f455df82bf976b84') &&
      body.includes('nonce=nonce-token') &&
      body.includes('q=720p')
    ) {
      return new Response(JSON.stringify({ data: encodedMirrorHtml }), { status: 200 });
    }

    if (url === 'https://filedon.example.com/720-player' && (!init?.method || init.method === 'GET')) {
      return new Response('<video src="https://cdn.example.com/test-720.mp4"></video>', { status: 200 });
    }

    if (url.startsWith('https://otakudesu-unofficial-api.vercel.app/')) {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('', { status: 404 });
  }) as typeof fetch;

  try {
    const manifest = await api.getOtakudesuPlaybackManifest('https://otakudesu.blog/episode/test-episode/');

    assert.ok(manifest);
    assert.equal(manifest?.initialUrl, 'https://cdn.example.com/test-720.mp4');
    assert.deepEqual(
      manifest?.qualityOptions.map((entry) => [entry.label, entry.mode]),
      [
        ['Auto', 'direct'],
        ['720p', 'direct'],
        ['480p', 'deferred'],
        ['360p', 'deferred'],
      ],
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('getOtakudesuPlaybackManifest promotes the best fallback quality when the initial direct source is missing', async () => {
  const api = new ApiService();
  api.setSource('otakudesu');

  const originalFetch = global.fetch;
  const encodedMirrorHtml = Buffer.from('<iframe src="https://filedon.example.com/1080-player"></iframe>').toString(
    'base64',
  );

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : '';

    if (url === 'https://otakudesu.blog/episode/fallback-only/' && (!init?.method || init.method === 'GET')) {
      return new Response(
        `
          <script>
            data: { action: "aa1208d27f29ca340c92c66d1926f13f" };
            nonce: window.__x__nonce, action: "2a3505c93b0035d3f455df82bf976b84";
          </script>
          <ul class="m720p"><li><a href="#" data-content="eyJpZCI6MSwiaSI6MCwicSI6IjcyMHAifQ==">filedon</a></li></ul>
          <ul class="m1080p"><li><a href="#" data-content="eyJpZCI6MSwiaSI6MCwicSI6IjEwODBwIn0=">filedon</a></li></ul>
        `,
        { status: 200 },
      );
    }

    if (url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' && body === 'action=aa1208d27f29ca340c92c66d1926f13f') {
      return new Response(JSON.stringify({ data: 'nonce-token' }), { status: 200 });
    }

    if (
      url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' &&
      body.includes('action=2a3505c93b0035d3f455df82bf976b84') &&
      body.includes('nonce=nonce-token') &&
      body.includes('q=1080p')
    ) {
      return new Response(JSON.stringify({ data: encodedMirrorHtml }), { status: 200 });
    }

    if (url === 'https://filedon.example.com/1080-player' && (!init?.method || init.method === 'GET')) {
      return new Response('<video src="https://cdn.example.com/test-1080.mp4"></video>', { status: 200 });
    }

    if (url.startsWith('https://otakudesu-unofficial-api.vercel.app/')) {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('', { status: 404 });
  }) as typeof fetch;

  try {
    const manifest = await api.getOtakudesuPlaybackManifest('https://otakudesu.blog/episode/fallback-only/');

    assert.ok(manifest);
    assert.equal(manifest?.initialUrl, 'https://cdn.example.com/test-1080.mp4');
    assert.deepEqual(
      manifest?.qualityOptions.map((entry) => [entry.label, entry.mode]),
      [
        ['Auto', 'direct'],
        ['1080p', 'direct'],
        ['720p', 'deferred'],
      ],
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('getBestOtakudesuPlayableSource prefers the Flutter-ranked 720p mirror over filedon-first HTML order', async () => {
  const api = new ApiService();
  api.setSource('otakudesu');

  const originalFetch = global.fetch;
  const filedonMirrorHtml = Buffer.from('<iframe src="https://filedon.example.com/720-player"></iframe>').toString(
    'base64',
  );
  const ondesuMirrorHtml = Buffer.from(
    '<iframe src="https://desustream.example.com/dstream/ondesu/hd/player"></iframe>',
  ).toString('base64');

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? String(init.body) : '';

    if (url === 'https://otakudesu.blog/episode/priority-check/' && (!init?.method || init.method === 'GET')) {
      return new Response(
        `
          <script>
            data: { action: "aa1208d27f29ca340c92c66d1926f13f" };
            nonce: window.__x__nonce, action: "2a3505c93b0035d3f455df82bf976b84";
          </script>
          <ul class="m720p">
            <li><a href="#" data-content="eyJpZCI6MSwiaSI6MCwicSI6IjcyMHAifQ==">filedon</a></li>
            <li><a href="#" data-content="eyJpZCI6MSwiaSI6MSwicSI6IjcyMHAifQ==">ondesuhd</a></li>
          </ul>
        `,
        { status: 200 },
      );
    }

    if (url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' && body === 'action=aa1208d27f29ca340c92c66d1926f13f') {
      return new Response(JSON.stringify({ data: 'nonce-token' }), { status: 200 });
    }

    if (
      url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' &&
      body.includes('action=2a3505c93b0035d3f455df82bf976b84') &&
      body.includes('nonce=nonce-token') &&
      body.includes('q=720p') &&
      body.includes('i=0')
    ) {
      return new Response(JSON.stringify({ data: filedonMirrorHtml }), { status: 200 });
    }

    if (
      url === 'https://otakudesu.blog/wp-admin/admin-ajax.php' &&
      body.includes('action=2a3505c93b0035d3f455df82bf976b84') &&
      body.includes('nonce=nonce-token') &&
      body.includes('q=720p') &&
      body.includes('i=1')
    ) {
      return new Response(JSON.stringify({ data: ondesuMirrorHtml }), { status: 200 });
    }

    if (url === 'https://filedon.example.com/720-player' && (!init?.method || init.method === 'GET')) {
      return new Response('<video src="https://cdn.example.com/filedon-720.mp4"></video>', { status: 200 });
    }

    if (url === 'https://desustream.example.com/dstream/ondesu/hd/player' && (!init?.method || init.method === 'GET')) {
      return new Response('<iframe src="https://www.blogger.com/video.g?token=ondesu-720"></iframe>', { status: 200 });
    }

    if (url === 'https://www.blogger.com/video.g?token=ondesu-720' && (!init?.method || init.method === 'GET')) {
      return new Response(
        `
          <script>
            "FdrFJe":"f-sid-token";
            "cfb2h":"bl-token";
          </script>
        `,
        { status: 200 },
      );
    }

    if (
      url.startsWith('https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute?') &&
      init?.method === 'POST'
    ) {
      return new Response(
        'https://rr1---sn-example.googlevideo.com/videoplayback?mime=video/mp4&itag=22\nhttps://rr1---sn-example.googlevideo.com/videoplayback?mime=video/mp4&itag=18',
        { status: 200 },
      );
    }

    if (url.startsWith('https://otakudesu-unofficial-api.vercel.app/')) {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('', { status: 404 });
  }) as typeof fetch;

  try {
    const source = await api.getBestOtakudesuPlayableSource('https://otakudesu.blog/episode/priority-check/');

    assert.ok(source);
    assert.match(source?.url ?? '', /googlevideo\.com\/videoplayback/);
    assert.deepEqual(source?.fallbackUrls, ['https://cdn.example.com/filedon-720.mp4']);
    assert.deepEqual(
      source?.qualityOptions.map((entry) => [entry.label, entry.rank]),
      [
        ['720p', 720],
        ['360p', 360],
      ],
    );
  } finally {
    global.fetch = originalFetch;
  }
});
