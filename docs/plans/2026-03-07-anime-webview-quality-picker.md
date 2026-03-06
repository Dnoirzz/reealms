# Anime WebView Quality Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an anime-only resolution picker to the WebView player so users can choose between available Otakudesu qualities without leaving the stable direct-stream wrapper.

**Architecture:** Keep `AnimeWebViewScreen` as the playback shell and keep `animeWebViewPlayerHtml.ts` focused on retrying an ordered URL list. Extend the anime playback session and screen state so quality selection happens in React Native, with deferred quality resolution performed through `ApiService` and cached only for the current player session.

**Tech Stack:** Expo SDK 55, React Native, TypeScript, `react-native-webview`, `expo-screen-orientation`, node test runner

---

### Task 1: Add anime quality session helpers

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.ts`
- Modify: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`

**Step 1: Write the failing test**
- Add tests for:
  - building visible anime quality items from a manifest with `Auto` first
  - building ordered source lists for `Auto`
  - building ordered source lists for a direct selected quality

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: FAIL because the new anime quality helper functions do not exist yet

**Step 3: Write minimal implementation**
- Extend the anime session shape to include `qualityOptions`
- Add helpers that:
  - convert `PlaybackQualityOption[]` into UI items
  - build the ordered URL list for a selected direct quality or `Auto`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: PASS

### Task 2: Add deferred anime quality cache behavior

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.ts`
- Modify: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`

**Step 1: Write the failing test**
- Add a test for caching a resolved deferred quality URL by label for the current anime session.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: FAIL because the deferred cache helper does not exist yet

**Step 3: Write minimal implementation**
- Add a helper or state-shape support for storing and reusing resolved deferred quality URLs by label.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: PASS

### Task 3: Pass manifest quality data into the anime session

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx`
- Modify: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.ts`
- Test: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`

**Step 1: Write the failing test**
- Extend the existing anime session test so the session keeps `qualityOptions` from the playback manifest.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: FAIL because `buildAnimeWebViewSession()` does not yet keep the manifest quality data

**Step 3: Write minimal implementation**
- Update `buildAnimeWebViewSession()` and `DetailScreen` so the anime route keeps the manifest quality options alongside URLs.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: PASS

### Task 4: Add the anime quality pill and tray to the WebView screen

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`
- Modify: `ReealmsExpo/src/ui/screens/animeWebViewMessageUtils.ts` only if state handling needs a small extension
- Test: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`

**Step 1: Write the failing test**
- Add the smallest helper-level test needed for the chosen-label and ordered-source behavior used by the screen.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: FAIL because the helper behavior is not implemented yet

**Step 3: Write minimal implementation**
- Add the top-right quality pill
- Add the horizontal tray
- Hide both in fullscreen
- Keep `Auto` selected by default
- Rebuild the WebView key/source order when the user picks a direct quality

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: PASS

### Task 5: Resolve deferred anime qualities on demand

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`
- Test: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`

**Step 1: Write the failing test**
- Add a helper-level test showing that a cached deferred quality is reused on the second selection.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: FAIL before the screen uses deferred quality caching correctly

**Step 3: Write minimal implementation**
- On deferred quality selection:
  - show `Resolving <label>...`
  - resolve through `ApiService.resolveOtakudesuQualityOption()`
  - cache the result by label
  - rebuild the WebView source order with the resolved URL first

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/playerQualitySessionUtils.test.ts`
Expected: PASS

### Task 6: Verify the Expo app

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx` if verification finds integration issues
- Modify: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.ts` if verification finds session issues

**Step 1: Run the full automated test suite**

Run: `npm test`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run Expo doctor**

Run: `npx expo-doctor`
Expected: PASS

**Step 4: Run Android export**

Run: `npx expo export --platform android`
Expected: PASS
