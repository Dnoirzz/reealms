# Anime Fullscreen Orientation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lock the anime WebView player to landscape while fullscreen is active and unlock it when fullscreen ends.

**Architecture:** Keep the current anime WebView wrapper and resolver flow. Add a pure message-to-state helper for test coverage, then apply Expo Screen Orientation side effects only from `AnimeWebViewScreen`.

**Tech Stack:** Expo SDK 55, React Native, `react-native-webview`, `expo-screen-orientation`, TypeScript, node test runner

---

### Task 1: Add fullscreen message reducer coverage

**Files:**
- Create: `ReealmsExpo/src/ui/screens/animeWebViewMessageUtils.test.ts`
- Create: `ReealmsExpo/src/ui/screens/animeWebViewMessageUtils.ts`

**Step 1: Write the failing test**
- Add a test that expects `enterFullscreen` to set fullscreen mode and request landscape orientation.
- Add a test that expects `exitFullscreen` to clear fullscreen mode and request the default orientation policy.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/screens/animeWebViewMessageUtils.test.ts`
Expected: FAIL because the helper does not exist yet

**Step 3: Write minimal implementation**
- Add a pure helper that maps anime WebView messages to:
  - `isFullscreen`
  - `statusMessage`
  - `terminalError`
  - `orientationMode`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/screens/animeWebViewMessageUtils.test.ts`
Expected: PASS

### Task 2: Apply anime-only orientation locking

**Files:**
- Modify: `ReealmsExpo/package.json`
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`
- Test: `ReealmsExpo/src/ui/screens/animeWebViewMessageUtils.test.ts`

**Step 1: Install dependency**

Run: `npx expo install expo-screen-orientation`

**Step 2: Write minimal implementation**
- Use the helper in `AnimeWebViewScreen`
- Lock to landscape on fullscreen enter
- Unlock on fullscreen exit and on unmount
- Keep this behavior scoped to anime only

**Step 3: Run tests to verify behavior still passes**

Run: `npm test -- src/ui/screens/animeWebViewMessageUtils.test.ts`
Expected: PASS

### Task 3: Verify the Expo app

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx` if verification reveals issues

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
