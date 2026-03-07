class AppPreferences {
  static const String qualityAuto = 'auto';
  static const String quality480p = '480p';
  static const String quality720p = '720p';

  static const List<String> allowedQualities = [
    qualityAuto,
    quality480p,
    quality720p,
  ];

  static const AppPreferences defaults = AppPreferences(
    defaultQuality: qualityAuto,
    autoplayNextEpisode: true,
    autoLandscapeOnStart: false,
  );

  final String defaultQuality;
  final bool autoplayNextEpisode;
  final bool autoLandscapeOnStart;

  const AppPreferences({
    required this.defaultQuality,
    required this.autoplayNextEpisode,
    required this.autoLandscapeOnStart,
  });

  AppPreferences copyWith({
    String? defaultQuality,
    bool? autoplayNextEpisode,
    bool? autoLandscapeOnStart,
  }) {
    return AppPreferences(
      defaultQuality: normalizeQuality(defaultQuality ?? this.defaultQuality),
      autoplayNextEpisode: autoplayNextEpisode ?? this.autoplayNextEpisode,
      autoLandscapeOnStart: autoLandscapeOnStart ?? this.autoLandscapeOnStart,
    );
  }

  static String normalizeQuality(String value) {
    final normalized = value.trim().toLowerCase();
    if (allowedQualities.contains(normalized)) {
      return normalized;
    }
    return qualityAuto;
  }
}
