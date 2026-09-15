# Audyt: publiczne SDK `bunny-stream-android` / `bunny-stream-ios` vs wrapper RN

Data: 2025-09-15. Analizowane repozytoria:

- `~/Desktop/bunny-stream-android` — publiczne, `main` @ `cb87934`, tag `4.0.0` (`6118838`), wydane 2026-09-10
- `~/Desktop/bunny-stream-ios` — publiczne, `main` @ `4158e2e` (merge `feature/iOS-Live-Stream`), **zero tagów git**
- Baseline wrappera (`native-sdk-baselines.json`): Android `fb863507` / `4.0.0-live.shadow.1-SNAPSHOT`, iOS `8e222bb4`

## 1. Kluczowe ustalenie — baseline'y są już w publicznych repo

| Platforma | Baseline wrappera | Status w publicznym repo |
| --- | --- | --- |
| Android | `fb863507` (feature/live_streams) | **Przodek tagu `4.0.0`** — publiczne wydanie zawiera całość kodu, na którym zbudowano wrapper, plus dodatkowe fixy |
| iOS | `8e222bb4` (feature/ios-liveStream) | **Przodek `main`** — publiczny main jest nadzbiorem API snapshotu |

**Wniosek:** Faza 0B ze starego planu jest odblokowana dla Androida w 100%, dla iOS częściowo (brak tagu — wymaga pin na commit/branch zamiast wersji).

## 2. Co zostało ze starego audytu (`Plan-complete-native-sdk-wrapper.md`)

### Ukończone (fazy 0A–7 + example parity)

Wszystkie fazy implementacji zakończone: baseline i kontrakt (0A), parytet playera (1/1A), read-only API i collections (2), upload (3), video management (4), broadcaster (5), sterowanie playerem z resume/skip/chapters (6), obrazy/TV/cast/PiP (7), example app z parity do demo Androida (popup resume, zarządzanie pozycjami, ustawienia).

### Pozostałe ze starego planu

1. **Faza 0B — przepięcie na publiczne SDK** — teraz wykonalna (Android: pełnia; iOS: pin na commit, bo brak tagów).
2. **Live komendy JS (play/pause/seek/jump-to-live)** — nadal zablokowane. Publiczny Android `BunnyLiveStreamPlayerViewModel` wystawia tylko `start/onForeground/onBackground/onPlaybackFailure/tickCountdown` — brak publicznego play/pause/seek (poprawka: wcześniejszy raport błędnie raportował je jako publiczne). iOS: `snapToLiveEdge`/`isAtLiveEdge` nadal internal.
3. **Nierówny kontrakt eventów VOD iOS** — iOS nadal bez publicznego controllera/delegate; bridge nadal wymaga workaroundu `AVPlayerLayer` + KVO.
4. **Live metadata iOS** (`dvrEnabled`, video size, seekable window w eventach) — `BunnyLiveStream.dvrEnabled`/`dvrWindowSeconds` i `LiveStreamPlayData.seekableWindow` są publiczne w publicznym repo — można uzupełnić payload bez zmian SDK (dane trzeba pobrać z API, nie z eventu playera).
5. **`regenerateStreamKey`** — Android: nadal brak w domenowym `LiveStreamRepository` (public 4.0.0). iOS: tylko generated client op. Pozostaje platformową luką.
6. **Quality/captions/audio selection, fullscreen, programmatic cast/AirPlay, PiP iOS** — wszystko nadal internal/wymaga nowego publicznego API w SDK.
7. **Wiele instancji/bibliotek** — publiczny Android dodał `BunnyStreamApi.create(context, config)` zwracający `StreamApi` (AutoCloseable) oraz `bunny: StreamApi?` na view — można teraz rozważyć wsparcie multi-instance w RN.
8. **Watermark** — iOS `PlayerWatermark` publiczne; Android nadal bez odpowiednika.
9. **Custom icons/theme** — obie platformy mają API (`PlayerIcons`/`iconSet`/`fontFamily`), wrapper nie wystawia — jawna decyzja z Fazy 6 (poza zakresem), możliwa do dodania.

## 3. Stan publicznych repozytoriów

### Android 4.0.0 (wydane)

- **Maven Central:** `net.bunny:api`, `net.bunny:player`, `net.bunny:recording`, `net.bunny:tv` — wszystkie w wersji `4.0.0` (zweryfikowane w `repo1.maven.org`, opublikowane 2026-09-10). Współrzędne identyczne z używanymi przez wrapper.
- **API surface:** każdy symbol importowany przez wrapper istnieje z identyczną sygnaturą (zweryfikowane field-level dla ~30 wywołań repozytoriów, modeli, listenerów, playera, camera upload, playback-position API). Zero zmian wymaganych w kodzie Kotlin.
- **Nowe publiczne API nieużywane przez wrapper:**
  - `VideoRepository.fetchVideoHeatmapData(→VideoHeatmap)`, `fetchVideoStorageSize(→VideoStorageSize)`
  - `LiveStreamRepository.pollLiveStream`
  - `BunnyStreamApi.create(...)` → `StreamApi` (multi-instance, `AutoCloseable`)
  - `createVideo` zwraca `Video` (nie `Unit`)
  - `net.bunny:tv` artifact (TV player) — wrapper może go teraz adoptować zamiast samego fallbacku
- **Uwaga:** flavor dimension `apiBase` (debug/prod) zachowany — `missingDimensionStrategy("apiBase", "debug")` w wrapperze nadal potrzebne.
- **Live speed:** publiczny `BunnyLiveStreamPlayer` composable tworzy własny ExoPlayer i nie przywraca zapamiętanej prędkości — oryginalny bug stutteringu nie występuje na ścieżce live composable. Workaround pollingu `currentPlayer.playbackParameters` w bridge do zweryfikowania testem regresyjnym, potencjalnie do usunięcia.

### iOS public main (bez tagu)

- **Wydanie:** brak tagów git; ostatnia wydana wersja to 1.1.0 (CHANGELOG), `main` zawiera live stream support. Konsumpcja tylko przez local path (obecny stan) albo pin na commit/branch w SwiftPM — nie przez wersję.
- **Produkty:** wszystkie 4 używane przez podspec istnieją: `BunnyStreamPlayer`, `BunnyStreamAPI`, `BunnyStreamUploader`, `BunnyStreamCameraUpload`.
- **API surface:** identyczny ze snapshotem `8e222bb4` (openapi.yml — te same 38 operationIds na tych samych liniach; wszystkie publiczne sygnatury zweryfikowane). Zmiany wyłącznie addytywne + jedna behawioralna:
  - **USUNIĘTO AUTOPLAY VOD** — publiczny `BunnyStreamPlayer` nie woła `mediaPlayer.play()` w `onAppear` ("playback starts when the viewer taps the play button"). **Regresja dla wrappera:** prop `autoPlay` staje się całkowicie martwy na iOS — wymaga naprawy w bridge (auto-play przez już istniejący workaround AVPlayer po `onReady`).
  - Dodano `headers: [String: String]?` do init playera (addytywne).
  - Nowe internal: `PlaybackForbiddenDetector` (403 → permanent error), `PlaybackFailureView`/`VideoNotAvailableView`, retry w container view.
- **Nadal internal:** VOD controller (play/pause/seek/events), PiP (`PictureInPictureManager`), AirPlay (`AirPlayView`), fullscreen, resume position (brak API — JS fallback zostaje).
- **Example-App:** brak ekranów resume settings/management (parity z prywatnym). Ekrany: video player, uploader, camera upload, direct play, live streams.

## 4. Plan wyrównania funkcjonalności

### Faza 8A — Android: przejście na publiczny Maven `4.0.0`

1. `gradle.properties`/`native-sdk-baselines.json`: `mavenVersion` → `4.0.0`, repository → `BunnyWay/bunny-stream-android`, commit → tag `4.0.0` (`6118838`).
2. Usunąć `mavenLocal()` z `android/build.gradle` i `example/android/build.gradle` (+ powiązane `TODO(Phase 0B)`).
3. Regression: pełny build + testy + live/DVR playback na publicznym artifact.
4. Opcjonalnie: dodać `net.bunny:tv:4.0.0` do example app (prawdziwy TV player zamiast fallbacku).

### Faza 8B — iOS: przejście na publiczny SwiftPM (pin na commit)

1. Podspec: `ios_sdk_path` → publiczny URL `https://github.com/BunnyWay/bunny-stream-ios` z pinem na commit `4158e2e` (brak tagu — `requirement: { kind: 'revision' }` lub branch `main`; zalecany commit pin dla reprodukowalności).
2. **Naprawić regresję autoplay:** po `onReady` wywołać `play()` na odnalezionym AVPlayer gdy `autoPlay` jest true (bridge już ma discovery AVPlayerLayer). Dodać test regresyjny.
3. Uzupełnić live event payload o `dvrEnabled`/seekable window z publicznych `BunnyLiveStream`/`LiveStreamPlayData` (bez zmian SDK).
4. Regression: pełny build iOS + testy.
5. Zaktualizować `native-sdk-baselines.json` (`repository` → publiczne, `commit` → `4158e2e`, notka o braku tagu).

### Faza 8C — adoptacja nowych publicznych API (opcjonalne rozszerzenia)

1. `fetchVideoHeatmapData` → uzupełnić `getVideoHeatmap` o pełny `VideoHeatmap` (wcześniej iOS-only fallback do `Map<String,Int>`).
2. `fetchVideoStorageSize` → nowa metoda `getVideoStorageSize` (Android teraz ma — wcześniej iOS-only).
3. `pollLiveStream` → pojedynczy poll statusu (wrapper robi to dziś przez `getLiveStream`).
4. `BunnyStreamApi.create` / multi-instance — tylko jeśli jest realny use-case (wymaga przeprojektowania `initialize` na instancje).
5. `PlayerIcons`/`iconSet`/`fontFamily`/`PlayerWatermark` — opcjonalne wystawienie themingu.
6. **Quality selection (odblokowane):** `setVideoQuality(resolution|auto)` + `getAvailableQualities`:
   - Android: `DefaultBunnyPlayer.currentPlayer?.trackSelectionParameters` (`setMaxVideoSize`/`setMaxVideoBitrate`) — publiczne, udokumentowane w KDoc `BunnyPlayer` jako ścieżka dla quality control;
   - iOS: `observedPlayer?.currentItem?.preferredPeakBitRate` (AVFoundation public API; bitrate map z iOS `Video.Resolution`: 240p=600k, 360p, 480p, 720p, 1080p — skopiować stałe z `VideoResolution.swift`);
   - lista dostępnych jakości z `fetchVideoResolutionsInfo`/`getVideo`.

### Faza 8D — domknięcie Fazy 0B i release

1. `npm pack --dry-run` + clean-consumer install w dwóch świeżych aplikacjach RN (bez dostępu do prywatnych repo i bez `mavenLocal()`/`BUNNY_STREAM_IOS_SDK_PATH`).
2. Usunięcie zweryfikowanych workaroundów `TODO` (np. polling prędkości live na Androidzie po teście regresyjnym).
3. Aktualizacja README: minimalne publiczne wersje SDK, wymagania platformowe.
4. Publikacja paczki RN.

## 5. Zaktualizowana macierz blokad SDK (backlog dla właścicieli natywnych repo)

| Blokada | Android 4.0.0 | iOS main | Uwagi |
| --- | --- | --- | --- |
| Live controller (play/pause/seek/jump-to-live) | Brak (ViewModel bez play/pause/seek) | Internal | Nadal zablokowane obie platformy |
| VOD controller/eventy | Publiczne callbacki na view | Internal (KVO workaround) | iOS wymaga publicznego controllera |
| Resume position | Publiczne (PlaybackPositionManager) | Brak API | iOS: JS fallback permanentny |
| regenerateStreamKey | Brak w domain repo | Tylko generated op | Platformowa luka Android |
| Quality programowo | **`currentPlayer` publiczne** → `trackSelectionParameters` (KDoc wprost: "direct control over tracks, quality") | AVFoundation `currentItem.preferredPeakBitRate` przez istniejący AVPlayer workaround (to samo robi internal `setPlayerBitrate`) | **Odblokowane** — stary audyt błędnie klasyfikował jako SDK blocker |
| Captions/audio tracks programowo | Przez `currentPlayer` track selection | Brak publicznej listy tracków | Android możliwy; iOS częściowo |
| Fullscreen/PiP/cast programowo | Częściowe (PiP przez Activity, cast events) | Internal | AirPlay/PiP iOS zablokowane |
| Image loader z Refererem | Brak (RN `Image` + headers) | Brak | Zostaje w JS — działa poprawnie |
| Autoplay VOD | Działa (ExoPlayer playWhenReady) | **Usunięty w publicznym main** | Wymaga fixu w bridge iOS |
| Tag/release do pinu | `4.0.0` na Maven Central | **Brak tagów** | iOS: pin na commit `4158e2e` |

## 6. Geoblock / HTTP 403 (nowe w publicznych wydaniach)

Oba publiczne SDK dodały obsługę blokad (geo-blocking, hotlink protection, wygasły token — celowo nierozróżniane dla widza):

- **Android 4.0.0:** `PlaybackFailureInfo` (publiczne) — wykrywa 403 w całym łańcuchu przyczyn media3 (manifest/segmenty/licencja Widevine) oraz **DNS-level geoblock** ("Blocked countries" → host CDN rozwiązuje do sinkhole 127.0.0.1 → `ConnectException` z loopback = block, nie network). `isBlocked` = terminal bez retry; `isNetwork` = "No internet connection" z retry. Natywny komunikat w playerze.
- **iOS main:** `PlaybackForbiddenDetector` (internal; CoreMedia `-12660` + error-log 403) → `VideoPlayerError.notAvailable` → generyczny widok. Live: 403 → permanent `BunnyLiveStreamError` → `failed`/`offline`.

**Stan w wrapperze:** UX działa natywnie bez zmian. Live error eventy propagują poprawnie (iOS `isPermanent`→`onLiveError`, Android `terminalError`→`onLiveError`). **Luka:** JS nie odróżnia geoblocku od innych błędów VOD — `onPlaybackFailureInfo` jest `internal` w publicznym Androidzie, iOS VOD nie ma eventu błędu. Jeśli potrzebny flag `isBlocked` w `onPlaybackError`, wymaga publicznego API w SDK (backlog §5) — nie należy heurystykować po komunikatach w bridge.

## 7. Ryzyka i uwagi

- **iOS autoplay** jest jedyną wykrytą regresją behawioralną publicznego wydania — naprawić przed przepięciem (Faza 8B.2), inaczej `autoPlay` przestanie działać.
- **iOS bez tagu** — pin na commit działa, ale README/hosting dokumentacji powinno jawnie opisać wersjonowanie; rozważyć prośbę o tag `2.0.0`/`4.0.0` do właścicieli repo.
- Publiczne repo Android ma dodatkowe fixy ponad baseline (m.in. "resume the ended stream's recording where it stopped", "No internet connection" message) — warto przetestować live→VOD recovery w clean-consumer test.
- Nie udostępniać prywatnych repo w żadnym artefakcie release; `.github/workflows` wrappera odwołujące się do prywatnych repo (`closed-test-native.yml`) wymagają aktualizacji w Fazie 8D.
