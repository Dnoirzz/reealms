type BuildAnimeWebViewPlayerHtmlInput = {
  title: string;
  initialUrl: string;
  fallbackUrls: string[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAnimeWebViewPlayerHtml({
  title,
  initialUrl,
  fallbackUrls,
}: BuildAnimeWebViewPlayerHtmlInput) {
  const orderedSources = [...new Set([initialUrl, ...fallbackUrls].map((url) => url.trim()))].filter(Boolean);
  const safeTitle = escapeHtml(title.trim() || 'Anime episode');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: dark;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #020812;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .shell {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background:
          radial-gradient(circle at top, rgba(255, 122, 89, 0.18), transparent 35%),
          linear-gradient(180deg, #07101e 0%, #020812 100%);
      }

      .label {
        padding: 12px 16px 8px;
        color: rgba(255, 255, 255, 0.92);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      video {
        flex: 1;
        width: 100%;
        height: 100%;
        background: #000000;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="label">${safeTitle}</div>
      <video id="player" controls playsinline webkit-playsinline autoplay preload="auto"></video>
    </div>

    <script>
      (() => {
        const title = ${JSON.stringify(title.trim() || 'Anime episode')};
        const sources = ${JSON.stringify(orderedSources)};
        const video = document.getElementById('player');
        let currentIndex = 0;
        let readySent = false;

        function post(type, payload = {}) {
          if (!window.ReactNativeWebView) {
            return;
          }

          window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
        }

        function currentSource() {
          return sources[currentIndex] || '';
        }

        function playCurrentSource(reason) {
          const nextUrl = currentSource();
          if (!nextUrl) {
            post('error', {
              title,
              message: 'All direct anime sources failed.',
            });
            return;
          }

          if (reason === 'fallback') {
            post('fallback', {
              title,
              index: currentIndex,
              total: sources.length,
              url: nextUrl,
            });
          }

          video.src = nextUrl;
          video.load();
          const playAttempt = video.play();
          if (playAttempt && typeof playAttempt.catch === 'function') {
            playAttempt.catch(() => {
              // The user can still start playback from native controls if autoplay is blocked.
            });
          }
        }

        function handleTerminalFailure() {
          post('error', {
            title,
            index: currentIndex,
            total: sources.length,
            url: currentSource(),
            message: 'All direct anime sources failed.',
          });
        }

        video.addEventListener('loadedmetadata', () => {
          if (readySent) {
            return;
          }

          readySent = true;
          post('ready', {
            title,
            index: currentIndex,
            total: sources.length,
            url: currentSource(),
          });
        });

        video.addEventListener('playing', () => {
          post('ready', {
            title,
            index: currentIndex,
            total: sources.length,
            url: currentSource(),
          });
        });

        video.addEventListener('error', () => {
          if (currentIndex < sources.length - 1) {
            currentIndex += 1;
            playCurrentSource('fallback');
            return;
          }

          handleTerminalFailure();
        });

        document.addEventListener('fullscreenchange', () => {
          post(document.fullscreenElement ? 'enterFullscreen' : 'exitFullscreen', { title });
        }, true);

        video.addEventListener('webkitbeginfullscreen', () => {
          post('enterFullscreen', { title });
        });

        video.addEventListener('webkitendfullscreen', () => {
          post('exitFullscreen', { title });
        });

        playCurrentSource('initial');
      })();
    </script>
  </body>
</html>`;
}
