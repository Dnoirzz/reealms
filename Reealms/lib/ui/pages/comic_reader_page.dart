import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:google_fonts/google_fonts.dart';

class ComicReaderPage extends StatefulWidget {
  final List<String> imageUrls;
  final String title;

  const ComicReaderPage({
    super.key,
    required this.imageUrls,
    required this.title,
  });

  @override
  State<ComicReaderPage> createState() => _ComicReaderPageState();
}

class _ComicReaderPageState extends State<ComicReaderPage> {
  bool _showAppBar = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: _showAppBar
          ? AppBar(
              backgroundColor: Colors.black54,
              elevation: 0,
              title: Text(
                widget.title,
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            )
          : null,
      body: GestureDetector(
        onTap: () => setState(() => _showAppBar = !_showAppBar),
        child: InteractiveViewer(
          minScale: 1.0,
          maxScale: 4.0,
          child: ListView.builder(
            itemCount: widget.imageUrls.length,
            padding: EdgeInsets.only(
              top: _showAppBar
                  ? kToolbarHeight + MediaQuery.of(context).padding.top
                  : 0,
            ),
            itemBuilder: (context, index) {
              return CachedNetworkImage(
                imageUrl: widget.imageUrls[index],
                fit: BoxFit.contain,
                width: double.infinity,
                placeholder: (context, url) => Container(
                  height: 500,
                  color: Colors.black,
                  child: Shimmer.fromColors(
                    baseColor: Colors.white.withOpacity(0.05),
                    highlightColor: Colors.white.withOpacity(0.1),
                    child: Container(color: Colors.white),
                  ),
                ),
                errorWidget: (context, url, error) => Container(
                  height: 200,
                  color: Colors.white.withOpacity(0.05),
                  child: const Center(
                    child: Icon(
                      Icons.broken_image_outlined,
                      color: Colors.white24,
                      size: 40,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
