# Anime Resolution Native Player Design (2026-03-05)

## Context
User requires anime playback to stay in native player and support in-player resolution switching. Current behavior often results in single quality option and fallback to WebView.

## Goals
1. Disable WebView fallback for anime playback flow.
2. Preserve and prioritize master HLS playlist when available so multiple variants can be displayed.
3. Keep quality UI visible even when source only has single variant.
4. Investigate and instrument resolver path to identify where quality options collapse to one.

## Root Cause Hypothesis
Quality options collapse because stream resolution selection is performed too early in service layer:
- Resolver frequently converts master `.m3u8` into a single variant URL before player receives it.
- `VideoPlayerPage` only renders multi-quality choices if source playlist contains `#EXT-X-STREAM-INF`.
- Therefore, player receives variant-only URL and can only show `Auto`/single entry.

## Proposed Changes

### A. Native-only anime playback path
- File: `Reealms/lib/ui/pages/detail_page.dart`
- Remove fallback navigation to `AnimeWebViewPage` for Otakudesu branch.
- If direct playable URL cannot be resolved, show explicit playback error Snackbar.

### B. Preserve master HLS in resolver
- File: `Reealms/lib/data/services/api_service.dart`
- Introduce separate behavior:
  - Keep API helper for variant preference where needed.
  - For anime playable URL flow, return master HLS URL when playlist is multi-variant.
- Add helper to detect whether m3u8 is master vs media playlist.
- Ensure `getBestOtakudesuPlayableUrl` prefers master m3u8 for UI quality switching.

### C. Quality diagnostics
- File: `Reealms/lib/data/services/api_service.dart`
- Add targeted debug logs (non-sensitive) for:
  - picked mirror URL
  - direct extracted URL type (master/media/non-m3u8)
  - decision points where URL is downgraded to single variant

### D. Player UI consistency
- File: `Reealms/lib/ui/pages/video_player_page.dart`
- Keep quality menu visible with at least `Auto` entry for single-quality sources.
- Preserve existing in-player switching behavior for multi-variant HLS.

## Expected Outcome
- Anime playback no longer auto-opens WebView.
- Multi-variant HLS streams expose selectable qualities in player menu.
- Single-quality streams still show quality control entry with clear limited options.
- Resolver logs clarify why any episode remains single-quality.

## Verification Plan
1. Play 2–3 Otakudesu episodes in app.
2. Confirm navigation always opens `VideoPlayerPage` (or shows error, never WebView).
3. For episode with master m3u8, verify multiple quality options appear.
4. For single-variant source, verify quality button still visible with single option.
5. Confirm logs show resolver decisions for each tested episode.
