import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:reealms_mobile/data/services/api_service.dart';
import 'package:reealms_mobile/ui/pages/detail_page.dart';

class _FakeApiService extends ApiService {
  _FakeApiService({
    this.playableResult = '',
    this.streamResult = '',
    this.episodes = const <Episode>[],
  });

  final String playableResult;
  final String streamResult;
  final List<Episode> episodes;

  int playableCalls = 0;
  int streamCalls = 0;
  String? lastPlayableEpisodeUrl;

  @override
  Future<List<Episode>> scrapeOtakudesuEpisodes(String animePageUrl) async {
    return episodes;
  }

  @override
  Future<String> getBestOtakudesuPlayableUrl(String episodeUrl) async {
    playableCalls++;
    lastPlayableEpisodeUrl = episodeUrl;
    return playableResult;
  }

  @override
  Future<String> getBestOtakudesuStreamUrl(String episodeUrl) async {
    streamCalls++;
    return streamResult;
  }
}

class _NavProbePage extends StatelessWidget {
  const _NavProbePage({required this.tag, required this.value});

  final String tag;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('$tag:$value', textDirection: TextDirection.ltr),
      ),
    );
  }
}

void main() {
  Movie buildMovie() {
    return Movie(
      id: 'anime-1',
      title: 'Anime Test',
      posterUrl: '',
      synopsis: 'https://otakudesu.blog/anime/test-series/',
      sourceType: 'otakudesu',
    );
  }

  DetailPage buildPage(_FakeApiService apiService, Movie movie) {
    return DetailPage(
      movie: movie,
      apiService: apiService,
      isFavoriteOverride: (_) async => false,
      toggleFavoriteOverride: (_) async {},
      addToHistoryOverride: (_) async {},
      otakudesuVideoPlayerBuilder: (videoUrl, title, preferLandscapeOnStart) =>
          _NavProbePage(
            tag: preferLandscapeOnStart
                ? 'native-landscape'
                : 'native-portrait',
            value: videoUrl,
          ),
      animeWebViewBuilder: (streamUrl, title) =>
          _NavProbePage(tag: 'webview', value: streamUrl),
    );
  }

  testWidgets('anime tap keeps native-first then webview fallback behavior', (
    WidgetTester tester,
  ) async {
    final api = _FakeApiService(
      playableResult: '',
      streamResult: 'https://filemoon.example/safe-mirror',
      episodes: [
        Episode(
          id: 'https://otakudesu.blog/episode/test-1/',
          title: 'Episode 7',
          order: 7,
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(home: buildPage(api, buildMovie())));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -900));
    await tester.pumpAndSettle();

    await tester.tap(find.text('7'));
    await tester.pumpAndSettle();

    expect(api.playableCalls, 1);
    expect(api.streamCalls, 1);
    expect(
      find.text('webview:https://filemoon.example/safe-mirror'),
      findsOneWidget,
    );
    expect(find.textContaining('native:'), findsNothing);
  });

  testWidgets(
    'anime tap goes native player when direct playable is available',
    (WidgetTester tester) async {
      final api = _FakeApiService(
        playableResult: 'https://cdn.example/direct-master.m3u8',
        streamResult: 'https://filemoon.example/should-not-be-used',
        episodes: [
          Episode(
            id: 'https://otakudesu.blog/episode/test-2/',
            title: 'Episode 9',
            order: 9,
          ),
        ],
      );

      await tester.pumpWidget(MaterialApp(home: buildPage(api, buildMovie())));
      await tester.pumpAndSettle();

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -900));
      await tester.pumpAndSettle();

      await tester.tap(find.text('9'));
      await tester.pumpAndSettle();

      expect(api.playableCalls, 1);
      expect(api.streamCalls, 0);
      expect(
        find.text('native-portrait:https://cdn.example/direct-master.m3u8'),
        findsOneWidget,
      );
      expect(find.textContaining('webview:'), findsNothing);
    },
  );

  testWidgets('anime grid number maps to matching episode URL', (
    WidgetTester tester,
  ) async {
    final api = _FakeApiService(
      playableResult: 'https://cdn.example/direct-master.m3u8',
      episodes: [
        Episode(
          id: 'https://otakudesu.blog/episode/test-anime-episode-9-sub-indo/',
          title: 'Episode 9',
          order: 1,
        ),
        Episode(
          id: 'https://otakudesu.blog/episode/test-anime-episode-1-sub-indo/',
          title: 'Episode 1',
          order: 9,
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp(home: buildPage(api, buildMovie())));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -900));
    await tester.pumpAndSettle();

    await tester.tap(find.text('1'));
    await tester.pumpAndSettle();

    expect(api.playableCalls, 1);
    expect(
      api.lastPlayableEpisodeUrl,
      'https://otakudesu.blog/episode/test-anime-episode-1-sub-indo/',
    );
  });
}
