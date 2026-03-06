# Anime WebView Quality Picker Design

## Goal
- Add a user-facing anime resolution picker to the Expo WebView player while keeping the stable direct-stream wrapper and `Auto` as the default entry path.

## Current State
- Anime playback no longer uses `expo-video`.
- `DetailScreen` resolves an Otakudesu playback manifest and opens `AnimeWebViewScreen`.
- The current WebView route receives only an initial direct URL plus fallback direct URLs.
- The app already has manifest quality data from `ApiService`, including direct and deferred Otakudesu quality options, but that data is not exposed in the anime UI.

## Recommended Approach
- Keep the current WebView wrapper in `AnimeWebViewScreen`.
- Extend the anime playback session so it includes quality options, not just URLs.
- Add a top-right quality pill that opens a horizontal tray.
- Keep `Auto` as the default selection.
- When the user selects a quality:
  - direct option: rebuild the WebView source order with that direct URL first
  - deferred option: resolve it through `ApiService.resolveOtakudesuQualityOption()` and then rebuild the WebView source order
- Keep the HTML wrapper simple: it only receives the ordered list of URLs and retries within that list.

## UX
- Use a small pill in the header, consistent with the previous drama player direction.
- Show only the qualities that exist for the current episode.
- Suggested order: `Auto`, then ascending or descending quality labels based on rank; the implementation should keep `Auto` first and the rest sorted by rank.
- Hide the pill and tray while fullscreen is active.
- Preserve the selected label when the user exits fullscreen.

## Data Flow
- `DetailScreen` continues calling `getOtakudesuPlaybackManifest()`.
- `buildAnimeWebViewSession()` should be expanded to keep:
  - `initialUrl`
  - `fallbackUrls`
  - `qualityOptions`
- `AnimeWebViewScreen` becomes responsible for:
  - building visible quality items
  - resolving deferred qualities on demand
  - caching resolved quality URLs for the active episode only
  - regenerating the ordered URL list passed into the WebView wrapper

## Failure Handling
- If a selected quality fails, keep the player screen open.
- The WebView wrapper should still try the remaining URLs for that selection order.
- If all URLs fail, show a compact in-app error message.
- Do not reintroduce the provider page or host picker.

## Testing
- Add focused tests for:
  - visible anime quality items from a manifest
  - ordered source generation for `Auto` and a direct selected quality
  - deferred-quality cache behavior
- Run the full Expo verification stack after implementation.
