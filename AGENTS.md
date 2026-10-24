# Agent Guide

React Native library bridging the Bunny Stream iOS/Android SDKs. **New
Architecture only** (TurboModules + Fabric codegen) — no Old Arch fallbacks.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first: it documents the layers,
codegen contract, platform invariants, and the checklist for spec changes.

## Quick rules

- All native access goes through `src/specs/` (codegen). A spec change requires
  matching iOS (`.mm` + `*Impl.swift`) **and** Kotlin updates in one change.
- API/upload methods return `Promise<BunnyResult<T>>` — never reject.
- `initialize(accessKey, libraryId)` must run before players/API use; a blank
  `accessKey` selects playback-only mode (management/upload/broadcast need a real key).
- Expo plugin sources live in `plugin/src`; run `yarn plugin:build` before
  `expo prebuild`.
- Code, docs, and commit messages in English; conventional commits enforced
  by lefthook + commitlint.
- User-facing changes add an entry to `CHANGELOG.md` under `[Unreleased]`.
  `yarn release` dates those entries and uses them as GitHub release notes.
- Never commit Bunny access keys or secrets.
- Never run `git commit` or `git push` on your own — only when the user
  explicitly asks for a commit or push in the current request.

## Verify

```bash
yarn typecheck && yarn lint && yarn test
yarn test:release             # changelog preparation and release notes
yarn native-baselines:check   # if native SDK versions/paths changed
yarn prepare                  # full library + plugin build
```

Dev loop: `yarn example:ios` / `yarn example:android` (Metro resolves `src/`
directly). See `CONTRIBUTING.md` for setup details.
