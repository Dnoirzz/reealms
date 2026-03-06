# Otakudesu-First Resolver Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make anime playback resolver prioritize Otakudesu-derived HLS (`.m3u8`) URLs—especially master playlists—so video quality options appear when available, while preserving safe fallback behavior.

**Architecture:** Keep `getBestOtakudesuPlayableUrl` as the single entry point, but replace first-hit fallback logic with bucketed candidate selection after scanning mirror candidates. Classify resolved direct URLs into `master m3u8`, `media m3u8`, and `direct file` buckets; choose best bucket in priority order before fallback to legacy stream/API path. Keep existing mirror collection and safety filters unchanged unless strictly needed for this behavior.

**Tech Stack:** Flutter (Dart), `http` client, existing Otakudesu scraper logic in `ApiService`, Flutter test (`flutter_test`, `MockClient`).

---

### Task 1: Add regression test for bucketed selection priority

**Files:**
- Modify: `test/api_service_anime_resolver_test.dart`
- Test: `test/api_service_anime_resolver_test.dart`

**Step 1: Write the failing test**

Add a new test that reproduces the current issue behavior pattern:
- Episode HTML returns multiple mirrors.
- First mirror resolves to MP4.
- Another mirror resolves to media `.m3u8`.
- Another mirror resolves to master `.m3u8`.
- Expect final selected URL to be master `.m3u8`.

Suggested test skeleton (append in existing resolver test group):

```dart
test('resolver chooses master m3u8 even when mp4 appears earlier in mirrors', () async {
  final client = MockClient((request) async {
    final url = request.url.toString();

    if (request.method == 'GET' &&
        url == 'https://otakudesu.blog/episode/bucket-priority/') {
      return http.Response('''
<ul class="m720p">
  <li><a href="https://ondesu.example/mirror-mp4" data-content="">OnDesu</a></li>
  <li><a href="https://filemoon.example/mirror-media" data-content="">Filemoon</a></li>
  <li><a href="https://vidhide.example/mirror-master" data-content="">Vidhide</a></li>
</ul>
''', 200);
    }

    if (request.method == 'HEAD') {
      return http.Response('', 200);
    }

    if (request.method == 'GET' && url == 'https://ondesu.example/mirror-mp4') {
      return http.Response('<script>const src="https://cdn.example/video-720.mp4";</script>', 200);
    }

    if (request.method == 'GET' && url == 'https://filemoon.example/mirror-media') {
      return http.Response('<script>const src="https://cdn.example/720/index.m3u8";</script>', 200);
    }

    if (request.method == 'GET' && url == 'https://vidhide.example/mirror-master') {
      return http.Response('<script>const src="https://cdn.example/master.m3u8";</script>', 200);
    }

    if (request.method == 'GET' && url == 'https://cdn.example/master.m3u8') {
      return http.Response(
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=1280x720\n720/index.m3u8\n',
        200,
      );
    }

    if (request.method == 'GET' && url == 'https://cdn.example/720/index.m3u8') {
      return http.Response('#EXTM3U\n#EXTINF:10.0,\nseg0.ts\n', 200);
    }

    fail('Unexpected HTTP request: ${request.method} $url');
  });

  final api = ApiService(client: client);

  final result = await api.getBestOtakudesuPlayableUrl(
    'https://otakudesu.blog/episode/bucket-priority/',
  );

  expect(result, 'https://cdn.example/master.m3u8');
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
flutter test test/api_service_anime_resolver_test.dart
```

Expected:
- New test fails first (likely returns MP4 or earlier non-master candidate), proving we reproduced the bug.

**Step 3: Commit test-only change**

```bash
git add test/api_service_anime_resolver_test.dart
git commit -m "test: add regression for otakudesu mirror bucket priority"
```

---

### Task 2: Implement bucketed mirror probe selection

**Files:**
- Modify: `lib/data/services/api_service.dart`
- Test: `test/api_service_anime_resolver_test.dart`

**Step 1: Introduce candidate classification for direct URLs**

Inside `ApiService` (near existing mirror probe helpers), add a small private model or enum-like helper to classify direct URLs:
- `masterM3u8`
- `mediaM3u8`
- `directFile`

Use existing helpers:
- `_isDirectPlayableVideoUrl`
- `_isMasterM3u8Url`

Keep this minimal and local to resolver scope.

**Step 2: Refactor `_probePlayableFromMirrors` to full-scan + bucket select**

Update `lib/data/services/api_service.dart` function:
- Current: `_probePlayableFromMirrors` early-returns on first master and otherwise keeps first non-master fallback.
- New behavior:
  1. Iterate all mirrors and resolve direct URL.
  2. Classify each resolved URL into bucket A/B/C.
  3. After loop, select first available by priority:
     - bucket A (master) > bucket B (media m3u8) > bucket C (direct file)
  4. Return `null` only if no playable URL discovered.

This preserves YAGNI while fixing root cause.

**Step 3: Add decision logs for observability**

In same function, add concise logs via `_logAnimePlayableDecision`:
- candidate classification per mirror (optional short format)
- bucket selected outcome (`bucket-selected=master|media|direct`)

Avoid noisy full dumps; keep logs short and actionable.

**Step 4: Run targeted resolver test**

Run:
```bash
flutter test test/api_service_anime_resolver_test.dart
```

Expected:
- Regression test passes.
- Existing resolver tests still pass.

**Step 5: Commit implementation**

```bash
git add lib/data/services/api_service.dart test/api_service_anime_resolver_test.dart
git commit -m "fix: prioritize otakudesu master hls over mp4 fallback"
```

---

### Task 3: Verify quality parser contract remains valid

**Files:**
- Test: `test/video_player_quality_menu_test.dart`

**Step 1: Run quality parser tests**

Run:
```bash
flutter test test/video_player_quality_menu_test.dart
```

Expected:
- All quality parser tests pass.
- No regressions in master/media handling.

**Step 2: (Optional) tighten one assertion if needed**

Only if behavior changed, adjust expected logging-related output minimally without altering business assertions.

**Step 3: Commit (only if test file changed)**

```bash
git add test/video_player_quality_menu_test.dart
git commit -m "test: keep quality parser expectations aligned with resolver priority"
```

---

### Task 4: Full verification and manual log validation

**Files:**
- None required (verification task)

**Step 1: Run full test suite**

Run:
```bash
flutter test
```

Expected:
- Entire suite passes.
- No failing resolver/player tests.

**Step 2: Manual runtime validation from Otakudesu episode**

Run app and play an Otakudesu episode that previously showed Auto-only.
Check log output for sequence:
- `AnimePlayable: ... bucket-selected => master` (or media if no master exists)
- `[QualityParser] Received URL: ...m3u8`
- `[VideoPlayerPage] Parsed N quality options` where `N > 1` when master is present.

**Step 3: Confirm expected UX**

- Resolution menu shows `Auto` + quality variants when master playlist exists.
- If only MP4 exists, menu remains `Auto` (valid fallback).

---

### Task 5: Final cleanup and integration readiness

**Files:**
- Modify: `lib/data/services/api_service.dart` (only if final tiny cleanup needed)

**Step 1: Keep change surface minimal**

Review diff to ensure no unrelated refactors.

**Step 2: Optional format pass for touched files only**

Run (if formatting needed):
```bash
dart format lib/data/services/api_service.dart test/api_service_anime_resolver_test.dart
```

**Step 3: Final commit (if needed)**

```bash
git add lib/data/services/api_service.dart test/api_service_anime_resolver_test.dart
git commit -m "chore: finalize otakudesu-first resolver cleanup"
```

---

## Notes for executor

- Keep DRY and YAGNI: do not rewrite scraper architecture; only adjust selection policy and required tests.
- Use existing helper methods whenever possible.
- Do not remove fallback behavior; fallback is part of accepted design.
- Follow @superpowers:systematic-debugging if unexpected resolver regressions appear.
- If adding or modifying tests, keep strict TDD cycle: write failing test first, then implement minimal fix.
