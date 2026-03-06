# Premium UI Consolidation Design

## Goal
- Tighten the Expo app's highest-visibility surfaces so `Home`, `Detail`, `Drama player`, and `Anime player` feel like one premium streaming product instead of a collection of working screens.

## Scope
- Focus only on:
  - `ReealmsExpo/src/ui/screens/HomeScreen.tsx`
  - `ReealmsExpo/src/ui/screens/DetailScreen.tsx`
  - `ReealmsExpo/src/ui/screens/DramaPlayerScreen.tsx`
  - `ReealmsExpo/src/ui/screens/AnimeWebViewScreen.tsx`
- Refine shared presentation pieces first:
  - `ReealmsExpo/src/core/theme.ts`
  - `ReealmsExpo/src/ui/components/MovieCard.tsx`
  - `ReealmsExpo/src/ui/components/SourcePill.tsx`
- Do not redesign navigation or data flow in this pass.

## Visual Direction
- Keep the current dark cinematic base.
- Reduce the orange/cyan competition so accents feel intentional.
- Make surfaces feel layered through contrast, gradients, and calmer borders instead of stacking more boxes.
- Tighten typography hierarchy with stronger titles, quieter secondary copy, and fewer tiny labels competing for attention.
- Favor one dominant visual zone per screen with cleaner secondary metadata and action groups.

## Shared UI Rules
- Poster and player surfaces should use larger radii and quieter edge treatment.
- Section spacing should create clearer breaks between hero, metadata, actions, and content rails.
- Badges and pills should feel lighter and more product-like, not like utility chips.
- Primary actions should stand out; secondary actions should recede.
- Repeated developer-facing or migration-facing copy should be removed from user-facing surfaces.

## Home Screen
- Replace the current status-like hero with a real featured-content hero.
- Keep the source switcher, but restyle it as a premium segmented selector.
- Make the poster grid denser and more consistent.
- Reduce noisy copy so poster art, title, and one supporting metadata line do most of the work.

## Detail Screen
- Strengthen the header into a cleaner poster-plus-metadata composition.
- Give the primary play/read action stronger visual priority.
- Simplify supporting pills and actions to reduce the current button-heavy feel.
- Make the episode area feel like a proper season or queue browser with more deliberate spacing and clearer grouping.

## Drama Player
- Calm the top chrome and reduce how many controls compete equally.
- Give the timeline and primary playback action more visual priority.
- Keep source and quality context available without making them look like debug tools.
- Make the episode queue feel like a premium continuation rail instead of a dense control list.

## Anime Player
- Align the header, spacing, and status language with the drama player so both players feel like one system.
- Keep the quality pill and status card, but make them quieter and more premium.
- Improve the loading and wrapper states so the WebView route feels owned by the app, not bolted on.

## Guardrails
- Preserve all current working behavior for source switching, detail navigation, playback, and quality selection.
- Keep layouts solid on phone widths first and maintain intentional spacing on wider screens.
- Prefer refinement over novelty; the target is premium cohesion, not a totally different brand language.
