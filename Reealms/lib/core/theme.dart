import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color darkBg = Color(0xFF0F0F1A);
  static const Color cardBg = Color(0xFF1E1E2E);
  static const Color accentColor = Color(0xFF7E57C2);
  static const Color primaryText = Colors.white;
  static const Color secondaryText = Colors.white70;

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: accentColor,
      scaffoldBackgroundColor: darkBg,
      cardColor: cardBg,
      textTheme: GoogleFonts.outfitTextTheme(
        const TextTheme(
          displayLarge: TextStyle(
            color: primaryText,
            fontWeight: FontWeight.bold,
          ),
          bodyLarge: TextStyle(color: primaryText),
          bodyMedium: TextStyle(color: secondaryText),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: darkBg,
        elevation: 0,
        titleTextStyle: TextStyle(
          color: primaryText,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF161625),
        selectedItemColor: accentColor,
        unselectedItemColor: Colors.grey,
      ),
    );
  }
}
