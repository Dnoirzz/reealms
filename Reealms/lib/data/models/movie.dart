class Movie {
  final String id;
  final String title;
  final String posterUrl;
  final String synopsis;
  final double rating;
  final String year;
  final String sourceType;
  final List<String> genres;
  final List<Episode> episodes;
  final int totalChapters;

  Movie({
    required this.id,
    required this.title,
    required this.posterUrl,
    this.synopsis = "",
    this.rating = 0.0,
    this.year = "",
    required this.sourceType,
    this.genres = const [],
    this.episodes = const [],
    this.totalChapters = 0,
  });

  factory Movie.fromJson(Map<String, dynamic> json, String sourceType) {
    // Parsing logic will vary slightly based on source_type,
    // but the model remains unified.
    final genreSet = <String>{};

    void addGenre(dynamic value) {
      final text = value?.toString().trim() ?? '';
      if (text.isNotEmpty) {
        genreSet.add(text);
      }
    }

    if (json['genres'] is List) {
      for (final item in json['genres'] as List) {
        addGenre(item);
      }
    } else {
      final rawGenres = json['genres']?.toString() ?? '';
      if (rawGenres.isNotEmpty) {
        for (final item in rawGenres.split(',')) {
          addGenre(item);
        }
      }
    }

    if (json['tags'] is List) {
      for (final item in json['tags'] as List) {
        addGenre(item);
      }
    }

    if (json['tagV3s'] is List) {
      for (final item in json['tagV3s'] as List) {
        if (item is Map<String, dynamic>) {
          addGenre(item['tagName']);
          addGenre(item['tagEnName']);
        }
      }
    }

    return Movie(
      id:
          json['id']?.toString() ??
          json['bookId']?.toString() ??
          json['animeId']?.toString() ??
          json['manga_id']?.toString() ??
          json['movie_id']?.toString() ??
          json['video_id']?.toString() ??
          json['shortPlayId']?.toString() ??
          json['short_play_id']?.toString() ??
          "",
      title:
          json['title'] ??
          json['bookName'] ??
          json['name'] ??
          json['manga_name'] ??
          json['movie_name'] ??
          json['video_name'] ??
          json['shortPlayName'] ??
          json['short_play_name'] ??
          "Unknown",
      posterUrl:
          json['cover_image_url'] ??
          json['poster_url'] ??
          json['poster'] ??
          json['cover'] ??
          json['manga_cover'] ??
          json['movie_poster'] ??
          json['video_cover'] ??
          json['shortPlayCover'] ??
          json['short_play_cover'] ??
          json['thumb_url'] ??
          json['coverWap'] ??
          "",
      synopsis:
          json['synopsis'] ??
          json['introduction'] ??
          json['abstract'] ??
          json['manga_description'] ??
          json['description'] ??
          json['movie_description'] ??
          "",
      rating: (json['rating'] ?? 0.0).toDouble(),
      year: json['year']?.toString() ?? "",
      sourceType: sourceType,
      genres: genreSet.toList(),
      totalChapters: json['total_chapters'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'poster_url': posterUrl,
      'synopsis': synopsis,
      'rating': rating,
      'year': year,
      'source_type': sourceType,
      'genres': genres,
      'total_chapters': totalChapters,
    };
  }
}

class Episode {
  final String id;
  final String title;
  final String streamUrl;
  final int order;
  final String duration;

  Episode({
    required this.id,
    required this.title,
    this.streamUrl = "",
    required this.order,
    this.duration = "",
  });

  factory Episode.fromJson(Map<String, dynamic> json) {
    // Dramabox specific parsing
    String? dramaboxUrl;
    if (json['cdnList'] != null &&
        json['cdnList'] is List &&
        json['cdnList'].isNotEmpty) {
      final cdn = json['cdnList'][0];
      if (cdn['videoPathList'] != null &&
          cdn['videoPathList'] is List &&
          cdn['videoPathList'].isNotEmpty) {
        final paths = cdn['videoPathList'] as List;
        final target = paths.firstWhere(
          (p) => p['quality'] == 720,
          orElse: () => paths[0],
        );
        dramaboxUrl = target['videoPath'];
      }
    }

    return Episode(
      id:
          json['id']?.toString() ??
          json['vid']?.toString() ??
          json['episodeId']?.toString() ??
          json['chapterId']?.toString() ??
          "",
      title: json['title'] ?? json['chapterName'] ?? "Episode",
      streamUrl:
          json['stream_url'] ??
          json['videoUrl'] ??
          json['main_url'] ??
          dramaboxUrl ??
          "",
      order:
          (json['order'] ??
              json['index'] ??
              json['episodeNo'] ??
              json['chapterIndex'] ??
              0) +
          (json.containsKey('chapterIndex') ? 1 : 0),
      duration: json['duration'] ?? "",
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'stream_url': streamUrl,
      'order': order,
      'duration': duration,
    };
  }
}
