import 'dart:io';
import 'package:flutter/material.dart';
import 'package:reealms_mobile/logic/app_state.dart';
import 'package:reealms_mobile/ui/pages/home_page.dart';
import 'package:reealms_mobile/ui/pages/search_page.dart';
import 'package:reealms_mobile/ui/pages/history_page.dart';
import 'package:reealms_mobile/ui/pages/profile_page.dart';
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

  // Initialize Supabase (User needs to provide URL and KEY)
  await Supabase.initialize(
    url: 'https://nuyhtbnmmbrnyjznvwqa.supabase.co',
    anonKey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eWh0Ym5tbWJybnlqem52d3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjU1OTAsImV4cCI6MjA4ODIwMTU5MH0.8Hp_H--1cUzPcTddibHq0E1jUFqmCd7I4seBhatRf38',
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

class AppEntryGate extends StatelessWidget {
  const AppEntryGate({super.key});

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

        if (state.currentUser == null) {
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

  final List<Widget> _pages = [
    const HomePage(),
    const SearchPage(),
    const HistoryPage(),
    const ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, child) {
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
                if (state.history.isNotEmpty)
                  _buildContinueWatching(context, state),
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

  Widget _buildContinueWatching(BuildContext context, AppState state) {
    if (state.history.isEmpty) return const SizedBox.shrink();
    final movie = state.history.first;

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
                onPressed: () => state.removeFromHistory(movie.id),
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
