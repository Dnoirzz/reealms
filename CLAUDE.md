# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reealms is a Flutter-based premium streaming application that aggregates Drama (Dramabox), Anime (Otakudesu), and Comic content in a single mobile app. The app features cloud synchronization via Supabase, guest access, and a dark space aesthetic theme.

## Repository Structure

This is a monorepo containing:
- **Reealms/** - Main Flutter mobile application
- **otakudesu_scrap/** - Python web scraper for extracting 720p anime video links from Otakudesu

## Development Commands

### Flutter App (Reealms/)

Navigate to the Reealms directory first: `cd Reealms`

**Build & Run:**
```bash
# Install dependencies
flutter pub get

# Run in debug mode
flutter run

# Build release APK for Android
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# Build for other platforms
flutter build ios --release
flutter build web --release
```

**Testing & Analysis:**
```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/widget_test.dart

# Analyze code for issues
flutter analyze

# Format code
dart format lib/
```

**Icon Generation:**
```bash
# Generate app icons from assets/images/logo.png
flutter pub run flutter_launcher_icons
```

### Python Scraper (otakudesu_scrap/)

```bash
cd otakudesu_scrap

# Run the scraper (edit anime_url in script first)
python scraper_720p.py
```

## Architecture

### Flutter App Structure

The app follows a **layered architecture** with clear separation of concerns:

```
lib/
├── core/           # App-wide constants and theme
├── data/           # Data layer
│   ├── models/     # Data models (Movie)
│   └── services/   # Business logic services
├── logic/          # State management (Provider)
└── ui/             # Presentation layer
    ├── pages/      # Full-screen pages
    └── widgets/    # Reusable UI components
```

**Key Architectural Patterns:**

1. **State Management**: Uses Provider pattern with `AppState` as the central state holder
   - `AppState` (logic/app_state.dart) manages all app state and coordinates services
   - Wraps the entire app in `ChangeNotifierProvider`
   - UI components use `Consumer<AppState>` to react to state changes

2. **Service Layer**: Four core services injected into AppState
   - `ApiService` - Fetches content from multiple sources (Dramabox, Anime, Comics)
   - `StorageService` - Local persistence using SharedPreferences
   - `AuthService` - Supabase authentication (email, guest/anonymous)
   - `SyncService` - Cloud sync for history and favorites

3. **Multi-Source Content**: ApiService dynamically switches between content sources
   - Dramabox API for dramas
   - Otakudesu unofficial API for anime
   - Komik API for comics
   - Uses Captain API for video streaming URLs

4. **Navigation**: Bottom navigation with 4 tabs (Home, Search, History, Profile)
   - IndexedStack preserves state across tab switches
   - Hero animations for smooth transitions
   - Continue watching bar appears above bottom nav when history exists

### Data Flow

```
UI (Consumer) → AppState → Services → External APIs/Storage
                    ↓
              notifyListeners()
                    ↓
            UI rebuilds automatically
```

### Critical Implementation Details

**Supabase Integration:**
- Credentials are hardcoded in `main.dart` (lines 28-32)
- Requires SQL setup (referenced in README but file not found in repo)
- Supports both authenticated users and anonymous/guest access
- Auto-syncs history and favorites when user logs in

**SSL Certificate Handling:**
- `MyHttpOverrides` in main.dart bypasses SSL certificate validation
- Required for accessing certain APIs with self-signed certificates
- Security consideration: Only acceptable for development/testing

**Video Playback:**
- Uses `chewie` player with `video_player` backend
- Supports direct MP4/MKV URLs and M3U8 streams
- ApiService includes M3U8 variant parsing for quality selection

**WebView Usage:**
- Anime content uses WebView for embedded players
- Comic reader uses WebView for chapter viewing
- Platform-specific implementations (Android/iOS) configured

## Content Sources & APIs

The app aggregates from multiple external APIs:

- **Captain API**: `https://captain.sapimu.au` - Video streaming URL resolver
- **Dramabox API**: `https://dramabox.sansekai.my.id/api/dramabox`
- **Anime API**: `https://otakudesu-unofficial-api.vercel.app/v1`
- **Komik API**: `https://api.sansekai.my.id/api`

API tokens and base URLs are in `lib/core/app_constants.dart`.

## Python Scraper

The `scraper_720p.py` script:
- Scrapes Otakudesu for 720p video download links (MP4/MKV)
- Implements rate limiting (3-7s delays) to avoid blocking
- Extracts links from episode pages and iframe players
- Outputs JSON with episode titles and direct video URLs
- Edit `anime_url` variable in the script before running

## Important Notes

- **No Supabase setup file**: README references `supabase_setup.md` but it's not in the repo
- **Hardcoded credentials**: Supabase URL and anon key are committed in main.dart
- **External API dependencies**: App relies on third-party APIs that may change or go offline
- **SSL bypass**: Certificate validation is disabled globally
- **Indonesian language**: UI text is in Indonesian (Bahasa Indonesia)
