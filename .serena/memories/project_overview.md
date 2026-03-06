# Reealms overview
- Monorepo for a streaming app that combines Drama (Dramabox), Anime (Otakudesu), and Comic content.
- Main folders:
  - `Reealms/`: original Flutter app.
  - `ReealmsExpo/`: active Expo + TypeScript rebuild used for current mobile work.
  - `otakudesu_scrap/`: Python scraper for Otakudesu links.
- Cloud sync/auth uses Supabase.
- The Flutter app follows a layered architecture (`core`, `data`, `logic`, `ui`).
- Current active product direction in practice is the Expo rebuild, while Flutter remains the reference implementation.
- Development machine is Windows.
