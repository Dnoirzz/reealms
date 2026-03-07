import 'package:reealms_mobile/core/runtime_config.dart';

class AppConstants {
  static const String appName = "Reealms";

  // API URLs
  static const String captainBaseUrl = "https://captain.sapimu.au";
  static const String dramaboxBaseUrl =
      "https://dramabox.sansekai.my.id/api/dramabox";
  static const String komikBaseUrl = "https://api.sansekai.my.id/api";

  // For development (change to your PC IP for Anime API)
  static const String animeBaseUrl =
      "https://otakudesu-unofficial-api.vercel.app/v1"; // Verified working API

  // Default tokens
  static String get defaultCaptainToken => RuntimeConfig.captainToken;
}
