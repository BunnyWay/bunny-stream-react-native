# Plan: integracja Expo (config plugin + przykładowa aplikacja)

Data: 2026-09-20. Bazuje na stanie po Fazie 8 (`plans/Audit-public-sdk-alignment.md`):
Android SDK `4.0.0` z Maven Central, iOS publiczny SwiftPM pin na commit `4158e2e`,
wrapper = TurboModule + Fabric (tylko New Architecture).

## 0. Cel i zakres

Umożliwić konsumpcję `bunny-stream-react-native` w aplikacjach Expo **z custom
native code** (development build / `expo prebuild` / EAS Build). Expo Go **nie
jest i nie będzie** wspierane — biblioteka zawiera natywny kod (Kotlin +
ObjC++/Swift), czego Go nie hostuje.

Wybrana ścieżka: **Expo Config Plugin** dostarczany w paczce npm. Biblioteka
jest już standardowym, autolinkowanym modułem RN — Expo autolinkuje biblioteki
RN automatycznie, więc cała robota to replikacja patchy host-app, które dziś
żyją imperatywnie w `example/` (`example/android/build.gradle`,
`example/ios/link_bunny_sdk.rb`).

**Odrzucona alternatywa:** przepisanie na Expo Modules API — straciłoby
infrastrukturę codegen (TurboModule/Fabric) z react-native-builder-bob i
zdublowało warstwę natywną bez korzyści.

## 1. Co plugin musi zreplikować (źródło prawdy = example app)

### Android (`example/android/build.gradle`, `example/app.json`)

| Wymaganie | Dziś | Mod pluginu |
| --- | --- | --- |
| `coreLibraryDesugaringEnabled true` + `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")` w module `:app` | patch `subprojects` w root `build.gradle` (SDK 4.0.0 wymaga desugaringu przez media3-exoplayer-ima/interactivemedia) | `withAppBuildGradle` — merge do istniejącego bloku `compileOptions` + `dependencies` |
| `android:supportsPictureInPicture="true"` + `android:configChanges="keyboard\|keyboardHidden\|orientation\|screenLayout\|screenSize\|smallestScreenSize\|uiMode"` na MainActivity | regex-patch wygenerowanego manifestu RNTA przed mergerem | `withAndroidManifest` — w Expo manifest jest prawdziwym plikiem, patch jest trywialny (bez hacku RNTA) |
| `CAMERA`, `RECORD_AUDIO` | `app.json` → permissions RNTA | `withAndroidManifest` / `AndroidConfig.Permissions.ensurePermissions` |
| `minSdkVersion = 26` (floor SDK Android) | `minSdkVersion` w `android/build.gradle` biblioteki | `withGradleProperties` → `android.minSdkVersion=26` (AGP i tak podniesie do max z deps, ale explicit > implicit) |
| `kotlinVersion ≥ 2.2.20` (SDK 4.0.0 ciągnie kotlin-stdlib 2.3.x — starszy kompilator nie czyta metadanych) | `kotlinVersion=2.2.20` w `android/gradle.properties` + buildscript biblioteki | `withGradleProperties` → `android.kotlinVersion=2.2.20` (template Expo czyta ten klucz; biblioteka dodatkowo czyta `rootProject.ext.kotlinVersion` przez `getExtOrDefault`) |

Maven Central i Google są już w domyślnym template Expo — brak potrzeby
`extraMavenRepos`. `missingDimensionStrategy("apiBase", "debug")` **nie jest
potrzebne** — dotyczyło konsumpcji SDK ze źródeł; artifact z Maven Central nie
niesie flavorów.

### iOS (`example/ios/link_bunny_sdk.rb`, podspec)

| Wymaganie | Dziś | Mod pluginu |
| --- | --- | --- |
| `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription` (teksty konfigurowalne) | patch wygenerowanego `Info.plist` | `withInfoPlist` + props pluginu |
| `UIBackgroundModes` += `audio` (wymóg `AVPictureInPictureController` — `enterPiP()`) | patch `Info.plist` | `withInfoPlist` |
| Build phase "Embed SwiftPM Frameworks" kopiujący + podpisujący `GoogleInteractiveMediaAds.framework` (+ fix duplikatu `*.xcframework-ios.signature` przy archiwum) | `xcodeproj` w `link_bunny_sdk.rb` | `withXcodeProject` — `PBXShellScriptBuildPhase` na targetcie aplikacji (skrypt 1:1 z `link_bunny_sdk.rb`) |
| Backport fixa kolizji UUID w `spm.rb` (RN commit `1cdf784`, wymagany dla RN < 0.88 na Xcode 16+/26) | patch pliku `node_modules/react-native/scripts/cocoapods/spm.rb` | `withDangerousMod` przed `pod install` (prebuild wykonuje mody przed instalacją podów — działa też na workerach EAS z CNG); warunek: tylko gdy wykryty RN < 0.88 |
| `spm_dependency` w podspecie — wymaga helpera z `react-native/scripts/cocoapods/spm.rb` | działa pod `use_react_native!` | **zweryfikować w spike** — Podfile Expo używa tej samej machinerii; fallback: `withPodfile` dopisuje `require` helpera |

Podpis, provisioning, `DEVELOPMENT_TEAM` — **poza pluginem** (sprawa konsumenta /
EAS credentials).

## 2. Struktura deliverables

```
plugin/
  src/index.ts            # withBunnyStream(config, props) — kompozycja modów
  src/withAndroidManifest.ts
  src/withAppBuildGradle.ts
  src/withInfoPlist.ts
  src/withXcodeProject.ts
  src/withSpmUuidPatch.ts
app.plugin.js             # require('./plugin/build/index.js')
```

- `package.json`: `dependencies` += `@expo/config-plugins` (wersja zgodna z
  najniższym wspieranym SDK), `files` += `plugin`, `app.plugin.js`.
- Props pluginu (wszystkie opcjonalne, z defaultami z example):
  `cameraPermission`, `microphonePermission`, `photoLibraryPermission`,
  `enablePictureInPicture` (domyślnie `true`), `enableBackgroundAudio`
  (domyślnie `true`, wymagane przez PiP), `desugarJdkLibsVersion`
  (domyślnie `2.1.5`).
- Plugin musi być **idempotentny** i **bezpieczny przy `prebuild --clean`**
  (CNG: katalogi `android/`/`ios/` są regenerowane, więc modów nie wolno
  zakładać jako trwałych).

Przykładowe użycie docelowe:

```json
{
  "expo": {
    "plugins": [
      ["bunny-stream-react-native", {
        "cameraPermission": "Allow $(PRODUCT_NAME) to record and broadcast video.",
        "microphonePermission": "Allow $(PRODUCT_NAME) to capture audio."
      }]
    ]
  }
}
```

## 3. Wymagania wersyjne

- **Expo SDK ≥ 52** — New Architecture domyślnie włączona (wrapper nie wspiera
  Old Arch). To podnosi efektywny floor `react-native` dla konsumentów Expo do
  ~0.76 (README: peer floor 0.71 zostaje dla bare RN; dodać notkę).
- `expo-dev-client` dla developmentu (lub EAS Build / `expo run:*` z prebuild).
- Hermes — bez zmian.
- Web (`expo start --web`) — **nie wspierane**; udokumentować guard
  `Platform.OS` / `Platform.select` po stronie konsumenta.

## 4. Fazy

### Faza E0 — spike walidacyjny (bez kodu produkcyjnego)

1. `npx create-expo-app` w `tmp/` (poza workspaces), deps: biblioteka przez
   `file:../`, `expo-dev-client`.
2. `npx expo prebuild` + `pod install` — katalogować dokładne błędy:
   - czy `spm_dependency`/`install_modules_dependencies` są dostępne pod
     Podfile Expo,
   - czy kolizja UUID w `spm.rb` się reprodukuje (wersja RN w SDK),
   - czy codegen biblioteki (`React-Codegen`, `BunnyStreamReactNativeSpec`)
     generuje się poprawnie,
   - czy `GoogleInteractiveMediaAds.framework` ląduje w bundle bez patcha
     (spodziewany crash/brak IMA — potwierdza konieczność build phase),
   - Android: czy build pada bez desugaringu i bez PiP/configChanges.
3. Wynik: zweryfikowana checklista patchy; aktualizacja tego planu jeśli
   założenia z §1 się nie potwierdzą.

### Faza E1 — implementacja config pluginu

1. Szkielet `plugin/` + `app.plugin.js` + entry w `files`/`dependencies`.
2. Mody Android (manifest, app build.gradle, gradle.properties) — najpierw,
   najniższe ryzyko.
3. Mody iOS (`withInfoPlist`, `withXcodeProject` z embed phase,
   `withDangerousMod` dla `spm.rb` z detekcją wersji RN).
4. Testy jednostkowe modów (fixture `AndroidManifest.xml`/`build.gradle`/
   `Info.plist` — czyste funkcje transformujące, bez Expo runtime).
5. Kryterium akceptacji: `npx expo prebuild --clean` + `expo run:android` /
   `pod install` + `xcodebuild` na świeżej apce → build przechodzi, player VOD
   gra, `enterPiP()` nie rzuca, broadcaster ma uprawnienia.

### Faza E2 — `example-expo/` w workspaces

1. Aplikacja Expo w monorepo (osobny workspace; metro needs `watchFolders` —
   standardowa konfiguracja monorepo Expo).
2. Podzbiór ekranów z `example/`: VOD player, live player, broadcaster,
   lista video — wystarczy do manual regression.
3. `eas.json` (profile `development` + `preview`), instrukcja dev-build.
4. Manual regression parity: PiP, cast (uwaga: wymaga Play Services +
   urządzenia Chromecast — jak w `live-features-updated.md`), broadcaster,
   autoplay iOS.

### Faza E3 — dokumentacja i packaging

1. README: sekcja "Expo" — instalacja, plugin + props, wymóg dev-client,
   brak wsparcia Expo Go/web, `BUNNY_STREAM_IOS_SDK_PATH` działa dalej
   (env przechodzi do `pod install`; na EAS przez `env` w `eas.json`).
2. `docs/CAPABILITIES.md`: wiersz/notka "Expo (config plugin)".
3. `npm pack --dry-run` — weryfikacja, że `plugin/` i `app.plugin.js`
   są w paczce (część Fazy 8D clean-consumer testu: dodać apkę Expo jako
   trzeci clean consumer).

### Faza E4 — CI

1. Job `expo-smoke`: `expo prebuild --clean` na fixture-app + Gradle
   `assembleDebug` (Android) i `pod install` + `xcodebuild` (iOS, bez podpisu —
   `CODE_SIGNING_ALLOWED=NO`).
2. EAS Build — opcjonalnie, wymaga konta/secrets; decyzja później.
3. Regression przy bumpach RN/Expo SDK (matrix na najniższe wspierane SDK +
   latest).

## 5. Ryzyka i otwarte kwestie

- **`spm_dependency` + SwiftPM binaryTarget pod CocoaPods-Expo** — największa
  niewiadoma (E0). Embed phase przez `withXcodeProject` musi trafić na właściwy
  target (app target, nie pod target). Jeśli zawiedzie: rozważyć prośbę
  upstream o dostarczenie IMA jako pod, albo patch `use_frameworks!`.
- **Kolizja UUID `spm.rb`** — patch w `node_modules` wykonywany w
  `withDangerousMod`; na EAS działa tylko gdy prebuild+CNG generuje projekt
  (tryb managed). Dla bare-Expo (`expo` w istniejącej apce RN) konsument
  musi sam zaaplikować patch albo używać `patch-package` — udokumentować.
- **`-skipPackagePluginValidation`** — przekazywane do `xcodebuild` w example;
  dla `expo run:ios`/EAS zweryfikować konieczność (E0); ewentualnie
  `defaults write com.apple.dt.Xcode IDESkipPackagePluginFingerprintValidatation`
  dla lokalnego dev.
- **Wersja Kotlin hosta** — jeśli template Expo ma starszy `kotlinVersion`,
  plugin nadpisuje przez `withGradleProperties`; konflikt z innymi
  bibliotekami wymagającymi starszego Kotlina = edge case do udokumentowania.
- **iOS bez tagu semver** — pin na commit w `spm_dependency` przechodzi 1:1
  (podspec czyta `native-sdk-baselines.json`); ryzyko bez zmian.
- **`react-native-test-app` ≠ Expo** — obecny example zostaje; `example-expo`
  to dodatkowy workspace, nie podmiana.
