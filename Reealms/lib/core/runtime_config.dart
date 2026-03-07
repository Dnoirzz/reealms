class RuntimeConfig {
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
  );
  static const String captainToken = String.fromEnvironment('CAPTAIN_TOKEN');
  static const String authEmailRedirectTo = String.fromEnvironment(
    'AUTH_EMAIL_REDIRECT_TO',
    defaultValue: 'reealms://auth/callback',
  );

  static bool get hasSupabaseConfig =>
      supabaseUrl.trim().isNotEmpty && supabaseAnonKey.trim().isNotEmpty;
}
