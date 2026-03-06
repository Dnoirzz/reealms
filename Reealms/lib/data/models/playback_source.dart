class PlaybackQualityOption {
  final String label;
  final String url;
  final int rank;

  const PlaybackQualityOption({
    required this.label,
    required this.url,
    required this.rank,
  });
}

class ResolvedPlayableSource {
  final String url;
  final List<PlaybackQualityOption> qualityOptions;

  const ResolvedPlayableSource({
    required this.url,
    this.qualityOptions = const [],
  });
}
