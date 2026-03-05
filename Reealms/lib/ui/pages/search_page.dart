import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:reealms_mobile/ui/pages/detail_page.dart';
import 'package:reealms_mobile/ui/widgets/movie_card.dart';
import 'package:provider/provider.dart';
import 'package:reealms_mobile/logic/app_state.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';
import 'dart:async';

class _DramaboxCategory {
  final String label;
  final String query;
  final Color color;
  final List<String> matchKeywords;

  const _DramaboxCategory({
    required this.label,
    required this.query,
    required this.color,
    this.matchKeywords = const [],
  });
}

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final TextEditingController _searchController = TextEditingController();
  List<Movie> _results = [];
  bool _isLoading = false;
  Timer? _debounce;
  String? _selectedDramaboxCategory;
  final Map<String, String> _dramaboxCategoryPosters = {};
  final Set<String> _loadingCategoryPosterQueries = {};
  bool _isPrefetchingDramaboxPosters = false;

  static const List<_DramaboxCategory> _dramaboxCategories = [
    _DramaboxCategory(
      label: "Balas Dendam",
      query: "Balas Dendam",
      color: Color(0xFF7B3633),
      matchKeywords: ["Balas Dendam", "Revenge"],
    ),
    _DramaboxCategory(
      label: "Romansa",
      query: "Romansa",
      color: Color(0xFF7F3D69),
      matchKeywords: ["Romansa", "Cinta", "Love"],
    ),
    _DramaboxCategory(
      label: "Mafia",
      query: "Mafia",
      color: Color(0xFF9B6C1D),
      matchKeywords: ["Mafia"],
    ),
    _DramaboxCategory(
      label: "CEO",
      query: "CEO",
      color: Color(0xFF0D376C),
      matchKeywords: ["CEO", "Billionaire"],
    ),
    _DramaboxCategory(
      label: "Keluarga",
      query: "Intrik Keluarga",
      color: Color(0xFF6D7707),
      matchKeywords: ["Keluarga", "Intrik Keluarga", "Family"],
    ),
    _DramaboxCategory(
      label: "Reinkarnasi",
      query: "Reinkarnasi",
      color: Color(0xFF0F617A),
      matchKeywords: ["Reinkarnasi", "Rebirth"],
    ),
    _DramaboxCategory(
      label: "Jalur Penyesalan",
      query: "Penyesalan",
      color: Color(0xFF004754),
      matchKeywords: ["Penyesalan", "All-Too-Late"],
    ),
    _DramaboxCategory(
      label: "Perselingkuhan",
      query: "Perselingkuhan",
      color: Color(0xFF7A3734),
      matchKeywords: ["Perselingkuhan", "Betrayal"],
    ),
    _DramaboxCategory(
      label: "Lintas Waktu",
      query: "Perjalanan Waktu",
      color: Color(0xFF813E66),
      matchKeywords: ["Lintas Waktu", "Perjalanan Waktu", "Time Travel"],
    ),
    _DramaboxCategory(
      label: "Intrik Istana",
      query: "Bangsawan",
      color: Color(0xFF9A6B1D),
      matchKeywords: ["Intrik Istana", "Bangsawan", "Kerajaan", "Sejarah"],
    ),
  ];

  void _onSearchChanged(String query) {
    setState(() {}); // Immediate update for clear button
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      if (query.trim().isNotEmpty) {
        _performSearch(query.trim());
      } else {
        setState(() {
          _results = [];
          _selectedDramaboxCategory = null;
        });
      }
    });
  }

  Future<void> _performSearch(String query) async {
    if (!mounted) return;
    final matchedCategoryQuery = _getMatchedCategoryQuery(query);
    setState(() {
      _isLoading = true;
      _selectedDramaboxCategory = matchedCategoryQuery;
    });
    try {
      final state = Provider.of<AppState>(context, listen: false);
      final results = await state.searchMovies(query);
      if (mounted) {
        setState(() => _results = results);
      }
    } catch (e) {
      print("Search error: $e");
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _applyDramaboxCategory(_DramaboxCategory category) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _searchController.text = category.query;
    _searchController.selection = TextSelection.fromPosition(
      TextPosition(offset: _searchController.text.length),
    );
    setState(() => _selectedDramaboxCategory = category.query);
    _performSearch(category.query);
  }

  String? _getMatchedCategoryQuery(String query) {
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) return null;

    for (final category in _dramaboxCategories) {
      final keywords = <String>{
        category.label,
        category.query,
        ...category.matchKeywords,
      };
      for (final keyword in keywords) {
        if (normalized == keyword.toLowerCase()) {
          return category.query;
        }
      }
    }
    return null;
  }

  void _ensureDramaboxCategoryPostersPrefetched() {
    if (_isPrefetchingDramaboxPosters) return;
    final missingCategories = _dramaboxCategories
        .where(
          (category) => !_dramaboxCategoryPosters.containsKey(category.query),
        )
        .toList();
    if (missingCategories.isEmpty) return;

    _isPrefetchingDramaboxPosters = true;
    unawaited(_prefetchDramaboxCategoryPosters(missingCategories));
  }

  Future<void> _prefetchDramaboxCategoryPosters(
    List<_DramaboxCategory> categories,
  ) async {
    try {
      final state = Provider.of<AppState>(context, listen: false);
      for (final category in categories) {
        if (!mounted || state.source != "dramabox") break;
        await _loadCategoryPoster(state, category.query);
        if (!mounted || state.source != "dramabox") break;
        await Future.delayed(const Duration(milliseconds: 120));
      }
    } finally {
      _isPrefetchingDramaboxPosters = false;
    }
  }

  Future<void> _loadCategoryPoster(AppState state, String query) async {
    if (_dramaboxCategoryPosters.containsKey(query) ||
        _loadingCategoryPosterQueries.contains(query) ||
        state.source != "dramabox") {
      return;
    }

    if (mounted) {
      setState(() => _loadingCategoryPosterQueries.add(query));
    } else {
      _loadingCategoryPosterQueries.add(query);
    }

    try {
      final movies = await state.searchMovies(query);
      String posterUrl = '';
      for (final movie in movies) {
        if (movie.posterUrl.isNotEmpty) {
          posterUrl = movie.posterUrl;
          break;
        }
      }

      if (!mounted) return;
      setState(() {
        _dramaboxCategoryPosters[query] = posterUrl;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _dramaboxCategoryPosters[query] = '';
      });
    } finally {
      if (mounted) {
        setState(() => _loadingCategoryPosterQueries.remove(query));
      } else {
        _loadingCategoryPosterQueries.remove(query);
      }
    }
  }

  String _resolveCategoryPoster(AppState state, _DramaboxCategory category) {
    final cachedPoster = _dramaboxCategoryPosters[category.query];
    if (cachedPoster != null && cachedPoster.isNotEmpty) {
      return cachedPoster;
    }

    final candidates = <String>{
      category.label,
      category.query,
      ...category.matchKeywords,
    };

    for (final movie in state.homeMovies) {
      if (movie.posterUrl.isEmpty) continue;
      final title = movie.title.toLowerCase();
      final genres = movie.genres.map((genre) => genre.toLowerCase()).toList();
      final hasMatch = candidates.any((keyword) {
        final keywordLower = keyword.toLowerCase();
        return title.contains(keywordLower) ||
            genres.any((genre) => genre.contains(keywordLower));
      });
      if (hasMatch) {
        return movie.posterUrl;
      }
    }
    return '';
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final source = Provider.of<AppState>(context).source;
    final isDramabox = source == "dramabox";
    final query = _searchController.text.trim();
    final showDramaboxFilters =
        isDramabox && query.isEmpty && _results.isEmpty && !_isLoading;

    if (showDramaboxFilters) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted &&
            Provider.of<AppState>(context, listen: false).source ==
                "dramabox") {
          _ensureDramaboxCategoryPostersPrefetched();
        }
      });
    }

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
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: _isLoading
                  ? _buildShimmerGrid()
                  : showDramaboxFilters
                  ? _buildDramaboxCategoryGrid()
                  : _results.isEmpty
                  ? _buildEmptyState()
                  : _buildResultsGrid(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    final source = Provider.of<AppState>(context).source;
    return Container(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 10,
        left: 20,
        right: 20,
        bottom: 20,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Cari",
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Theme.of(context).primaryColor.withOpacity(0.3),
                  ),
                ),
                child: Text(
                  source.toUpperCase(),
                  style: TextStyle(
                    color: Theme.of(context).primaryColor,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              onSubmitted: (value) {
                if (_debounce?.isActive ?? false) _debounce!.cancel();
                if (value.trim().isNotEmpty) {
                  _performSearch(value.trim());
                }
              },
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: source == "dramabox"
                    ? "Cari drama atau pilih kategori..."
                    : "Cari film, anime, atau komik...",
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white38),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.white38),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _results = [];
                            _selectedDramaboxCategory = null;
                          });
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 15),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildSourceChip("dramabox", "Dramabox", Icons.movie_filter),
                const SizedBox(width: 8),
                _buildSourceChip("otakudesu", "Anime", Icons.animation),
                const SizedBox(width: 8),
                _buildSourceChip("komik", "Komik", Icons.menu_book),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSourceChip(String id, String label, IconData icon) {
    final state = Provider.of<AppState>(context);
    final isSelected = state.source == id;
    return ChoiceChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: isSelected ? Colors.white : Colors.white38,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
            ),
          ),
        ],
      ),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          state.setSource(id);
          if (_searchController.text.isNotEmpty) {
            _performSearch(_searchController.text);
          } else {
            setState(() {
              _results = [];
              _selectedDramaboxCategory = null;
            });
          }
        }
      },
      backgroundColor: Colors.white.withOpacity(0.05),
      selectedColor: Theme.of(context).primaryColor,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : Colors.white70,
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      side: BorderSide(
        color: isSelected ? Colors.transparent : Colors.white.withOpacity(0.1),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 0),
    );
  }

  Widget _buildDramaboxCategoryGrid() {
    final state = Provider.of<AppState>(context);
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.7,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: _dramaboxCategories.length,
      itemBuilder: (context, index) {
        final category = _dramaboxCategories[index];
        final posterUrl = _resolveCategoryPoster(state, category);
        final isSelected = _selectedDramaboxCategory == category.query;
        final isPosterLoading = _loadingCategoryPosterQueries.contains(
          category.query,
        );
        return _buildDramaboxCategoryCard(
          category: category,
          posterUrl: posterUrl,
          isSelected: isSelected,
          isPosterLoading: isPosterLoading,
        );
      },
    );
  }

  Widget _buildDramaboxCategoryCard({
    required _DramaboxCategory category,
    required String posterUrl,
    required bool isSelected,
    required bool isPosterLoading,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _applyDramaboxCategory(category),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: category.color,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? Colors.white.withOpacity(0.85)
                  : Colors.white.withOpacity(0.06),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                top: -26,
                right: -24,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.08),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 82, 12),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    category.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontSize: 15.5,
                      fontWeight: FontWeight.w700,
                      height: 1.15,
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 10,
                bottom: 6,
                child: Transform.rotate(
                  angle: -0.28,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(9),
                    child: SizedBox(
                      width: 52,
                      height: 76,
                      child: posterUrl.isEmpty
                          ? (isPosterLoading
                                ? _buildCategoryPosterLoading()
                                : _buildCategoryPosterFallback())
                          : CachedNetworkImage(
                              imageUrl: posterUrl,
                              fit: BoxFit.cover,
                              placeholder: (context, url) =>
                                  _buildCategoryPosterFallback(),
                              errorWidget: (context, url, error) =>
                                  _buildCategoryPosterFallback(),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryPosterLoading() {
    return Container(
      color: Colors.white.withOpacity(0.18),
      child: const Center(
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildCategoryPosterFallback() {
    return Container(
      color: Colors.white.withOpacity(0.18),
      child: Icon(
        Icons.movie_creation_outlined,
        color: Colors.white.withOpacity(0.65),
        size: 24,
      ),
    );
  }

  Widget _buildShimmerGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.55,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: 9,
      itemBuilder: (context, index) {
        return Shimmer.fromColors(
          baseColor: Colors.white.withOpacity(0.05),
          highlightColor: Colors.white.withOpacity(0.1),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Container(width: 40, height: 10, color: Colors.white),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    final query = _searchController.text;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            query.isEmpty ? Icons.search : Icons.search_off,
            size: 80,
            color: Colors.white.withOpacity(0.1),
          ),
          const SizedBox(height: 20),
          Text(
            query.isEmpty
                ? "Cari sesuatu yang menarik"
                : "Oops! Tidak ditemukan",
            style: GoogleFonts.outfit(
              fontSize: 20,
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            query.isEmpty
                ? "Jelajahi ribuan konten berkualitas"
                : "Coba kata kunci lain atau ganti sumber",
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.55,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: _results.length,
      itemBuilder: (context, index) {
        final movie = _results[index];
        return MovieCard(
          movie: movie,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => DetailPage(movie: movie)),
            );
          },
        );
      },
    );
  }
}
