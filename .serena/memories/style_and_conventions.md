# Style and conventions
- Keep changes pragmatic and scoped; preserve existing architecture unless explicitly changing it.
- For Expo/TypeScript code, keep modules small and favor pure helpers for testable behavior.
- For Flutter code, the project uses layered separation between `data`, `logic`, and `ui`.
- UI text is largely Indonesian-facing, but current Expo migration code may contain English internal status copy.
- Prefer direct, app-owned playback flows over provider pages when possible.
- Use `apply_patch` for manual file edits when working through Codex.
- Prefer `rg` for searching.
