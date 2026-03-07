import 'package:flutter_test/flutter_test.dart';
import 'package:reealms_mobile/data/models/app_preferences.dart';

void main() {
  group('AppPreferences', () {
    test('normalizes invalid quality to auto', () {
      expect(
        AppPreferences.normalizeQuality('1080p'),
        AppPreferences.qualityAuto,
      );
      expect(AppPreferences.normalizeQuality(''), AppPreferences.qualityAuto);
    });

    test('keeps allowed quality values', () {
      expect(
        AppPreferences.normalizeQuality('auto'),
        AppPreferences.qualityAuto,
      );
      expect(
        AppPreferences.normalizeQuality('480p'),
        AppPreferences.quality480p,
      );
      expect(
        AppPreferences.normalizeQuality('720p'),
        AppPreferences.quality720p,
      );
    });

    test('copyWith normalizes default quality', () {
      final prefs = AppPreferences.defaults.copyWith(defaultQuality: '1080p');
      expect(prefs.defaultQuality, AppPreferences.qualityAuto);
      expect(prefs.autoplayNextEpisode, isTrue);
      expect(prefs.autoLandscapeOnStart, isFalse);
    });
  });
}
