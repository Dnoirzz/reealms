import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:shimmer/shimmer.dart';
import 'package:google_fonts/google_fonts.dart';

class MovieCard extends StatelessWidget {
  final Movie movie;
  final VoidCallback onTap;

  const MovieCard({super.key, required this.movie, required this.onTap});

  String get _heroTag => 'movie_poster_${movie.id}_${movie.hashCode}';

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                Hero(
                  tag: _heroTag,
                  placeholderBuilder: (context, heroSize, child) => child,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child:
                        movie.posterUrl.isNotEmpty &&
                            movie.posterUrl.startsWith('http')
                        ? CachedNetworkImage(
                            imageUrl: movie.posterUrl,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Shimmer.fromColors(
                              baseColor: Colors.white.withOpacity(0.05),
                              highlightColor: Colors.white.withOpacity(0.1),
                              child: Container(color: Colors.black),
                            ),
                            errorWidget: (context, url, error) => Container(
                              color: Colors.white.withOpacity(0.05),
                              child: const Icon(
                                Icons.movie_outlined,
                                color: Colors.white24,
                                size: 30,
                              ),
                            ),
                          )
                        : Container(
                            color: Colors.white.withOpacity(0.05),
                            child: const Icon(
                              Icons.movie_outlined,
                              color: Colors.white24,
                              size: 30,
                            ),
                          ),
                  ),
                ),
                // Top Badge (e.g., Terpopuler)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.pinkAccent.withOpacity(0.8),
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(4),
                      ),
                    ),
                    child: const Text(
                      "Terpopuler",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                // Bottom View Count Badge
                Positioned(
                  bottom: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.4),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.play_arrow, color: Colors.white, size: 10),
                        SizedBox(width: 2),
                        Text(
                          "15.8M",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            movie.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            movie.genres.isNotEmpty
                ? movie.genres.first
                : (movie.sourceType == "komik"
                      ? "Manga"
                      : movie.sourceType == "otakudesu"
                      ? "Anime"
                      : "Drama"),
            style: GoogleFonts.outfit(fontSize: 10, color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }
}
