import 'package:reealms_mobile/data/models/app_preferences.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const String _defaultQualityKey = 'settings_default_quality';
  static const String _autoplayNextEpisodeKey =
      'settings_autoplay_next_episode';
  static const String _autoLandscapeOnStartKey =
      'settings_auto_landscape_on_start';

  Future<AppPreferences> loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final defaultQuality = AppPreferences.normalizeQuality(
      prefs.getString(_defaultQualityKey) ?? AppPreferences.qualityAuto,
    );
    final autoplayNextEpisode =
        prefs.getBool(_autoplayNextEpisodeKey) ??
        AppPreferences.defaults.autoplayNextEpisode;
    final autoLandscapeOnStart =
        prefs.getBool(_autoLandscapeOnStartKey) ??
        AppPreferences.defaults.autoLandscapeOnStart;

    return AppPreferences(
      defaultQuality: defaultQuality,
      autoplayNextEpisode: autoplayNextEpisode,
      autoLandscapeOnStart: autoLandscapeOnStart,
    );
  }

  Future<void> saveDefaultQuality(String quality) async {
    final prefs = await SharedPreferences.getInstance();
    final normalized = AppPreferences.normalizeQuality(quality);
    await prefs.setString(_defaultQualityKey, normalized);
  }

  Future<void> saveAutoplayNextEpisode(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoplayNextEpisodeKey, enabled);
  }

  Future<void> saveAutoLandscapeOnStart(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoLandscapeOnStartKey, enabled);
  }
}
