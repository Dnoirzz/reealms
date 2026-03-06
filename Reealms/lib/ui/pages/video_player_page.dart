import 'dart:convert';
import 'dart:developer' as developer;
import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:video_player/video_player.dart';

class _QualityOption {
  final String label;
  final String url;
  final int rank;

  const _QualityOption({
    required this.label,
    required this.url,
    required this.rank,
  });
}

Future<List<_QualityOption>> _parseVideoPlayerQualityOptions({
  required String sourceUrl,
  required http.Client client,
}) async {
  developer.log('[QualityParser] Received URL: $sourceUrl');

  final uri = Uri.tryParse(sourceUrl);
  final defaultOption = _QualityOption(
    label: 'Auto',
    url: sourceUrl,
    rank: 9999,
  );

  if (uri == null) {
    developer.log('[QualityParser] URI parse failed');
    return [defaultOption];
  }

  if (!uri.path.toLowerCase().endsWith('.m3u8')) {
    developer.log('[QualityParser] Not an .m3u8 URL, path: ${uri.path}');
    return [defaultOption];
  }

  developer.log('[QualityParser] Parsing m3u8 playlist');

  const requestHeaders = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  List<_QualityOption> parseMasterPlaylist(Uri playlistUri, String body) {
    if (!body.contains('#EXT-X-STREAM-INF')) return const [];

    final lines = const LineSplitter().convert(body);
    final variants = <_QualityOption>[];

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i].trim();
      if (!line.startsWith('#EXT-X-STREAM-INF')) continue;

      final heightMatch = RegExp(
        r'RESOLUTION=\d+x(\d+)',
        caseSensitive: false,
      ).firstMatch(line);
      final height = int.tryParse(heightMatch?.group(1) ?? '');

      String? nextPath;
      for (var j = i + 1; j < lines.length; j++) {
        final next = lines[j].trim();
        if (next.isEmpty || next.startsWith('#')) continue;
        nextPath = next;
        break;
      }
      if (nextPath == null) continue;

      final resolvedUrl = playlistUri.resolve(nextPath).toString();
      final label = height != null ? '${height}p' : 'Varian ${variants.length + 1}';
      variants.add(
        _QualityOption(label: label, url: resolvedUrl, rank: height ?? 0),
      );
    }

    if (variants.isEmpty) return const [];

    final byLabel = <String, _QualityOption>{};
    for (final option in variants) {
      byLabel[option.label] = option;
    }

    final sorted = byLabel.values.toList()
      ..sort((a, b) => b.rank.compareTo(a.rank));
    return sorted;
  }

  try {
    developer.log('[QualityParser] Fetching playlist: $uri');
    final response = await client
        .get(uri, headers: requestHeaders)
        .timeout(const Duration(seconds: 8));

    developer.log('[QualityParser] Response status: ${response.statusCode}');

    if (response.statusCode != 200) {
      developer.log('[QualityParser] Non-200 response, returning Auto only');
      return [defaultOption];
    }

    developer.log('[QualityParser] Response body length: ${response.body.length}');
    developer.log('[QualityParser] Response body preview: ${response.body.substring(0, response.body.length > 200 ? 200 : response.body.length)}');

    final directVariants = parseMasterPlaylist(uri, response.body);
    developer.log('[QualityParser] Direct variants found: ${directVariants.length}');

    if (directVariants.isNotEmpty) {
      developer.log('[QualityParser] Returning ${directVariants.length + 1} options (including Auto)');
      return [defaultOption, ...directVariants];
    }

    final pathSegments = uri.pathSegments;
    developer.log('[QualityParser] Path segments: ${pathSegments.length}, attempting master playlist recovery');

    final recoveryPatterns = <(Uri, String)>[];

    if (pathSegments.length >= 1) {
      final lastSegment = pathSegments.last;
      final parentUri = uri.resolve('..');

      if (lastSegment.toLowerCase().contains('index')) {
        recoveryPatterns.add((uri.resolve('../master.m3u8'), 'master.m3u8'));
        recoveryPatterns.add((uri.resolve('../playlist.m3u8'), 'playlist.m3u8'));
      }

      if (lastSegment.toLowerCase().contains('.m3u8')) {
        final segmentName = lastSegment.toLowerCase();
        if (segmentName.contains('720') || segmentName.contains('1080') || segmentName.contains('480')) {
          recoveryPatterns.add((uri.resolve('../master.m3u8'), 'master.m3u8'));
          recoveryPatterns.add((uri.resolve('../index.m3u8'), 'index.m3u8'));
          recoveryPatterns.add((uri.resolve('../../master.m3u8'), '../../master.m3u8'));
        }
      }
    }

    for (final (candidateUri, label) in recoveryPatterns) {
      developer.log('[QualityParser] Trying $label: $candidateUri');
      try {
        final response = await client
            .get(candidateUri, headers: requestHeaders)
            .timeout(const Duration(seconds: 8));

        developer.log('[QualityParser] $label response status: ${response.statusCode}');

        if (response.statusCode == 200) {
          final variants = parseMasterPlaylist(candidateUri, response.body);
          developer.log('[QualityParser] $label variants found: ${variants.length}');

          if (variants.isNotEmpty) {
            developer.log('[QualityParser] Found ${variants.length} variants via $label');
            return [defaultOption, ...variants];
          }
        }
      } catch (e) {
        developer.log('[QualityParser] $label error: $e');
      }
    }

    developer.log('[QualityParser] No variants found after recovery attempts, returning Auto only');
    return [defaultOption];
  } catch (e) {
    developer.log('[QualityParser] Exception: $e');
    return [defaultOption];
  }
}

class VideoPlayerPage extends StatefulWidget {
  final String videoUrl;
  final String title;
  final List<String>? playlistUrls;
  final List<String>? playlistTitles;
  final int? initialPlaylistIndex;
  final bool autoPlayNext;
  final bool disablePlaybackInitializationForTesting;
  final bool preferLandscapeOnStart;

  static http.Client Function() httpClientFactory = () => http.Client();

  static Future<List<String>> parseQualityOptionsForTesting({
    required String sourceUrl,
    required http.Client client,
  }) async {
    final options = await _parseVideoPlayerQualityOptions(
      sourceUrl: sourceUrl,
      client: client,
    );
    return options.map((option) => option.label).toList();
  }

  const VideoPlayerPage({
    super.key,
    required this.videoUrl,
    required this.title,
    this.playlistUrls,
    this.playlistTitles,
    this.initialPlaylistIndex,
    this.autoPlayNext = false,
    this.disablePlaybackInitializationForTesting = false,
    this.preferLandscapeOnStart = false,
  });

  @override
  State<VideoPlayerPage> createState() => _VideoPlayerPageState();
}

class _VideoPlayerPageState extends State<VideoPlayerPage> {
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;
  bool _wasInFullScreen = false;
  bool _isLoading = true;
  bool _isSwitchingQuality = false;
  String _selectedQualityLabel = 'Auto';
  List<_QualityOption> _qualityOptions = const [];
  String _currentTitle = '';
  List<String> _playlistUrls = const [];
  List<String> _playlistTitles = const [];
  int _playlistIndex = 0;
  bool _isAutoAdvancing = false;
  bool _hasHandledCurrentCompletion = false;
  double _verticalDragDelta = 0;

  static const double _swipeMinDistance = 36;
  static const double _swipeMinVelocity = 320;

  @override
  void initState() {
    super.initState();
    _initializePlaylist();
    if (widget.preferLandscapeOnStart) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      _wasInFullScreen = true;
    }
    if (widget.disablePlaybackInitializationForTesting) {
      _qualityOptions = [
        _QualityOption(label: 'Auto', url: widget.videoUrl, rank: 9999),
      ];
      _selectedQualityLabel = 'Auto';
      _isLoading = false;
      return;
    }
    _initializePlayer();
  }

  void _initializePlaylist() {
    _currentTitle = widget.title;
    final urls = widget.playlistUrls ?? const [];
    if (!widget.autoPlayNext || urls.length <= 1) {
      _playlistUrls = const [];
      _playlistTitles = const [];
      _playlistIndex = 0;
      return;
    }

    _playlistUrls = urls.where((u) => u.trim().isNotEmpty).toList();
    _playlistTitles = (widget.playlistTitles ?? const [])
        .map((t) => t.trim())
        .toList();
    if (_playlistUrls.length <= 1) {
      _playlistUrls = const [];
      _playlistTitles = const [];
      return;
    }

    final requestedIndex = widget.initialPlaylistIndex ?? 0;
    final maxIndex = _playlistUrls.length - 1;
    _playlistIndex = requestedIndex < 0
        ? 0
        : (requestedIndex > maxIndex ? maxIndex : requestedIndex);
    if (_playlistTitles.length > _playlistIndex &&
        _playlistTitles[_playlistIndex].isNotEmpty) {
      _currentTitle = _playlistTitles[_playlistIndex];
    }
  }

  Future<void> _initializePlayer() async {
    final initialUrl = _playlistUrls.isNotEmpty
        ? _playlistUrls[_playlistIndex]
        : widget.videoUrl;

    if (mounted) {
      setState(() {
        _qualityOptions = [
          _QualityOption(label: 'Auto', url: initialUrl, rank: 9999),
        ];
        _selectedQualityLabel = 'Auto';
      });
    } else {
      _qualityOptions = [
        _QualityOption(label: 'Auto', url: initialUrl, rank: 9999),
      ];
      _selectedQualityLabel = 'Auto';
    }

    final ok = await _setupPlayer(url: initialUrl, shouldAutoPlay: true);
    if (ok) {
      await _loadQualityOptions(initialUrl);
    }
  }

  Future<bool> _setupPlayer({
    required String url,
    required bool shouldAutoPlay,
    Duration? seekTo,
  }) async {
    if (mounted) {
      setState(() => _isLoading = true);
    }

    final oldChewie = _chewieController;
    final oldVideo = _videoPlayerController;
    final newVideo = VideoPlayerController.networkUrl(Uri.parse(url));

    try {
      await newVideo.initialize();
      if (seekTo != null && seekTo > Duration.zero) {
        final maxDuration = newVideo.value.duration;
        var safePosition = seekTo;
        if (maxDuration > Duration.zero && seekTo > maxDuration) {
          safePosition = maxDuration;
        }
        await newVideo.seekTo(safePosition);
      }

      final newChewie = _createChewieController(
        newVideo,
        autoPlay: shouldAutoPlay,
      );
      newChewie.addListener(_onChewieStateChanged);
      newVideo.addListener(_onVideoProgressChanged);

      if (!mounted) {
        newChewie.dispose();
        newVideo.removeListener(_onVideoProgressChanged);
        newVideo.dispose();
        return false;
      }

      setState(() {
        _videoPlayerController = newVideo;
        _chewieController = newChewie;
        _isLoading = false;
      });

      oldChewie?.removeListener(_onChewieStateChanged);
      oldVideo?.removeListener(_onVideoProgressChanged);
      oldChewie?.dispose();
      oldVideo?.dispose();
      return true;
    } catch (e) {
      newVideo.removeListener(_onVideoProgressChanged);
      newVideo.dispose();
      print("Error initializing video player: $e");
      if (mounted) {
        setState(() => _isLoading = false);
      }
      return false;
    }
  }

  ChewieController _createChewieController(
    VideoPlayerController controller, {
    required bool autoPlay,
  }) {
    return ChewieController(
      videoPlayerController: controller,
      autoPlay: autoPlay,
      looping: false,
      aspectRatio: controller.value.aspectRatio,
      showControlsOnInitialize: true,
      useRootNavigator: true,
      materialProgressColors: ChewieProgressColors(
        playedColor: const Color(0xFF6C5CE7),
        handleColor: const Color(0xFF6C5CE7),
        backgroundColor: Colors.white24,
        bufferedColor: Colors.white38,
      ),
      placeholder: Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(color: Color(0xFF6C5CE7)),
        ),
      ),
      // Hide Chewie's built-in options button because it appears inside the
      // player area; quality menu is provided from the AppBar action.
      showOptions: false,
      allowPlaybackSpeedChanging: false,
      allowFullScreen: true,
      fullScreenByDefault: false,
      // Make fullscreen behavior deterministic across Android devices.
      deviceOrientationsOnEnterFullScreen: const [
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ],
      systemOverlaysOnEnterFullScreen: const [],
      deviceOrientationsAfterFullScreen: const [DeviceOrientation.portraitUp],
      systemOverlaysAfterFullScreen: SystemUiOverlay.values,
    );
  }

  Future<void> _loadQualityOptions(String sourceUrl) async {
    developer.log('[VideoPlayerPage] Loading quality options for: $sourceUrl');

    final client = VideoPlayerPage.httpClientFactory();
    final parsedOptions = await _parseVideoPlayerQualityOptions(
      sourceUrl: sourceUrl,
      client: client,
    );
    client.close();

    developer.log('[VideoPlayerPage] Parsed ${parsedOptions.length} quality options');
    for (final option in parsedOptions) {
      developer.log('[VideoPlayerPage]   - ${option.label}: ${option.url}');
    }

    if (!mounted) return;
    setState(() {
      _qualityOptions = parsedOptions;
      _selectedQualityLabel = 'Auto';
    });
  }

  Future<void> _switchQuality(_QualityOption option) async {
    if (_isSwitchingQuality) return;

    final currentUrl = _videoPlayerController?.dataSource ?? widget.videoUrl;
    if (option.url == currentUrl) {
      if (mounted) setState(() => _selectedQualityLabel = option.label);
      return;
    }

    final previousLabel = _selectedQualityLabel;
    final previousPosition = _videoPlayerController?.value.position;
    final shouldAutoPlay = _videoPlayerController?.value.isPlaying ?? true;

    if (mounted) {
      setState(() {
        _selectedQualityLabel = option.label;
        _isSwitchingQuality = true;
      });
    }

    final switched = await _setupPlayer(
      url: option.url,
      shouldAutoPlay: shouldAutoPlay,
      seekTo: previousPosition,
    );

    if (!mounted) return;
    setState(() {
      _isSwitchingQuality = false;
      if (!switched) {
        _selectedQualityLabel = previousLabel;
      }
    });
  }

  void _onVideoProgressChanged() {
    if (!widget.autoPlayNext || _playlistUrls.length <= 1) return;
    if (_isAutoAdvancing || _isSwitchingQuality) return;
    final controller = _videoPlayerController;
    if (controller == null) return;

    final value = controller.value;
    if (!value.isInitialized) return;
    final duration = value.duration;
    if (duration <= Duration.zero) return;

    final threshold = duration - const Duration(milliseconds: 350);
    final isCompleted = value.position >= threshold;
    if (!isCompleted) {
      _hasHandledCurrentCompletion = false;
      return;
    }
    if (_hasHandledCurrentCompletion) return;

    _hasHandledCurrentCompletion = true;
    _playNextEpisode();
  }

  Future<void> _playNextEpisode() async {
    await _playEpisodeAtIndex(_playlistIndex + 1);
  }

  Future<void> _playPreviousEpisode() async {
    await _playEpisodeAtIndex(_playlistIndex - 1);
  }

  bool get _canSwipeEpisodes => widget.autoPlayNext && _playlistUrls.length > 1;

  Future<void> _playEpisodeAtIndex(int targetIndex) async {
    if (!_canSwipeEpisodes) return;
    if (targetIndex < 0 || targetIndex >= _playlistUrls.length) return;
    if (_isAutoAdvancing || _isSwitchingQuality) return;

    _isAutoAdvancing = true;
    _hasHandledCurrentCompletion = true;

    final targetUrl = _playlistUrls[targetIndex];
    final targetDefaultOption = _QualityOption(
      label: 'Auto',
      url: targetUrl,
      rank: 9999,
    );

    if (mounted) {
      setState(() {
        _selectedQualityLabel = 'Auto';
        _qualityOptions = [targetDefaultOption];
      });
    } else {
      _selectedQualityLabel = 'Auto';
      _qualityOptions = [targetDefaultOption];
    }

    final targetTitle =
        (_playlistTitles.length > targetIndex &&
            _playlistTitles[targetIndex].isNotEmpty)
        ? _playlistTitles[targetIndex]
        : _currentTitle;
    final ok = await _setupPlayer(url: targetUrl, shouldAutoPlay: true);
    if (ok) {
      if (mounted) {
        setState(() {
          _playlistIndex = targetIndex;
          _currentTitle = targetTitle;
        });
      } else {
        _playlistIndex = targetIndex;
        _currentTitle = targetTitle;
      }
      await _loadQualityOptions(targetUrl);
    }

    _isAutoAdvancing = false;
    _hasHandledCurrentCompletion = false;
  }

  void _handleVerticalSwipe(DragEndDetails details) {
    if (!_canSwipeEpisodes || _isAutoAdvancing || _isSwitchingQuality) return;

    final velocity = details.primaryVelocity ?? 0;
    final isSwipeUp =
        _verticalDragDelta <= -_swipeMinDistance ||
        velocity <= -_swipeMinVelocity;
    final isSwipeDown =
        _verticalDragDelta >= _swipeMinDistance ||
        velocity >= _swipeMinVelocity;
    _verticalDragDelta = 0;

    // Up swipe -> next episode, down swipe -> previous episode.
    if (isSwipeUp && !isSwipeDown) {
      _playNextEpisode();
    } else if (isSwipeDown && !isSwipeUp) {
      _playPreviousEpisode();
    }
  }

  Future<void> _onChewieStateChanged() async {
    final controller = _chewieController;
    if (controller == null) return;

    final nowFullScreen = controller.isFullScreen;
    if (nowFullScreen == _wasInFullScreen) return;
    _wasInFullScreen = nowFullScreen;

    if (nowFullScreen) {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      await SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      return;
    }

    await SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.edgeToEdge,
      overlays: SystemUiOverlay.values,
    );
    await SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
    ]);
  }

  @override
  void dispose() {
    _chewieController?.removeListener(_onChewieStateChanged);
    _videoPlayerController?.removeListener(_onVideoProgressChanged);
    _chewieController?.dispose();
    _videoPlayerController?.dispose();
    // Safety restore in case user exits page while fullscreen is active.
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.edgeToEdge,
      overlays: SystemUiOverlay.values,
    );
    SystemChrome.setPreferredOrientations(const [DeviceOrientation.portraitUp]);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isReady =
        !_isLoading &&
        !_isSwitchingQuality &&
        _chewieController != null &&
        _videoPlayerController != null &&
        _videoPlayerController!.value.isInitialized;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(
          _currentTitle,
          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Pilih kualitas',
            icon: const Icon(Icons.more_vert),
            onSelected: (selectedUrl) {
              if (selectedUrl.isEmpty || _qualityOptions.isEmpty) return;
              final selected = _qualityOptions.firstWhere(
                (q) => q.url == selectedUrl,
                orElse: () => _qualityOptions.first,
              );
              _switchQuality(selected);
            },
            itemBuilder: (context) {
              if (_qualityOptions.isEmpty) {
                return const [
                  PopupMenuItem<String>(
                    enabled: false,
                    value: '',
                    child: Text('Memuat kualitas...'),
                  ),
                ];
              }

              return _qualityOptions.map((option) {
                final isSelected = option.label == _selectedQualityLabel;
                return PopupMenuItem<String>(
                  value: option.url,
                  child: Row(
                    children: [
                      if (isSelected)
                        const Icon(Icons.check, size: 16)
                      else
                        const SizedBox(width: 16),
                      const SizedBox(width: 8),
                      Text(option.label),
                    ],
                  ),
                );
              }).toList();
            },
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Center(
        child: isReady
            ? AspectRatio(
                aspectRatio: _videoPlayerController!.value.aspectRatio,
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onVerticalDragStart: _canSwipeEpisodes
                      ? (_) {
                          _verticalDragDelta = 0;
                        }
                      : null,
                  onVerticalDragUpdate: _canSwipeEpisodes
                      ? (details) {
                          _verticalDragDelta += details.delta.dy;
                        }
                      : null,
                  onVerticalDragEnd: _canSwipeEpisodes
                      ? _handleVerticalSwipe
                      : null,
                  child: Chewie(controller: _chewieController!),
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(color: Color(0xFF6C5CE7)),
                  const SizedBox(height: 16),
                  Text(
                    _isSwitchingQuality
                        ? "Mengganti kualitas..."
                        : "Memuat video...",
                    style: GoogleFonts.outfit(color: Colors.white70),
                  ),
                ],
              ),
      ),
    );
  }
}
