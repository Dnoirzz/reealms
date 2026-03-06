# Anime WebView Wrapper Design

## Goal
- Replace Expo native anime playback with an in-app WebView wrapper that plays already-resolved direct Otakudesu URLs without loading the provider episode page.

## Problem
- The current anime route resolves valid direct URLs, but Expo Go playback still fails on device with repeated `403` errors through the native `expo-video` path.
- Multiple resolver-side fixes improved host selection, but the failure pattern stayed at the native player boundary.
- Repeated native-player retries now point to an architectural issue instead of a parser issue.

## Approach
- Keep drama playback on `DramaPlayerScreen` and `expo-video`.
- Route anime episode taps into a dedicated WebView-based player screen.
- The anime player screen will render app-owned HTML with a `<video>` element instead of navigating to the Otakudesu provider page.
- The HTML wrapper will receive:
  - the best initial direct URL
  - any alternate direct fallback URLs already captured in the playback manifest
  - a simple title for display

## Data Flow
- `DetailScreen` continues to ask `ApiService` for an `AnimePlaybackManifest`.
- For `movie.sourceType === 'otakudesu'`, `DetailScreen` opens `AnimeWebViewScreen` instead of `DramaPlayerScreen`.
- `AnimeWebViewScreen` builds a local HTML document string and passes it to `WebView` via `source={{ html, baseUrl }}`.
- The HTML wrapper owns `<video>` loading and switches to the next fallback URL if the current URL emits a media error.
- The React Native shell listens to WebView messages for `ready`, `fallback`, `error`, and fullscreen state.

## UI Behavior
- Keep the existing top bar and full-screen shell style from the current anime WebView screen.
- Show app-level loading and status copy while the wrapper prepares the first playable source.
- Do not expose Otakudesu provider controls or provider navigation.
- Keep the first version minimal:
  - native video controls inside the WebView
  - automatic direct-host fallback on media error
  - no provider-page DOM automation

## Error Handling
- If the first direct URL fails, try the next fallback URL inside the wrapper.
- If all direct URLs fail, show a clear in-app failure state instead of a blank provider page.
- Keep anime-specific failure handling inside the WebView wrapper so drama playback behavior remains untouched.

## Scope
- In scope:
  - anime-only route switch
  - app-owned HTML wrapper
  - fallback URL handling inside the wrapper
  - minimal status messages and fullscreen bridge
- Out of scope:
  - changing drama playback
  - reintroducing the provider-page WebView path
  - full custom anime player controls
  - backend proxying

## Testing
- Add unit coverage for the HTML wrapper builder so it includes initial and fallback URLs.
- Add route-level coverage for the anime detail path so it chooses the new screen instead of `DramaPlayerScreen`.
- Run the existing Expo checks plus on-device retest in Expo Go.
