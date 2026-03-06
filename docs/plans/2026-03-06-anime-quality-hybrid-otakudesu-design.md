# Anime Quality Selection Design (Hybrid Otakudesu) — 2026-03-06

## Goal

Provide anime quality selection in native player reliably (Auto/1080p/720p/480p when available), while keeping playback stable.

User priorities:
- Keep native in-player quality menu UX.
- Prioritize completeness over startup speed (acceptable extra probing time).
- Use `https://otakudesu.blog/` scraping as primary path.
- Keep hybrid safety fallback to existing API path.

## Scope

In scope:
- Strengthen Otakudesu scraping-based resolver pipeline for stream + quality discovery.
- Keep current native player quality menu and ensure options are populated whenever source exposes variants.
- Keep fallback to existing API path only when scraping pipeline fails.

Out of scope:
- Reworking unrelated app modules.
- Removing existing fallback safety net.
- Any server-side proxy infrastructure.

## Current Baseline (Observed)

- Episode tap path (`detail_page.dart`) does:
  1. try native direct playable URL from `getBestOtakudesuPlayableUrl`
  2. fallback to safe mirror WebView
  3. show failure snackbar
- Player menu in `video_player_page.dart` already supports HLS variant parsing from master playlists.
- Main failure mode for native quality options: resolver often returns media playlist or single direct URL instead of discoverable master playlist candidates.

## Proposed Architecture

### 1) Resolver Pipeline v2 (Hybrid)

Introduce a deterministic, staged resolver strategy in `ApiService`:

1. **Primary source: Otakudesu scraping**
   - Scrape episode page mirror sections.
   - Resolve mirror `data-content` through Otakudesu AJAX (`admin-ajax.php`) with nonce and mirror action.

2. **Mirror expansion + ranking**
   - Collect all safe mirror URLs (dedupe by normalized URL).
   - Rank by provider priority + reachability probe.

3. **Playable extraction per mirror**
   - For each ranked mirror, extract direct playable candidates from:
     - iframe/embed src
     - inline script literals
     - HTML-decoded payloads
     - `data-page` JSON payloads
   - Prefer master `.m3u8` when present.

4. **Selection policy**
   - First master `.m3u8` found wins.
   - Else best media `.m3u8`.
   - Else best direct video URL (mp4/mkv/webm).

5. **Hybrid fallback**
   - If scraping path fails end-to-end, fallback to existing API-based stream URL path.

### 2) Data Contract for Player Input

Keep current function signature used by UI:
- `Future<String> getBestOtakudesuPlayableUrl(String episodeUrl)`

Behavior contract update:
- Must prefer master playlist URLs whenever discoverable.
- Must log reasoned decision steps for each stage (for field debugging).
- Must not return blocked/ad hosts.

### 3) Quality Menu Behavior (Native Player)

No major UX redesign needed; preserve current approach in `video_player_page.dart`:
- Menu always visible.
- Default `Auto` always present.
- If master playlist available, append parsed variants sorted descending.
- If source truly single-quality, show only `Auto` (or single available option).

## Detailed Component Changes

## A. `lib/data/services/api_service.dart`

### A1. Add staged mirror probing (new helper)
- Add helper to resolve best playable URL from **multiple** candidate mirror pages (not only one pre-picked mirror).
- Input: ordered mirror URL list.
- Output: first high-confidence playable URL according to selection policy.

### A2. Upgrade `getBestOtakudesuStreamUrl`
- Keep scraping-first strategy.
- Instead of collapsing too early to a single mirror URL, preserve candidate pool and allow deeper probing pass.
- Keep API fallback when no playable extraction succeeds.

### A3. Strengthen extraction patterns
- Expand extraction for escaped/encoded URL forms and dynamic payload traversals.
- Keep current `data-page` extraction and HTML entity decoding.
- Preserve safety filters.

### A4. Deterministic logging
- Keep/extend `ApiServiceAnime` decision logs so runtime traces always show:
  - source stage reached
  - candidate counts
  - selected URL type (`master-m3u8`, `media-m3u8`, `direct-video`)
  - fallback reason

## B. `lib/ui/pages/detail_page.dart`

- Keep baseline-stable behavior (already restored):
  - native first,
  - safe WebView fallback,
  - snackbar on total failure.
- No functional widening beyond that.

## C. `lib/ui/pages/video_player_page.dart`

- Keep current quality menu improvements already present:
  - visible menu,
  - default Auto seed,
  - loading placeholder when needed.
- No additional UI complexity required for this iteration.

## Error Handling & Safety

- If probes timeout or return non-200, continue to next candidate; do not hard-fail early.
- Keep host allowlist + ad-block checks before accepting candidate.
- If no native URL found, preserve current fallback behavior rather than breaking playback.

## Performance Strategy

Given user preference (“not in a hurry, prioritize perfect result”):
- Allow wider mirror probing window per episode open.
- Use bounded sequential probing with early exit when master playlist is found.
- Reuse host reachability cache in current resolver to avoid repeated expensive checks.

## Testing & Verification

1. Static checks:
- `flutter analyze`

2. Functional checks (manual):
- Open anime detail → tap episode.
- Verify native playback opens when resolvable.
- Verify quality menu contents for:
  - master m3u8 source (multiple options shown)
  - single-quality source (Auto only)
- Verify fallback behavior still works when native resolution fails.

3. Debug evidence:
- Ensure logs include `ApiServiceAnime` decision chain for each episode attempt.

## Risks and Mitigations

Risk: Otakudesu markup changes.
- Mitigation: keep multiple extraction paths + hybrid API fallback.

Risk: Some mirrors intentionally hide variants.
- Mitigation: probe multiple ranked mirrors before concluding single quality.

Risk: Slow startup for episode open.
- Mitigation: early exit once high-confidence master is found.

## Acceptance Criteria

- Episode playback baseline remains stable (no regression to immediate failure snackbar for resolvable episodes).
- For episodes where master m3u8 exists on accessible mirror, player shows multiple quality options in native menu.
- For episodes truly single-quality, playback still works and menu remains consistent.
- Decision logs are present and actionable for future debugging.
