# Anime Resolution Native Player Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure Otakudesu anime playback stays in native player and supports in-player resolution selection whenever multi-variant HLS is available.

**Architecture:** Keep anime playback native-only from `DetailPage` into `VideoPlayerPage`, remove WebView fallback, and change stream resolution logic to preserve master HLS playlists for quality parsing in player UI. Add targeted diagnostics to verify why sources collapse to single-quality.

**Tech Stack:** Flutter, Dart, `video_player`, `chewie`, existing `ApiService` stream resolver.

---

### Task 1: Add stream playlist diagnostics in ApiService

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart`
- Test (manual): `Reealms/lib/ui/pages/detail_page.dart` playback path

**Step 1: Write failing test/check definition (manual debug criteria)**
- Define expected logs for one anime episode:
  - selected mirror URL
  - whether final URL is `.m3u8` master playlist, media playlist, or direct file
  - whether resolver downgraded to a variant

**Step 2: Run current app path to confirm missing diagnostics**
Run:
```bash
cd Reealms
flutter run
```
Expected: Existing logs do not clearly indicate master-vs-variant decision points.

**Step 3: Write minimal implementation**
- Add helper in `api_service.dart` to classify playlist type:
  - `_isMasterM3u8Content(String body)` (checks `#EXT-X-STREAM-INF`)
  - `_logAnimePlayableDecision(...)` lightweight print logs
- Call logger in:
  - `getBestOtakudesuStreamUrl`
  - `_resolveDirectPlayableUrlFromPage`
  - `getBestOtakudesuPlayableUrl`

**Step 4: Run and verify diagnostics**
Run:
```bash
cd Reealms
flutter run
```
Expected: Console shows deterministic decision path for episode URL to final playable URL.

**Step 5: Commit**
```bash
git add Reealms/lib/data/services/api_service.dart
git commit -m "chore: add anime stream decision diagnostics"
```

---

### Task 2: Preserve master HLS for quality selection

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart`

**Step 1: Write failing behavior check**
- Document failing case: multi-quality source still appears as single option because URL already variant-only before `VideoPlayerPage`.

**Step 2: Run manual reproduction**
Run:
```bash
cd Reealms
flutter run
```
Expected: For problematic episode, quality options show only `Auto`/single option.

**Step 3: Write minimal implementation**
- Introduce helper to inspect m3u8 URL content and return either:
  - master URL (if it is a master playlist)
  - same URL if non-master
- Update `getBestOtakudesuPlayableUrl`:
  - if `streamUrl` is m3u8, prefer keeping master URL (do not downgrade to single variant)
  - only resolve variant explicitly for explicit single-quality paths where needed
- Update `_resolveDirectPlayableUrlFromPage` selection scoring to keep master playlists in candidate priority (or at least not forcibly convert to one variant before player stage).

**Step 4: Verify behavior**
Run:
```bash
cd Reealms
flutter run
```
Expected: For master m3u8 source, URL passed to player remains master and can expose variant list.

**Step 5: Commit**
```bash
git add Reealms/lib/data/services/api_service.dart
git commit -m "fix: keep master hls for in-player quality switching"
```

---

### Task 3: Enforce native-only anime playback from DetailPage

**Files:**
- Modify: `Reealms/lib/ui/pages/detail_page.dart:570-612`

**Step 1: Write failing behavior check**
- Define expected: tapping anime episode never opens `AnimeWebViewPage`.

**Step 2: Reproduce current fallback**
Run app and open episode that currently falls back to WebView.
Expected: WebView opens (current undesired behavior).

**Step 3: Write minimal implementation**
- Remove/disable WebView fallback branch in anime section of `_handleEpisodeTap`.
- Keep only native path:
  - resolve via `getBestOtakudesuPlayableUrl`
  - navigate to `VideoPlayerPage` if valid
  - else show explicit Snackbar error
- Remove unused `anime_webview_page.dart` import if no longer referenced.

**Step 4: Verify behavior**
Run:
```bash
cd Reealms
flutter run
```
Expected:
- Episode opens native player when URL valid.
- If invalid, shows message and stays on detail page.
- No WebView navigation path triggered.

**Step 5: Commit**
```bash
git add Reealms/lib/ui/pages/detail_page.dart
git commit -m "fix: remove anime webview fallback and keep native playback"
```

---

### Task 4: Ensure quality control remains visible in player UI

**Files:**
- Modify: `Reealms/lib/ui/pages/video_player_page.dart:210-300, 497-527`

**Step 1: Write failing behavior check**
- Define expected:
  - quality button visible even for single-quality source
  - still shows multiple entries for master HLS

**Step 2: Reproduce current behavior**
Run app with single-quality and multi-quality episode.
Expected: quality menu may be hidden/unclear in some single-option scenarios.

**Step 3: Write minimal implementation**
- Guarantee `_qualityOptions` always has at least `Auto` entry after player init.
- Keep AppBar quality button visible whenever in anime playback path (or whenever player ready) and menu items reflect available options.
- Preserve selected label handling in `_switchQuality`.

**Step 4: Verify UI behavior**
Run:
```bash
cd Reealms
flutter run
```
Expected:
- Single-quality: menu opens, shows `Auto` (and possibly one stream).
- Multi-quality: menu shows multiple resolution options.

**Step 5: Commit**
```bash
git add Reealms/lib/ui/pages/video_player_page.dart
git commit -m "fix: keep quality menu visible with single or multiple variants"
```

---

### Task 5: Validate end-to-end anime playback scenarios

**Files:**
- Modify (if needed): same files above based on validation findings
- Test: manual scenario checklist

**Step 1: Define scenario matrix**
- Scenario A: episode with master m3u8 (expect multiple qualities)
- Scenario B: episode with single variant/direct file (expect menu still visible)
- Scenario C: episode with unresolvable stream (expect clean error, no WebView)

**Step 2: Execute scenario tests**
Run:
```bash
cd Reealms
flutter run
```
Expected:
- A: native player + quality choices
- B: native player + at least Auto
- C: error message only

**Step 3: Capture diagnostics output**
- Ensure logs confirm which decision path each scenario took.

**Step 4: Run static checks**
Run:
```bash
cd Reealms
flutter analyze
```
Expected: no new analyzer errors from touched files.

**Step 5: Final commit**
```bash
git add Reealms/lib/data/services/api_service.dart Reealms/lib/ui/pages/detail_page.dart Reealms/lib/ui/pages/video_player_page.dart
git commit -m "fix: native anime playback with reliable in-player quality selection"
```
