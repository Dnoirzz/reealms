# Anime Quality Hybrid Otakudesu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement reliable native anime quality selection by prioritizing Otakudesu scraping pipeline (with master-playlist preference) while keeping hybrid fallback behavior.

**Architecture:** Enhance `ApiService` with a staged resolver pipeline that probes multiple Otakudesu mirror candidates, extracts direct playable URLs per mirror, and prefers master HLS playlists so `VideoPlayerPage` can surface multiple quality options. Keep UI flow stable: native first, safe WebView fallback, and final snackbar.

**Tech Stack:** Flutter, Dart, `http`, `video_player`, `chewie`, existing Otakudesu HTML/AJAX scraping utilities.

---

### Task 1: Add resolver data structures and helper methods for multi-mirror probing

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart`
- Test: `Reealms/test/api_service_anime_resolver_test.dart`

**Step 1: Write the failing test**

```dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('placeholder for multi-mirror staged resolver helper', () {
    // This test should call a public/internal-visible helper
    // and initially fail because helper does not exist yet.
    expect(true, isFalse, reason: 'Replace with real failing assertion');
  });
}
```

**Step 2: Run test to verify it fails**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: FAIL because assertion intentionally fails or helper not found.

**Step 3: Write minimal implementation**

In `api_service.dart`, add compact internal model(s) to represent candidate probing result (example names):

```dart
class _AnimePlayableCandidate {
  final String mirrorUrl;
  final String playableUrl;
  final bool isMasterM3u8;

  const _AnimePlayableCandidate({
    required this.mirrorUrl,
    required this.playableUrl,
    required this.isMasterM3u8,
  });
}
```

Add helper(s):
- `_collectRankedMirrorCandidatesFromEpisodePage(String episodeUrl)`
- `_probePlayableFromMirrors(List<String> mirrors)`

Rules:
- Reuse existing extraction helpers (`_extractMirrorCandidatesFromQualitySection`, `_resolveOtakudesuAjaxMirrorUrl`, `_resolveDirectPlayableUrlFromPage`).
- Prefer candidate with `isMasterM3u8 == true`.
- Keep YAGNI: no new abstraction layers beyond these helpers.

**Step 4: Run test to verify it passes**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: PASS for newly implemented helper behavior.

**Step 5: Commit**

```bash
git add Reealms/lib/data/services/api_service.dart Reealms/test/api_service_anime_resolver_test.dart
git commit -m "feat(anime): add staged multi-mirror resolver helpers"
```

---

### Task 2: Update `getBestOtakudesuStreamUrl` to use staged mirror probing first

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart` (method `getBestOtakudesuStreamUrl`)
- Test: `Reealms/test/api_service_anime_resolver_test.dart`

**Step 1: Write the failing test**

Add test that expects resolver to try staged scraping path and return scraped playable result before API fallback:

```dart
test('getBestOtakudesuStreamUrl prefers staged scrape result before API fallback', () async {
  // Arrange fake episode URL + fake HTML/AJAX/http responses in a test seam.
  // Act resolver call.
  // Assert returned URL comes from scraped mirror path.
});
```

**Step 2: Run test to verify it fails**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: FAIL because method still uses old direct path order.

**Step 3: Write minimal implementation**

Adjust `getBestOtakudesuStreamUrl` order:
1. Validate episode URL.
2. Run staged mirror collection/probing helper.
3. If result found, return it.
4. If not, keep existing API fallback (`getAnimeStreamUrl(slug)`).
5. Return empty only if both fail.

Ensure logs include stage entry/exit:
- `stage: scrape-start`
- `stage: scrape-selected`
- `stage: api-fallback`
- `stage: all-failed`

**Step 4: Run test to verify it passes**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: PASS.

**Step 5: Commit**

```bash
git add Reealms/lib/data/services/api_service.dart Reealms/test/api_service_anime_resolver_test.dart
git commit -m "feat(anime): prefer staged otakudesu scraping before api fallback"
```

---

### Task 3: Ensure playable URL selection always prefers master m3u8 where available

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart`
- Test: `Reealms/test/api_service_anime_resolver_test.dart`

**Step 1: Write the failing test**

```dart
test('resolver prefers master m3u8 over media playlist and mp4 when present', () async {
  // Arrange candidates including master.m3u8, media.m3u8, and mp4.
  // Assert selected URL is master.m3u8.
});
```

**Step 2: Run test to verify it fails**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: FAIL if current selection is not deterministic for master-first.

**Step 3: Write minimal implementation**

In selection logic:
- Evaluate candidate URLs and compute `isMasterM3u8` via `_isMasterM3u8Url`.
- Sort by: master m3u8 > media m3u8 > direct video, with existing quality hint score secondary.
- Return first winner.

Do not add extra UI behavior here.

**Step 4: Run test to verify it passes**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: PASS.

**Step 5: Commit**

```bash
git add Reealms/lib/data/services/api_service.dart Reealms/test/api_service_anime_resolver_test.dart
git commit -m "fix(anime): enforce master-m3u8 priority in resolver selection"
```

---

### Task 4: Strengthen runtime diagnostics for resolver traceability

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart`
- Test: `Reealms/test/api_service_anime_resolver_test.dart`

**Step 1: Write the failing test**

```dart
test('resolver emits decision logs for each major stage', () async {
  // Use a logging seam or callback verification.
  // Assert expected labels are produced.
});
```

**Step 2: Run test to verify it fails**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: FAIL until stage labels are complete.

**Step 3: Write minimal implementation**

Add consistent labels to `_logAnimePlayableDecision`, e.g.:
- `episode-input`
- `mirror-candidates-count`
- `mirror-selected`
- `playable-selected`
- `api-fallback-used`
- `resolver-empty`

Keep logs concise and non-sensitive.

**Step 4: Run test to verify it passes**

Run: `flutter test test/api_service_anime_resolver_test.dart -r expanded`

Expected: PASS.

**Step 5: Commit**

```bash
git add Reealms/lib/data/services/api_service.dart Reealms/test/api_service_anime_resolver_test.dart
git commit -m "chore(anime): add structured resolver decision logging"
```

---

### Task 5: Keep detail page flow stable and regression-safe

**Files:**
- Modify: `Reealms/lib/ui/pages/detail_page.dart` (only if needed to preserve contract)
- Test: `Reealms/test/widget_test.dart` (or new focused page test)

**Step 1: Write the failing test**

```dart
testWidgets('anime tap keeps native-first then webview fallback behavior', (tester) async {
  // Pump page with mocked ApiService behavior:
  // 1) native url empty
  // 2) safe mirror available
  // Assert webview navigation occurs.
});
```

**Step 2: Run test to verify it fails**

Run: `flutter test test/widget_test.dart -r expanded`

Expected: FAIL until behavior is asserted correctly.

**Step 3: Write minimal implementation**

Only if test indicates drift:
- Ensure call order remains `getBestOtakudesuPlayableUrl` -> `getBestOtakudesuStreamUrl` fallback.
- Ensure unsafe otakudesu-host direct fallback is blocked as currently intended.

No extra UI changes.

**Step 4: Run test to verify it passes**

Run: `flutter test test/widget_test.dart -r expanded`

Expected: PASS.

**Step 5: Commit**

```bash
git add Reealms/lib/ui/pages/detail_page.dart Reealms/test/widget_test.dart
git commit -m "test(anime): lock native-first plus webview fallback flow"
```

---

### Task 6: Verify quality menu behavior in native player under both master and single-quality sources

**Files:**
- Modify: `Reealms/lib/ui/pages/video_player_page.dart` (only if tests reveal issue)
- Test: `Reealms/test/video_player_quality_menu_test.dart`

**Step 1: Write the failing test**

```dart
testWidgets('quality menu shows variants when master playlist is available', (tester) async {
  // Mock playlist fetch with EXT-X-STREAM-INF variants.
  // Assert menu items include 1080p/720p/etc.
});

testWidgets('quality menu shows Auto only when source is single quality', (tester) async {
  // Mock media playlist or mp4.
  // Assert only Auto (or single option) is shown.
});
```

**Step 2: Run test to verify it fails**

Run: `flutter test test/video_player_quality_menu_test.dart -r expanded`

Expected: FAIL before implementation/mocking seam.

**Step 3: Write minimal implementation**

If needed:
- Keep current always-visible menu behavior.
- Ensure `_loadQualityOptions` handles non-master playlists deterministically.

No redesign of player controls.

**Step 4: Run test to verify it passes**

Run: `flutter test test/video_player_quality_menu_test.dart -r expanded`

Expected: PASS.

**Step 5: Commit**

```bash
git add Reealms/lib/ui/pages/video_player_page.dart Reealms/test/video_player_quality_menu_test.dart
git commit -m "test(player): verify quality menu for master and single-quality sources"
```

---

### Task 7: End-to-end verification and cleanup

**Files:**
- Modify: `Reealms/lib/data/services/api_service.dart` (small cleanup if required)
- Test: `Reealms/test/**/*.dart`

**Step 1: Run full targeted test suite**

Run:
- `flutter test test/api_service_anime_resolver_test.dart -r expanded`
- `flutter test test/video_player_quality_menu_test.dart -r expanded`
- `flutter test test/widget_test.dart -r expanded`

Expected: All PASS.

**Step 2: Run analyzer**

Run: `flutter analyze`

Expected: No new errors introduced (existing info-level lints may remain).

**Step 3: Manual verification checklist**

Run app and verify:
- Anime episode with known multi-quality source shows multiple quality entries in native player.
- Anime episode with single quality still plays and menu remains valid.
- If native unresolved, WebView fallback still works.
- Resolver logs (`ApiServiceAnime`) clearly show stage chain.

**Step 4: Final commit**

```bash
git add Reealms/lib/data/services/api_service.dart Reealms/lib/ui/pages/video_player_page.dart Reealms/lib/ui/pages/detail_page.dart Reealms/test/
git commit -m "feat(anime): hybrid otakudesu resolver with reliable native quality selection"
```

---

## Notes for Execution

- Use @superpowers:test-driven-development for each task before implementation edits.
- Use @superpowers:verification-before-completion before declaring success.
- Keep changes DRY and YAGNI: avoid introducing new services or architectural layers unless a test requires it.
- Keep each commit focused to one task outcome.
