# Anime Episode Numbering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Otakudesu episode labels in the Expo app so season tags like `S2` and `S3` no longer replace the real episode number.

**Architecture:** Add a small pure helper for Otakudesu episode number extraction and entry shaping, then reuse it from `ApiService.scrapeOtakudesuEpisodes()`. The helper will prefer explicit episode markers in titles and URLs, then fall back to the last standalone number instead of the first one.

**Tech Stack:** TypeScript, Expo, Node test runner with `tsx`

---

### Task 1: Add Regression Coverage

**Files:**
- Create: `D:\Project_Gabut\reealms\ReealmsExpo\src\data\services\animeEpisodeUtils.test.ts`
- Create: `D:\Project_Gabut\reealms\ReealmsExpo\src\data\services\animeEpisodeUtils.ts`

**Step 1: Write the failing test**

Add tests for:
- `Sousou no Frieren S2 Episode 7` resolves to episode `7`
- `https://otakudesu.blog/episode/snf-s2-episode-7-sub-indo/` resolves to episode `7`
- `Jujutsu Kaisen S3 Episode 3` resolves to episode `3`
- built episode entries use `Episode N` labels from the resolved number

**Step 2: Run test to verify it fails**

Run: `npm test -- src/data/services/animeEpisodeUtils.test.ts`

Expected: FAIL because the helper does not exist yet.

### Task 2: Patch Otakudesu Episode Parsing

**Files:**
- Modify: `D:\Project_Gabut\reealms\ReealmsExpo\src\data\services\apiService.ts`
- Create: `D:\Project_Gabut\reealms\ReealmsExpo\src\data\services\animeEpisodeUtils.ts`

**Step 1: Write minimal implementation**

Implement a helper that:
- strips HTML tags from the episode title
- prefers `episode 7`, `ep 7`, and slug patterns like `-episode-7-`
- falls back to the last standalone number instead of the first one
- returns a normalized `Episode` entry with the correct `title` and `order`

**Step 2: Run test to verify it passes**

Run: `npm test -- src/data/services/animeEpisodeUtils.test.ts`

Expected: PASS

### Task 3: Full Verification

**Files:**
- Modify: `D:\Project_Gabut\reealms\ReealmsExpo\src\data\services\apiService.ts`
- Update notes: `Reealms/context.md`, `Reealms/decisions.md`, `Reealms/migration.md`

**Step 1: Run project verification**

Run:
- `npm test`
- `npm run typecheck`
- `npx expo-doctor`
- `npx expo export --platform android`

**Step 2: Record the fix**

Append the root cause and result to the `Reealms/` Obsidian notes.
