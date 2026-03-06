# Premium UI Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the Expo app's visual quality on the four highest-visibility screens so the product feels more polished, premium, and cohesive without changing working behavior.

**Architecture:** Refine the shared visual system first in `theme.ts` and the reusable presentation components, then apply those shared rules to `HomeScreen`, `DetailScreen`, `DramaPlayerScreen`, and `AnimeWebViewScreen`. Keep navigation, data flow, and current feature behavior intact.

**Tech Stack:** Expo SDK 55, React Native, TypeScript, `expo-video`, `react-native-webview`

---

### Task 1: Tighten the shared visual system

**Files:**
- Modify: `ReealmsExpo/src/core/theme.ts`

**Step 1: Review the current palette and surface tokens**
- Identify where orange and cyan accents are overcompeting.
- Identify which surface and gradient tokens are reused across the target screens.

**Step 2: Refine the theme**
- Tighten accent usage.
- Add or adjust surface, border, gradient, and text hierarchy tokens that support the premium direction.
- Keep the existing dark cinematic base.

**Step 3: Run targeted typecheck if needed**

Run: `npm run typecheck`
Expected: PASS

### Task 2: Upgrade the shared content selectors and cards

**Files:**
- Modify: `ReealmsExpo/src/ui/components/MovieCard.tsx`
- Modify: `ReealmsExpo/src/ui/components/SourcePill.tsx`

**Step 1: Refine `SourcePill`**
- Restyle it into a cleaner premium segmented-selector feel.
- Improve active vs inactive contrast without making every pill glow.

**Step 2: Refine `MovieCard`**
- Tighten poster overlay treatment, metadata hierarchy, and spacing.
- Reduce visual clutter while keeping title and source context readable.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 3: Rebuild the Home screen hierarchy

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/HomeScreen.tsx`

**Step 1: Replace the migration-status feel**
- Remove user-facing migration/dev framing.
- Build a proper featured-content hero with a stronger visual lead.

**Step 2: Apply the new selector and card language**
- Use the refined source selector and poster presentation consistently.
- Improve section spacing, header balance, and grid density.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 4: Rebuild the Detail screen hierarchy

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx`

**Step 1: Strengthen the hero composition**
- Make poster, title, metadata, and synopsis read as one deliberate block.

**Step 2: Simplify the action area**
- Give the primary action more emphasis.
- Reduce badge and pill noise.

**Step 3: Improve the episode browser**
- Tighten spacing and grouping so the episode area feels premium instead of crowded.

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 5: Polish the Drama player chrome

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DramaPlayerScreen.tsx`

**Step 1: Rebalance player emphasis**
- Give timeline and play state stronger priority.
- Reduce the utility-first feel of top badges, queue cards, and secondary actions.

**Step 2: Align player surfaces with the new visual system**
- Use calmer spacing, quieter borders, and more premium grouping.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 6: Polish the Anime player chrome

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`

**Step 1: Align the anime player with the drama player**
- Apply the same hierarchy and chrome language.
- Keep the quality pill and status card, but make them feel less tooling-like.

**Step 2: Improve wrapper and loading states**
- Make the owned WebView route feel intentional and premium.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 7: Verify the Expo app

**Files:**
- Modify: target UI files above only if verification finds regressions

**Step 1: Run the full test suite**

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
