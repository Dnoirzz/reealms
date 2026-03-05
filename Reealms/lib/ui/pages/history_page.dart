import 'package:flutter/material.dart';
import 'package:reealms_mobile/logic/app_state.dart';
import 'package:reealms_mobile/ui/pages/detail_page.dart';
import 'package:reealms_mobile/ui/widgets/movie_card.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          elevation: 0,
          title: Text(
            "Koleksi Saya",
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          actions: [
            Consumer<AppState>(
              builder: (context, state, child) {
                return Visibility(
                  visible: state.history.isNotEmpty,
                  child: IconButton(
                    icon: const Icon(
                      Icons.delete_sweep_outlined,
                      color: Colors.white70,
                    ),
                    tooltip: "Hapus Semua Riwayat",
                    onPressed: () => _showClearHistoryDialog(context, state),
                  ),
                );
              },
            ),
          ],
          bottom: TabBar(
            indicatorColor: Theme.of(context).primaryColor,
            indicatorSize: TabBarIndicatorSize.label,
            labelStyle: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.normal,
            ),
            labelColor: Colors.white,
            unselectedLabelColor: Colors.grey,
            tabs: const [
              Tab(text: "Riwayat"),
              Tab(text: "Favorit"),
            ],
          ),
        ),
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black,
                Theme.of(context).primaryColor.withOpacity(0.05),
              ],
            ),
          ),
          child: const TabBarView(children: [_HistoryList(), _FavoritesList()]),
        ),
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList();

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, child) {
        if (state.history.isEmpty) {
          return _buildEmptyState(
            context,
            Icons.history,
            "Belum ada riwayat",
            "Mulai tonton konten menarik untuk mengisi riwayat Anda.",
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 0.55,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemCount: state.history.length,
          itemBuilder: (context, index) {
            final movie = state.history[index];
            return MovieCard(
              movie: movie,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => DetailPage(movie: movie),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _FavoritesList extends StatelessWidget {
  const _FavoritesList();

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, child) {
        if (state.favorites.isEmpty) {
          return _buildEmptyState(
            context,
            Icons.bookmark_outline,
            "Belum ada favorit",
            "Simpan konten yang Anda sukai agar mudah ditemukan kembali.",
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 0.55,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemCount: state.favorites.length,
          itemBuilder: (context, index) {
            final movie = state.favorites[index];
            return MovieCard(
              movie: movie,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => DetailPage(movie: movie),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

Widget _buildEmptyState(
  BuildContext context,
  IconData icon,
  String title,
  String subtitle,
) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 80, color: Colors.white10),
        const SizedBox(height: 20),
        Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white38),
          ),
        ),
      ],
    ),
  );
}

void _showClearHistoryDialog(BuildContext context, AppState state) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: const Color(0xFF1E1E1E),
      title: Text(
        "Hapus Riwayat",
        style: GoogleFonts.outfit(
          color: Colors.white,
          fontWeight: FontWeight.bold,
        ),
      ),
      content: const Text(
        "Apakah Anda yakin ingin menghapus semua riwayat tontonan?",
        style: TextStyle(color: Colors.white70),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text("Batal", style: TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          onPressed: () {
            state.clearHistory();
            Navigator.pop(context);
          },
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red[900]),
          child: const Text("Hapus", style: TextStyle(color: Colors.white)),
        ),
      ],
    ),
  );
}
