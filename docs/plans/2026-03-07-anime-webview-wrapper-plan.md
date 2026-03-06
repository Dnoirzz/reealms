# Anime WebView Wrapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Expo native anime playback path with an app-owned WebView video wrapper that uses resolved direct Otakudesu URLs and retries fallback hosts inside the WebView.

**Architecture:** Keep the existing resolver and playback manifest in `ApiService`, but stop sending anime into `DramaPlayerScreen`. Instead, `DetailScreen` will open `AnimeWebViewScreen` with a manifest-aware payload, and that screen will render local HTML containing a `<video>` element that can retry alternate direct URLs on media error.

**Tech Stack:** Expo, React Native, `react-native-webview`, TypeScript, node test runner

---

### Task 1: Add manifest-aware anime player helpers

**Files:**
- Create: `ReealmsExpo/src/ui/screens/animeWebViewPlayerHtml.ts`
- Test: `ReealmsExpo/src/ui/screens/animeWebViewPlayerHtml.test.ts`

**Step 1: Write the failing test**
- Add tests for:
  - building HTML with the initial URL
  - embedding fallback URLs in order
  - surfacing a safe title string

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/ui/screens/animeWebViewPlayerHtml.test.ts"`
Expected: FAIL because the helper file does not exist yet

**Step 3: Write minimal implementation**
- Create a pure helper that accepts `{ title, initialUrl, fallbackUrls }`
- Return a full HTML string with:
  - a `<video controls playsinline autoplay>` element
  - a JS array of URLs in retry order
  - media-error handling that advances to the next URL
  - WebView message hooks for `ready`, `fallback`, `error`, `enterFullscreen`, and `exitFullscreen`

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/ui/screens/animeWebViewPlayerHtml.test.ts"`
Expected: PASS

### Task 2: Route anime detail playback into the new screen

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx`
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`
- Test: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`

**Step 1: Write the failing test**
- Add the smallest testable helper coverage needed for passing the anime manifest and fallback URLs through the route state.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/ui/screens/playerQualitySessionUtils.test.ts"`
Expected: FAIL on the new anime-routing helper expectation

**Step 3: Write minimal implementation**
- Update `DetailScreen` so `movie.sourceType === 'otakudesu'` opens `AnimeWebViewScreen`
- Pass:
  - `title`
  - `initialUrl`
  - `fallbackUrls`
- Keep drama and comic flows unchanged

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/ui/screens/playerQualitySessionUtils.test.ts"`
Expected: PASS

### Task 3: Replace provider-page WebView behavior with app-owned HTML playback

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`
- Modify: `ReealmsExpo/src/data/models/playback.ts`
- Test: `ReealmsExpo/src/ui/screens/animeWebViewPlayerHtml.test.ts`

**Step 1: Write the failing test**
- Extend the HTML helper test or screen-adjacent helper test to require fallback URL retries and message emission.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test "src/ui/screens/animeWebViewPlayerHtml.test.ts"`
Expected: FAIL on the new retry/message behavior

**Step 3: Write minimal implementation**
- Simplify `AnimeWebViewScreen` props to use direct URLs rather than provider-page navigation
- Remove provider-host filtering and injected DOM automation that assumed Otakudesu pages
- Feed `WebView` with `source={{ html, baseUrl: 'https://otakudesu.blog/' }}`
- Handle messages for:
  - ready state
  - fallback attempts
  - terminal failure
  - fullscreen toggles

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test "src/ui/screens/animeWebViewPlayerHtml.test.ts"`
Expected: PASS

### Task 4: Verify the full Expo app after the route switch

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx` if verification reveals route issues
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx` if verification reveals wrapper issues

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
