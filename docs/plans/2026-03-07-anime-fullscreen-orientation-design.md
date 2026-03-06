# Anime Fullscreen Orientation Design

## Goal
- Keep the current anime `Auto` stream selection, and rotate only the anime WebView player into horizontal fullscreen when the user taps fullscreen.

## Scope
- In scope:
  - anime-only fullscreen orientation handling
  - keep drama playback unchanged
  - preserve the current manifest-driven `Auto` source behavior
- Out of scope:
  - changing anime quality selection
  - changing the resolver order
  - app-wide orientation locks

## Approach
- Keep `AnimeWebViewScreen` as the anime playback route.
- Continue using the HTML5 video fullscreen events already emitted from `animeWebViewPlayerHtml.ts`.
- Add a small pure helper that maps WebView messages into UI state plus an orientation intent.
- On `enterFullscreen`, lock the screen to landscape using Expo Screen Orientation.
- On `exitFullscreen` and screen unmount, unlock back to the default policy.

## Default Resolution
- The anime WebView still starts from `playbackManifest.initialUrl`.
- That URL is the resolver's best verified direct source, which is usually the highest direct quality available, commonly `720p`.

## Testing
- Add a unit test that proves anime fullscreen messages request `landscape` on enter and `default` on exit.
- Run the Expo test suite, typecheck, Expo doctor, and Android export after the screen change.
