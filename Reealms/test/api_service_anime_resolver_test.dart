import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:reealms_mobile/data/services/api_service.dart';

void main() {
  group('ApiService anime resolver', () {
    test(
      'scrapeOtakudesuEpisodes keeps real episode numbers aligned with URLs',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/anime/champignon-majo-sub-indo/') {
            return http.Response('''
<div class="episodelist">
  <a href="https://otakudesu.blog/episode/cpnm-episode-10-sub-indo/">Champignon no Majo Episode 10 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-9-sub-indo/">Champignon no Majo Episode 9 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-8-sub-indo/">Champignon no Majo Episode 8 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-7-sub-indo/">Champignon no Majo Episode 7 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-6-sub-indo/">Champignon no Majo Episode 6 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-5-sub-indo/">Champignon no Majo Episode 5 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-4-sub-indo/">Champignon no Majo Episode 4 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-3-sub-indo/">Champignon no Majo Episode 3 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-2-sub-indo/">Champignon no Majo Episode 2 Subtitle Indonesia</a>
  <a href="https://otakudesu.blog/episode/cpnm-episode-1-sub-indo/">Champignon no Majo Episode 1 Subtitle Indonesia</a>
</div>
''', 200);
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final api = ApiService(client: client);

        final episodes = await api.scrapeOtakudesuEpisodes(
          'https://otakudesu.blog/anime/champignon-majo-sub-indo/',
        );

        expect(episodes, hasLength(10));
        expect(
          episodes.first.id,
          'https://otakudesu.blog/episode/cpnm-episode-1-sub-indo/',
        );
        expect(episodes.first.title, 'Episode 1');
        expect(episodes.first.order, 1);
        expect(
          episodes.last.id,
          'https://otakudesu.blog/episode/cpnm-episode-10-sub-indo/',
        );
        expect(episodes.last.title, 'Episode 10');
        expect(episodes.last.order, 10);
      },
    );

    test(
      'getBestOtakudesuStreamUrl prefers staged scrape result before API fallback',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/episode/test-episode/') {
            return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/embed-720" data-content="">OnDesu</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD' &&
              url == 'https://ondesu.example/embed-720') {
            return http.Response('', 200);
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final logs = <String>[];
        final api = ApiService(
          client: client,
          animePlayableLogger: (label, value) => logs.add('$label=$value'),
        );

        final result = await api.getBestOtakudesuStreamUrl(
          'https://otakudesu.blog/episode/test-episode/',
        );

        expect(result, 'https://ondesu.example/embed-720');
        expect(logs, contains('stage=scrape-start'));
        expect(logs, contains('stage=scrape-selected'));
        expect(logs.where((entry) => entry == 'stage=api-fallback'), isEmpty);
      },
    );

    test(
      'getBestOtakudesuStreamUrl falls back to API when scrape candidates are empty',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/episode/fallback-episode/') {
            return http.Response(
              '<html><body>no mirrors here</body></html>',
              200,
            );
          }

          if (request.method == 'GET' &&
              url.endsWith('/episode/fallback-episode')) {
            return http.Response(
              json.encode({
                'data': {
                  'details': {
                    'defaultStreamingUrl':
                        'https://filemoon.example/embed-fallback',
                  },
                },
              }),
              200,
              headers: {'content-type': 'application/json'},
            );
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final logs = <String>[];
        final api = ApiService(
          client: client,
          animePlayableLogger: (label, value) => logs.add('$label=$value'),
        );

        final result = await api.getBestOtakudesuStreamUrl(
          'https://otakudesu.blog/episode/fallback-episode/',
        );

        expect(result, 'https://filemoon.example/embed-fallback');
        expect(logs, contains('stage=scrape-start'));
        expect(logs, contains('stage=api-fallback'));
        expect(
          logs.where((entry) => entry == 'stage=scrape-selected'),
          isEmpty,
        );
      },
    );

    test(
      'getBestOtakudesuStreamUrl falls back to API when scraped mirrors are unreachable',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/episode/unreachable-episode/') {
            return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/unreachable-mirror" data-content="">OnDesu</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD' &&
              url == 'https://ondesu.example/unreachable-mirror') {
            return http.Response('', 503);
          }

          if (request.method == 'GET' &&
              url.endsWith('/episode/unreachable-episode')) {
            return http.Response(
              json.encode({
                'data': {
                  'details': {
                    'defaultStreamingUrl': 'https://filemoon.example/embed-api',
                  },
                },
              }),
              200,
              headers: {'content-type': 'application/json'},
            );
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final logs = <String>[];
        final api = ApiService(
          client: client,
          animePlayableLogger: (label, value) => logs.add('$label=$value'),
        );

        final result = await api.getBestOtakudesuStreamUrl(
          'https://otakudesu.blog/episode/unreachable-episode/',
        );

        expect(result, 'https://filemoon.example/embed-api');
        expect(logs, contains('stage=scrape-start'));
        expect(logs, contains('stage=api-fallback'));
      },
    );

    test(
      'resolver prefers master m3u8 over media playlist and mp4 when present',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/episode/master-priority/') {
            return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/mirror-mp4" data-content="">OnDesu</a></li>
  <li><a href="https://filemoon.example/mirror-media" data-content="">Filemoon</a></li>
  <li><a href="https://vidhide.example/mirror-master" data-content="">Vidhide</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD') {
            return http.Response('', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://ondesu.example/mirror-mp4') {
            return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/video.mp4";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://filemoon.example/mirror-media') {
            return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/media-720.m3u8";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://vidhide.example/mirror-master') {
            return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/master.m3u8";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://cdn.example/master.m3u8') {
            return http.Response(
              '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=1280x720\n720/index.m3u8\n',
              200,
            );
          }

          if (request.method == 'GET' &&
              url == 'https://cdn.example/media-720.m3u8') {
            return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final logs = <String>[];
        final api = ApiService(
          client: client,
          animePlayableLogger: (label, value) => logs.add('$label=$value'),
        );

        final result = await api.getBestOtakudesuPlayableUrl(
          'https://otakudesu.blog/episode/master-priority/',
        );

        expect(result, 'https://cdn.example/master.m3u8');
        expect(
          logs,
          contains('mirror-selected=master:https://cdn.example/master.m3u8'),
        );
      },
    );

    test(
      'resolver prefers media m3u8 over earlier mp4 when no master exists',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/episode/media-priority/') {
            return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/media-priority-mp4" data-content="">OnDesu</a></li>
  <li><a href="https://filemoon.example/media-priority-media" data-content="">Filemoon</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD') {
            return http.Response('', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://ondesu.example/media-priority-mp4') {
            return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/media-priority.mp4";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://filemoon.example/media-priority-media') {
            return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/720/index.m3u8";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://cdn.example/720/index.m3u8') {
            return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final logs = <String>[];
        final api = ApiService(
          client: client,
          animePlayableLogger: (label, value) => logs.add('$label=$value'),
        );

        final result = await api.getBestOtakudesuPlayableUrl(
          'https://otakudesu.blog/episode/media-priority/',
        );

        expect(result, 'https://cdn.example/720/index.m3u8');
        expect(logs, contains('bucket-selected=media'));
        expect(
          logs,
          contains('mirror-selected=media:https://cdn.example/720/index.m3u8'),
        );
      },
    );

    test(
      'resolver extracts selectable qualities from blogger iframe mirrors',
      () async {
        const episodeUrl = 'https://otakudesu.blog/episode/blogger-quality/';
        const mirrorUrl = 'https://ondesu.example/blogger-mirror';
        const bloggerUrl = 'https://www.blogger.com/video.g?token=test-token';
        const source720 =
            'https://rr3---sn-npoeener.googlevideo.com/videoplayback?itag=22&mime=video/mp4&id=abc';
        const source360 =
            'https://rr3---sn-npoeener.googlevideo.com/videoplayback?itag=18&mime=video/mp4&id=abc';

        String escapeBloggerUrl(String url) {
          return url.replaceAll('&', r'\u0026').replaceAll('=', r'\u003d');
        }

        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' && url == episodeUrl) {
            return http.Response('''
<ul class="m720p">
  <li><a href="$mirrorUrl" data-content="">OnDesu</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD' && url == mirrorUrl) {
            return http.Response('', 200);
          }

          if (request.method == 'GET' && url == mirrorUrl) {
            return http.Response('''
<html>
  <iframe src="$bloggerUrl"></iframe>
</html>
''', 200);
          }

          if (request.method == 'GET' && url == bloggerUrl) {
            return http.Response('''
<html>
  <script>
    window.WIZ_global_data = {"FdrFJe":"test-fsid","cfb2h":"test-bl"};
  </script>
</html>
''', 200);
          }

          if (request.method == 'POST' &&
              request.url.host == 'www.blogger.com' &&
              request.url.path == '/_/BloggerVideoPlayerUi/data/batchexecute') {
            return http.Response('''
)]}'

2621
[["wrb.fr","WcwnYd","[1,null,[[\\"${escapeBloggerUrl(source720)}\\",[22]],[\\"${escapeBloggerUrl(source360)}\\",[18]]],null,null,null,\\"generic\\"]"]]
''', 200);
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final api = ApiService(client: client);

        final source = await api.getBestOtakudesuPlayableSource(episodeUrl);

        expect(source?.url, source720);
        expect(source?.qualityOptions.map((option) => option.label).toList(), [
          '720p',
          '360p',
        ]);
        expect(source?.qualityOptions.map((option) => option.url).toList(), [
          source720,
          source360,
        ]);
      },
    );

    test(
      'resolver still prefers master URL when master probe check cannot be confirmed',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url ==
                  'https://otakudesu.blog/episode/master-fallback-heuristic/') {
            return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/mirror-heuristic" data-content="">OnDesu</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD' &&
              url == 'https://ondesu.example/mirror-heuristic') {
            return http.Response('', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://ondesu.example/mirror-heuristic') {
            return http.Response('''
<html>
  <script>
    const a = "https://cdn.example/master.m3u8";
    const b = "https://cdn.example/720/index.m3u8";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://cdn.example/master.m3u8') {
            return http.Response('forbidden', 403);
          }

          if (request.method == 'GET' &&
              url == 'https://cdn.example/720/index.m3u8') {
            return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final api = ApiService(client: client);

        final result = await api.getBestOtakudesuPlayableUrl(
          'https://otakudesu.blog/episode/master-fallback-heuristic/',
        );

        expect(result, 'https://cdn.example/master.m3u8');
      },
    );

    test('resolver emits decision logs for each major stage', () async {
      final client = MockClient((request) async {
        final url = request.url.toString();

        if (request.method == 'GET' &&
            url == 'https://otakudesu.blog/episode/logging-episode/') {
          return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/logging-mirror" data-content="">OnDesu</a></li>
</ul>
''', 200);
        }

        if (request.method == 'HEAD' &&
            url == 'https://ondesu.example/logging-mirror') {
          return http.Response('', 200);
        }

        if (request.method == 'GET' &&
            url == 'https://ondesu.example/logging-mirror') {
          return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/logging-master.m3u8";
  </script>
</html>
''', 200);
        }

        if (request.method == 'GET' &&
            url == 'https://cdn.example/logging-master.m3u8') {
          return http.Response(
            '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1920x1080\n1080/index.m3u8\n',
            200,
          );
        }

        fail('Unexpected HTTP request: ${request.method} $url');
      });

      final logs = <String>[];
      final api = ApiService(
        client: client,
        animePlayableLogger: (label, value) => logs.add('$label=$value'),
      );

      final result = await api.getBestOtakudesuPlayableUrl(
        'https://otakudesu.blog/episode/logging-episode/',
      );

      expect(result, 'https://cdn.example/logging-master.m3u8');
      expect(
        logs,
        containsAll([
          'mirror-candidates-count=1',
          'playable-selected=master:https://cdn.example/logging-master.m3u8',
          'mirror-selected=master:https://cdn.example/logging-master.m3u8',
        ]),
      );
    });

    test(
      'getBestOtakudesuPlayableUrl falls back to API source when scraped mirror is unreachable',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();

          if (request.method == 'GET' &&
              url == 'https://otakudesu.blog/episode/unreachable-playable/') {
            return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/unreachable-playable-mirror" data-content="">OnDesu</a></li>
</ul>
''', 200);
          }

          if (request.method == 'HEAD' &&
              url == 'https://ondesu.example/unreachable-playable-mirror') {
            return http.Response('', 503);
          }

          if (request.method == 'GET' &&
              url.endsWith('/episode/unreachable-playable')) {
            return http.Response(
              json.encode({
                'data': {
                  'details': {
                    'defaultStreamingUrl':
                        'https://filemoon.example/api-playable-fallback',
                  },
                },
              }),
              200,
              headers: {'content-type': 'application/json'},
            );
          }

          if (request.method == 'GET' &&
              url == 'https://filemoon.example/api-playable-fallback') {
            return http.Response('''
<html>
  <script>
    const src = "https://cdn.example/api-fallback-master.m3u8";
  </script>
</html>
''', 200);
          }

          if (request.method == 'GET' &&
              url == 'https://cdn.example/api-fallback-master.m3u8') {
            return http.Response(
              '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1920x1080\n1080/index.m3u8\n',
              200,
            );
          }

          fail('Unexpected HTTP request: ${request.method} $url');
        });

        final api = ApiService(client: client);

        final result = await api.getBestOtakudesuPlayableUrl(
          'https://otakudesu.blog/episode/unreachable-playable/',
        );

        expect(result, 'https://cdn.example/api-fallback-master.m3u8');
      },
    );
  });
}
