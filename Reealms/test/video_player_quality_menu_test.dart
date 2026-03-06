import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:reealms_mobile/data/models/playback_source.dart';
import 'package:reealms_mobile/ui/pages/video_player_page.dart';

void main() {
  group('VideoPlayerPage quality menu parsing', () {
    test(
      'quality menu shows variants when master playlist is available',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();
          if (url == 'https://cdn.example/master.m3u8') {
            return http.Response('''
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5200000,RESOLUTION=1920x1080
1080/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480
480/index.m3u8
''', 200);
          }
          fail('Unexpected request: ${request.method} $url');
        });

        final labels = await VideoPlayerPage.parseQualityOptionsForTesting(
          sourceUrl: 'https://cdn.example/master.m3u8',
          client: client,
        );

        expect(labels, ['Auto', '1080p', '720p', '480p']);
      },
    );

    test(
      'quality menu recovers variants from nearby master playlist',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();
          if (url == 'https://cdn.example/720/index.m3u8') {
            return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
          }
          if (url == 'https://cdn.example/master.m3u8') {
            return http.Response('''
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5200000,RESOLUTION=1920x1080
1080/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480
480/index.m3u8
''', 200);
          }
          return http.Response('not-found', 404);
        });

        final labels = await VideoPlayerPage.parseQualityOptionsForTesting(
          sourceUrl: 'https://cdn.example/720/index.m3u8',
          client: client,
        );

        expect(labels, ['Auto', '1080p', '720p', '480p']);
      },
    );

    test(
      'quality menu shows Auto only when source is single quality',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();
          if (url == 'https://cdn.example/media.m3u8') {
            return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
          }
          return http.Response('not-found', 404);
        });

        final labelsFromMedia =
            await VideoPlayerPage.parseQualityOptionsForTesting(
              sourceUrl: 'https://cdn.example/media.m3u8',
              client: client,
            );
        final labelsFromMp4 =
            await VideoPlayerPage.parseQualityOptionsForTesting(
              sourceUrl: 'https://cdn.example/video.mp4',
              client: client,
            );

        expect(labelsFromMedia, ['Auto']);
        expect(labelsFromMp4, ['Auto']);
      },
    );

    test(
      'quality menu recovers variants when URL contains quality hint like 720p',
      () async {
        final client = MockClient((request) async {
          final url = request.url.toString();
          // Media playlist at current path (no variants)
          if (url == 'https://cdn.example/720p.m3u8') {
            return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
          }
          // Master playlist at parent directory
          if (url == 'https://cdn.example/master.m3u8') {
            return http.Response('''
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5200000,RESOLUTION=1920x1080
1080/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480
480/index.m3u8
''', 200);
          }
          return http.Response('not-found', 404);
        });

        final labels = await VideoPlayerPage.parseQualityOptionsForTesting(
          sourceUrl: 'https://cdn.example/720p.m3u8',
          client: client,
        );

        expect(labels, ['Auto', '1080p', '720p', '480p']);
      },
    );

    testWidgets('quality menu uses provided override options for direct sources', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: VideoPlayerPage(
            videoUrl:
                'https://rr3---sn-npoeener.googlevideo.com/videoplayback?itag=22&mime=video/mp4&id=abc',
            title: 'Episode 1',
            disablePlaybackInitializationForTesting: true,
            qualityOptionsOverride: [
              PlaybackQualityOption(
                label: '720p',
                url:
                    'https://rr3---sn-npoeener.googlevideo.com/videoplayback?itag=22&mime=video/mp4&id=abc',
                rank: 720,
              ),
              PlaybackQualityOption(
                label: '360p',
                url:
                    'https://rr3---sn-npoeener.googlevideo.com/videoplayback?itag=18&mime=video/mp4&id=abc',
                rank: 360,
              ),
            ],
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Auto'), findsOneWidget);
      expect(find.text('720p'), findsOneWidget);
      expect(find.text('360p'), findsOneWidget);
    });
  });
}
