import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:reealms_mobile/core/app_constants.dart';
import 'package:reealms_mobile/data/models/movie.dart';

class _OtakudesuMirrorCandidate {
  final String provider;
  final String href;
  final String dataContent;

  const _OtakudesuMirrorCandidate({
    required this.provider,
    required this.href,
    required this.dataContent,
  });
}

class _M3u8VariantCandidate {
  final String url;
  final int height;

  const _M3u8VariantCandidate({required this.url, required this.height});
}

class ApiService {
  final http.Client _client = http.Client();

  String _source = "dramabox";
  String _lang = "in";
  String _captainToken = AppConstants.defaultCaptainToken;
  final Map<String, List<Movie>> _dramaboxSearchCache = {};
  final Map<String, DateTime> _dramaboxSearchCacheAt = {};
  DateTime? _dramaboxRateLimitedUntil;

  static const Duration _dramaboxSearchCacheTtl = Duration(minutes: 2);
  static const Duration _dramaboxRateLimitCooldown = Duration(seconds: 65);

  Map<String, String> get _headers => {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };

  Future<http.Response?> _getAnimeApi(
    Uri url, {
    Duration timeout = const Duration(seconds: 10),
    int maxAttempts = 3,
  }) async {
    Object? lastError;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final response = await _client
            .get(url, headers: _headers)
            .timeout(timeout);
        final statusCode = response.statusCode;
        final retriable = statusCode == 429 || statusCode >= 500;

        if (!retriable || attempt == maxAttempts) {
          return response;
        }

        print(
          "Anime API temporary failure ($statusCode), retry $attempt/$maxAttempts: $url",
        );
      } catch (e) {
        lastError = e;
        if (attempt == maxAttempts) break;
        print(
          "Anime API request exception, retry $attempt/$maxAttempts: $url ($e)",
        );
      }

      await Future.delayed(Duration(milliseconds: 400 * attempt));
    }

    if (lastError != null) {
      print("Anime API request failed after retries: $url ($lastError)");
    }
    return null;
  }

  void setSource(String source) {
    _source = source.toLowerCase();
  }

  void setToken(String token) {
    _captainToken = token;
  }

  Future<List<Movie>> getHomeContent() async {
    if (_source == "dramabox") {
      return _getDramaboxContent("foryou");
    } else if (_source == "netshort") {
      return _getNetshortHome();
    } else if (_source == "komik") {
      return _getKomikContent("latest");
    } else if (_source == "otakudesu") {
      return _getAnimeContent("otakudesu/ongoing");
    }
    return [];
  }

  // KOMIK CONTENT
  Future<List<Movie>> _getKomikContent(String type) async {
    final url = Uri.parse(
      "${AppConstants.komikBaseUrl}/komik/latest?type=project",
    );
    try {
      final response = await _client.get(url);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result = data['data'] ?? [];
        return result.map((json) => Movie.fromJson(json, "komik")).toList();
      } else {
        print(
          "ApiService: Komik failed (${response.statusCode}): ${response.body.substring(0, response.body.length > 100 ? 100 : response.body.length)}",
        );
      }
    } catch (e) {
      print("Error fetching Komik: $e");
    }
    return [];
  }

  // ANIME CONTENT - using otakudesu-unofficial-api.vercel.app/v1
  Future<List<Movie>> _getAnimeContent(String endpoint) async {
    final url = Uri.parse("${AppConstants.animeBaseUrl}/ongoing-anime");
    try {
      final response = await _getAnimeApi(url);
      if (response != null && response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result = data['data'] ?? [];
        return result.map((item) => _parseOtakudesuAnime(item)).toList();
      } else {
        final preview = response == null
            ? ''
            : response.body.substring(
                0,
                response.body.length > 120 ? 120 : response.body.length,
              );
        print(
          "Anime API failed (${response?.statusCode ?? 'no response'}): $url",
        );
        if (preview.isNotEmpty) {
          print("Anime API response preview: $preview");
        }
      }
    } catch (e) {
      print("Error fetching Anime: $e");
    }
    return [];
  }

  // Parse otakudesu-unofficial-api anime item
  // synopsis stores the otakudesu_url for later HTML scraping
  Movie _parseOtakudesuAnime(dynamic item) {
    final j = item as Map<String, dynamic>;
    final String currentEpStr = j['current_episode'] ?? '';
    final int totalEp = _parseEpisodeNumber(currentEpStr);
    final String otakudesuUrl = j['otakudesu_url'] ?? '';
    final String slug = j['slug'] ?? '';
    return Movie(
      id: slug,
      title: j['title'] ?? 'Unknown',
      posterUrl: j['poster'] ?? '',
      synopsis: otakudesuUrl, // store full page URL for scraping
      rating: double.tryParse(j['rating']?.toString() ?? '0') ?? 0.0,
      year: j['newest_release_date'] ?? '',
      sourceType: 'otakudesu',
      genres: [],
      totalChapters: totalEp,
    );
  }

  int _parseEpisodeNumber(String epString) {
    final match = RegExp(r'\d+').firstMatch(epString);
    if (match != null) return int.tryParse(match.group(0)!) ?? 0;
    return 0;
  }

  static const List<String> _safeAnimeMirrorKeywords = [
    'desustream',
    'vidhide',
    'odvidhide',
    'filemoon',
    'filedon',
    'desudrive',
    'ondesu',
    'mp4upload',
    'streamwish',
    'vidsrc',
    'mega.nz',
    'stream',
    'embed',
  ];

  static const String _otakudesuDefaultNonceAction =
      'aa1208d27f29ca340c92c66d1926f13f';
  static const String _otakudesuDefaultMirrorAction =
      '2a3505c93b0035d3f455df82bf976b84';

  static const List<String> _animeMirrorProviderPriority = [
    'ondesu',
    'desustream',
    'filemoon',
    'filedon',
    'vidhide',
    'desudrive',
    'mp4upload',
    'mega',
  ];

  static const List<String> _blockedAnimeHostKeywords = [
    'qq',
    '1xbet',
    'adsterra',
    'doubleclick',
    'popads',
    'shorte',
    'ouo',
    'judi',
    'casino',
    'slot',
    'togel',
    'toto',
    'bet',
  ];

  bool _isBlockedAnimeUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    final host = uri?.host.toLowerCase() ?? '';
    if (host.isEmpty) return false;
    return _blockedAnimeHostKeywords.any(host.contains);
  }

  bool _isSafeAnimeMirrorUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    final host = uri?.host.toLowerCase() ?? '';
    if (host.isEmpty) return false;
    if (_isBlockedAnimeUrl(rawUrl)) return false;
    final path = uri?.path.toLowerCase() ?? '';
    if (path.endsWith('.css') ||
        path.endsWith('.js') ||
        path.endsWith('.png') ||
        path.endsWith('.jpg') ||
        path.endsWith('.jpeg') ||
        path.endsWith('.svg') ||
        path.endsWith('.webp')) {
      return false;
    }
    return _safeAnimeMirrorKeywords.any(host.contains);
  }

  bool _looksLikeUnavailableMirrorPage(String body) {
    if (body.isEmpty) return false;
    final content = body.toLowerCase();
    if (!content.contains('cloudflare')) return false;
    return content.contains('error code 522') ||
        content.contains('error code 523') ||
        content.contains('error code 524') ||
        (content.contains('host error') &&
            content.contains('connection timed out'));
  }

  Future<bool> _isMirrorReachable(
    String rawUrl,
    Map<String, bool> hostCache,
  ) async {
    final uri = Uri.tryParse(rawUrl);
    final host = uri?.host.toLowerCase() ?? '';
    if (uri == null || host.isEmpty) return false;
    if (!_isSafeAnimeMirrorUrl(rawUrl)) return false;

    final cached = hostCache[host];
    if (cached != null) return cached;

    try {
      final headResponse = await _client
          .head(uri, headers: _headers)
          .timeout(const Duration(seconds: 6));
      if (headResponse.statusCode >= 500) {
        hostCache[host] = false;
        return false;
      }
      if (headResponse.statusCode >= 200 && headResponse.statusCode < 400) {
        hostCache[host] = true;
        return true;
      }
    } catch (_) {
      // Fall through to GET probe.
    }

    try {
      final probeHeaders = <String, String>{
        ..._headers,
        'Range': 'bytes=0-4096',
      };
      final getResponse = await _client
          .get(uri, headers: probeHeaders)
          .timeout(const Duration(seconds: 8));
      if (getResponse.statusCode >= 500) {
        hostCache[host] = false;
        return false;
      }
      if (_looksLikeUnavailableMirrorPage(getResponse.body)) {
        hostCache[host] = false;
        return false;
      }

      hostCache[host] = true;
      return true;
    } catch (_) {
      hostCache[host] = false;
      return false;
    }
  }

  Future<String> _pickBestReachableMirror(List<String> rawCandidates) async {
    if (rawCandidates.isEmpty) return '';

    final uniqueCandidates = <String>{};
    for (final raw in rawCandidates) {
      final normalized = raw.trim();
      if (normalized.isEmpty) continue;
      if (!_isSafeAnimeMirrorUrl(normalized)) continue;
      uniqueCandidates.add(normalized);
    }
    if (uniqueCandidates.isEmpty) return '';

    final candidates = uniqueCandidates.toList();
    final hostCache = <String, bool>{};
    for (final url in candidates) {
      final reachable = await _isMirrorReachable(url, hostCache);
      if (reachable) return url;
    }

    // Fallback to the first candidate when probe cannot validate availability.
    return candidates.first;
  }

  bool _isDirectPlayableVideoUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    if (uri == null || uri.host.isEmpty) return false;
    final path = uri.path.toLowerCase();
    return path.endsWith('.m3u8') ||
        path.endsWith('.mp4') ||
        path.endsWith('.m4v') ||
        path.endsWith('.webm') ||
        path.endsWith('.mov') ||
        path.endsWith('.mkv');
  }

  int _extractQualityHint(String rawUrl) {
    final normalized = rawUrl.toLowerCase();
    for (final value in const [2160, 1440, 1080, 720, 540, 480, 360, 240]) {
      if (normalized.contains('${value}p') || normalized.contains('$value')) {
        return value;
      }
    }
    if (normalized.contains('hd')) return 720;
    return 0;
  }

  int _directPlayableScore(String rawUrl) {
    final normalized = rawUrl.toLowerCase();
    final quality = _extractQualityHint(normalized);
    final isM3u8 = normalized.contains('.m3u8');
    final isMp4 = normalized.contains('.mp4');
    // Prefer higher quality first, then prefer HLS master/variant playlists.
    return (quality * 100) + (isM3u8 ? 10 : 0) + (isMp4 ? 1 : 0);
  }

  Future<String> _resolvePreferredM3u8Variant(String playlistUrl) async {
    final uri = Uri.tryParse(playlistUrl);
    if (uri == null) return playlistUrl;
    if (!uri.path.toLowerCase().endsWith('.m3u8')) return playlistUrl;

    try {
      final response = await _client
          .get(uri, headers: _headers)
          .timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) return playlistUrl;

      final body = response.body;
      if (!body.contains('#EXT-X-STREAM-INF')) {
        return playlistUrl;
      }

      final lines = const LineSplitter().convert(body);
      final variants = <_M3u8VariantCandidate>[];

      for (var i = 0; i < lines.length; i++) {
        final line = lines[i].trim();
        if (!line.startsWith('#EXT-X-STREAM-INF')) continue;

        final heightMatch = RegExp(
          r'RESOLUTION=\d+x(\d+)',
          caseSensitive: false,
        ).firstMatch(line);
        final height = int.tryParse(heightMatch?.group(1) ?? '') ?? 0;

        String? nextPath;
        for (var j = i + 1; j < lines.length; j++) {
          final candidate = lines[j].trim();
          if (candidate.isEmpty || candidate.startsWith('#')) continue;
          nextPath = candidate;
          break;
        }
        if (nextPath == null) continue;

        final resolved = uri.resolve(nextPath).toString();
        if (!_isDirectPlayableVideoUrl(resolved)) continue;

        variants.add(_M3u8VariantCandidate(url: resolved, height: height));
      }

      if (variants.isEmpty) return playlistUrl;

      // Prefer exact 720p; fallback to highest available variant.
      for (final variant in variants) {
        if (variant.height == 720) return variant.url;
      }

      variants.sort((a, b) => b.height.compareTo(a.height));
      return variants.first.url;
    } catch (_) {
      return playlistUrl;
    }
  }

  String _normalizeExtractedUrl(String rawValue, String baseUrl) {
    var url = rawValue.trim();
    if (url.isEmpty) return '';

    // Decode common JS/HTML escaped forms.
    url = url
        .replaceAll(r'\/', '/')
        .replaceAll(r'\u0026', '&')
        .replaceAll('&amp;', '&');

    if (url.startsWith('//')) {
      return 'https:$url';
    }

    if (url.startsWith('/')) {
      final baseUri = Uri.tryParse(baseUrl);
      if (baseUri == null) return '';
      return '${baseUri.scheme}://${baseUri.host}$url';
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    return '';
  }

  Future<String> _resolveDirectPlayableUrlFromPage(String pageUrl) async {
    if (_isDirectPlayableVideoUrl(pageUrl)) return pageUrl;
    if (pageUrl.isEmpty || !pageUrl.startsWith('http')) return '';

    try {
      final response = await _client
          .get(Uri.parse(pageUrl), headers: _headers)
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) return '';

      final html = response.body;
      final candidates = <String>{};

      void collect(RegExp regex) {
        for (final match in regex.allMatches(html)) {
          final raw = match.group(1);
          if (raw == null || raw.isEmpty) continue;
          final normalized = _normalizeExtractedUrl(raw, pageUrl);
          if (normalized.isNotEmpty) candidates.add(normalized);
        }
      }

      collect(
        RegExp(
          r'''(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)''',
          caseSensitive: false,
        ),
      );
      collect(
        RegExp(
          r'''(https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*)''',
          caseSensitive: false,
        ),
      );
      collect(
        RegExp(r'''["']([^"']+\.m3u8[^"']*)["']''', caseSensitive: false),
      );
      collect(RegExp(r'''["']([^"']+\.mp4[^"']*)["']''', caseSensitive: false));

      final playableCandidates =
          candidates
              .where((url) => !_isBlockedAnimeUrl(url))
              .where(_isDirectPlayableVideoUrl)
              .toList()
            ..sort(
              (a, b) =>
                  _directPlayableScore(b).compareTo(_directPlayableScore(a)),
            );

      for (final url in playableCandidates) {
        final normalized = url.toLowerCase();
        if (normalized.contains('.m3u8')) {
          final preferredVariant = await _resolvePreferredM3u8Variant(url);
          if (preferredVariant.isNotEmpty &&
              _isDirectPlayableVideoUrl(preferredVariant)) {
            return preferredVariant;
          }
        }
        return url;
      }
    } catch (e) {
      print('Error resolving direct playable URL: $e');
    }

    return '';
  }

  /// Scrape episode list directly from Otakudesu anime HTML page.
  /// Uses otakudesu_url stored in movie.synopsis.
  Future<List<Episode>> scrapeOtakudesuEpisodes(String animePageUrl) async {
    if (animePageUrl.isEmpty || !animePageUrl.startsWith('http')) return [];
    try {
      final response = await _client
          .get(Uri.parse(animePageUrl), headers: _headers)
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) return [];
      final html = response.body;
      // Match: href="https://otakudesu.blog/episode/some-slug-sub-indo/"
      final regex = RegExp(
        r'href="(https://otakudesu\.blog/episode/([^"]+)/)"[^>]*>(.*?)</a>',
        caseSensitive: false,
        dotAll: true,
      );
      final matches = regex.allMatches(html).toList();
      if (matches.isEmpty) return [];

      // Deduplicate by URL
      final seen = <String>{};
      final episodes = <Episode>[];
      int order = 1;
      for (final m in matches) {
        final url = m.group(1)!;
        var title =
            m.group(3)?.replaceAll(RegExp(r'<[^>]+>'), '').trim() ??
            'Episode $order';
        // Clean up title - keep only "Episode N" format
        final epNumMatch = RegExp(r'[Ee]pisode\s*(\d+)').firstMatch(title);
        if (epNumMatch != null) {
          title = 'Episode ${epNumMatch.group(1)}';
        }
        if (!seen.contains(url)) {
          seen.add(url);
          episodes.add(
            Episode(
              id: url, // use full URL as ID for direct opening
              title: title,
              order: order++,
              streamUrl: '',
            ),
          );
        }
      }
      // Reverse so newest episode comes first
      return episodes.reversed.toList();
    } catch (e) {
      print("Error scraping Otakudesu episodes: $e");
    }
    return [];
  }

  /// Get the best 720p mirror URL from an episode page HTML.
  /// Prioritizes reliable providers like Vidhide and Filemoon.
  String _extractHtmlAttribute(String attrs, String attrName) {
    final regex = RegExp(
      '${RegExp.escape(attrName)}\\s*=\\s*["\']([^"\']+)["\']',
      caseSensitive: false,
    );
    return (regex.firstMatch(attrs)?.group(1) ?? '').trim();
  }

  String _decodeBase64Loose(String rawValue) {
    if (rawValue.isEmpty) return '';
    var normalized = rawValue.trim().replaceAll('-', '+').replaceAll('_', '/');
    final mod = normalized.length % 4;
    if (mod != 0) {
      normalized += List.filled(4 - mod, '=').join();
    }
    try {
      return utf8.decode(base64.decode(normalized));
    } catch (_) {
      return '';
    }
  }

  int _mirrorPriorityScore(String providerName) {
    final provider = providerName.toLowerCase();
    for (var i = 0; i < _animeMirrorProviderPriority.length; i++) {
      if (provider.contains(_animeMirrorProviderPriority[i])) return i;
    }
    return _animeMirrorProviderPriority.length + 1;
  }

  String _extractOtakudesuNonceAction(String html) {
    final match = RegExp(
      r'''data\s*:\s*\{\s*action\s*:\s*["']([a-f0-9]{32})["']\s*\}''',
      caseSensitive: false,
    ).firstMatch(html);
    return match?.group(1) ?? _otakudesuDefaultNonceAction;
  }

  String _extractOtakudesuMirrorAction(String html) {
    final match = RegExp(
      r'''nonce\s*:\s*(?:window\.__x__nonce|a)\s*,\s*action\s*:\s*["']([a-f0-9]{32})["']''',
      caseSensitive: false,
    ).firstMatch(html);
    return match?.group(1) ?? _otakudesuDefaultMirrorAction;
  }

  Future<String> _fetchOtakudesuNonce(Uri ajaxUri, String nonceAction) async {
    try {
      final response = await _client
          .post(ajaxUri, headers: _headers, body: {'action': nonceAction})
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) return '';
      final body = json.decode(response.body);
      if (body is Map) {
        return (body['data'] ?? '').toString().trim();
      }
    } catch (_) {}
    return '';
  }

  List<_OtakudesuMirrorCandidate> _extractMirrorCandidatesFromQualitySection(
    String html,
    String sectionClass,
  ) {
    final sectionRegex = RegExp(
      '<ul[^>]*class=["\'][^"\']*\\b${RegExp.escape(sectionClass)}\\b[^"\']*["\'][^>]*>(.*?)</ul>',
      caseSensitive: false,
      dotAll: true,
    );
    final sectionMatch = sectionRegex.firstMatch(html);
    final sectionHtml = sectionMatch?.group(1);
    if (sectionHtml == null || sectionHtml.isEmpty) return const [];

    final anchors = RegExp(
      r'<a([^>]*)>(.*?)</a>',
      caseSensitive: false,
      dotAll: true,
    );

    final candidates = <_OtakudesuMirrorCandidate>[];
    for (final match in anchors.allMatches(sectionHtml)) {
      final attrs = match.group(1) ?? '';
      final inner = match.group(2) ?? '';
      final href = _extractHtmlAttribute(attrs, 'href');
      final dataContent = _extractHtmlAttribute(attrs, 'data-content');
      final provider = inner
          .replaceAll(RegExp(r'<[^>]+>'), ' ')
          .trim()
          .toLowerCase();
      if (href.isEmpty && dataContent.isEmpty) continue;
      candidates.add(
        _OtakudesuMirrorCandidate(
          provider: provider,
          href: href,
          dataContent: dataContent,
        ),
      );
    }
    return candidates;
  }

  Future<String> _resolveOtakudesuAjaxMirrorUrl({
    required Uri ajaxUri,
    required String dataContent,
    required String nonce,
    required String mirrorAction,
    required String Function(String) makeAbsolute,
  }) async {
    if (dataContent.isEmpty || nonce.isEmpty) return '';

    try {
      final decodedPayload = _decodeBase64Loose(dataContent);
      if (decodedPayload.isEmpty) return '';

      final payloadMap = json.decode(decodedPayload);
      if (payloadMap is! Map) return '';

      final body = <String, String>{};
      for (final entry in payloadMap.entries) {
        body[entry.key.toString()] = entry.value.toString();
      }
      body['nonce'] = nonce;
      body['action'] = mirrorAction;

      final response = await _client
          .post(ajaxUri, headers: _headers, body: body)
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) return '';

      final jsonBody = json.decode(response.body);
      if (jsonBody is! Map) return '';
      final encodedHtml = (jsonBody['data'] ?? '').toString();
      final mirrorHtml = _decodeBase64Loose(encodedHtml);
      if (mirrorHtml.isEmpty) return '';

      final iframeMatch = RegExp(
        r'''<iframe[^>]+src=["']([^"']+)["']''',
        caseSensitive: false,
      ).firstMatch(mirrorHtml);
      if (iframeMatch != null) {
        final resolved = makeAbsolute(iframeMatch.group(1)!);
        if (_isSafeAnimeMirrorUrl(resolved)) return resolved;
      }

      final absoluteUrlRegex = RegExp(
        r'''https?:\/\/[^"'\s<]+''',
        caseSensitive: false,
      );
      for (final match in absoluteUrlRegex.allMatches(mirrorHtml)) {
        final candidate = makeAbsolute(
          (match.group(0) ?? '').replaceAll('&amp;', '&').trim(),
        );
        if (_isSafeAnimeMirrorUrl(candidate)) return candidate;
      }
    } catch (_) {}

    return '';
  }

  Future<String> getOtakudesu720pStreamUrl(String episodeUrl) async {
    if (episodeUrl.isEmpty || !episodeUrl.startsWith('http')) return '';
    try {
      final response = await _client
          .get(Uri.parse(episodeUrl), headers: _headers)
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) return '';

      final html = response.body;

      String makeAbsolute(String url) {
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:$url';
        final uri = Uri.parse(episodeUrl);
        final base = "${uri.scheme}://${uri.host}";
        if (url.startsWith('?')) return episodeUrl.split('?').first + url;
        if (url.startsWith('/')) return base + url;
        return url;
      }

      // 1) Resolve links inside m720p section first.
      // New pages expose mirror params in `data-content`, which must be
      // exchanged via admin-ajax before we get the real mirror URL.
      final sectionCandidates = _extractMirrorCandidatesFromQualitySection(
        html,
        'm720p',
      );
      if (sectionCandidates.isNotEmpty) {
        final sectionResolvedUrls = <String>[];
        final prioritized = sectionCandidates.toList()
          ..sort((a, b) {
            final scoreA = _mirrorPriorityScore(a.provider);
            final scoreB = _mirrorPriorityScore(b.provider);
            if (scoreA != scoreB) return scoreA.compareTo(scoreB);
            return a.provider.compareTo(b.provider);
          });

        final episodeUri = Uri.tryParse(episodeUrl);
        final ajaxUri = episodeUri == null
            ? null
            : Uri.parse(
                '${episodeUri.scheme}://${episodeUri.host}/wp-admin/admin-ajax.php',
              );
        final nonceAction = _extractOtakudesuNonceAction(html);
        final mirrorAction = _extractOtakudesuMirrorAction(html);
        String? nonceCache;

        for (final candidate in prioritized) {
          if (candidate.href.isNotEmpty && candidate.href != '#') {
            final resolved = makeAbsolute(candidate.href);
            if (_isSafeAnimeMirrorUrl(resolved)) {
              sectionResolvedUrls.add(resolved);
            }
          }

          if (candidate.dataContent.isEmpty || ajaxUri == null) continue;
          nonceCache ??= await _fetchOtakudesuNonce(ajaxUri, nonceAction);
          if (nonceCache.isEmpty) continue;

          final resolved = await _resolveOtakudesuAjaxMirrorUrl(
            ajaxUri: ajaxUri,
            dataContent: candidate.dataContent,
            nonce: nonceCache,
            mirrorAction: mirrorAction,
            makeAbsolute: makeAbsolute,
          );
          if (resolved.isNotEmpty) sectionResolvedUrls.add(resolved);
        }

        final pickedSectionMirror = await _pickBestReachableMirror(
          sectionResolvedUrls,
        );
        if (pickedSectionMirror.isNotEmpty) {
          return pickedSectionMirror;
        }
      }

      // 2) Quality-aware quick-path from absolute links embedded in HTML.
      final absoluteUrlRegex = RegExp(
        r'''https?:\/\/[^"'\s<]+''',
        caseSensitive: false,
      );
      final safeAbsoluteUrls = <String>[];
      for (final m in absoluteUrlRegex.allMatches(html)) {
        final candidate = (m.group(0) ?? '').replaceAll('&amp;', '&').trim();
        if (_isSafeAnimeMirrorUrl(candidate)) {
          safeAbsoluteUrls.add(candidate);
        }
      }

      final preferredAbsoluteUrls = <String>[];
      final otherAbsoluteUrls = <String>[];
      for (final candidate in safeAbsoluteUrls) {
        final normalized = candidate.toLowerCase();
        if (normalized.contains('720') ||
            normalized.contains('hd') ||
            normalized.contains('ondesuhd')) {
          preferredAbsoluteUrls.add(candidate);
        } else {
          otherAbsoluteUrls.add(candidate);
        }
      }

      final pickedAbsoluteMirror = await _pickBestReachableMirror([
        ...preferredAbsoluteUrls,
        ...otherAbsoluteUrls,
      ]);
      if (pickedAbsoluteMirror.isNotEmpty) {
        return pickedAbsoluteMirror;
      }

      // 3) Global fallback - any link with 720p text if section check fails.
      final any720Regex = RegExp(
        r'<a[^>]+href=["'
        ']([^"'
        ']+)["'
        '][^>]*>.*?720p.*?</a>',
        caseSensitive: false,
        dotAll: true,
      );
      final any720Match = any720Regex.firstMatch(html);
      if (any720Match != null) {
        final rawUrl = any720Match.group(1)!;
        if (rawUrl != '#') {
          final resolved = makeAbsolute(rawUrl);
          if (_isSafeAnimeMirrorUrl(resolved)) {
            final pickedFallbackMirror = await _pickBestReachableMirror([
              resolved,
            ]);
            if (pickedFallbackMirror.isNotEmpty) {
              return pickedFallbackMirror;
            }
          }
        }
      }
    } catch (e) {
      print("Error scraping 720p URL: $e");
    }
    print("Anime mirror fallback: no safe 720p mirror found");
    return '';
  }

  String _extractEpisodeSlugFromUrl(String episodeUrl) {
    final uri = Uri.tryParse(episodeUrl);
    if (uri == null) return '';
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    final idx = segments.indexOf('episode');
    if (idx >= 0 && idx + 1 < segments.length) {
      return segments[idx + 1];
    }
    return segments.isNotEmpty ? segments.last : '';
  }

  /// Resolve best otakudesu stream URL safely.
  /// 1) Prefer HTML scraping 720p mirror selection.
  /// 2) Fallback to direct streaming URL from API.
  Future<String> getBestOtakudesuStreamUrl(String episodeUrl) async {
    if (episodeUrl.isEmpty || !episodeUrl.startsWith('http')) return '';

    final scrapedUrl = await getOtakudesu720pStreamUrl(episodeUrl);
    if (scrapedUrl.isNotEmpty && _isSafeAnimeMirrorUrl(scrapedUrl)) {
      return scrapedUrl;
    }

    final slug = _extractEpisodeSlugFromUrl(episodeUrl);
    if (slug.isNotEmpty) {
      final directApiUrl = await getAnimeStreamUrl(slug);
      if (directApiUrl.isNotEmpty && _isSafeAnimeMirrorUrl(directApiUrl)) {
        return directApiUrl;
      }
    }

    return '';
  }

  /// Return direct playable URL for in-app video player.
  /// Will not return Otakudesu episode pages.
  Future<String> getBestOtakudesuPlayableUrl(String episodeUrl) async {
    final streamUrl = await getBestOtakudesuStreamUrl(episodeUrl);
    if (streamUrl.isEmpty) return '';

    if (_isDirectPlayableVideoUrl(streamUrl)) {
      if (streamUrl.toLowerCase().contains('.m3u8')) {
        final preferredVariant = await _resolvePreferredM3u8Variant(streamUrl);
        if (preferredVariant.isNotEmpty) return preferredVariant;
      }
      return streamUrl;
    }

    final directFromPage = await _resolveDirectPlayableUrlFromPage(streamUrl);
    if (directFromPage.isNotEmpty) {
      return directFromPage;
    }

    return '';
  }

  // DRAMABOX LATEST (Using existing logic from Python)
  Future<List<Movie>> _getDramaboxContent(String type) async {
    final endpoint = type == "foryou" ? "foryou" : "latest";
    final url = Uri.parse(
      "${AppConstants.dramaboxBaseUrl}/$endpoint?lang=$_lang",
    );

    try {
      final response = await _client.get(url);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        List<dynamic> data = [];
        if (decoded is List) {
          data = decoded;
        } else if (decoded is Map) {
          data = decoded['data'] ?? decoded['result'] ?? decoded['books'] ?? [];
        }
        return data.map((json) => Movie.fromJson(json, "dramabox")).toList();
      } else {
        print(
          "ApiService: Dramabox failed (${response.statusCode}): ${response.body.substring(0, response.body.length > 100 ? 100 : response.body.length)}",
        );
      }
    } catch (e) {
      print("Error fetching Dramabox $type: $e");
    }
    return [];
  }

  // NETSHORT HOME (Exactly like Python: /api/v1/explore)
  Future<List<Movie>> _getNetshortHome() async {
    final url = Uri.parse(
      "${AppConstants.captainBaseUrl}/netshort/api/v1/explore?offset=0&limit=20",
    );

    try {
      final response = await _client.get(
        url,
        headers: {..._headers, 'Authorization': 'Bearer $_captainToken'},
      );

      if (response.statusCode == 200) {
        final dynamic decoded = json.decode(response.body);
        if (decoded is Map && decoded['success'] == true) {
          final List<dynamic> result = decoded['data']?['result'] ?? [];
          return _parseNetshortMovies(result);
        }
      } else {
        print(
          "ApiService: Netshort home failed (${response.statusCode}): ${response.body}",
        );
      }
    } catch (e) {
      print("ApiService: Netshort home Exception: $e");
    }
    return [];
  }

  // NETSHORT SEARCH (Exactly like Python: /api/v1/find)
  Future<List<Movie>> _searchNetshort(String query) async {
    final encodedQuery = Uri.encodeComponent(query);
    final url = Uri.parse(
      "${AppConstants.captainBaseUrl}/netshort/api/v1/find?q=$encodedQuery&page=1&size=20",
    );

    try {
      final response = await _client.get(
        url,
        headers: {..._headers, 'Authorization': 'Bearer $_captainToken'},
      );

      if (response.statusCode == 200) {
        final dynamic decoded = json.decode(response.body);
        if (decoded is Map && decoded['success'] == true) {
          final dynamic rawData = decoded['data'];
          List<dynamic> result = [];
          if (rawData is List) {
            result = rawData;
          } else if (rawData is Map) {
            result = rawData['result'] ?? [];
          }
          return _parseNetshortMovies(result);
        }
      }
    } catch (e) {
      print("ApiService: Netshort search failed ($url): $e");
    }
    return [];
  }

  // NETSHORT MOVIE PARSER (Helper)
  List<Movie> _parseNetshortMovies(List<dynamic> items) {
    return items.where((item) => item is Map).map((item) {
      final json = item as Map<String, dynamic>;
      // Logic matching Python's _parse_netshort_movies
      final String id = (json['id'] ?? json['shortPlayId'] ?? "").toString();
      final String title = (json['name'] ?? json['shortPlayName'] ?? "Unknown")
          .toString()
          .replaceAll(RegExp(r'<[^>]*>|&[^;]+;'), '');
      final String poster = (json['cover'] ?? json['shortPlayCover'] ?? "")
          .toString();
      final String synopsis =
          (json['introduction'] ?? json['shotIntroduce'] ?? "").toString();

      return Movie(
        id: id,
        title: title,
        posterUrl: poster,
        synopsis: synopsis,
        sourceType: "netshort",
      );
    }).toList();
  }

  Future<List<Episode>> getEpisodes(String movieId) async {
    if (_source == "dramabox") {
      return _getDramaboxEpisodes(movieId);
    } else if (_source == "komik") {
      return _getKomikChapters(movieId);
    } else if (_source == "otakudesu") {
      return _getAnimeEpisodes(movieId);
    }
    return [];
  }

  Future<List<Episode>> _getKomikChapters(String mangaId) async {
    final url = Uri.parse(
      "${AppConstants.komikBaseUrl}/komik/chapterlist?manga_id=$mangaId",
    );
    try {
      final response = await _client.get(url, headers: _headers);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result = data['data'] ?? [];
        return result
            .map((json) => Episode.fromJson(json))
            .toList()
            .reversed
            .toList();
      }
    } catch (e) {
      print("Error fetching Komik chapters: $e");
    }
    return [];
  }

  Future<List<Episode>> _getAnimeEpisodes(String animeSlug) async {
    // Try the API detail endpoint first (5s timeout)
    try {
      final url = Uri.parse("${AppConstants.animeBaseUrl}/anime/$animeSlug");
      final response = await _getAnimeApi(
        url,
        timeout: const Duration(seconds: 6),
      );
      if (response != null && response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result =
            data['data']?['episode_list'] ??
            data['data']?['episodes'] ??
            data['episodeList'] ??
            [];
        if (result.isNotEmpty) {
          return result
              .asMap()
              .entries
              .map((entry) {
                final ep = entry.value as Map<String, dynamic>;
                return Episode(
                  id:
                      ep['slug'] ??
                      ep['episode_id'] ??
                      ep['id']?.toString() ??
                      '',
                  title:
                      ep['episode'] ??
                      ep['title'] ??
                      "Episode ${entry.key + 1}",
                  order: entry.key + 1,
                  streamUrl: '',
                );
              })
              .toList()
              .reversed
              .toList();
        }
      }
    } catch (e) {
      print("Anime detail API failed for $animeSlug: $e");
    }

    // Fallback: build Otakudesu episode page URLs directly using slug pattern
    // We need the Movie to know totalChapters, so this is called from DetailPage
    // Return empty here; DetailPage will call generateEpisodesForAnime separately
    return [];
  }

  /// Generate episode list offline using Otakudesu URL pattern.
  /// Call this from DetailPage when _getAnimeEpisodes returns empty.
  List<Episode> generateEpisodesForAnime(String animeSlug, int count) {
    if (count <= 0) return [];
    // Strip trailing sub-indo suffix to build episode slugs
    final String base = animeSlug.replaceAll(RegExp(r'-sub-indo$'), '');
    return List.generate(count, (i) {
      final epNum = i + 1;
      // Otakudesu episode URL slug pattern: {base}-episode-{n}-sub-indo
      final episodeSlug = '$base-episode-$epNum-sub-indo';
      return Episode(
        id: episodeSlug,
        title: 'Episode $epNum',
        order: epNum,
        streamUrl: '',
      );
    }).reversed.toList(); // newest first
  }

  // Resolve anime episode slug to embed/streaming URL
  Future<String> getAnimeStreamUrl(String episodeSlug) async {
    final url = Uri.parse("${AppConstants.animeBaseUrl}/episode/$episodeSlug");
    try {
      final response = await _getAnimeApi(
        url,
        timeout: const Duration(seconds: 8),
      );
      if (response != null && response.statusCode == 200) {
        final data = json.decode(response.body);
        final candidates = <dynamic>[
          data['data']?['details']?['defaultStreamingUrl'],
          data['details']?['defaultStreamingUrl'],
          data['data']?['defaultStreamingUrl'],
          data['defaultStreamingUrl'],
          data['data']?['embed_url'],
          data['data']?['stream_url'],
          data['data']?['url'],
          data['embed_url'],
          data['stream_url'],
          data['url'],
        ];

        for (final candidate in candidates) {
          final streamUrl = (candidate ?? '').toString().trim();
          if (streamUrl.startsWith('http') && !_isBlockedAnimeUrl(streamUrl)) {
            return streamUrl;
          }
        }
      }
    } catch (e) {
      print("Error fetching Anime stream URL: $e");
    }
    return '';
  }

  Future<List<Episode>> _getDramaboxEpisodes(String bookId) async {
    final url = Uri.parse(
      "${AppConstants.dramaboxBaseUrl}/allepisode?bookId=$bookId&lang=$_lang",
    );

    try {
      final response = await _client.get(url, headers: _headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => Episode.fromJson(json)).toList();
      }
    } catch (e) {
      print("Error fetching Dramabox episodes: $e");
    }
    return [];
  }

  Future<List<String>> getComicImages(String chapterId) async {
    final url = Uri.parse(
      "${AppConstants.komikBaseUrl}/komik/getimage?chapter_id=$chapterId",
    );
    try {
      final response = await _client.get(url, headers: _headers);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result = data['data']['chapter']['data'] ?? [];
        return result.cast<String>();
      }
    } catch (e) {
      print("Error fetching Comic images: $e");
    }
    return [];
  }

  Future<List<Movie>> search(String query) async {
    if (_source == "dramabox") {
      return _searchDramabox(query);
    } else if (_source == "netshort") {
      return _searchNetshort(query);
    } else if (_source == "komik") {
      return _searchKomik(query);
    } else if (_source == "otakudesu") {
      return _searchAnime(query);
    }
    return [];
  }

  Future<List<Movie>> _searchDramabox(String query) async {
    final trimmedQuery = query.trim();
    if (trimmedQuery.isEmpty) return [];

    final normalizedKey = trimmedQuery.toLowerCase();
    final now = DateTime.now();

    final cachedAt = _dramaboxSearchCacheAt[normalizedKey];
    final cached = _dramaboxSearchCache[normalizedKey];
    if (cachedAt != null &&
        cached != null &&
        now.difference(cachedAt) <= _dramaboxSearchCacheTtl) {
      return cached;
    }

    if (_dramaboxRateLimitedUntil != null &&
        now.isBefore(_dramaboxRateLimitedUntil!)) {
      return cached ?? [];
    }

    final encodedQuery = Uri.encodeComponent(trimmedQuery);
    // Use `query` first because Dramabox now requires this parameter.
    final urls = [
      Uri.parse(
        "${AppConstants.dramaboxBaseUrl}/search?query=$encodedQuery&lang=$_lang",
      ),
      Uri.parse(
        "${AppConstants.dramaboxBaseUrl}/search?q=$encodedQuery&lang=$_lang",
      ),
    ];

    for (var url in urls) {
      try {
        final response = await _client.get(url, headers: _headers);
        if (response.statusCode == 429) {
          _dramaboxRateLimitedUntil = DateTime.now().add(
            _dramaboxRateLimitCooldown,
          );
          print(
            "ApiService: Dramabox search rate-limited, pausing new search requests temporarily.",
          );
          return cached ?? [];
        }

        if (response.statusCode != 200) {
          continue;
        }

        final dynamic decoded = json.decode(response.body);
        List<dynamic> data = [];

        if (decoded is List) {
          data = decoded;
        } else if (decoded is Map) {
          data =
              decoded['data'] ??
              decoded['result'] ??
              decoded['books'] ??
              decoded['list'] ??
              decoded['bookList'] ??
              decoded['shortPlayList'] ??
              decoded['items'] ??
              [];
        }

        final movies = data
            .whereType<Map<String, dynamic>>()
            .map((json) => Movie.fromJson(json, "dramabox"))
            .toList();

        _dramaboxSearchCache[normalizedKey] = movies;
        _dramaboxSearchCacheAt[normalizedKey] = DateTime.now();
        return movies;
      } catch (e) {
        print("ApiService: Try search $url failed: $e");
      }
    }

    return cached ?? [];
  }

  // Removed _searchNetshort from here as it's now integrated above

  Future<List<Movie>> _searchKomik(String query) async {
    final encodedQuery = Uri.encodeComponent(query);
    final url = Uri.parse(
      "${AppConstants.komikBaseUrl}/komik/search?query=$encodedQuery",
    );
    try {
      final response = await _client.get(url, headers: _headers);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result = data['data'] ?? [];
        return result.map((json) => Movie.fromJson(json, "komik")).toList();
      }
    } catch (e) {
      print("Error searching Komik: $e");
    }
    return [];
  }

  Future<List<Movie>> _searchAnime(String query) async {
    final encodedQuery = Uri.encodeComponent(query);
    final url = Uri.parse("${AppConstants.animeBaseUrl}/search/$encodedQuery");
    try {
      final response = await _getAnimeApi(
        url,
        timeout: const Duration(seconds: 8),
      );
      if (response != null && response.statusCode == 200) {
        final data = json.decode(response.body);
        final List<dynamic> result = data['data'] ?? [];
        return result.map((item) => _parseOtakudesuAnime(item)).toList();
      }
    } catch (e) {
      print("Error searching Anime: $e");
    }
    return [];
  }

  Future<String> getStreamUrl(String movieId, int chapterIndex) async {
    if (_source == "dramabox") {
      final episodes = await _getDramaboxEpisodes(movieId);
      final ep = episodes.firstWhere(
        (e) => e.order == chapterIndex + 1,
        orElse: () => episodes.first,
      );
      return ep.streamUrl;
    }
    return "";
  }
}
