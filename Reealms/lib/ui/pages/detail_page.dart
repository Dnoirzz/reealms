import 'package:flutter/material.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:reealms_mobile/data/services/api_service.dart';
import 'package:reealms_mobile/ui/pages/comic_reader_page.dart';
import 'package:reealms_mobile/ui/pages/video_player_page.dart';
import 'package:reealms_mobile/ui/pages/anime_webview_page.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:reealms_mobile/logic/app_state.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';

class DetailPage extends StatefulWidget {
  final Movie movie;
  final ApiService? apiService;
  final Future<bool> Function(String movieId)? isFavoriteOverride;
  final Future<void> Function(Movie movie)? toggleFavoriteOverride;
  final Future<void> Function(Movie movie)? addToHistoryOverride;
  final Widget Function(
    String videoUrl,
    String title,
    bool preferLandscapeOnStart,
  )?
  otakudesuVideoPlayerBuilder;
  final Widget Function(String streamUrl, String title)? animeWebViewBuilder;

  const DetailPage({
    super.key,
    required this.movie,
    this.apiService,
    this.isFavoriteOverride,
    this.toggleFavoriteOverride,
    this.addToHistoryOverride,
    this.otakudesuVideoPlayerBuilder,
    this.animeWebViewBuilder,
  });

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  late final ApiService _apiService = widget.apiService ?? ApiService();

  List<Episode> _episodes = [];
  bool _isLoading = true;
  int? _selectedEpisodeRangeIndex;

  static const int _episodeRangeSize = 30;

  @override
  void initState() {
    super.initState();
    _loadEpisodes();
  }

  Future<void> _loadEpisodes() async {
    setState(() => _isLoading = true);
    try {
      _apiService.setSource(widget.movie.sourceType);

      List<Episode> eps = [];

      if (widget.movie.sourceType == 'otakudesu') {
        // Use HTML scraping with the otakudesu_url stored in synopsis
        final animePageUrl = widget.movie.synopsis;
        eps = await _apiService.scrapeOtakudesuEpisodes(animePageUrl);
      } else {
        eps = await _apiService.getEpisodes(widget.movie.id);
      }

      if (mounted) {
        setState(() {
          _episodes = eps;
          _selectedEpisodeRangeIndex = null;
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<bool> _isFavorite(BuildContext context, String movieId) {
    if (widget.isFavoriteOverride != null) {
      return widget.isFavoriteOverride!(movieId);
    }
    return Provider.of<AppState>(context, listen: false).isFavorite(movieId);
  }

  Future<void> _toggleFavorite(BuildContext context, Movie movie) {
    if (widget.toggleFavoriteOverride != null) {
      return widget.toggleFavoriteOverride!(movie);
    }
    return Provider.of<AppState>(context, listen: false).toggleFavorite(movie);
  }

  Future<void> _addToHistory(BuildContext context, Movie movie) {
    if (widget.addToHistoryOverride != null) {
      return widget.addToHistoryOverride!(movie);
    }
    return Provider.of<AppState>(context, listen: false).addToHistory(movie);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Theme.of(context).primaryColor.withOpacity(0.05),
              Colors.black,
            ],
          ),
        ),
        child: CustomScrollView(
          slivers: [
            _buildAppBar(context),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildMainInfo(context),
                    const SizedBox(height: 24),
                    _buildSynopsis(context),
                    const SizedBox(height: 32),
                    _buildEpisodeHeader(context),
                    if (_showEpisodeRangeSelector) ...[
                      const SizedBox(height: 12),
                      _buildEpisodeRangeSelector(),
                    ],
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
            if (_isLoading)
              _buildShimmerList()
            else if (_episodes.isEmpty)
              const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(40.0),
                    child: Text(
                      "Banyak episode akan segera hadir",
                      style: TextStyle(color: Colors.white38),
                    ),
                  ),
                ),
              )
            else
              _buildEpisodeList(),
            _buildBottomSafeAreaSpacer(context),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 450,
      pinned: true,
      backgroundColor: Colors.black,
      leading: Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.5),
          shape: BoxShape.circle,
        ),
        child: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      actions: [
        Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.5),
            shape: BoxShape.circle,
          ),
          child: FutureBuilder<bool>(
            future: _isFavorite(context, widget.movie.id),
            builder: (context, snapshot) {
              final isFav = snapshot.data ?? false;
              return IconButton(
                icon: Icon(
                  isFav ? Icons.favorite : Icons.favorite_border,
                  color: isFav ? Colors.red : Colors.white,
                ),
                onPressed: () => _toggleFavorite(context, widget.movie),
              );
            },
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            Hero(
              tag: 'movie_poster_${widget.movie.id}',
              child:
                  widget.movie.posterUrl.isNotEmpty &&
                      widget.movie.posterUrl.startsWith('http')
                  ? CachedNetworkImage(
                      imageUrl: widget.movie.posterUrl,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) => Container(
                        color: Colors.grey[900],
                        child: const Icon(
                          Icons.movie,
                          color: Colors.white24,
                          size: 60,
                        ),
                      ),
                    )
                  : Container(
                      color: Colors.grey[900],
                      child: const Icon(
                        Icons.movie,
                        color: Colors.white24,
                        size: 60,
                      ),
                    ),
            ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.4),
                    Colors.black.withOpacity(0.0),
                    Colors.black.withOpacity(0.8),
                    Colors.black,
                  ],
                  stops: const [0.0, 0.4, 0.8, 1.0],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainInfo(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                widget.movie.sourceType.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.star, color: Colors.amber, size: 16),
            const SizedBox(width: 4),
            Text(
              widget.movie.rating > 0 ? widget.movie.rating.toString() : "8.5",
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          widget.movie.title,
          style: GoogleFonts.outfit(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            height: 1.1,
          ),
        ),
      ],
    );
  }

  Widget _buildSynopsis(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Sinopsis",
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          widget.movie.synopsis.isNotEmpty
              ? widget.movie.synopsis
              : "Belum ada deskripsi untuk konten ini.",
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
            height: 1.5,
          ),
        ),
      ],
    );
  }

  Widget _buildEpisodeHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          widget.movie.sourceType == "komik" ? "Daftar Chapter" : "Episode",
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        Text(
          "${_episodes.length} Bagian",
          style: TextStyle(color: Theme.of(context).primaryColor, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildEpisodeList() {
    if (_useGridEpisodeLayout) {
      return _buildEpisodeGrid();
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          final ep = _episodes[index];
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.02)),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 8,
              ),
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    "${ep.order}",
                    style: TextStyle(
                      color: Theme.of(context).primaryColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              title: Text(
                ep.title,
                style: const TextStyle(color: Colors.white, fontSize: 14),
              ),
              trailing: const Icon(
                Icons.play_circle_outline,
                color: Colors.white38,
              ),
              onTap: () => _handleEpisodeTap(ep),
            ),
          );
        }, childCount: _episodes.length),
      ),
    );
  }

  bool get _useGridEpisodeLayout => widget.movie.sourceType != "komik";

  List<Episode> get _orderedEpisodes {
    final ordered = List<Episode>.from(_episodes);
    ordered.sort((a, b) => _episodeSortKey(a).compareTo(_episodeSortKey(b)));
    return ordered;
  }

  List<List<Episode>> get _episodeRanges {
    final ordered = _orderedEpisodes;
    if (ordered.isEmpty) return const [];

    final ranges = <List<Episode>>[];
    for (var i = 0; i < ordered.length; i += _episodeRangeSize) {
      final end = (i + _episodeRangeSize > ordered.length)
          ? ordered.length
          : i + _episodeRangeSize;
      ranges.add(ordered.sublist(i, end));
    }
    return ranges;
  }

  bool get _showEpisodeRangeSelector =>
      !_isLoading && _useGridEpisodeLayout && _episodeRanges.length > 1;

  List<Episode> get _visibleEpisodes {
    final ranges = _episodeRanges;
    if (ranges.isEmpty) return const [];

    if (_selectedEpisodeRangeIndex == null) {
      return _orderedEpisodes;
    }

    final maxIndex = ranges.length - 1;
    final safeIndex = _selectedEpisodeRangeIndex! > maxIndex
        ? maxIndex
        : _selectedEpisodeRangeIndex!;
    return ranges[safeIndex];
  }

  int _episodeSortKey(Episode ep) {
    if (ep.order > 0) return ep.order;
    final match = RegExp(r'\d+').firstMatch(ep.title);
    if (match != null) {
      return int.tryParse(match.group(0) ?? '') ?? 0;
    }
    return 0;
  }

  Widget _buildEpisodeRangeSelector() {
    final ranges = _episodeRanges;
    final total = _orderedEpisodes.length;

    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: ranges.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final start = (index * _episodeRangeSize) + 1;
          final end = ((index + 1) * _episodeRangeSize > total)
              ? total
              : (index + 1) * _episodeRangeSize;
          final isSelected = index == _selectedEpisodeRangeIndex;

          return InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: () {
              setState(() {
                _selectedEpisodeRangeIndex = isSelected ? null : index;
              });
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: isSelected
                    ? Theme.of(context).primaryColor.withOpacity(0.2)
                    : Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isSelected
                      ? Theme.of(context).primaryColor.withOpacity(0.3)
                      : Colors.white.withOpacity(0.1),
                ),
              ),
              child: Center(
                child: Text(
                  "$start-$end",
                  style: TextStyle(
                    color: isSelected
                        ? Theme.of(context).primaryColor
                        : Colors.white70,
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEpisodeGrid() {
    final visibleEpisodes = _visibleEpisodes;
    final screenWidth = MediaQuery.of(context).size.width;
    final crossAxisCount = screenWidth >= 600
        ? 8
        : (screenWidth >= 430 ? 6 : 5);
    final baseOrder =
        ((_selectedEpisodeRangeIndex ?? 0) * _episodeRangeSize) + 1;

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1,
        ),
        delegate: SliverChildBuilderDelegate((context, index) {
          final ep = visibleEpisodes[index];
          final epNumber = _episodeSortKey(ep) > 0
              ? _episodeSortKey(ep)
              : (baseOrder + index);
          final isLocked = _isEpisodeLocked(ep);

          return InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: isLocked
                ? () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Episode ini terkunci")),
                    );
                  }
                : () => _handleEpisodeTap(ep),
            child: Ink(
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(isLocked ? 0.03 : 0.05),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isLocked
                      ? Colors.white.withOpacity(0.06)
                      : Colors.white.withOpacity(0.1),
                ),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Text(
                      "$epNumber",
                      style: TextStyle(
                        color: isLocked ? Colors.white54 : Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (isLocked)
                    const Positioned(
                      top: 6,
                      right: 6,
                      child: Icon(
                        Icons.lock_outline_rounded,
                        color: Colors.white54,
                        size: 14,
                      ),
                    ),
                ],
              ),
            ),
          );
        }, childCount: visibleEpisodes.length),
      ),
    );
  }

  bool _isEpisodeLocked(Episode ep) {
    if (widget.movie.sourceType == "otakudesu") return false;
    if (widget.movie.sourceType == "komik") return false;
    return ep.streamUrl.isEmpty;
  }

  void _handleEpisodeTap(Episode ep) async {
    _addToHistory(context, widget.movie);

    if (widget.movie.sourceType == "komik") {
      setState(() => _isLoading = true);
      try {
        final images = await _apiService.getComicImages(ep.id);
        if (images.isNotEmpty) {
          if (!mounted) return;
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) =>
                  ComicReaderPage(imageUrls: images, title: ep.title),
            ),
          );
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    } else if (widget.movie.sourceType == "otakudesu") {
      setState(() => _isLoading = true);
      try {
        final directMirrorUrl = await _apiService.getBestOtakudesuPlayableUrl(
          ep.id,
        );
        if (!mounted) return;

        // Preferred path: direct playable URL in native in-app video player.
        if (directMirrorUrl.isNotEmpty && directMirrorUrl.startsWith('http')) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) =>
                  widget.otakudesuVideoPlayerBuilder?.call(
                    directMirrorUrl,
                    ep.title,
                    true,
                  ) ??
                  VideoPlayerPage(
                    videoUrl: directMirrorUrl,
                    title: ep.title,
                    preferLandscapeOnStart: true,
                  ),
            ),
          );
          return;
        }

        // Fallback path: safe mirror in WebView (still inside app), but never otakudesu page.
        final safeMirrorUrl = await _apiService.getBestOtakudesuStreamUrl(
          ep.id,
        );
        if (!mounted) return;

        if (safeMirrorUrl.isNotEmpty && safeMirrorUrl.startsWith('http')) {
          final host = Uri.tryParse(safeMirrorUrl)?.host.toLowerCase() ?? '';
          if (!host.contains('otakudesu')) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) =>
                    widget.animeWebViewBuilder?.call(safeMirrorUrl, ep.title) ??
                    AnimeWebViewPage(streamUrl: safeMirrorUrl, title: ep.title),
              ),
            );
            return;
          }
        }

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Video episode ini belum bisa diputar langsung"),
          ),
        );
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    } else if (ep.streamUrl.isNotEmpty) {
      if (widget.movie.sourceType == "dramabox") {
        final playableEpisodes = _orderedEpisodes
            .where((item) => item.streamUrl.trim().isNotEmpty)
            .toList();
        if (playableEpisodes.isNotEmpty) {
          final idx = playableEpisodes.indexWhere(
            (item) =>
                item.id == ep.id ||
                (item.id.isEmpty &&
                    ep.id.isEmpty &&
                    item.order == ep.order &&
                    item.title == ep.title),
          );
          final startIndex = idx >= 0 ? idx : 0;
          final startEpisode = playableEpisodes[startIndex];
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => VideoPlayerPage(
                videoUrl: startEpisode.streamUrl,
                title: startEpisode.title,
                playlistUrls: playableEpisodes
                    .map((item) => item.streamUrl)
                    .toList(),
                playlistTitles: playableEpisodes
                    .map((item) => item.title)
                    .toList(),
                initialPlaylistIndex: startIndex,
                autoPlayNext: true,
              ),
            ),
          );
          return;
        }
      }
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) =>
              VideoPlayerPage(videoUrl: ep.streamUrl, title: ep.title),
        ),
      );
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Link tidak ditemukan")));
    }
  }

  Widget _buildShimmerList() {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) => Shimmer.fromColors(
            baseColor: Colors.white.withOpacity(0.05),
            highlightColor: Colors.white.withOpacity(0.1),
            child: Container(
              height: 60,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          childCount: 5,
        ),
      ),
    );
  }

  Widget _buildBottomSafeAreaSpacer(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final safeBottom = mediaQuery.viewPadding.bottom > mediaQuery.padding.bottom
        ? mediaQuery.viewPadding.bottom
        : mediaQuery.padding.bottom;
    return SliverToBoxAdapter(child: SizedBox(height: safeBottom + 20));
  }
}
