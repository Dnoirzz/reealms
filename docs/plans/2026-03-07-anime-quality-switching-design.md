# Anime Quality Switching Design

**Date:** 2026-03-07

## Goal
- Add Otakudesu anime quality switching to the Expo app while keeping the player UI app-native and close to the Flutter experience.

## Current Problem
- The Expo anime playback path currently resolves a single direct stream and discards quality information.
- `collectOtakudesuMirrorCandidates()` in `ReealmsExpo/src/data/services/apiService.ts` only inspects the `m720p` mirror group.
- `DetailScreen.tsx` passes a single resolved URL into `DramaPlayerScreen.tsx`, so the player has no way to expose fallback qualities.
- Live runtime probes against Otakudesu episode pages currently resolve only one direct `720p` Filedon URL with no `qualityOptions`.

## Constraints
- Otakudesu links are unstable and often require runtime mirror resolution.
- Signed direct URLs expire, so resolved links should not be persisted.
- The player must stay inside the app flow. No WebView fallback for anime playback.
- The user wants Otakudesu page-listed qualities available as fallback options, even if some fail at runtime.
- The UI should still feel like the app, not like a mirror-host browser.

## Approved Approach
- Use a hybrid quality model.
- Autoplay the best verified direct stream immediately.
- Expose additional Otakudesu page qualities such as `360p`, `480p`, `720p`, and `1080p` as fallback choices in the player UI.
- Resolve fallback qualities on demand when the user selects them.
- Keep the current stream playing if a new quality cannot be resolved.

## Resolver Design

### Playback Manifest
- Replace the current single-result anime resolver flow with a playback manifest returned from `ApiService`.
- The manifest should include:
  - `initialSource`: the best verified direct stream for autoplay
  - `qualityOptions`: normalized quality entries for the player menu
  - enough metadata per quality to tell whether the option is already direct-playable or still needs deferred Otakudesu resolution

### Quality Option Types
- `Auto` always maps to the best initial direct source.
- Verified options:
  - direct playable URL already resolved
  - safe to switch immediately
- Deferred fallback options:
  - quality label known from the Otakudesu page
  - host or mirror resolution still needed when selected

### Otakudesu Extraction Rules
- Scrape all quality sections from the episode page, not just `m720p`.
- Collect:
  - `Mirror 360p`
  - `Mirror 480p`
  - `Mirror 720p`
  - any other stable mirror groups that appear on the page
- Keep the existing direct-page and nested-iframe resolution logic for turning mirror pages into direct playable URLs.
- Use the Otakudesu page quality labels as the canonical fallback labels.
- Deduplicate qualities by label and prefer already verified direct URLs over unresolved fallback entries.

### Ranking Rules
- `Auto` first
- highest verified playable quality next
- remaining verified qualities sorted by rank descending
- unresolved fallback qualities sorted by rank descending
- if the same label exists in both verified and fallback form, keep the verified version

## Player UI Design

### General Behavior
- Keep the existing player layout in `ReealmsExpo/src/ui/screens/DramaPlayerScreen.tsx`.
- Add a `Quality` control in the top bar area, close to the source badge.
- The player remains a single native `expo-video` surface.
- No mirror-host picker is shown to the user.

### Quality Menu
- Default selected label on first open: `Auto`
- Menu entries:
  - `Auto`
  - verified direct qualities such as `360p`, `480p`, `720p`, `1080p`
  - unresolved fallback qualities from the Otakudesu page when available
- If only `Auto` exists, the menu can still be shown but should not imply that other choices are available yet.

### Quality Switching
- For verified direct qualities:
  - switch immediately
  - preserve current playback position
  - preserve play or pause state
- For deferred fallback qualities:
  - show a short loading state such as `Resolving 1080p...`
  - attempt Otakudesu host resolution for that quality only
  - switch only if a direct playable source is found
  - keep the current stream untouched if resolution fails

## Error Handling
- If the initial autoplay source fails:
  - keep the player open
  - show `Stream failed. Try another quality.`
- If a selected fallback quality fails:
  - keep the current stream active
  - show a compact error such as `1080p could not be resolved.`
- If no playable quality can be resolved at all:
  - keep the existing `Playback unavailable` behavior in `DetailScreen.tsx`

## Caching Rules
- Cache resolved direct URLs only in memory for the current player session.
- Do not write anime playback URLs to persistent storage.
- If a fallback quality resolves once during the active player session, reuse that direct URL for later switches in the same session.

## File-Level Impact
- `ReealmsExpo/src/data/models/playback.ts`
  - expand the playback model to represent verified and deferred quality options
- `ReealmsExpo/src/data/services/apiService.ts`
  - parse all Otakudesu quality groups
  - build the playback manifest
  - add deferred per-quality resolution entry points
- `ReealmsExpo/src/ui/screens/DetailScreen.tsx`
  - request the playback manifest instead of a single direct source
  - pass the manifest into the player screen
- `ReealmsExpo/src/ui/screens/DramaPlayerScreen.tsx`
  - render the quality selector
  - handle on-demand resolution and source switching

## Testing Strategy
- Unit tests for Otakudesu quality-group extraction from episode HTML
- Unit tests for manifest ranking and quality deduplication
- Unit tests for deferred quality resolution behavior
- Manual device verification in Expo Go:
  - `Auto -> 480p -> 720p`
  - failed `1080p` fallback without losing current playback
  - episode queue still works after quality switches

## Non-Goals
- No host-picker UI
- No anime WebView fallback
- No persistence of signed direct stream URLs
- No attempt to make Otakudesu host metadata user-visible in the player
