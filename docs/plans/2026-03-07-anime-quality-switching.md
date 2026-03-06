# Anime Quality Switching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Otakudesu anime quality switching to the Expo player so the app autoplays the best direct source, shows `Auto` plus page-listed qualities, and switches or falls back without leaving the player.

**Architecture:** Keep the current Expo player screen, but add a richer Otakudesu playback manifest between `DetailScreen` and `DramaPlayerScreen`. The resolver will scrape all Otakudesu quality groups, rank verified direct sources above deferred fallbacks, and expose a player-safe quality menu. The player will keep session-only resolved URLs in memory and switch source URLs while preserving position and play state.

**Tech Stack:** TypeScript, Expo SDK 55, `expo-video`, Node test runner with `tsx`, Otakudesu HTML scraping in `ApiService`

---

### Task 1: Add playback manifest types and Otakudesu quality parsing utilities

**Files:**
- Modify: `ReealmsExpo/src/data/models/playback.ts:1-8`
- Create: `ReealmsExpo/src/data/services/otakudesuQualityUtils.ts`
- Test: `ReealmsExpo/src/data/services/otakudesuQualityUtils.test.ts`

**Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeAnimeQualityOptions,
  parseOtakudesuQualitySections,
} from './otakudesuQualityUtils';

const html = `
  <ul class="m360p"><li><a href="#" data-content="360-filedon">filedon</a></li></ul>
  <ul class="m480p"><li><a href="#" data-content="480-ondesu">ondesu</a></li></ul>
  <ul class="m720p"><li><a href="#" data-content="720-filedon">filedon</a></li></ul>
`;

test('parseOtakudesuQualitySections reads all mirrored quality groups', () => {
  const sections = parseOtakudesuQualitySections(html, 'https://otakudesu.blog/episode/test/');
  assert.deepEqual(
    sections.map((entry) => entry.label),
    ['360p', '480p', '720p'],
  );
});

test('mergeAnimeQualityOptions keeps Auto first and prefers direct options over fallback entries', () => {
  const merged = mergeAnimeQualityOptions({
    initialUrl: 'https://cdn.example.com/anime-720.mp4',
    directOptions: [{ label: '720p', url: 'https://cdn.example.com/anime-720.mp4', rank: 720 }],
    fallbackOptions: [
      { label: '1080p', rank: 1080, episodeUrl: 'https://otakudesu.blog/episode/test/', mirrors: [] },
      { label: '720p', rank: 720, episodeUrl: 'https://otakudesu.blog/episode/test/', mirrors: [] },
    ],
  });

  assert.deepEqual(
    merged.map((entry) => [entry.label, entry.mode]),
    [['Auto', 'direct'], ['720p', 'direct'], ['1080p', 'deferred']],
  );
});
```

**Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/data/services/otakudesuQualityUtils.test.ts
```

Expected: FAIL because `otakudesuQualityUtils.ts` and the new model shape do not exist yet.

**Step 3: Write minimal implementation**

```ts
export type PlaybackQualityOption =
  | {
      label: string;
      rank: number;
      mode: 'direct';
      url: string;
    }
  | {
      label: string;
      rank: number;
      mode: 'deferred';
      episodeUrl: string;
      mirrors: OtakudesuMirrorReference[];
    };

export interface AnimePlaybackManifest {
  initialUrl: string;
  qualityOptions: PlaybackQualityOption[];
}

const QUALITY_CLASS_TO_LABEL = {
  m360p: '360p',
  m480p: '480p',
  m720p: '720p',
  m1080p: '1080p',
} as const;
```

- In `playback.ts`, extend the quality model so it can represent direct and deferred entries cleanly.
- In `otakudesuQualityUtils.ts`, add:
  - `parseOtakudesuQualitySections(html, episodeUrl)`
  - `mergeAnimeQualityOptions({ initialUrl, directOptions, fallbackOptions })`
  - helper ranking and dedupe logic

**Step 4: Run test to verify it passes**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/data/services/otakudesuQualityUtils.test.ts
```

Expected: PASS with both parsing and ranking tests green.

**Step 5: Commit**

```powershell
cd D:\Project_Gabut\reealms
git add ReealmsExpo/src/data/models/playback.ts ReealmsExpo/src/data/services/otakudesuQualityUtils.ts ReealmsExpo/src/data/services/otakudesuQualityUtils.test.ts
git commit -m "feat: add anime quality manifest parsing"
```

### Task 2: Expose Otakudesu playback manifests and deferred quality resolution from `ApiService`

**Files:**
- Modify: `ReealmsExpo/src/data/services/apiService.ts:277-315`
- Modify: `ReealmsExpo/src/data/services/apiService.ts:1050-1110`
- Test: `ReealmsExpo/src/data/services/apiService.otakudesuQuality.test.ts`

**Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import apiServiceModule from './apiService';

const { ApiService } = apiServiceModule;

test('getOtakudesuPlaybackManifest returns Auto plus fallback qualities from the episode page', async () => {
  const api = new ApiService();
  api.setSource('otakudesu');

  global.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/episode/test-episode/')) {
      return new Response(`
        <ul class="m360p"><li><a href="#" data-content="360-filedon">filedon</a></li></ul>
        <ul class="m480p"><li><a href="#" data-content="480-filedon">filedon</a></li></ul>
        <ul class="m720p"><li><a href="#" data-content="720-filedon">filedon</a></li></ul>
      `, { status: 200 });
    }
    return new Response('', { status: 404 });
  };

  const manifest = await api.getOtakudesuPlaybackManifest('https://otakudesu.blog/episode/test-episode/');
  assert.ok(manifest);
  assert.deepEqual(
    manifest?.qualityOptions.map((entry) => entry.label),
    ['Auto', '720p', '480p', '360p'],
  );
});
```

**Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/data/services/apiService.otakudesuQuality.test.ts
```

Expected: FAIL because `ApiService` does not expose `getOtakudesuPlaybackManifest()` yet.

**Step 3: Write minimal implementation**

```ts
async getOtakudesuPlaybackManifest(episodeUrl: string): Promise<AnimePlaybackManifest | null> {
  const html = await this.requestText(episodeUrl, { timeoutMs: 10000 });
  const fallbackOptions = parseOtakudesuQualitySections(html, episodeUrl);
  const directSource = await this.getBestOtakudesuPlayableSource(episodeUrl);

  if (!directSource?.url && fallbackOptions.length === 0) {
    return null;
  }

  return {
    initialUrl: directSource?.url ?? '',
    qualityOptions: mergeAnimeQualityOptions({
      initialUrl: directSource?.url ?? '',
      directOptions: directSource?.qualityOptions ?? [],
      fallbackOptions,
    }),
  };
}

async resolveOtakudesuQualityOption(option: PlaybackQualityOption): Promise<ResolvedPlayableSource | null> {
  if (option.mode === 'direct') {
    return { url: option.url, qualityOptions: [] };
  }
  return this.resolveDeferredOtakudesuQuality(option);
}
```

- Change the mirror-collection logic so it can gather quality-scoped candidates for `360p`, `480p`, `720p`, and `1080p`.
- Keep `getBestOtakudesuPlayableSource()` for the initial autoplay path, but add:
  - `getOtakudesuPlaybackManifest()`
  - `resolveOtakudesuQualityOption()`
- Reuse existing page, iframe, Blogger, and direct-video resolution logic instead of introducing a second resolver stack.

**Step 4: Run tests and typecheck**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/data/services/apiService.otakudesuQuality.test.ts
npm run typecheck
```

Expected: PASS and no TypeScript errors.

**Step 5: Commit**

```powershell
cd D:\Project_Gabut\reealms
git add ReealmsExpo/src/data/services/apiService.ts ReealmsExpo/src/data/services/apiService.otakudesuQuality.test.ts
git commit -m "feat: expose otakudesu playback manifests"
```

### Task 3: Wire the Otakudesu playback manifest into the detail flow

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx:65-66`
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx:136-181`
- Modify: `ReealmsExpo/src/ui/screens/DetailScreen.tsx:199-204`
- Test: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts`
- Create: `ReealmsExpo/src/ui/screens/playerQualitySessionUtils.ts`

**Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { getEpisodeManifest } from './playerQualitySessionUtils';

test('getEpisodeManifest returns the manifest for the active episode and falls back to null safely', () => {
  const manifest = { initialUrl: 'https://cdn.example.com/a.mp4', qualityOptions: [] };
  const lookup = { 'episode-1': manifest };

  assert.equal(getEpisodeManifest(lookup, 'episode-1'), manifest);
  assert.equal(getEpisodeManifest(lookup, 'episode-2'), null);
});
```

**Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/ui/screens/playerQualitySessionUtils.test.ts
```

Expected: FAIL because the helper file does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function getEpisodeManifest(
  manifests: Record<string, AnimePlaybackManifest> | undefined,
  episodeId: string,
): AnimePlaybackManifest | null {
  if (!manifests || !episodeId) {
    return null;
  }

  return manifests[episodeId] ?? null;
}
```

- In `DetailScreen.tsx`, replace the anime `getBestOtakudesuPlayableSource()` call with `getOtakudesuPlaybackManifest()`.
- Extend `videoQueueState` so it can carry:
  - `episodes`
  - `initialIndex`
  - `qualityManifestsByEpisodeId`
- For Otakudesu, store the manifest under the active episode ID and keep the current one-episode queue behavior.
- For drama and comics, do not change behavior.

**Step 4: Run tests and typecheck**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/ui/screens/playerQualitySessionUtils.test.ts
npm run typecheck
```

Expected: PASS and no `DetailScreen` type errors.

**Step 5: Commit**

```powershell
cd D:\Project_Gabut\reealms
git add ReealmsExpo/src/ui/screens/DetailScreen.tsx ReealmsExpo/src/ui/screens/playerQualitySessionUtils.ts ReealmsExpo/src/ui/screens/playerQualitySessionUtils.test.ts
git commit -m "feat: pass anime quality manifests to player"
```

### Task 4: Add player quality selection, deferred resolution, and source switching

**Files:**
- Modify: `ReealmsExpo/src/ui/screens/DramaPlayerScreen.tsx:1-220`
- Modify: `ReealmsExpo/src/data/models/playback.ts:1-40`
- Test: `ReealmsExpo/src/ui/screens/playerQualitySwitchUtils.test.ts`
- Create: `ReealmsExpo/src/ui/screens/playerQualitySwitchUtils.ts`

**Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQualityStatusMessage, buildSelectableQualityItems } from './playerQualitySwitchUtils';

test('buildSelectableQualityItems keeps Auto first and marks deferred qualities as unresolved', () => {
  const items = buildSelectableQualityItems([
    { label: 'Auto', rank: 9999, mode: 'direct', url: 'https://cdn.example.com/a.mp4' },
    { label: '1080p', rank: 1080, mode: 'deferred', episodeUrl: 'https://otakudesu.blog/episode/test/', mirrors: [] },
  ]);

  assert.deepEqual(
    items.map((entry) => [entry.label, entry.isDeferred]),
    [['Auto', false], ['1080p', true]],
  );
});

test('buildQualityStatusMessage formats a compact fallback resolution failure', () => {
  assert.equal(buildQualityStatusMessage({ failedLabel: '1080p' }), '1080p could not be resolved.');
});
```

**Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/ui/screens/playerQualitySwitchUtils.test.ts
```

Expected: FAIL because the player quality helpers do not exist yet.

**Step 3: Write minimal implementation**

```ts
const [selectedQualityLabel, setSelectedQualityLabel] = React.useState('Auto');
const [isResolvingQuality, setIsResolvingQuality] = React.useState(false);
const [qualityError, setQualityError] = React.useState<string | null>(null);
const [resolvedQualityCache, setResolvedQualityCache] = React.useState<Record<string, string>>({});

async function handleQualitySelect(option: PlaybackQualityOption) {
  const previousTime = player.currentTime;
  const wasPlaying = player.playing;

  if (option.mode === 'direct') {
    replaceSource(option.url, previousTime, wasPlaying);
    return;
  }

  setIsResolvingQuality(true);
  const resolved = await apiService.resolveOtakudesuQualityOption(option);
  if (!resolved?.url) {
    setQualityError(`${option.label} could not be resolved.`);
    setIsResolvingQuality(false);
    return;
  }

  replaceSource(resolved.url, previousTime, wasPlaying);
}
```

- Add a `qualityManifestsByEpisodeId` prop to `DramaPlayerScreen`.
- Add a `Quality` control in the top bar that stays close to the Flutter app behavior.
- Use `expo-video` source replacement:
  - preserve `currentTime`
  - preserve play or pause state
  - never tear down playback if a fallback quality fails
- Reuse in-memory resolved URLs for the active player session.
- Keep the current drama path working by treating drama entries as `Auto`-only unless direct qualities already exist.

**Step 4: Run tests and full project verification**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
node --import tsx --test src/ui/screens/playerQualitySwitchUtils.test.ts
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform android
```

Expected: all commands PASS.

**Step 5: Commit**

```powershell
cd D:\Project_Gabut\reealms
git add ReealmsExpo/src/ui/screens/DramaPlayerScreen.tsx ReealmsExpo/src/ui/screens/playerQualitySwitchUtils.ts ReealmsExpo/src/ui/screens/playerQualitySwitchUtils.test.ts ReealmsExpo/src/data/models/playback.ts
git commit -m "feat: add anime quality switching in player"
```

### Task 5: Manual Expo Go verification on device

**Files:**
- Modify: none unless a bug is found

**Step 1: Start the Expo app with a clean bundle**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
npm start -- --tunnel -c
```

Expected: Metro starts and shows a QR code for Expo Go.

**Step 2: Verify Otakudesu behavior on-device**

Check:
- `Auto` starts playback for a known working episode
- quality menu shows page-listed choices when available
- switching `Auto -> 480p -> 720p` keeps position close to the prior timestamp
- selecting a broken fallback quality keeps the current stream alive and shows a compact error
- backing out and re-entering the episode still works

**Step 3: If a regression appears, add the smallest failing test before fixing it**

Run:
```powershell
cd D:\Project_Gabut\reealms\ReealmsExpo
npm test
npm run typecheck
```

Expected: the automated suite remains green after any follow-up fix.
