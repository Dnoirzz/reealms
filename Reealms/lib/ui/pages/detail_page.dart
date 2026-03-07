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
  bool _isPreparingAnimePlayer = false;
  bool _isFavorite = false;
  bool _isFavoriteReady = false;
  bool _isTogglingFavorite = false;
  int? _selectedEpisodeRangeIndex;

  static const int _episodeRangeSize = 30;

  String get _movieHeroTag =>
      'movie_poster_${widget.movie.id}_${widget.movie.hashCode}';

  @override
  void initState() {
    super.initState();
    _loadEpisodes();
    _loadFavoriteStatus();
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

  Future<bool> _getFavoriteStatus(String movieId) {
    if (widget.isFavoriteOverride != null) {
      return widget.isFavoriteOverride!(movieId);
    }
    return Provider.of<AppState>(context, listen: false).isFavorite(movieId);
  }

  Future<void> _toggleFavorite(Movie movie) {
    if (widget.toggleFavoriteOverride != null) {
      return widget.toggleFavoriteOverride!(movie);
    }
    return Provider.of<AppState>(context, listen: false).toggleFavorite(movie);
  }

  Future<void> _addToHistory(Movie movie) {
    if (widget.addToHistoryOverride != null) {
      return widget.addToHistoryOverride!(movie);
    }
    return Provider.of<AppState>(context, listen: false).addToHistory(movie);
  }

  Future<void> _loadFavoriteStatus() async {
    if (_isGuestUser) {
      if (!mounted) return;
      setState(() {
        _isFavorite = false;
        _isFavoriteReady = true;
      });
      return;
    }

    try {
      final isFav = await _getFavoriteStatus(widget.movie.id);
      if (!mounted) return;
      setState(() {
        _isFavorite = isFav;
        _isFavoriteReady = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isFavoriteReady = true;
      });
    }
  }

  Future<void> _handleFavoriteTap() async {
    if (_isGuestUser) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Anda perlu login untuk menyimpan konten ini jadi favorit",
          ),
        ),
      );
      return;
    }

    if (_isTogglingFavorite) return;

    final previous = _isFavorite;
    setState(() {
      _isFavorite = !previous;
      _isFavoriteReady = true;
      _isTogglingFavorite = true;
    });

    try {
      await _toggleFavorite(widget.movie);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isFavorite = previous;
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _isTogglingFavorite = false;
      });
    }
  }

  bool get _isGuestUser {
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      final user = appState.currentUser;
      return user != null && user.isAnonymous;
    } catch (_) {
      return false;
    }
  }

  bool _isGuestEpisodeRestricted(Episode ep) {
    if (!_isGuestUser) return false;

    final episodeNumber = _episodeSortKey(ep);
    if (widget.movie.sourceType == "dramabox") {
      return episodeNumber > 10;
    }
    if (widget.movie.sourceType == "otakudesu") {
      return episodeNumber != 1;
    }
    return false;
  }

  String _lockedEpisodeMessage(Episode ep) {
    if (_isGuestEpisodeRestricted(ep)) {
      if (widget.movie.sourceType == "dramabox") {
        return "Login diperlukan untuk menikmati seluruh episode";
      }
      if (widget.movie.sourceType == "otakudesu") {
        return "Login diperlukan untuk menikmati seluruh episode";
      }
    }
    return "Episode ini terkunci";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Container(
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
          if (_isPreparingAnimePlayer)
            Positioned.fill(
              child: AbsorbPointer(
                child: Container(
                  color: Colors.black.withOpacity(0.45),
                  child: Center(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 28),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.82),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(
                            width: 28,
                            height: 28,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            "Sedang mempersiapkan video player...",
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "Mohon tunggu sebentar",
                            style: GoogleFonts.outfit(
                              color: Colors.white60,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
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
          child: IconButton(
            onPressed: _handleFavoriteTap,
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 150),
              switchInCurve: Curves.easeOutBack,
              switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, animation) =>
                  ScaleTransition(scale: animation, child: child),
              child: Icon(
                _isFavorite ? Icons.favorite : Icons.favorite_border,
                key: ValueKey<bool>(_isFavorite),
                color: _isFavorite
                    ? Colors.red
                    : (_isFavoriteReady ? Colors.white : Colors.white54),
              ),
            ),
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            Hero(
              tag: _movieHeroTag,
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

  AppState? _tryGetAppState(BuildContext context, {required bool listen}) {
    try {
      return Provider.of<AppState>(context, listen: listen);
    } on ProviderNotFoundException {
      return null;
    }
  }

  Movie? _historyMovieForCurrent(AppState state) {
    if (!state.isMemberLoggedIn) return null;

    Movie? historyMovie;
    for (final movie in state.history) {
      if (movie.id == widget.movie.id) {
        historyMovie = movie;
        break;
      }
    }
    return historyMovie;
  }

  bool _isLastWatchedEpisode(Episode episode, Movie historyMovie) {
    if (historyMovie.id != widget.movie.id) return false;

    final savedEpisodeId = historyMovie.lastWatchedEpisodeId.trim();
    if (savedEpisodeId.isNotEmpty && savedEpisodeId == episode.id.trim()) {
      return true;
    }

    final savedOrder = historyMovie.lastWatchedEpisodeOrder;
    final currentOrder = _episodeSortKey(episode) > 0
        ? _episodeSortKey(episode)
        : episode.order;
    if (savedOrder != null && savedOrder > 0 && currentOrder == savedOrder) {
      return true;
    }

    final savedTitle = historyMovie.lastWatchedEpisodeTitle
        .trim()
        .toLowerCase();
    if (savedTitle.isNotEmpty &&
        savedTitle == episode.title.trim().toLowerCase()) {
      return true;
    }

    return false;
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
    if (widget.movie.sourceType == "otakudesu") {
      final animeEpisodeNumber = _extractAnimeEpisodeNumber(ep);
      if (animeEpisodeNumber > 0) return animeEpisodeNumber;
    }

    if (ep.order > 0) return ep.order;
    final match = RegExp(r'\d+').firstMatch(ep.title);
    if (match != null) {
      return int.tryParse(match.group(0) ?? '') ?? 0;
    }
    return 0;
  }

  int _extractAnimeEpisodeNumber(Episode ep) {
    final slugMatch = RegExp(
      r'episode-(\d+)-sub-indo',
      caseSensitive: false,
    ).firstMatch(ep.id);
    if (slugMatch != null) {
      return int.tryParse(slugMatch.group(1) ?? '') ?? 0;
    }

    final titleMatch = RegExp(
      r'(?:episode|ep)\s*(\d+)',
      caseSensitive: false,
    ).firstMatch(ep.title);
    if (titleMatch != null) {
      return int.tryParse(titleMatch.group(1) ?? '') ?? 0;
    }

    final fallbackDigits = RegExp(r'\d+').firstMatch(ep.title);
    if (fallbackDigits != null) {
      return int.tryParse(fallbackDigits.group(0) ?? '') ?? 0;
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
    final appState = _tryGetAppState(context, listen: true);
    final historyMovie = appState == null
        ? null
        : _historyMovieForCurrent(appState);

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
          final isLastWatched =
              historyMovie != null && _isLastWatchedEpisode(ep, historyMovie);

          return InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: isLocked
                ? () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(_lockedEpisodeMessage(ep))),
                    );
                  }
                : () => _handleEpisodeTap(ep),
            child: Ink(
              decoration: BoxDecoration(
                color: isLocked
                    ? Colors.white.withOpacity(0.03)
                    : (isLastWatched
                          ? Theme.of(context).primaryColor.withOpacity(0.2)
                          : Colors.white.withOpacity(0.05)),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isLocked
                      ? Colors.white.withOpacity(0.06)
                      : (isLastWatched
                            ? Theme.of(context).primaryColor.withOpacity(0.7)
                            : Colors.white.withOpacity(0.1)),
                ),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Text(
                      "$epNumber",
                      style: TextStyle(
                        color: isLocked
                            ? Colors.white54
                            : (isLastWatched ? Colors.white : Colors.white),
                        fontSize: 24,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (isLastWatched && !isLocked)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: const Text(
                          "Terakhir",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
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
    if (_isGuestEpisodeRestricted(ep)) return true;
    if (widget.movie.sourceType == "otakudesu") return false;
    if (widget.movie.sourceType == "komik") return false;
    return ep.streamUrl.isEmpty;
  }

  void _handleEpisodeTap(Episode ep) async {
    if (_isGuestEpisodeRestricted(ep)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_lockedEpisodeMessage(ep))));
      return;
    }

    final appState = Provider.of<AppState>(context, listen: false);
    final autoPlayNextEnabled = appState.autoplayNextEpisode;
    final autoLandscapeOnStart = appState.autoLandscapeOnStart;
    final preferredQuality = appState.defaultVideoQuality;

    final episodeOrder = _episodeSortKey(ep) > 0
        ? _episodeSortKey(ep)
        : ep.order;
    final historyMovie = widget.movie.copyWith(
      lastWatchedEpisodeId: ep.id,
      lastWatchedEpisodeTitle: ep.title,
      lastWatchedEpisodeOrder: episodeOrder > 0 ? episodeOrder : null,
    );
    _addToHistory(historyMovie);

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
      setState(() => _isPreparingAnimePlayer = true);
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
                    autoLandscapeOnStart,
                  ) ??
                  VideoPlayerPage(
                    videoUrl: directMirrorUrl,
                    title: ep.title,
                    preferLandscapeOnStart: autoLandscapeOnStart,
                    defaultQuality: preferredQuality,
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
        if (mounted) setState(() => _isPreparingAnimePlayer = false);
      }
    } else if (ep.streamUrl.isNotEmpty) {
      if (widget.movie.sourceType == "dramabox") {
        final playableEpisodes = _orderedEpisodes
            .where((item) => item.streamUrl.trim().isNotEmpty)
            .where((item) => !_isGuestEpisodeRestricted(item))
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
                autoPlayNext: autoPlayNextEnabled,
                preferLandscapeOnStart: autoLandscapeOnStart,
                defaultQuality: preferredQuality,
              ),
            ),
          );
          return;
        }
      }
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VideoPlayerPage(
            videoUrl: ep.streamUrl,
            title: ep.title,
            preferLandscapeOnStart: autoLandscapeOnStart,
            defaultQuality: preferredQuality,
          ),
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
