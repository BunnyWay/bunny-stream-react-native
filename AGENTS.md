# Agent Guide

React Native library bridging the Bunny Stream iOS/Android SDKs. **New
Architecture only** (TurboModules + Fabric codegen) — no Old Arch fallbacks.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first: it documents the layers,
codegen contract, platform invariants, and the checklist for spec changes.

## Quick rules

- All native access goes through `src/specs/` (codegen). A spec change requires
  matching iOS (`.mm` + `*Impl.swift`) **and** Kotlin updates in one change.
- API/upload methods return `Promise<BunnyResult<T>>` — never reject.
- `initialize(accessKey, libraryId)` must run before players/API use.
- Expo plugin sources live in `plugin/src`; run `yarn plugin:build` before
  `expo prebuild`.
- Code, docs, and commit messages in English; conventional commits enforced
  by lefthook + commitlint.
- Never commit Bunny access keys or secrets.

## Verify

```bash
yarn typecheck && yarn lint && yarn test
yarn native-baselines:check   # if native SDK versions/paths changed
yarn prepare                  # full library + plugin build
```

Dev loop: `yarn example:ios` / `yarn example:android` (Metro resolves `src/`
directly). See `CONTRIBUTING.md` for setup details.
