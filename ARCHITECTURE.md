# Architecture

`@bunny.net/stream-react-native` is a React Native library that wraps the
official Bunny Stream native SDKs — [iOS](https://github.com/BunnyWay/bunny-stream-ios)
(SwiftPM, pinned by commit) and [Android](https://github.com/BunnyWay/bunny-stream-android)
(Maven Central `net.bunny:*` artifacts) — behind one TypeScript API.

**New Architecture only**: TurboModules + Fabric codegen. No Old Arch
fallbacks exist anywhere; do not add bridge/legacy-arch code paths.

## Layers

```text
src/  public TS API  ──►  src/specs/  codegen contract  ──►  ios/ · android/  native glue
                                                              │
                                          BunnyStream iOS SDK · BunnyStream Android SDK
```

Changes flow strictly downward. `src/` never imports native files directly;
all native access goes through `src/specs/`. When you change a spec, you must
update **both** platform implementations in the same change or the app breaks
at runtime (codegen types are generated per platform).

### `src/specs/` — codegen contract (single source of truth)

- `NativeBunnyStreamPlayer.ts` — TurboModule: `initialize`, TV detection,
  playback speeds, resume-position CRUD.
- `NativeBunnyStreamApi.ts` — TurboModule: all Bunny REST API operations.
- `NativeBunnyStreamUpload.ts` — TurboModule: upload lifecycle.
- `*NativeComponent.ts` — Fabric components: VOD player, live player,
  broadcaster. Props/events/commands are declared here.

Codegen config lives in `package.json` (`codegenConfig`, spec name
`BunnyStreamReactNativeSpec`, Android package `net.bunny.reactnative`).
`src/__tests__/codegen-contract.typecheck.ts` guards the public-API/codegen
type surface.

### `src/` — public TypeScript API

| Dir | Responsibility |
| --- | --- |
| `config/` | `initialize(accessKey, libraryId)` — validates inputs **before** calling native (SDK ≥4 rejects empty keys), stores the configured `libraryId` used as fallback. |
| `player/` | `BunnyStreamPlayer` component (one component for VOD + live), `useBunnyStreamPlayer` hook, resume positions, source identity. |
| `api/` | `BunnyStreamApi` — typed wrapper over the TurboModule; `result/` holds `BunnyResult` + helpers (`fold`, `getOrNull`, …); `models/` holds request/response types. |
| `upload/` | `BunnyStreamUpload` — start/continue/pause/resume/cancel + event subscriptions. |
| `broadcaster/` | `BunnyStreamBroadcaster` camera-broadcast component. |
| `image/` | `BunnyImage` — RN `Image` with the `Referer` header Bunny CDN hotlink protection requires. |
| `internal/` | Cross-cutting internals (e.g. `liveStateEvent` normalization). Not exported publicly. |

## Key invariants and conventions

- **`BunnyResult` envelope everywhere.** All API/upload control methods return
  `Promise<BunnyResult<T>>` and **never reject**. Keep it that way — errors
  carry a typed taxonomy (`BunnyErrorKind`, `isTerminal`).
- **Single VOD player instance.** The native VOD player is a singleton;
  `BunnyStreamPlayer` remounts the host view when `sourceIdentityKey(source)`
  changes. Live uses a *separate* Fabric component
  (`BunnyLiveStreamPlayerNativeComponent`) behind the same public component.
- **`libraryId` resolution.** `source.libraryId` is optional and falls back to
  the ID passed to `initialize()` (`player/resolveLibraryId.ts`,
  `config/initialize.ts:getConfiguredLibraryId`).
- **Resume positions are platform-split.** Android persists natively
  (SharedPreferences via TurboModule). iOS returns empty stubs — the JS
  AsyncStorage fallback (`player/hooks/resumeStorage.ts`) owns persistence and
  the public wrapper never calls the iOS native methods.
- **Platform asymmetry is intentional.** Android-only features (e.g. `useNativeTvPlayer`
  / `net.bunny:tv`) and iOS-only behaviors are documented in the source JSDoc
  of the owning file — mirror that pattern when adding platform-gated APIs.
- **Serialization at the boundary.** Complex props cross the bridge as JSON
  strings (e.g. `serializeWatermark`, `serializeVideoQuality` in
  `BunnyStreamPlayer.tsx`), validated on the JS side before dispatch.
- **Events**: component events go through codegen direct events; upload events
  go through `RCTDeviceEventEmitter` (`bunnyStreamUploadEvent`) via
  `NativeEventEmitter`.

### iOS (`ios/`)

Pattern: `X.h` + `X.mm` is the codegen glue (component descriptor, event
emitter, protocol conformance); `XImpl.swift` is the actual implementation the
`.mm` file delegates to. Configuration shared across modules lives in
`BunnyStreamConfiguration.swift`. Consumers must embed
`GoogleInteractiveMediaAds.framework` (handled by the Expo plugin;
`EMBED_FRAMEWORKS_SCRIPT` in `plugin/src/ios.ts` for manual setups).
`BUNNY_STREAM_IOS_SDK_PATH` can point the podspec at a local SDK checkout.

### Android (`android/`)

Package `net.bunny.reactnative`, split by concern:

- `module/` — TurboModule implementations (`BunnyStreamApiModule`,
  `BunnyStreamPlayerModule`, `BunnyStreamUploadModule`, `BunnyApiMappers`).
- `view/` — Fabric `ViewManager`s + views. Props **accumulate** on the view
  and are applied in `commitProps()` after the whole prop batch (`onAfterUpdateTransaction`).
- `commands/` — `CommandQueue` + `GenerationToken`: imperative commands are
  UI-thread-dispatched and stale generations are dropped (view remount safety).
- `ownership/` — `BunnyPlayerLease` guards the singleton player.
- `events/FabricEventEmitter.kt` — event dispatch to JS.

## Expo config plugin (`plugin/`)

`app.plugin.js` → `plugin/src/index.ts` (`withBunnyStream`). Mods touch
`AndroidManifest` (PiP, permissions), `build.gradle` (desugaring, Kotlin
version), `gradle.properties`, `Info.plist` (permissions, background audio),
and the Xcode project (embed-frameworks phase, SPM UUID fix in `spm.ts`).
Sources compile to `plugin/build` via `yarn plugin:build` — **rebuild before
`expo prebuild`** or stale output runs. `example-expo/` regenerates its native
dirs via CNG, so each prebuild is a plugin regression test.

## Native SDK versioning

`native-sdk-baselines.json` is the single pin for both SDKs (repo, ref, commit;
plus `mavenVersion` for Android). After bumping it — or when setting a local
SDK path — run `yarn native-baselines:check` to verify podspec/gradle agree.
`scripts/publish-android-sdk.mjs` publishes Android SDK artifacts (maintainers).

## Repo map

```text
src/          public TS API (player, api, upload, broadcaster, image, config)
src/specs/    codegen contract — TurboModules + Fabric components
ios/          Obj-C++ codegen glue (*.mm) + Swift impls (*Impl.swift); podspec
android/      Kotlin bridge (module/, view/, commands/, ownership/, state/)
plugin/       Expo config plugin (src → build via tsc)
example/      bare RN app — primary dev loop, feature-based src/features/*
example-expo/ Expo dev-build app — exercises app.plugin.js via CNG
docs/guides/  user-facing integration guides
scripts/      native SDK baseline verification + Android publishing
lib/          build output (react-native-builder-bob: commonjs/module/types)
```

## Build, test, verify

```bash
yarn typecheck              # tsc (library + plugin srcs via project refs)
yarn lint                   # eslint 9 + prettier
yarn test                   # jest, @react-native/jest-preset, src/__tests__
yarn prepare                # bob build → lib/  +  plugin:build
yarn native-baselines:check # podspec/gradle vs native-sdk-baselines.json
yarn fallow                 # dead-code/duplication health report (.fallowrc.json)
yarn codegen                # regenerate codegen into example/build/generated/codegen
```

Dev loop: `yarn example:ios` / `yarn example:android` — `example/` resolves the
library from `src/` via Metro (Fast Refresh, no library rebuild needed for TS
changes; native changes need a rebuild). `yarn example:typecheck` checks the
example app. Workspaces + turbo (`build:ios`, `build:android`) orchestrate the
examples; commits are conventional-commit linted via lefthook.

## When changing things, remember

- Adding a prop/event/command to a `specs/*NativeComponent` → update the `.mm`
  glue **and** `*Impl.swift` **and** the Kotlin `View` + `ViewManager` +
  `state/BunnyStreamPlayerProps`, then regenerate codegen.
- Adding a TurboModule method → update both `*Module` implementations and the
  public wrapper; keep the `BunnyResult` contract (map native errors, never
  reject).
- Android unit tests live in `android/src/test/` (JUnit); TS tests in
  `src/__tests__/`.
- Keep docs honest: public API changes → update `README.md` and the relevant
  `docs/guides/*`; platform-gated features → JSDoc on the owning file.
