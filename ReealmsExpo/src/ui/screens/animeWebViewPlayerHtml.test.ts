import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnimeWebViewPlayerHtml } from './animeWebViewPlayerHtml';

test('buildAnimeWebViewPlayerHtml embeds the title, initial source, and fallback sources', () => {
  const html = buildAnimeWebViewPlayerHtml({
    title: 'Episode 1',
    initialUrl: 'https://cdn.example.com/primary.mp4',
    fallbackUrls: [
      'https://cdn.example.com/fallback-a.mp4',
      'https://cdn.example.com/fallback-b.mp4',
    ],
  });

  assert.match(html, /Episode 1/);
  assert.match(html, /https:\/\/cdn\.example\.com\/primary\.mp4/);
  assert.match(html, /https:\/\/cdn\.example\.com\/fallback-a\.mp4/);
  assert.match(html, /https:\/\/cdn\.example\.com\/fallback-b\.mp4/);
  assert.match(html, /ReactNativeWebView\.postMessage/);
  assert.match(html, /video\.addEventListener\('error'/);
});
