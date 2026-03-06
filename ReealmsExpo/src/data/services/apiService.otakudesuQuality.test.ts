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
