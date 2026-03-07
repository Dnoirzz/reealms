import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:reealms_mobile/core/runtime_config.dart';
import 'package:reealms_mobile/data/models/movie.dart';
import 'package:reealms_mobile/logic/app_state.dart';
import 'package:reealms_mobile/ui/pages/home_page.dart';
import 'package:reealms_mobile/ui/pages/search_page.dart';
import 'package:reealms_mobile/ui/pages/history_page.dart';
import 'package:reealms_mobile/ui/pages/profile_page.dart';
import 'package:reealms_mobile/ui/pages/password_recovery_page.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:reealms_mobile/ui/pages/detail_page.dart';

class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback =
          (X509Certificate cert, String host, int port) => true;
  }
}

void main() async {
  HttpOverrides.global = MyHttpOverrides();
  WidgetsFlutterBinding.ensureInitialized();

  if (!RuntimeConfig.hasSupabaseConfig) {
    runApp(const MissingConfigApp());
    return;
  }

  // Initialize Supabase from dart-define values.
  await Supabase.initialize(
    url: RuntimeConfig.supabaseUrl,
    anonKey: RuntimeConfig.supabaseAnonKey,
  );

  final supabase = Supabase.instance.client;
  final existingUser = supabase.auth.currentUser;
  if (existingUser?.isAnonymous ?? false) {
    try {
      await supabase.auth.signOut(scope: SignOutScope.local);
    } catch (_) {}
  }

  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState(),
      child: const ReealmsApp(),
    ),
  );
}

class MissingConfigApp extends StatelessWidget {
  const MissingConfigApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Konfigurasi belum lengkap.\n'
              'Jalankan app dengan --dart-define SUPABASE_URL dan SUPABASE_ANON_KEY.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ),
        ),
      ),
    );
  }
}

class ReealmsApp extends StatelessWidget {
  const ReealmsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Reealms',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF6C5CE7),
        scaffoldBackgroundColor: Colors.black,
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6C5CE7),
          secondary: Color(0xFFa29bfe),
        ),
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
      ),
      home: const AppEntryGate(),
    );
  }
}

class AppEntryGate extends StatefulWidget {
  const AppEntryGate({super.key});

  @override
  State<AppEntryGate> createState() => _AppEntryGateState();
}

class _AppEntryGateState extends State<AppEntryGate>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      final appState = Provider.of<AppState>(context, listen: false);
      unawaited(appState.clearGuestSessionIfNeeded());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, child) {
        if (!state.isAuthReady) {
          return const Scaffold(
            backgroundColor: Colors.black,
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (state.isPasswordRecoveryFlowActive) {
          return const PasswordRecoveryPage();
        }

        if (!state.canEnterMainNavigation) {
          return const ProfilePage();
        }
        return const MainNavigationPage();
      },
    );
  }
}

class MainNavigationPage extends StatefulWidget {
  const MainNavigationPage({super.key});

  @override
  State<MainNavigationPage> createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _selectedIndex = 0;
  String? _dismissedContinueMovieKey;

  final List<Widget> _pages = [
    const HomePage(),
    const SearchPage(),
    const HistoryPage(showHistoryTab: false, showFavoritesTab: true),
    const ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, child) {
        final latestMovie = _latestContinueMovie(state);
        final latestMovieKey = latestMovie == null
            ? null
            : _continueMovieKey(latestMovie);
        final shouldShowContinueWatching =
            _selectedIndex == 0 &&
            latestMovie != null &&
            latestMovieKey != _dismissedContinueMovieKey;

        return PopScope(
          canPop: _selectedIndex == 0,
          onPopInvokedWithResult: (didPop, result) {
            if (!didPop && _selectedIndex != 0) {
              setState(() => _selectedIndex = 0);
            }
          },
          child: Scaffold(
            body: IndexedStack(index: _selectedIndex, children: _pages),
            bottomNavigationBar: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (shouldShowContinueWatching)
                  _buildContinueWatching(context, state, latestMovie!),
                BottomNavigationBar(
                  currentIndex: _selectedIndex,
                  onTap: (index) {
                    setState(() {
                      _selectedIndex = index;
                    });
                  },
                  type: BottomNavigationBarType.fixed,
                  backgroundColor: Colors.black,
                  selectedItemColor: Theme.of(context).primaryColor,
                  unselectedItemColor: Colors.grey,
                  selectedFontSize: 12,
                  unselectedFontSize: 12,
                  items: const [
                    BottomNavigationBarItem(
                      icon: Icon(Icons.home_outlined),
                      activeIcon: Icon(Icons.home),
                      label: "Beranda",
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.play_circle_outline),
                      activeIcon: Icon(Icons.play_circle),
                      label: "Jelajah",
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.collections_bookmark_outlined),
                      activeIcon: Icon(Icons.collections_bookmark),
                      label: "Koleksi",
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.person_outline),
                      activeIcon: Icon(Icons.person),
                      label: "Profil",
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Movie? _latestContinueMovie(AppState state) {
    if (state.history.isEmpty) return null;
    return state.history.first;
  }

  String _continueMovieKey(Movie movie) =>
      '${movie.id}|${movie.title}|${movie.posterUrl}';

  Widget _buildContinueWatching(
    BuildContext context,
    AppState state,
    Movie movie,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Row(
            children: [
              Hero(
                tag: 'continue_watch_${movie.id}',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: CachedNetworkImage(
                    imageUrl: movie.posterUrl,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      movie.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Lanjutkan tontonan...",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 32,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => DetailPage(movie: movie),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white.withOpacity(0.1),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: const Text(
                    "Lanjutkan",
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.close, color: Colors.white24, size: 16),
                onPressed: () {
                  setState(() {
                    _dismissedContinueMovieKey = _continueMovieKey(movie);
                  });
                },
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
