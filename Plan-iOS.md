# Plan: dodanie iOS playera VOD i live do `bunny-stream-react-native`

## 1. Cel i zakres

Celem jest dodanie natywnego mostka iOS do istniejącej biblioteki `bunny-stream-react-native`, opakowującego `BunnyStreamPlayer` z prywatnego SwiftPM package `bunny-stream-ios-private`, przy zachowaniu cienkiego bridge'a React Native i wspólnego, typowanego API TypeScript już używanego przez Androida.

Pierwszy zakres obejmuje wyłącznie:

- integrację produktu SwiftPM `BunnyStreamPlayer` (który zależy od `BunnyStreamAPI`) z aplikacją example i docelową dystrybucją biblioteki RN;
- implementację TurboModule `initialize(accessKey, libraryId)` jako bridge-owned configuration store — iOS SDK nie ma globalnego `initialize`;
- implementację Fabric Native Component dla VOD (`BunnyStreamPlayerView`) zgodnego z istniejącym Codegen spec;
- pełny zestaw callbacków playbacku (ready, state, progress, error, buffering, play, pause, end, volume, rate, video size, playback error);
- pełny zestaw komend ref (play, pause, seekTo, setVolume, setPlaybackRate, mute, unmute);
- natywne kontrolki oraz możliwość ich wyłączenia (`controls={false}`) dla custom controls w RN;
- kontrolę `autoPlay`;
- FairPlay/DRM transparentnie przez SDK;
- live playback z natywnym UI (countdown, trailer, offline, live edge, DVR, recovery, live → VOD recording) przez `BunnyStreamLivePlayer` z gałęzi `origin/feature/ios-liveStream`;
- example app iOS działający obok Androida z tymi samymi ekranami (VOD + live z natywnymi kontrolkami).

Poza zakresem są: **live custom controls** (iOS SDK nie wystawia publicznego controllera live — patrz sekcja 6), REST API do zarządzania biblioteką, upload, kamera, Android TV, PiP/Chromecast/AirPlay jako komendy ref oraz samo wykonanie publikacji npm. Release readiness (publiczne zależności, tarball i czysta instalacja) pozostaje w zakresie.

> Bazą wdrożenia jest `origin/feature/ios-liveStream` (commit `e5fe42e` lub nowszy jawnie wybrany commit tej gałęzi). Na potrzeby tego planu jest to gotowy, autorytatywny branch główny SDK.

## 2. Zweryfikowane źródła

- Lokalna ścieżka prywatnego SDK: `/Users/apple/Desktop/bunny-stream-ios-private` (SwiftPM, `Package.swift`).
- Moduł playera: `Sources/BunnyStreamPlayer` (SwiftUI `BunnyStreamPlayer` → `BunnyStreamPlayerContainerView` → `VideoPlayerView` → `AVPlayerViewControllerRepresentable` → `AVPlayerLayer`).
- Podklasa `MediaPlayer: AVPlayer` w `Utilities/MediaPlayer/MediaPlayer.swift` posiada wszystkie potrzebne metody (`play`, `pause`, `jump(to:)`, `seekForward`, `seekBackward`, `playerSpeed`, `isMuted`, `setPlayerBitrate`, `updatePlaybackInterval`), ale jest **internal**.
- `MediaPlayerDelegate` (internal) wystawia pełen zestaw zdarzeń: `didBeginPlayback`, `didEndPlayback`, `didPausePlayback`, `didBeginBuffering`, `didEndBuffering`, `didProgressToTime`, `onProgressUpdate`, `didChangeVolume`, `didChangeRate`, `didChangeSubtitle`, `didFailWithError`, `didUpdatePlaybackState`.
- `PlaybackState` (internal): `preparing`, `readyToPlay`, `playing`, `paused`, `stopped`, `ended`, `failed(error)`.
- FairPlay: bazowy SDK podpina `FairPlayStreamHandler` w `MediaPlayer.make(video:)`; factory dodaje też statyczne nagłówki CMCD dla VOD.
- Example App SDK: `Example-App/Scenes/VideoPlayerDemo/Player/BunnyStreamPlayer+Default.swift` pokazuje drop-in użycie `BunnyStreamPlayer(accessKey:videoId:libraryId:playerIcons:)` bez callbacków i bez komend.
- Istniejący plan Androida: `Plan.md` (migracja do SDK 4.0.0 + live). Ten plan jest jego iOS-owym odpowiednikiem dla VOD + live (natywnego).

### Bazowy SDK (`origin/feature/ios-liveStream`, commit `e5fe42e`)

`origin/feature/ios-liveStream` jest jedyną podstawą wdrożenia tego planu i jest traktowany jak gotowy branch główny SDK. Dostarcza VOD oraz publiczny live player:

- `Sources/BunnyStreamPlayer/BunnyStreamLivePlayer.swift` — publiczny SwiftUI view `BunnyStreamLivePlayer(accessKey:libraryId:streamId:watermark:token:expires:onStateChange:onPlaybackError:)`.
- `Sources/BunnyStreamPlayer/Player/LivePlaybackController.swift` — `@MainActor final class LivePlaybackController: ObservableObject` z pollingiem (5 s), stanami, recovery, lifecycle (background/foreground), `userWantsPlay` flagą.
- `Sources/BunnyStreamPlayer/Player/BunnyLiveStreamPlaybackState.swift` — publiczny enum: `loading | playing(isVodRecording:) | countdown(until:title:) | trailer(vodId:scheduledStart:title:) | offline(message:) | failed(message:)`.
- `Sources/BunnyStreamPlayer/Player/LiveStreamDisplayState.swift` — internal resolver stanu z `BunnyLiveStream.status` (created/scheduled/preview/running/ended/vodProcessing/error).
- `Sources/BunnyStreamPlayer/Utilities/MediaPlayer/MediaPlayer+Live.swift` — `MediaPlayer.makeLive(url:seekableWindowSeconds:contentId:)`, `isAtLiveEdge`, `snapToLiveEdge(toleranceSeconds:)` (internal).
- `Sources/BunnyStreamPlayer/Utilities/MediaPlayer/MediaPlayer+Models.swift` — `PlaybackKind = .vod | .event | .live`.
- Publiczne callbacki live: `onStateChange: ((BunnyLiveStreamPlaybackState) -> Void)?` i `onPlaybackError: ((Error) -> Void)?` — wywoływane na main actor.
- `BunnyStreamLivePlayer` samodzielnie zarządza pollingiem, countdown, trailer (looping AVQueuePlayer), offline, error overlay, recovery po stallu/failu, przejściem live → VOD recording, lifecycle (pause poll w background).
- Brak publicznego controllera komend live (play/pause/seek/jumpToLive) — `userWantsPlay` jest internal.
- Brak `controlsEnabled` — live używa `BunnyStreamPlayerContainerView` z `resolvedConfig` z serwera (controlTokens, showHeatmap, compactControls).
- Brak `autoPlay` — `userWantsPlay = true` hardcoded w `onAppear`.
- Brak publicznego `snapToLiveEdge` / `isAtLiveEdge` (internal w `MediaPlayer+Live.swift`).
- Brak publicznego DVR/live-edge stanu w `BunnyLiveStreamPlaybackState` (tylko `isVodRecording` w `playing`).
- Baseline zawiera publiczną konfigurację `watermark` dla VOD i live.

Implementacja i testy muszą być przypięte do konkretnego SHA bazowego SDK. Aktualizacja SHA jest świadomą zmianą zależności i wymaga ponownego uruchomienia testów kontraktu.

## 3. Aktualny stan biblioteki RN (kontekst iOS)

### Kontrakt Codegen (wspólny dla platform)

`src/specs/BunnyStreamPlayerNativeComponent.ts` definiuje component name `'BunnyStreamPlayerView'` oraz:

- props: `videoId: string`, `libraryId?: Double`, `token?: string`, `expires?: Double`, `autoPlay?: WithDefault<boolean, true>`, `controls?: WithDefault<boolean, true>`;
- direct events: `onReady`, `onPlaybackStateChange`, `onProgress`, `onError`, `onBuffering`, `onPlay`, `onPause`, `onEnd`, `onVolumeChange`, `onPlaybackRateChange`, `onVideoSizeChange`, `onPlaybackError`;
- commands: `play`, `pause`, `seekTo(positionMs)`, `setVolume(volume)`, `setPlaybackRate(rate)`, `mute`, `unmute`.

`src/specs/NativeBunnyStreamPlayer.ts` definiuje TurboModule `'BunnyStreamPlayer'` z `initialize(accessKey: string, libraryId: Double): void`.

`src/specs/BunnyLiveStreamPlayerNativeComponent.ts` definiuje live component — **zostanie zaimplementowany na iOS** na podstawie gałęzi `origin/feature/ios-liveStream` (publiczny `BunnyStreamLivePlayer`). Custom controls live pozostają poza zakresem (brak publicznego controllera).

### Stuby iOS

`ios/` zawiera wyłącznie placeholdery:

- `BunnyStreamPlayerModule.h/.mm` — TurboModule z pustym `initialize:libraryId:` (TODO).
- `BunnyStreamPlayerView.h/.mm` — `RCTViewManager` bez propów, eventów i komend (TODO).
- Brak plików dla live — trzeba dodać host `BunnyLiveStreamPlayerView` i zarejestrować go w iOS Codegen.
- `package.json > codegenConfig.ios.components` rejestruje obecnie tylko `BunnyStreamPlayerView`; trzeba dodać `BunnyLiveStreamPlayerView`, inaczej iOS Codegen nie zarejestruje live componentu.
- `BunnyStreamReactNative.podspec` — standardowy podspec bez zależności od iOS SDK; używa `min_ios_version_supported` z helperów React Native.

### Warstwa TypeScript (już gotowa, wspólna z Androidem)

- `src/index.tsx`: publiczny `BunnyStreamPlayer` z `source: BunnyStreamSource` (union `vod`/`live`), `autoPlay`, `controls`, ref `BunnyStreamPlayerRef`, `initialize`, `sourceIdentityKey`.
- `src/useBunnyStreamPlayer.ts`: hook ze stanem niskiej częstotliwości, osobnym `progress`, stabilnymi handlerami, reducerem z idempotentnymi przejściami i `RESET` po zmianie `sourceKey`.
- `src/types.ts`: typy publiczne.

Warstwa TS **nie wymaga zmian** dla VOD iOS. Dla live już montuje `NativeLiveView` i ma odpowiedni podstawowy kontrakt, ale iOS SDK musi jeszcze dostarczyć publiczny video-size callback oraz terminal-error semantics. Istniejący guard `sourceTypeRef.current !== 'vod'` (no-op ref commands dla live) jest poprawny dla pierwszego zakresu. Custom controls live będą wymagały późniejszej zmiany Codegen i `index.tsx`.

### Wzorce Android do odzwierciedlenia na iOS

Android bridge zawiera wartościowe mechanizmy, które należy zachować na iOS w idiomatyczny sposób:

- Fabric Native Component + Codegen;
- snapshot propsów i rozróżnienie zmiany źródła od zmiany UI (`SourceKey`);
- `GenerationToken` chroniący przed starymi callbackami;
- `CommandQueue` dla komend przed ready;
- idempotentny cleanup;
- kontrola starych callbacków i zadań async przy zmianie źródła;
- coalescing/deduplikacja eventów progress i buffering;
- **nie kopiować `BunnyPlayerLease` bez dowodu**: Android używa singletonu SDK, natomiast iOS tworzy osobny `MediaPlayer` dla każdego widoku; obsługę wielu playerów trzeba zweryfikować testem, a nie ograniczać z góry;
- czysta maszyna stanów (na iOS: mapowanie `PlaybackState` SDK → stringi z Codegen).

## 4. Nowe możliwości iOS SDK istotne dla playera

### Co SDK już dostarcza (internal)

- `MediaPlayer: AVPlayer` z pełnym API playbacku i KVO (`AVPlayerItem.status`, `rate`, `outputVolume`), periodic time observer (500 ms), FairPlay automatycznie.
- `MediaPlayerDelegate` z pełnym zestawem zdarzeń playbacku.
- `BunnyStreamPlayer` SwiftUI z drop-in `init(accessKey:videoId:libraryId:token:expires:playerIcons:watermark:)`.
- `VideoPlayerConfig` z serwerowo konfigurowaną listą `Control` i `vastTagUrl` (IMA).
- `PlayerIcons` do customizacji ikon.
- `Video` model z `width`/`height`/`length`/`resolutions`/`captions`/`chaptersList`/`moments`.

### Co dostarcza bazowy SDK (`origin/feature/ios-liveStream`)

- Publiczny `BunnyStreamLivePlayer` SwiftUI z `onStateChange` i `onPlaybackError` (main actor).
- Samodzielny polling (5 s), countdown, pre-stream trailer (looping), offline, error overlay, recovery po stallu/failu, przejście live → VOD recording, lifecycle background/foreground.
- `BunnyLiveStreamPlaybackState` publiczny enum: `loading | playing(isVodRecording:) | countdown(until:title:) | trailer(vodId:scheduledStart:title:) | offline(message:) | failed(message:)`.
- `MediaPlayer.makeLive` + `PlaybackKind = .vod | .event | .live` (DVR vs live edge).
- `isAtLiveEdge` i `snapToLiveEdge` (internal — do wystawienia publicznie dla `jumpToLive`).
- FairPlay dla zakończonego live odtwarzanego jako VOD recording przez `MediaPlayer.make`; live edge `makeLive` używa CMCD resource loader i w obecnym kodzie nie podpina FairPlay — wsparcie DRM live edge trzeba potwierdzić osobno.
- CMCD dla live edge (`.event`/`.live`).
- Dashboard customization (font, primary color, control list, heatmap, compact controls) przez `/play`.

### Braki publicznego API bazowego SDK

- VOD `BunnyStreamPlayer` nie wystawia publicznych callbacków playbacku (delegat jest internal).
- VOD nie wystawia publicznego controllera/instancji `MediaPlayer` (jest `@State` prywatny).
- VOD nie przyjmuje `controlsEnabled` (kontrolki zawsze renderowane, chowane auto-hide; pojedyncze przyciski ukrywane przez serwerową konfigurację `Control`).
- VOD nie przyjmuje `autoPlay` (hardcoded `.onAppear { mediaPlayer.play() }`).
- Live działa z natywnym UI, ale nie wystawia publicznego controllera, `controlsEnabled`, `jumpToLive`, publicznego DVR/live-edge state ani pełnych callbacków playbacku.

## 5. Docelowe publiczne API React Native (iOS)

Publiczne API TypeScript pozostaje bez zmian — to samo `BunnyStreamPlayer` z `source`, `autoPlay`, `controls`, ref i eventami. iOS implementuje ten sam kontrakt Codegen co Android.

### Host iOS

Dwa wewnętrzne hosty Fabric: `BunnyStreamPlayerView` dla VOD i `BunnyLiveStreamPlayerView` dla live. Każdy jest natywnym widokiem React Native zawierającym child `UIHostingController` z odpowiednim SwiftUI view. `UIViewRepresentable`/`UIViewControllerRepresentable` są odwrotnym kierunkiem integracji (UIKit wewnątrz SwiftUI) i nie są hostem RN.

### Sterowanie

Ref udostępnia ten sam zestaw co Android: `play`, `pause`, `seekTo(positionMs)`, `setVolume(volume)`, `setPlaybackRate(rate)`, `mute`, `unmute`.

### Stan i eventy

Te same eventy co Android, ale ich semantyka musi być jawnie ustalona w publicznym API SDK, a nie odtwarzana z prywatnego KVO bridge'a:

- `onReady` — dokładnie raz na source generation, gdy `AVPlayerItem` jest gotowy; nie opisywać tego jako „first frame rendered”, chyba że SDK użyje `AVPlayerLayer.isReadyForDisplay`;
- `onPlaybackStateChange` — `preparing→loading`, `readyToPlay→ready`, `playing→playing`, `paused→paused`, `ended→ended`, `failed→error`; `stopped` jest cleanupem, nie eventem użytkownika;
- `onProgress` — `{positionMs,durationMs,progress}` z jednym callbackiem SDK; iOS obecnie tyka co 500 ms, podczas gdy TS opisuje ~4×/s, więc ustawić 250 ms albo zmienić dokumentację na częstotliwość platformową;
- `onError` — terminalny błąd source/playera ze stabilnym `code`, `message`, `nativeCode`, który ustawia stan hooka na `error`; `onPlaybackError` — dodatkowa surowa wiadomość callbacku SDK, która nie zmienia stanu hooka. Ten sam failure może emitować oba tylko w udokumentowanej kolejności (`onPlaybackError` → `onError`) i z deduplikacją; loader errors bez player callbacku emitują wyłącznie `onError`;
- `onBuffering` — deduplikować powtarzające się wartości, bo SDK sprawdza `isPlaybackLikelyToKeepUp` przy każdym ticku;
- `onPlay`/`onPause`/`onEnd` — emitować raz na realne przejście stanu;
- `onVolumeChange` — raportować per-player `AVPlayer.volume` + `isMuted`; nie mieszać z obserwowanym obecnie `AVAudioSession.outputVolume` (głośność sprzętowa);
- `onPlaybackRateChange` — raportować wybraną prędkość (`playerSpeed`), nie chwilowe `AVPlayer.rate=0` podczas pauzy;
- `onVideoSizeChange` — z publicznego callbacku SDK; dla VOD może początkowo pochodzić z metadata `Video.width/height`, ale docelowo reagować również na zmianę presentation size.

### Controls

- `controls={true}` — UI natywne SDK (SwiftUI overlay `VideoPlayerControls`).
- `controls={false}` — powierzchnia playbacku bez chrome, sterowana przez RN.

### Live

Na iOS `source.type='live'` **jest wspierane** z natywnym UI przez `BunnyStreamLivePlayer` (gałąź `origin/feature/ios-liveStream`). Bridge implementuje `BunnyLiveStreamPlayerView` opakowujący `BunnyStreamLivePlayer` przez `UIHostingController`, mapując:

- `onLiveStateChange` ← `BunnyStreamLivePlayer.onStateChange` (`BunnyLiveStreamPlaybackState` → payload Codegen `state: 'loading'|'offline'|'countdown'|'trailer'|'live'|'vod'`, `isLive`, `targetEpochMs`, `title`);
- `onLiveError` ← tylko błąd terminalny: permanentny `BunnyLiveStreamError` lub `.failed`; obecny `onPlaybackError` zgłasza także błędy przejściowe, z których player sam się odzyskuje, więc nie wolno mapować wszystkich 1:1 na publiczny terminalny event;
- `onVideoSizeChange` wymaga dodania publicznego callbacku do `BunnyStreamLivePlayer`; obecne `onStateChange` nie przekazuje `MediaPlayer` ani `Video`, więc bridge nie może legalnie odczytać wymiarów.

Mapowanie `BunnyLiveStreamPlaybackState` → stringi Codegen:

| iOS SDK                                  | Codegen `state` | `isLive` | uwagi                                                   |
| ---------------------------------------- | --------------- | -------- | ------------------------------------------------------- |
| `.loading`                               | `loading`       | false    |                                                         |
| `.playing(isVodRecording: false)`        | `live`          | true     | live edge                                               |
| `.playing(isVodRecording: true)`         | `vod`           | false    | recording po ended                                      |
| `.countdown(until, title)`               | `countdown`     | false    | `targetEpochMs = until.timeIntervalSince1970 * 1000`    |
| `.trailer(vodId, scheduledStart, title)` | `trailer`       | false    |                                                         |
| `.offline(message)`                      | `offline`       | false    | `reason = message`                                      |
| `.failed(message)`                       | —               | —        | `onLiveError` dokładnie raz; nie udawać stanu `offline` |

`dvrEnabled` pozostaje `undefined`, dopóki SDK nie wystawi go publicznie. Nie odczytywać internal `MediaPlayer.kind`. Jeśli produkt wymaga jawnego stanu błędu także w `onLiveStateChange`, należy rozszerzyć wspólny Codegen union o `'error'` na obu platformach zamiast mapować błąd na `offline`.

**Custom controls live są poza zakresem** — iOS SDK nie wystawia publicznego controllera komend live (play/pause/seek/jumpToLive). `BunnyStreamLivePlayer` sam decyduje o playbacku na podstawie `userWantsPlay`. Ref commands na live pozostają no-op (istniejący guard w `index.tsx` już to obsługuje).

## 6. Blokady w aktualnym API iOS SDK

> **Ważne**: Repozytorium `bunny-stream-ios-private` jest tylko do odczytu z perspektywy mostka RN. Wszystkie zmiany API SDK muszą być wykonane przez zespół SDK. Pełna lista brakujących elementów znajduje się w sekcji 12.

Bazowy VOD `BunnyStreamPlayer` z `origin/feature/ios-liveStream`:

- nie wystawia publicznych callbacków playbacku;
- ukrywa `MediaPlayer` w prywatnym `@State`;
- nie przyjmuje `controlsEnabled`/`controls`;
- nie przyjmuje `autoPlay` (hardcoded play on appear).

Live playback jest częścią tego samego bazowego SDK przez osobny publiczny `BunnyStreamLivePlayer`, z ograniczeniami opisanymi poniżej.

### Blokady live (gałąź `origin/feature/ios-liveStream`)

Aktualny `BunnyStreamLivePlayer`:

- nie wystawia publicznego controllera komend (play/pause/seek/jumpToLive) — `userWantsPlay` jest internal;
- nie wystawia publicznie `isAtLiveEdge` / `snapToLiveEdge` (internal w `MediaPlayer+Live.swift`);
- nie wystawia publicznie DVR/live-edge stanu w `BunnyLiveStreamPlaybackState` (tylko `isVodRecording`);
- nie przyjmuje `controlsEnabled` — live używa `BunnyStreamPlayerContainerView` z `resolvedConfig` z serwera;
- nie przyjmuje `autoPlay` — `userWantsPlay = true` hardcoded w `onAppear`;
- nie przekazuje callbacków playbacku (progress, buffering, volume, rate) — tylko `onStateChange` i `onPlaybackError`.

Dlatego **custom controls live nie mogą być zrealizowane jako cienki bridge** na obecnym API. Wymagana zmiana przed integracją custom live UI po stronie iOS SDK:

- publiczny `BunnyStreamLivePlayerController` (lub wystawienie `MediaPlayer` z live) z `play`, `pause`, `seek`, `jumpToLive`, `mute`, `unmute`, `setPlaybackRate` (tam gdzie wspierane);
- `controlsEnabled`/override dla `BunnyStreamLivePlayer`;
- publiczny `isAtLiveEdge` i `snapToLiveEdge`;
- publiczny DVR/live-edge stan w `BunnyLiveStreamPlaybackState` lub osobny callback;
- obserwowalny progress/buffering dla live (jeśli custom UI ma je pokazywać).

Nie stosować refleksji, prywatnych pól, ani reimplementacji pollingu w TypeScript. Jeśli SDK nie dostarczy kontraktu, pierwsze wydanie iOS live dostarcza **wyłącznie natywne UI** (countdown, trailer, offline, live edge, DVR w natywnych kontrolkach, recovery, live → VOD) — bez `controls={false}` i bez ref commands. Nie oznaczać custom-live jako wspieranego częściowo.

### Blokady VOD w bazowym SDK

Dlatego kompletny cienki bridge VOD z custom controls **nie może być zrealizowany wyłącznie na obecnym publicznym API**.

### Wymagane zmiany przed integracją po stronie iOS SDK

Jedna z dwóch ścieżek:

**Ścieżka A — rozszerzenie publicznego API `BunnyStreamPlayer` (preferowana):**

- publiczne closures na `BunnyStreamPlayer`: `onReady`, `onPlaybackStateChange`, `onProgress`, `onError`, `onBuffering`, `onPlay`, `onPause`, `onEnd`, `onVolumeChange`, `onPlaybackRateChange`, `onVideoSizeChange` (lub jeden `onPlayerEvent`);
- publiczny `controlsEnabled: Bool` (domyślnie `true`);
- publiczny `autoPlay: Bool` (domyślnie `true`, zachowując obecne zachowanie);
- publiczny controller/protocol `BunnyStreamPlayerController` z `play`, `pause`, `seek(to:)`, `setVolume`, `setPlaybackRate`, `mute`, `unmute`, `dispose()` i stabilną tożsamością;
- `seek(to:)` musi zachowywać play/pause; nie może być bezpośrednim aliasem obecnego `MediaPlayer.jump(to:)`, które automatycznie wywołuje `play()`;
- `dispose()` musi anulować load task, odłączyć delegate/KVO/time observer, zatrzymać ads i zwolnić FairPlay resources;
- publiczne callbacki muszą być wywoływane na main actor i odłączane po `dispose()`.

**Ścieżka B — publiczne wystawienie `MediaPlayer` + `MediaPlayerDelegate`:**

- `MediaPlayer` i `MediaPlayerDelegate` stają się publiczne;
- `BunnyStreamPlayer` przyjmuje opcjonalny `controlsEnabled` i `autoPlay`;
- bridge buduje własny thin host SwiftUI/UIView na `MediaPlayer.make(video:)` i implementuje `MediaPlayerDelegate` samodzielnie.

Ścieżka B daje bridge'owi większą kontrolę (własny host, własny delegat, własny timer progress), ale przenosi na bridge więcej odpowiedzialności za lifecycle i DRM. Ścieżka A jest spójna z podejściem Android SDK 4.0.0 (`controlsEnabled`, publiczne callbacki na `BunnyStreamPlayer`).

### Decyzja

Zalecam ścieżkę A jako docelową (spójność z Androidem, mniej duplikacji w bridge'u). Ścieżka B jako fallback, jeśli zespół SDK woli nie rozszerzać publicznego API widoku.

Nie stosować refleksji, prywatnych pól, swizzlingu KVO na wewnętrznym `MediaPlayer`, ani reimplementacji resolvera config/FairPlay w bridge'u. Jeśli SDK nie dostarczy kontraktu, pierwsze wydanie iOS może dostarczyć VOD wyłącznie z natywnym UI (bez `controls={false}` i bez ref commands) — ale nie oznaczać custom controls jako wspieranych częściowo.

## 7. Plan implementacji

### Faza 0 — przypięcie lokalnego SDK

- [ ] Przypiąć `origin/feature/ios-liveStream` jako autorytatywny baseline SDK — początkowo commit `e5fe42e` albo nowszy jawnie wybrany commit tej samej gałęzi. Każda zmiana SHA wymaga świadomego review kontraktu i ponownego uruchomienia testów.
- [ ] Zrobić osobny spike dystrybucyjny i wybrać jeden wspierany wariant:
  - preferowany: oficjalny CocoaPod `BunnyStreamPlayer`, od którego zależy podspec RN;
  - alternatywa: oficjalny binarny `XCFramework` vendored przez podspec RN;
  - wariant przejściowy development-only: ręczne dodanie lokalnego SwiftPM package do example app — nie rozwiązuje instalacji npm u konsumenta.
- [ ] Nie zakładać `s.package`/`:path` w podspecie jako przenośnego rozwiązania CocoaPods.
- [ ] Rozwiązać OpenAPI Generator: target `BunnyStreamAPI` używa SwiftPM build pluginu, którego CocoaPods nie uruchomi. Oficjalny pod/XCFramework musi zawierać wygenerowane źródła lub gotowy binary target.
- [ ] Rozwiązać zależności player targetu: `Kingfisher`, `SwiftSubtitles`, `GoogleInteractiveMediaAds` 3.18.4; IMA może wymagać statycznego linkowania i konfiguracji zasobów.
- [ ] W SDK zastąpić branch dependencies (`Kingfisher/master`, `SwiftSubtitles/main`; także pozostałe branch dependencies w package) przypiętymi wersjami lub rewizjami przed dystrybucją produkcyjną.
- [ ] Zapisać diff snapshotu względem docelowego tagu oraz procedurę aktualizacji.

### Faza 1a — zmiany w iOS SDK dla VOD (zadanie dla zespołu SDK, wymagane przed bridge'em)

> Te zmiany muszą być wykonane w repozytorium `bunny-stream-ios-private` przez zespół SDK. Mostek RN nie modyfikuje SDK. Pełna lista w sekcji 12.1.

- [ ] Dodać publiczne callbacki na `BunnyStreamPlayer` (ścieżka A) LUB publiczne `MediaPlayer`+`MediaPlayerDelegate` (ścieżka B).
- [ ] Dodać publiczny `controlsEnabled: Bool` (domyślnie `true`).
- [ ] Dodać publiczny `autoPlay: Bool` (domyślnie `true`).
- [ ] Dodać publiczny controller / obiekt komend (ścieżka A) LUB wystawić `MediaPlayer` (ścieżka B).
- [ ] Zapewnić stabilną tożsamość controllera podczas re-renderów SwiftUI oraz publiczny, idempotentny `dispose()` anulujący także async `loadVideo()`.
- [ ] Zapewnić callbacki na main actor i brak callbacków po `dispose()`.
- [ ] Dodać `seek(to:)` zachowujące stan play/pause; obecne `jump(to:)` automatycznie wznawia playback.
- [ ] Rozdzielić per-player volume od sprzętowego `AVAudioSession.outputVolume` i wybraną playback rate od chwilowego `AVPlayer.rate`.
- [ ] Udokumentować mapowanie `PlaybackState` SDK → stringi kontraktu RN.
- [ ] Udokumentować mapowanie `BunnyLiveStreamPlaybackState` → payload `onLiveStateChange` (patrz sekcja 5).
- [ ] Nie łamać istniejącego drop-in API example app SDK.

### Faza 1b — minimalne zmiany w iOS SDK dla natywnego live (zadanie dla zespołu SDK, wymagane)

> Te zmiany muszą być wykonane w repozytorium `bunny-stream-ios-private` przez zespół SDK. Mostek RN nie modyfikuje SDK. Pełna lista w sekcji 12.2.

- [ ] Dodać publiczny `onVideoSizeChange(width:height:)` do `BunnyStreamLivePlayer`, ponieważ obecny publiczny stan nie daje bridge'owi dostępu do `Video`/`MediaPlayer`.
- [ ] Rozdzielić błąd terminalny od przejściowego recovery: albo osobny `onTerminalError`, albo stabilna publiczna klasyfikacja błędu. `onLiveError` RN emituje tylko terminalny błąd dokładnie raz.
- [ ] Zagwarantować, że `stop()` anuluje polling i wszystkie zagnieżdżone Taski ładowania playera/recordingu, nie tylko główny `pollTask`.
- [ ] Zachować callbacki live na main actor i nie emitować ich po `stop()`.

### Faza 1c — zmiany w iOS SDK dla live custom controls (zadanie dla zespołu SDK, opcjonalnie, po natywnym live)

> Te zmiany muszą być wykonane w repozytorium `bunny-stream-ios-private` przez zespół SDK. Mostek RN nie modyfikuje SDK. Pełna lista w sekcji 12.2.

- [ ] Dodać publiczny `BunnyStreamLivePlayerController` (lub wystawić `MediaPlayer` z live) z `play`, `pause`, `seek`, `jumpToLive`, `mute`, `unmute`, `setPlaybackRate` (tam gdzie wspierane).
- [ ] Wystawić publicznie `isAtLiveEdge` i `snapToLiveEdge` (lub `jumpToLive()` na controllerze).
- [ ] Dodać publiczny DVR/live-edge stan do `BunnyLiveStreamPlaybackState` lub osobny callback.
- [ ] Dodać `controlsEnabled` do `BunnyStreamLivePlayer`.
- [ ] Dodać obserwowalny progress/buffering dla live (jeśli custom UI ma je pokazywać).
- [ ] Zapewnić stabilną tożsamość controllera podczas re-renderów SwiftUI i poprawny cleanup po `onDisappear` (`controller.stop()` już istnieje).

### Faza 2 — Codegen, podspec i build spike

- [ ] Dodać `BunnyLiveStreamPlayerView` do `package.json > codegenConfig.ios.components` obok VOD.
- [ ] Uruchomić iOS Codegen dla RN 0.86.2 i sprawdzić faktycznie wygenerowane protokoły/component descriptors dla obu hostów oraz TurboModule.
- [ ] Na minimalnym widoku bez SDK potwierdzić wybrany wzorzec implementacji RN 0.86 (Codegen/Fabric component view albo wspierany manager interop); nie kopiować mechanicznie Androidowego `commitProps()` ani zakładać nazw protokołów przed wygenerowaniem kodu.
- [ ] Zależnie od decyzji z Fazy 0: dodać oficjalną zależność CocoaPods, vendored XCFramework albo development-only SwiftPM linkage w example app.
- [ ] Ustawić minimum iOS 15.0 oraz Swift 5.9 zgodnie z SDK.
- [ ] Upewnić się, że source files i zasoby SDK (lokalizacje, fonty) trafiają do finalnego artefaktu.
- [ ] Rozwiązać IMA (`GoogleInteractiveMediaAds`) i sprawdzić static/dynamic linking.
- [ ] Zweryfikować `pod install`, Codegen oraz `xcodebuild` example app w Debug i Release.

### Faza 3 — TurboModule `initialize` i konfiguracja bridge'a

- [ ] Zaimplementować `initialize(accessKey:libraryId:)` jako zapis do thread-safe, in-memory `BunnyStreamConfigurationStore`; iOS SDK nie ma globalnego `BunnyStreamAPI.initialize`.
- [ ] Nie zapisywać access key do `UserDefaults`, nie logować go i nie umieszczać w eventach.
- [ ] Przeprowadzić security review modelu uwierzytelnienia: access key przekazany z JS i osadzony w aplikacji mobilnej jest możliwy do odzyskania. Preferować viewer/embed token lub backend-issued short-lived credential; długoterminowy API access key nie powinien być wymagany do publicznego playbacku.
- [ ] Walidować niepusty access key oraz dodatni całkowity `libraryId`, zgodnie z obecnym wspólnym TS API; jeśli security review zmieni kontrakt, zaktualizować Codegen/TS świadomie na obu platformach.
- [ ] Każdy host pobiera snapshot konfiguracji przy tworzeniu źródła: jawny `source.libraryId` ma pierwszeństwo, w przeciwnym razie używa wartości domyślnej z store; access key przekazywany jest do konstruktora SDK.
- [ ] Zdefiniować błąd kontrolowany, gdy host jest montowany przed `initialize()` (dla live zawsze wymagany access key; dla VOD decyzja produktowa, czy publiczny VOD może użyć `nil`).
- [ ] Ponowne `initialize()` wpływa tylko na przyszłe source generations; nie przeładowuje potajemnie już grającego playera.
- [ ] Zachować wygenerowany `NativeBunnyStreamPlayerSpecJSI` i prawidłową rejestrację modułu iOS.
- [ ] Audio session konfiguruje player przy rozpoczęciu playbacku; FairPlay jest per source. Nie wykonywać ich globalnie w `initialize()`.

### Faza 4 — Fabric VOD view (rdzeń)

- [ ] Zastąpić stub VOD implementacją dokładnie zgodną z artefaktami wygenerowanymi przez RN 0.86 Codegen; nazwa komponentu musi pozostać `'BunnyStreamPlayerView'`.
- [ ] W update props tworzyć immutable snapshot (`videoId`, resolved `libraryId`, `token`, `expires`, `autoPlay`, `controls`) i porównywać source identity (`videoId + libraryId + token + expires`); `autoPlay`/`controls` nie przeładowują źródła.
- [ ] Hostować SwiftUI `BunnyStreamPlayer` przez child `UIHostingController`: poprawne `addChild/didMove`, layout, trait/safe-area propagation i symetryczny removal. Ścieżka B z bezpośrednim `MediaPlayer` pozostaje wyłącznie fallbackiem po jawnej decyzji SDK.
- [ ] Na zmianę source identity: anulować poprzednią generację, wykonać `dispose()`, utworzyć nowy controller/root view i odrzucać stare callbacki.
- [ ] Emitować direct events przez mechanizm wygenerowany dla Fabric/Codegen; nie zakładać `RCTEventDispatcher` ani ręcznego event name mapping bez sprawdzenia wzorca RN 0.86. Progress ma być coalesced/throttled, buffering deduplikowany.
- [ ] Obsłużyć Codegen commands `play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`, `mute`, `unmute`; walidować `seekTo>=0`, clamp volume do `0...1`, rate do wspieranych dodatnich wartości oraz wymagać bezpiecznych liczb całkowitych dla `libraryId`/`expires` przed konwersją JS `Double` → Swift `Int`/`Int64`.

### Faza 5 — mechanizmy mostka (idiomatyczne iOS)

- [ ] Main-actor `generation` counter — increment przy zmianie źródła/cleanup, sprawdzanie przed każdym eventem i zakończeniem async task; nie używać przestarzałego `OSAtomic`.
- [ ] `CommandQueue` — kolejka `play`/`pause`/`seekTo` przed ready, FIFO drain po `onReady`, reset przy zmianie źródła; jawnie ustalić kolejność wobec `autoPlay` (ostatnia komenda użytkownika wygrywa).
- [ ] Idempotentny cleanup — anulowanie Tasków, `controller.dispose()`/live stop, odłączenie callbacków, usunięcie child `UIHostingController` i increment generation.
- [ ] Nie dodawać lease bez potwierdzonego ograniczenia SDK. Testować dwa niezależne playery; jeśli potrzebna jest polityka audio focus, opisać ją osobno od lifetime/ownership.
- [ ] Czyste, testowalne mappery VOD i live; deduplikacja transition events, buffering i terminal errors.
- [ ] Coalescing/throttling `onProgress` zgodny z iOS Fabric Codegen.

### Faza 6 — custom controls VOD

- [ ] `controls={false}` → `controlsEnabled=false` na SDK (ścieżka A) lub brak overlayu (ścieżka B).
- [ ] Wszystkie komendy przez publiczny controller SDK; nie sięgać z bridge'a do internal `MediaPlayer`.
- [ ] `seekTo` zachowuje stan paused/playing i clampuje pozycję do poprawnego zakresu.
- [ ] `setVolume`/mute raportują per-player volume, nie sprzętowy output volume.
- [ ] `setPlaybackRate` zachowuje wybraną wartość podczas pauzy i wznowienia.
- [ ] Synchronizacja custom UI po błędzie, lifecycle, zmianie źródła, mute/volume i zmianie prędkości.
- [ ] Nie obiecywać fullscreen/PiP/AirPlay jako komend ref, dopóki SDK nie udostępni publicznych komend.

### Faza 7 — live z natywnym UI (Fabric)

- [ ] Dodać wewnętrzny Fabric host `BunnyLiveStreamPlayerView` opakowujący `BunnyStreamLivePlayer` przez `UIHostingController` (analogicznie do VOD Fazy 4, jako osobno zarejestrowany component zgodny z wynikiem Codegen spike'a).
- [ ] Props źródła: `libraryId`, `streamId`, `token`, `expires` (z `BunnyLiveStreamPlayerNativeComponent.ts`).
- [ ] Przekazać `accessKey` z konfiguracji bridge'a (z `initialize()`).
- [ ] Mapować `BunnyStreamLivePlayer.onStateChange` → `onLiveStateChange` (patrz tabela w sekcji 5).
- [ ] Mapować tylko terminalny błąd live → `onLiveError` dokładnie raz; transient recovery errors nie są terminalnym publicznym eventem.
- [ ] Mapować nowy publiczny callback SDK `onVideoSizeChange` → event Codegen; bez niego event pozostaje niewykonalny i jest blockerem Fazy 7.
- [ ] `.failed(message)` emituje `onLiveError`; nie mapować go fałszywie na `state='offline'`.
- [ ] Source key z `libraryId + streamId + token + expires` → rekonstrukcja hosta tylko przy zmianie źródła; JS `key` już wymusza remount, natywny cleanup nadal musi być idempotentny.
- [ ] Na unmount: zatrzymać live controller/polling, anulować zagnieżdżone Taski, odłączyć callbacks i usunąć `UIHostingController`.
- [ ] Brak komend ref — istniejący guard w `index.tsx` no-opuje komendy dla live.
- [ ] Zarejestrować live host przez zaktualizowany iOS `codegenConfig` i właściwy wzorzec RN 0.86.
- [ ] Udokumentować brak custom controls live jako ograniczenie platformowe (do czasu Fazy 1c/7b).

### Faza 7b — custom controls live (po Fazie 1c)

- [ ] Wymaga publicznego controllera z Fazy 1c.
- [ ] Rozszerzyć wspólny live Codegen spec o `controls` i commands oraz przekazywać publiczny `controls` z `index.tsx`; obecnie TS celowo nie forwarduje `controls` do live.
- [ ] Mapować `controls={false}` na `BunnyStreamLivePlayer.controlsEnabled=false`.
- [ ] Mapować controller na ref commands RN (`play`, `pause`, `seek`, `jumpToLive`, `mute`, `unmute`).
- [ ] Emitować progress/buffering/DVR/live-edge z publicznego źródła SDK.
- [ ] Zdefiniować zachowanie komend dla offline/countdown/trailer i przejścia live → VOD.
- [ ] Zachować overlaye statusów SDK nawet przy custom controls, chyba że finalne SDK jawnie wspiera ich zastępowanie.

### Faza 8 — example app iOS

- [ ] Uruchomić example app na iOS przez `pod install` + Metro.
- [ ] Zweryfikować `PlayerScreen` (VOD native controls) na iOS.
- [ ] Zweryfikować `CustomControlsPlayerScreen` (VOD `controls={false}` + custom RN UI) na iOS.
- [ ] Zweryfikować `initialize` z access key i library ID.
- [ ] Zweryfikować token-secured VOD (`token` + `expires`).
- [ ] Zweryfikować FairPlay/DRM video (jeśli dostępne w testowej bibliotece).
- [ ] Dodać ekran live z natywnymi kontrolkami przez ten sam publiczny `BunnyStreamPlayer` i `source.type='live'` (analogicznie do Androida).
- [ ] Zweryfikować live: offline, countdown, trailer, running (live edge), DVR, recovery, live → VOD recording.
- [ ] Zweryfikować token-secured live (`token` + `expires`).
- [ ] Nie umieszczać access key ani tokenów w repo.

### Faza 9 — testy

#### Jednostkowe (Swift / Obj-C)

- [ ] Testy mapper `PlaybackState` SDK → stringi RN.
- [ ] Testy `CommandQueue` (enqueue/drain/reset/ready-gate).
- [ ] Testy generation counter (bump/invalidate) i braku eventów po cleanup.
- [ ] Testy thread-safe configuration store: initialize, snapshot, reinitialize, brak konfiguracji.
- [ ] Testy source key (zmiana `videoId`/`libraryId`/`token`/`expires` → reload; zmiana `autoPlay`/`controls` → brak reloadu).
- [ ] Testy mapper live: wszystkie stany, `isVodRecording`, countdown epoch, `.failed` tylko jako terminal error, transient error bez `onLiveError`.
- [ ] Testy deduplikacji buffering/terminal error oraz semantyki volume/rate.
- [ ] Testy source key live (`streamId`/`libraryId`/`token`/`expires` → reload).

#### Jednostkowe (TypeScript — już istnieją, rozszerzyć)

- [ ] Test wrappera: `source.type='live'` montuje live host, forwarduje właściwe event handlers, nie forwarduje VOD props i zachowuje no-op ref commands.
- [ ] Test hooka: mapowanie live state/error, reset po zmianie identity i brak duplikacji terminal error.
- [ ] Zachować istniejące testy reducerów, handlerów i stabilności.

#### Integracyjne iOS

- [ ] VOD native controls i custom controls.
- [ ] Publiczny i token-secured VOD.
- [ ] FairPlay/DRM (jeśli dostępne).
- [ ] Live: offline, countdown, trailer, running (live edge), DVR, recovery, live → VOD recording.
- [ ] Publiczny i token-secured live.
- [ ] Zmiana `videoId` i `streamId` bez starych callbacków/pollingu.
- [ ] Background/foreground (polling live pauzuje/wznawia), rotacja, fullscreen natywny.
- [ ] Mount/unmount bez wycieków `MediaPlayer`/`AVPlayer`/FairPlay/IMA oraz bez pollingu/callbacków po cleanup.
- [ ] Dwa równoczesne playery VOD/live — zweryfikować faktyczne zachowanie; nie narzucać lease bez ograniczenia SDK. Osobno przetestować audio interruptions i route changes.
- [ ] Accessibility/VoiceOver, rotacja, safe areas, fullscreen/PiP oferowane przez natywne UI.
- [ ] Utrata/odzyskanie sieci, app background/foreground i memory pressure.
- [ ] Debug i Release na simulatorze i urządzeniu.

#### Dystrybucja

- [ ] Codegen, TypeScript, Jest, testy Swift.
- [ ] Build example debug/release iOS.
- [ ] `npm pack --dry-run`.
- [ ] Instalacja tarballa w czystym projekcie RN New Architecture na iOS.
- [ ] Finalny test bez lokalnego SwiftPM (po opublikowaniu SDK jako pod).

### Faza 10 — przejście na publiczne SDK i release readiness

- [ ] Zapisać finalny przypięty SHA `origin/feature/ios-liveStream` oraz wersję artefaktu iOS SDK zbudowanego z tego SHA.
- [ ] Jeżeli publiczny artefakt używa innego SHA niż development baseline, wykonać jawny contract diff i pełną regresję.
- [ ] Zamienić development-only linkage na wybrany publiczny mechanizm (CocoaPod lub XCFramework); nie polegać na nieprzenośnym SPM dependency w podspecie.
- [ ] Usunąć lokalne ścieżki/repozytoria z konfiguracji dystrybucyjnej.
- [ ] Opisać macierz kompatybilności npm ↔ iOS SDK (`origin/feature/ios-liveStream` SHA/artifact version) ↔ React Native ↔ iOS version.
- [ ] Udokumentować VOD native/custom controls oraz live z natywnym UI.
- [ ] Udokumentować wymaganie iOS 15+ i rzeczywiste wyniki testu wielu playerów.
- [ ] Udokumentować brak custom controls/commands live do czasu Fazy 1c.
- [ ] Opisać bezpieczne użycie access key oraz embed token/`expires`.
- [ ] Nie publikować npm, dopóki czysta aplikacja nie pobiera wszystkich zależności z publicznych repozytoriów (iOS + Android).

## 8. Kolejność priorytetów

1. Przypięcie konkretnego SHA `origin/feature/ios-liveStream` jako baseline i rozstrzygnięcie dystrybucji (CocoaPod/XCFramework; OpenAPI generated sources).
2. Zmiany SDK VOD: callbacki, controller, `controlsEnabled`, `autoPlay`, `dispose`, poprawne seek/volume/rate.
3. Minimalne zmiany SDK live: publiczny video-size callback, terminal error contract i pełne anulowanie Tasków.
4. iOS Codegen/Fabric spike RN 0.86 + rejestracja obu hostów.
5. Configuration store i TurboModule `initialize`.
6. Fabric VOD host, pełne eventy/komendy i custom controls.
7. Fabric live host z natywnym UI i eventami.
8. Example app iOS (VOD + live), testy integracyjne i dystrybucyjne.
9. Opcjonalnie: live controller + rozszerzenie Codegen + custom controls live (Faza 1c/7b).
10. Publiczny artefakt SDK, czysty tarball test i gotowość do publikacji.

Ta kolejność pozwala niezależnie zweryfikować regresje VOD, ryzyka SwiftUI-w-UIHostingController, natywny live bez custom controls oraz brakujące API SDK dla custom-live.

## 9. Ryzyka i ograniczenia

- **SwiftUI w Fabric przez `UIHostingController`**: timing `onAppear`/`onDisappear`, parent controller discovery, reattach, safe areas i fullscreen. Wymaga spike'a na RN 0.86 oraz testów lifecycle.
- **Dystrybucja SwiftPM/CocoaPods**: OpenAPI build plugin, zasoby, branch dependencies i IMA są blockerem instalacji u konsumenta; rozwiązać przed właściwym bridge'em.
- **Zmiana baseline SHA**: `origin/feature/ios-liveStream` jest gotowym branchem głównym dla tego wdrożenia, ale przesunięcie przypiętego SHA nadal może zmienić kontrakt; każda aktualizacja wymaga review i pełnych testów.
- **Access key w kliencie mobilnym**: przekazanie długoterminowego API key przez JS/native nie czyni go sekretem; integracja live nie może zostać uznana za produkcyjną bez zaakceptowanego modelu tokenów/uprawnień.
- **Async cleanup live**: `stop()` anuluje główny polling, ale zagnieżdżone Taski muszą również respektować cancellation/generation.
- **Brak publicznego video size i terminal error contract live**: wymagane minimalne zmiany SDK przed pełnym kontraktem Codegen.
- **IMA/FairPlay**: sprawdzić linking, zasoby, cleanup, błędy i urządzenie fizyczne.
- **Volume/rate semantics**: obecne callbacki SDK obserwują wartości AVFoundation, które nie odpowiadają wprost publicznemu stanowi RN.
- **Wiele playerów**: iOS nie używa potwierdzonego singletonu; zweryfikować zasoby i audio behavior testem zamiast kopiować lease Androida.
- **iOS 15+**: jest twardym minimum SwiftPM SDK i musi znaleźć się w podspecie oraz dokumentacji.

## 10. Otwarte pytania do zespołu iOS SDK

1. Czy zespół SDK zaakceptuje preferowane API VOD: publiczny controller + callbacks + `controlsEnabled` + `autoPlay` + `dispose`, zamiast wystawiania całego `MediaPlayer`?
2. Czy `seek(to:)` zachowa pause, a volume/rate callbacks będą raportować publiczne wartości per-player?
3. Czy callbacki VOD/live są gwarantowane na main actor i zatrzymują się po `dispose()`/`stop()`?
4. Czy live dostanie publiczny `onVideoSizeChange` oraz jednoznaczny terminal-error callback?
5. Czy IMA może być opcjonalne i jak ma być dystrybuowane/linkowane?
6. Który dokładny SHA `origin/feature/ios-liveStream` ma być przypięty jako baseline release candidate (domyślnie `e5fe42e`)?
7. Czy oficjalna dystrybucja iOS będzie przez CocoaPods, XCFramework, SwiftPM, czy kilka formatów; jak rozwiązane będą OpenAPI generated sources?
8. Jaki model uwierzytelnienia jest zaakceptowany dla aplikacji mobilnej: publiczny playback bez key, embed token, short-lived backend token czy długoterminowy API access key? Czy publiczny VOD bez `initialize()` ma być wspierany mimo obecnego TS API?
9. Czy SDK formalnie wspiera wiele równoczesnych instancji playera?
10. W późniejszym zakresie: czy live dostanie controller, `controlsEnabled`, `jumpToLive` i publiczny DVR/live-edge state?

## 11. Kryteria zakończenia

Zmiana jest gotowa, gdy:

1. VOD działa na iOS z publicznym SDK bez regresji względem drop-in example app SDK;
2. VOD custom controls używają publicznego API SDK zamiast refleksji/swizzlingu;
3. wszystkie eventy VOD Codegen są emitowane dokładnie z opisaną semantyką (ready, progress cadence, buffering dedupe, volume/rate, błędy);
4. wszystkie komendy ref VOD działają i walidują argumenty; `seekTo` nie wznawia odtwarzania podczas pauzy;
5. `controls={false}` i `autoPlay` działają dla VOD;
6. FairPlay/DRM i IMA działają oraz zwalniają zasoby;
7. lifecycle Fabric/SwiftUI i zmiana źródła anulują stare Taski/callbacki/polling i nie pozostawiają starego hosta;
8. test wielu playerów potwierdza faktyczne zachowanie i nie ma sztucznego lease bez ograniczenia SDK;
9. `source.type='live'` renderuje natywny `BunnyStreamLivePlayer` (countdown, trailer, offline, live, DVR, recovery, live → VOD) z poprawnym `onLiveStateChange`, terminalnym `onLiveError` dokładnie raz i publicznym `onVideoSizeChange`; ref commands pozostają no-op;
10. iOS Codegen rejestruje oba hosty i TurboModule w Debug/Release RN New Architecture;
11. paczka instaluje się w czystym projekcie bez prywatnych ścieżek, manualnego patchowania ani lokalnego SDK;
12. dokumentacja opisuje iOS 15+, format dystrybucji, model `initialize`, VOD native/custom controls, live native UI i brak custom controls live do czasu Fazy 1c.

## 12. Brakujące elementy w iOS SDK (wymagane do pełnego mostka)

Repozytorium `bunny-stream-ios-private` (gałąź `origin/feature/ios-liveStream`, commit `e5fe42e`) jest traktowane jako gotowy baseline, ale **nie wolno go modyfikować z poziomu mostka RN**. Poniższe elementy muszą zostać dodane przez zespół SDK, zanim będą mogły być zaimplementowane w mostku.

### 12.1. Brakujące API VOD (`BunnyStreamPlayer`)

| Brak                                                                                                                                                                                                    | Wpływ na mostek                                                                              | Priorytet                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Publiczne callbacki playbacku (`onReady`, `onPlaybackStateChange`, `onProgress`, `onError`, `onBuffering`, `onPlay`, `onPause`, `onEnd`, `onVolumeChange`, `onPlaybackRateChange`, `onVideoSizeChange`) | Bez callbacków mostek RN nie może emitować eventów Codegen do TypeScript                     | **Blocker**                                              |
| Publiczny controller komend (`play`, `pause`, `seek`, `setVolume`, `setPlaybackRate`, `mute`, `unmute`)                                                                                                 | Bez controllera ref commands z `BunnyStreamPlayerRef` nie mogą być zaimplementowane          | **Blocker**                                              |
| `controlsEnabled: Bool`                                                                                                                                                                                 | Bez tej flagi nie można ukryć natywnych kontrolek dla `controls={false}`                     | **Blocker dla custom controls**                          |
| `autoPlay: Bool`                                                                                                                                                                                        | Bez tego nie można kontrolować automatycznego startu playbacku                               | **Blocker dla `autoPlay` prop**                          |
| `dispose()` / idempotentny cleanup                                                                                                                                                                      | Bez tego mostek nie może bezpiecznie zwolnić zasoby przy zmianie źródła/unmount              | **Blocker**                                              |
| `seek(to:)` zachowujące stan paused/playing                                                                                                                                                             | Obecne `jump(to:)` automatycznie wznawia playback, co jest niezgodne z semantyką RN `seekTo` | **Blocker dla `seekTo`**                                 |
| Per-player volume (nie sprzętowy `AVAudioSession.outputVolume`)                                                                                                                                         | Obecny `setupVolumeObserver` obserwuje głośność sprzętową, nie per-player                    | **Blocker dla `setVolume`/`onVolumeChange`**             |
| Playback rate = wybrana prędkość (nie chwilowy `AVPlayer.rate`)                                                                                                                                         | Obecny rate observer zgłasza `rate=0` podczas pauzy                                          | **Blocker dla `setPlaybackRate`/`onPlaybackRateChange`** |

### 12.2. Brakujące API Live (`BunnyStreamLivePlayer`)

| Brak                                                                                       | Wpływ na mostek                                                                                                                                                      | Priorytet                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `onVideoSizeChange(width:height:)`                                                         | Obecny `onStateChange` nie przekazuje `Video`/`MediaPlayer`, więc bridge nie może legalnie odczytać wymiarów                                                         | **Blocker dla `onVideoSizeChange` Codegen event** |
| Rozdzielenie błędu terminalnego od przejściowego                                           | Obecny `onPlaybackError` zgłasza także błędy przejściowe, z których player sam się odzyskuje; `onLiveError` RN powinien emitować tylko terminalny błąd dokładnie raz | **Blocker dla `onLiveError` semantics**           |
| `controlsEnabled: Bool`                                                                    | Bez tej flagi nie można ukryć natywnych kontrolek live dla `controls={false}`                                                                                        | **Blocker dla live custom controls**              |
| Publiczny controller komend live (`play`, `pause`, `seek`, `jumpToLive`, `mute`, `unmute`) | `userWantsPlay` jest internal; bez controllera ref commands live nie mogą być zaimplementowane                                                                       | **Blocker dla live custom controls**              |
| Publiczne `isAtLiveEdge` / `snapToLiveEdge`                                                | Internal w `MediaPlayer+Live.swift`; potrzebne dla `jumpToLive`                                                                                                      | **Blocker dla `jumpToLive`**                      |
| Publiczny DVR/live-edge stan w `BunnyLiveStreamPlaybackState`                              | Tylko `isVodRecording` w `playing`; brak jawnego DVR/live-edge                                                                                                       | **Blocker dla `dvrEnabled`**                      |
| Obserwowalny progress/buffering dla live                                                   | Tylko `onStateChange` i `onPlaybackError`; brak callbacków progress/buffering                                                                                        | **Blocker dla live custom UI**                    |
| FairPlay dla live edge                                                                     | `makeLive` używa CMCD resource loader, ale nie podpina FairPlay — wsparcie DRM live edge niepotwierdzone                                                             | **Do potwierdzenia**                              |

### 12.3. Brakujące API dystrybucyjne

| Brak                                     | Wpływ                                                                                                                                    | Priorytet                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Oficjalny CocoaPod lub XCFramework       | SwiftPM package używa OpenAPI Generator build plugin, którego CocoaPods nie uruchomi; `s.package`/`:path` w podspecie nie jest przenośne | **Blocker dla instalacji npm u konsumenta** |
| Przypięte wersje zależności (nie branch) | `Kingfisher/master`, `SwiftSubtitles/main` itd. nie są akceptowalne dla dystrybucji                                                      | **Blocker dla dystrybucji**                 |
| OpenAPI generated sources w artefakcie   | Build plugin nie zadziała w CocoaPods/XCFramework                                                                                        | **Blocker dla dystrybucji**                 |

## 13. Funkcje specyficzne tylko dla iOS

Ta sekcja dokumentuje różnice między implementacją iOS a Androidem, które wynikają z konstrukcji iOS SDK i nie mają odpowiednika po stronie Androida.

### 13.1. Architektura

- **SwiftUI w `UIHostingController`**: iOS SDK używa SwiftUI (`BunnyStreamPlayer`, `BunnyStreamLivePlayer`), które mostek hostuje przez `UIHostingController` wewnątrz Fabric view. Android używa Compose przez `ComposeView`. Wzorzec jest analogiczny, ale iOS wymaga obsługi `addChild/didMove`, trait/safe-area propagation i symetrycznego removal.
- **Brak globalnego `initialize`**: iOS SDK nie ma globalnego `BunnyStreamAPI.initialize`. `BunnyStreamAPI` jest instancjonowane bezpośrednio z `accessKey`. Mostek musi utrzymywać własny configuration store, z którego każdy host pobiera snapshot przy tworzeniu źródła. Android używa `BunnyStreamApi.initialize(context, accessKey, libraryId)`.
- **Brak `BunnyPlayerLease`**: Android używa singletonu SDK i lease dla pojedynczego aktywnego playera. iOS tworzy osobny `MediaPlayer` dla każdego widoku — lease nie jest wymagany, chyba że test wykaże ograniczenie.

### 13.2. VOD

- **`watermark`**: iOS SDK przyjmuje `PlayerWatermark` w konstruktorze `BunnyStreamPlayer` i `BunnyStreamLivePlayer`. Android nie ma odpowiednika w tym samym miejscu (watermark jest obsługiwany inaczej).
- **`playerIcons`**: iOS SDK przyjmuje `PlayerIcons` do customizacji ikon. Android używa innego mechanizmu.
- **`FontManager.registerFonts()`**: iOS SDK rejestruje fonty w konstruktorze `BunnyStreamPlayer`. Mostek nie musi tego robić osobno.
- **Audio session**: iOS SDK konfiguruje `AVAudioSession` w `setupAudioSession()` (kategoria `.playback`, tryb `.moviePlayback`). Android nie wymaga analogicznej konfiguracji.
- **FairPlay vs Widevine**: iOS używa FairPlay (automatycznie podpinany w `MediaPlayer.make(video:)`). Android używa Widevine. Mostek nie musi implementować DRM — jest transparentny.
- **IMA ads**: iOS używa `GoogleInteractiveMediaAds` 3.18.4 przez SwiftPM. Android używa IMA SDK przez Gradle. Linkowanie i zasoby mogą się różnić.

### 13.3. Live

- **`BunnyStreamLivePlayer` jako osobny widok**: iOS ma osobny publiczny `BunnyStreamLivePlayer` z własnym `LivePlaybackController`. Android używa tego samego `BunnyStreamPlayer` z `source.type='live'`. Mostek RN ukrywa tę różnicę za wspólnym `BunnyStreamPlayer` z `source: BunnyStreamSource`.
- **Polling w SDK**: iOS `LivePlaybackController` samodzielnie odpytuje stan co 5 s. Android SDK również samodzielnie zarządza pollingiem. Mostek nie reimplementuje pollingu.
- **Pre-stream trailer**: iOS używa `LoopingTrailerView` (looping `AVQueuePlayer`). Android używa innego mechanizmu.
- **Countdown overlay**: iOS renderuje countdown w SwiftUI (`TimelineView.periodic`). Android renderuje w Compose.
- **Offline/error overlay**: iOS renderuje natywnie w SwiftUI. Android w Compose.
- **Live → VOD recording**: iOS automatycznie przełącza na VOD player po zakończeniu streamu (jeśli `recordVod`). Android analogicznie.
- **DVR/live edge**: iOS rozróżnia `PlaybackKind = .vod | .event | .live` (internal). Android używa `dvrEnabled`.
- **`BunnyLiveStreamPlaybackState`**: iOS ma publiczny enum z 6 stanami. Android ma `LiveStreamPlayerState` sealed interface. Mapowanie na wspólny Codegen union jest opisane w sekcji 5.
- **Brak `onVideoSizeChange` live**: iOS SDK nie wystawia publicznego callbacku video size dla live (patrz sekcja 12.2). Android wystawia.
- **Brak live custom controls**: iOS SDK nie wystawia publicznego controllera komend live (patrz sekcja 12.2). Android wystawia.

### 13.4. Dystrybucja

- **SwiftPM + OpenAPI Generator**: iOS SDK używa SwiftPM z `OpenAPIGenerator` build plugin dla `BunnyStreamAPI`. CocoaPods nie uruchamia build pluginów. Android nie ma analogicznego problemu.
- **Branch dependencies**: iOS SDK ma `Kingfisher/master`, `SwiftSubtitles/main`, `TUSKit/main`, `HaishinKit.swift` 1.7.3. Android przypina wersje w Gradle.
- **iOS 15+**: iOS SDK wymaga iOS 15+. Android ma inne minimum (API level z `minSdkVersion`).
- **Swift 5.9**: iOS SDK wymaga Swift 5.9. Android używa Kotlin/Java.
- **CocoaPods vs Gradle**: iOS dystrybuuje się przez CocoaPods (lub XCFramework). Android przez Gradle/Maven.

### 13.5. Model uwierzytelnienia

- **Access key w nagłówku HTTP**: iOS `VideoPlayerConfigLoader` wysyła `AccessKey` w nagłówku HTTP. Android robi analogicznie.
- **Token + expires**: iOS przyjmuje `token: String?` i `expires: Int64?` w konstruktorze. Android analogicznie.
- **Public VOD bez access key**: iOS `BunnyStreamPlayer` przyjmuje `accessKey: String?` (nil dla publicznych). Wspólne TS API obecnie wymaga niepustego klucza — decyzja produktowa (patrz sekcja 10, pytanie 8).
