# Plan: audyt modułu kamery + integracja example app (fazy 4 i 5)

## 1. Cel

Dwa cele wykonywane sekwencyjnie:

1. **Audyt kompletności modułu `BunnyStreamBroadcaster`** (faza 5) względem natywnych SDK i example appów (`bunny-stream-ios-private`, `bunny-stream-android-private`). Moduł kamery jest już zaimplementowany w wrapperze — audyt weryfikuje parytet i identyfikuje luki.
2. **Rozszerzenie example app** o funkcje dodane w fazach 4 i 5:
   - **Faza 5 (kamera):** screen "Camera" z dwoma trybami — nagrywanie nowego VOD oraz Go Live do istniejącego streama — wiernie oddające UX natywnych example appów (`GoLiveActivity`/`RecordingActivity` na Androidzie, `BunnyStreamCameraUploadView`/`BroadcastDemoView` na iOS), bez usuwania istniejących funkcjonalności.
   - **Faza 4 (video management):** screen "Video management" z akcjami per-video (thumbnail, captions, reencode, repackage, deleteResolutions, transcribe, smartGenerate). Natywne example appy **nie demonstrują** tych operacji w UI — ten screen jest oryginalnym wkładem wrappera, bez natywnego wzorca UX.

Audyt i example appy natywne wykonano 2026-09-13 na aktualnych working tree `bunny-stream-ios-private` (`feature/ios-liveStream`, `8e222bb`) i `bunny-stream-android-private` (`feature/live_streams`, `fb86350`) — zgodnie z `native-sdk-baselines.json`.

## 2. Decyzje przyjęte w planie

| Decyzja | Wybór | Uzasadnienie |
| --- | --- | --- |
| Uprawnienia kamery/mikrofonu | **Odpowiedzialność aplikacji-hosta** (example app), nie wrappera | Wrapper nie żąda uprawnień; natywne SDK sprawdzają, ale nie żądają. Example app dodaje klucze `Info.plist` (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`) przez `app.json` RNTA, uprawnienia Android przez `app.json` (`android.permissions`) oraz żądanie runtime przez helper. Wrapper pozostaje czystym opakowaniem SDK. |
| Tryb standalone VOD vs Go Live | **Dwa osobne tryby w jednym screenie `Camera`** | Pełna parzystość z iOS (`ContentView` → standalone, `LiveStreamListView` swipe → `BroadcastDemoView`) i Androidem (`RecordingActivity` → VOD, `GoLiveActivity` → live ze `streamId`). Go Live wymaga wybranego istniejącego streama. |
| Start broadcast na Androidzie | **`hideDefaultControls={false}` + natywny przycisk start** | Android SDK nie wystawia publicznego `startBroadcast()` (TODO(Android SDK)). Bridge symuluje kliknięcie wbudowanego przycisku tylko gdy kontrolki widoczne. Example app na Androidzie używa natywnych kontrolek SDK do startu; przycisk JS "Start" wywołuje `startBroadcast()` (działa przez symulację). iOS używa `startBroadcast()` natywnie. |
| Quality picker | **Tylko iOS, presety z `BroadcastQuality`** | Android hard-coduje 1080p30 (~9.3 Mbps); `quality` jest ignorowany. Picker pokazany tylko na iOS (`Platform.OS === 'ios'`), z presettami `sd480`/`hd720`/`fullHd1080`/`fullHd1080p60` — mirror `BroadcastQualityOption` z iOS `ContentView.swift:14-39`. |
| Event log | **Lista ostatnich zdarzeń w screenie kamery** | Mirror `BroadcastDemoView.swift:36-39` (`eventLog.insert(describe(event), at: 0)`). Pokazuje state, reconnect, failover, ingest, errors. |
| Go Live entry point | **Akcja "Go Live" w `LiveStreamsScreen` na wierszu streama** | Mirror iOS `LiveStreamListView.swift:170-177` (swipe action → `broadcasterStream`) i Android `LiveStreamsScreen` → `GoLiveActivity`. Nawigacja do screenu `Camera` z parametrem `{ streamId, libraryId }`. |
| Phase 4 management screen | **Opcjonalny screen `VideoManagement` z actions per-video** | Natywne appy nie mają UI dla faz-4 (potwierdzone grepami w obu repozytoriach). Screen jest wrapper-original, bez natywnego wzorca. Otwierany z `VideoListScreen` (long-press / menu). Działa jako demo/debug powierzchni API. |

## 3. Audyt modułu `BunnyStreamBroadcaster`

### 3.1. Co jest gotowe i poprawne

- **Kontrakt TS** (`src/broadcaster/types.ts`, `src/broadcaster/BunnyStreamBroadcaster.tsx`): `BunnyStreamBroadcasterProps` z `source` (`new` | `live`), `quality`, `cameraPosition`, `hideDefaultControls`, `dualPublish`, `autoStart`. Eventy: `onStateChange`, `onElapsedTime`, `onCameraChange`, `onMuteChange`, `onIngestStateChange`, `onReconnecting`, `onReconnectFailed`, `onFailover`, `onError`. Ref: `startBroadcast`, `stopBroadcast`, `switchCamera`, `setMuted`, `toggleMute`. Spójne z modelem zdarzeń obu SDK.
- **Spec Codegen** (`src/specs/BunnyStreamBroadcasterNativeComponent.ts`): poprawny Fabric Native Component z wszystkimi props i direct events.
- **Android** (`android/.../BunnyStreamBroadcasterView.kt`, `BunnyStreamBroadcasterViewManager.kt`): hostuje `BunnyStreamCameraUpload`, `RecordingStateListener` + `RecordingDurationListener` mapowane na JS events, prop setters, `commitProps` z `startPreview()`, `stopBroadcast`/`switchCamera`/`setMuted`. `net.bunny:recording` linkowane w `android/build.gradle`.
- **iOS** (`ios/BunnyStreamBroadcasterViewImpl.swift` + `.mm` + `.h`): hostuje `BunnyStreamCameraUploadView`, używa `BunnyBroadcastController` do komend, mapuje `BunnyBroadcastEvent` na JS. `BunnyStreamCameraUpload` product linkowane w `BunnyStreamReactNative.podspec:42-47`.
- **Eksport** (`src/index.ts:105-124`): `BunnyStreamBroadcaster` i wszystkie typy publicznie eksportowane.
- **Capability matrix** (`docs/capabilities.json`): `broadcaster.camera`, `broadcaster.events`, `broadcaster.reconnect-failover` = `supported`; `broadcaster.commands` = `partial` (Android start); `broadcaster.quality` = `partial` (Android unsupported).

### 3.2. Znalezione luki i ograniczenia (platformowe, akceptowane)

#### LUKA-1 (platformowa, akceptowana): Android `startBroadcast` to workaround

`BunnyStreamBroadcasterView.kt:194-198, 228-251` — brak publicznego `startBroadcast()` w Android SDK. Bridge symuluje kliknięcie wbudowanego przycisku (`findStartButton` + `performClick`) tylko gdy `hideDefaultControls=false`. Gdy kontrolki ukryte — no-op. Oznaczone `TODO(Android SDK)`. **Nie blokuje example app** — example używa `hideDefaultControls=false` na Androidzie i polega na natywnym przycisku start. Pozostawić z istniejącym komentarzem.

#### LUKA-2 (platformowa, akceptowana): Android `quality` ignorowane

`DefaultStreamHandler.kt:157-164` hard-coduje 1920×1080@30fps, ~9.3 Mbps video, 64 kbps audio. `quality` prop akceptowany ale ignorowany. Oznaczone w `types.ts:6-9` i `capabilities.json`. **Nie blokuje example app** — picker quality pokazywany tylko na iOS.

#### LUKA-3 (platformowa, akceptowana): Android `toggleMute` śledzi stan wewnętrznie

`BunnyStreamBroadcasterView.kt:212-216` — SDK nie wystawia `isAudioMuted()` ani `toggleMute()`. Bridge utrzymuje `lastKnownMuted` i odwraca. Oznaczone `TODO(Android SDK)`. Działa poprawnie dopóki eventy `onAudioMuted` aktualizują `lastKnownMuted`. **Nie blokuje example app**.

#### LUKA-4: brak hooka `useBunnyBroadcast`

`src/broadcaster/` nie ma `hooks/`. Plan docelowy (§6.1) przewiduje `useBunnyBroadcast`. Nie jest wymagany dla example app (example może subskrybować eventy bezpośrednio przez props), ale **rekomendowane** dodać prosty hook agregujący stan broadcastu (state, elapsed, muted, cameraPosition, ingest, ostatnie błędy) dla wygody i spójności z `useBunnyStreamPlayer`. Zakres: opcjonalny w tym planie.

#### LUKA-5: `autoStart` no-op na Androidzie gdy `hideDefaultControls=true`

`BunnyStreamBroadcasterView.kt:181-183` — `autoStart` działa tylko gdy `!pendingHideDefaultControls` (symulacja przycisku). Oznaczone `TODO(Android SDK)`. **Nie blokuje example app** — example nie używa `autoStart` z ukrytymi kontrolkami na Androidzie.

### 3.3. Werdykt kompletności

Moduł kamery jest **funkcjonalnie kompletny** dla example app. Wszystkie luki są platformowe, akceptowane i oznaczone `TODO(Android SDK)`. Example app może zostać zintegrowany bez zmian w wrapperze. Phase 4 (video management API) jest w pełni zaimplementowana w `BunnyStreamApi.ts` (wszystkie metody istnieją) — example app po prostu jej nie eksponuje w UI.

## 4. Uprawnienia kamery i mikrofonu w example app

Uprawnienia to odpowiedzialność aplikacji-hosta. Example app używa `react-native-test-app` (RNTA) — konfiguracja przez `example/app.json`.

### 4.1. iOS — klucze `Info.plist`

RNTA generuje `Info.plist` z `app.json`. Dodać sekcję `ios.info` (lub mechanizm RNTA dla dodatkowych kluczy plist):

```json
"ios": {
  "info": {
    "NSCameraUsageDescription": "This app uses the camera to record and broadcast video to Bunny Stream.",
    "NSMicrophoneUsageDescription": "This app uses the microphone to capture audio during recording and broadcasting."
  }
}
```

Jeśli RNTA nie wspiera `info` bezpośrednio, użyć `react-native.config.js` / `postlink` hooka albo ręcznie utrzymywany plik `example/ios/.../Info.plist` fragmentu (zweryfikować mechanizm RNTA przed implementacją). iOS 14+ `AVCaptureDevice` — brak dodatkowych uprawnień poza kluczami opisu.

### 4.2. Android — uprawnienia manifest + runtime

Dodać do `example/app.json` sekcję `android.permissions`:

```json
"android": {
  "permissions": ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"]
}
```

RNTA scala te wpisy do wygenerowanego `AndroidManifest.xml`. Runtime request (API 23+) przez helper — użyć `react-native-permissions` albo natywnego `PermissionsAndroid` z React Native:

```ts
// example/src/media/permissions.ts
import { Platform } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
// albo PermissionsAndroid z RN core (bez nowej zależności)

export async function requestBroadcastPermissions(): Promise<boolean>;
```

**Rekomendacja:** użyć `PermissionsAndroid` z React Native core (brak nowej zależności) na Androidzie; na iOS uprawnienia żąda natywne SDK przy pierwszym użyciu kamery/mikrofonu — `BunnyStreamCameraUploadView` pokazuje prompt ustawień gdy `arePermissionsGranted == false` (`BunnyStreamCameraUploadView.swift:175-208`). Example app może dodatkowo pre-requestować przez `react-native-permissions` dla lepszego UX, ale nie jest wymagane.

### 4.3. Helper uprawnień

`example/src/media/permissions.ts`:

```ts
// Android: PermissionsAndroid.requestMultiple([CAMERA, RECORD_AUDIO]).
// iOS: brak akcji — SDK pyta natywnie; zwraca true.
export async function requestBroadcastPermissions(): Promise<boolean>;
export async function checkBroadcastPermissions(): Promise<boolean>;
```

Wywoływany przed nawigacją do screenu kamery (Home → Camera) i przed montowaniem `BunnyStreamBroadcaster`.

## 5. Example app — zmiany (faza 5: kamera)

Nienaruszone: wszystkie istniejące screeny, nawigacja, storage, theme. **Nie usuwamy żadnej funkcjonalności.**

### 5.1. Nawigacja (`example/src/navigation/types.ts`)

Dodać do `RootStackParamList`:

```ts
Camera: { mode: 'new'; libraryId: number } | { mode: 'live'; libraryId: number; streamId: string };
VideoManagement: { videoId: string; libraryId: number };
```

`Camera` to jeden screen z dwoma trybami określonymi parametrem `mode`. `VideoManagement` to screen faz-4 (sekcja 6).

### 5.2. Home screen (`example/src/screens/HomeScreen.tsx`)

Zastąpić placeholder "Camera upload" (badge "Coming soon", disabled) aktywnym `HomeOption` nawigującym do `Camera` w trybie `new`:

```tsx
<HomeOption
  title="Camera upload"
  subtitle={hasConfig ? 'Record and broadcast live' : 'Not configured'}
  disabled={!hasConfig}
  onPress={() => navigation.navigate('Camera', { mode: 'new', libraryId: Number(stored.libraryId) })}
/>
```

Opcjonalnie dodać drugą opcję "Go Live" w sekcji Playback (lub zostawić entry point w `LiveStreamsScreen`). **Rekomendacja:** zostawić "Go Live" w `LiveStreamsScreen` (per-stream), a "Camera upload" w sekcji Upload = standalone VOD recording (mirror iOS `ContentView`).

### 5.3. Nowy screen `CameraScreen.tsx`

Struktura wzorowana na iOS `BroadcastDemoView` + Android `GoLiveActivity`/`RecordingActivity`:

- **Header** z back + tytuł ("Camera" dla VOD, "Go Live" dla live).
- **Permission gate**: przed montowaniem `BunnyStreamBroadcaster` wywołać `requestBroadcastPermissions()`; gdy odmowa — pokazać panel z przyciskiem "Open settings" (mirror iOS `BunnyStreamCameraUploadView` permission prompt).
- **Quality picker** (tylko iOS, `Platform.OS === 'ios'`): dropdown z presettami:
  - `sd480` — 480p, 30fps, 1.2 Mbps
  - `hd720` — 720p, 30fps, 2.5 Mbps
  - `fullHd1080` — 1080p, 30fps, 4.5 Mbps (default)
  - `fullHd1080p60` — 1080p, 60fps, 6 Mbps
  Mapować na `BroadcastQuality` `{ resolution, frameRate, videoBitrate, audioBitrate: 128000 }`. Na Androidzie ukryć picker + pokazać notkę "Quality fixed by SDK (1080p30)".
- **Camera preview** — `BunnyStreamBroadcaster` wypełniający kontener (flex: 1):
  - `source`: `{ type: 'new', libraryId }` lub `{ type: 'live', libraryId, streamId }` zależnie od `mode`.
  - `accessKey` z `loadSettings()`.
  - `quality` (iOS).
  - `cameraPosition="back"`.
  - `hideDefaultControls={false}` na Androidzie (wymagane do startu przez natywny przycisk); na iOS `hideDefaultControls` opcjonalne.
  - `dualPublish` — przełącznik w UI (mirror Android `GoLiveActivity:60`).
  - Event handlery: `onStateChange`, `onElapsedTime`, `onCameraChange`, `onMuteChange`, `onIngestStateChange`, `onReconnecting`, `onReconnectFailed`, `onFailover`, `onError` — wszystkie feedują stan + event log.
- **Overlay controls** (gdy `hideDefaultControls=false` na Androidzie, natywne kontrolki SDK są widoczne; dodatkowe JS kontrolki opcjonalne):
  - Przycisk "Start"/"Stop" → `ref.startBroadcast()` / `ref.stopBroadcast()`. Na Androidzie "Start" działa przez symulację przycisku (działa tylko gdy kontrolki widoczne).
  - "Switch camera" → `ref.switchCamera()`.
  - "Mute"/"Unmute" → `ref.toggleMute()`.
- **Status bar** (mirror `recording_view.xml` + `BroadcastDemoView`):
  - Stan: `idle` / `preparing` / `live` (kolor: szary/żółty/czerwony "LIVE").
  - Elapsed time: `formatted` (HH:MM:SS) z `onElapsedTime`.
  - Ingest badges: primary/backup z kolorem z `onIngestStateChange` (connecting=żółty, live=zielony, offline=szary).
  - Mute indicator.
- **Event log** (mirror `BroadcastDemoView.swift:36-39`): lista ostatnich ~20 zdarzeń z opisem, najnowsze na górze. Format: `[HH:MM:SS] state=live`, `[HH:MM:SS] reconnecting attempt=1 usingBackup=true`, itp.
- **Cleanup**: `useEffect` cleanup → `ref.stopBroadcast()` przy unmount (mirror `BunnyStreamBroadcasterView.cleanup()`).

### 5.4. `LiveStreamsScreen.tsx` — akcja "Go Live"

Dodać do każdego wiersza streama akcję "Go Live" (mirror iOS swipe action `LiveStreamListView.swift:170-177` i Android `LiveStreamsScreen` → `GoLiveActivity`):

- Przycisk/akcja "Go Live" na wierszu streama → `navigation.navigate('Camera', { mode: 'live', libraryId, streamId: stream.id })`.
- Warunek: stream w stanie pozwalającym na broadcast (nie `ended`, nie `VOD_PROCESSING` — mirror `DefaultRecordingRepository.kt:119-125`). Ukryć/disable akcję gdy stream zakończony.
- Opcjonalnie: po powrocie z kamery odświeżyć listę streamów (stream mógł zmienić stan po `startLiveStream`/`stopLiveStream` wywołanych natywnie).

### 5.5. Rejestracja screenów w `App.tsx`

Dodać do `Stack.Navigator`:

```tsx
<Stack.Screen name="Camera" component={CameraScreen} />
<Stack.Screen name="VideoManagement" component={VideoManagementScreen} />
```

### 5.6. Zależności example app

- Brak nowych zewnętrznych zależności wymaganych (uprawnienia Android przez `PermissionsAndroid` z RN core; iOS przez klucze plist + natywne SDK).
- Opcjonalnie: `react-native-permissions` dla ujednolicenia pre-requestu na obu platformach — **rekomendacja: nie dodawać**, użyć `PermissionsAndroid` na Androidzie i natywnego promptu SDK na iOS, aby uniknąć puchnięcia zależności.

## 6. Example app — zmiany (faza 4: video management)

Natywne example appy **nie demonstrują** operacji faz-4 (VOD `setThumbnail`, `uploadThumbnail`, `fetchNewVideo`, `refetchVideo`, `addCaption`, `deleteCaption`, `reencodeVideo`, `reencodeUsingCodec`, `repackageVideo`, `deleteResolutions`, `smartGenerate`, `transcribeVideo`) — potwierdzone grepami w obu repozytoriach. Ten screen jest **wrapper-original**, bez natywnego wzorca UX. Służy jako demo/debug powierzchni API już zaimplementowanej w `BunnyStreamApi.ts`.

### 6.1. Nowy screen `VideoManagementScreen.tsx`

Otwierany z `VideoListScreen` (long-press na wierszu → menu → "Manage"). Parametry: `{ videoId, libraryId }`.

Sekcje (każda z przyciskiem akcji + wynik/ładowanie/błąd):

- **Thumbnail**:
  - "Set thumbnail URL" → `TextInput` + `BunnyStreamApi.setThumbnail(libraryId, videoId, url)`.
  - "Upload thumbnail" → `pickImage()` → `BunnyStreamApi.uploadThumbnail(libraryId, videoId, uri)`. **Android-only** — iOS zwraca `InvalidState` (capabilities.json: `api.thumbnails-captions`). Pokazać notkę platformową.
- **Import**:
  - "Fetch new video" → `TextInput` (URL) + `BunnyStreamApi.fetchNewVideo(libraryId, { url })`.
  - "Refetch video" → `BunnyStreamApi.refetchVideo(libraryId, videoId, { url })`. **Android-native**; iOS fallback do `getVideo` (capabilities.json).
- **Captions**:
  - "Add caption" → `TextInput` (languageCode, label, srclang, file URL) + `BunnyStreamApi.addCaption(...)`.
  - "Delete caption" → `TextInput` (languageCode) + `BunnyStreamApi.deleteCaption(libraryId, videoId, languageCode)`.
- **Encoding**:
  - "Reencode" → `BunnyStreamApi.reencodeVideo(libraryId, videoId)`.
  - "Reencode with codec" → picker (`h264`/`vp9`/`hevc`/`av1`) + `BunnyStreamApi.reencodeUsingCodec(libraryId, videoId, codec)`.
  - "Repackage" → `BunnyStreamApi.repackageVideo(libraryId, videoId, keepOriginalFiles)`.
  - "Delete resolutions" → multi-select z `fetchVideoResolutions` + `BunnyStreamApi.deleteResolutions(libraryId, videoId, resolutions, { dryRun: true })`. **Wymagany `dryRun: true` w pierwszym wywołaniu** (Plan-complete §Faza 4) — pokazać wynik dryRun, potwierdzić, drugie wywołanie bez `dryRun`.
- **AI**:
  - "Transcribe" → `BunnyStreamApi.transcribeVideo(libraryId, videoId, { ... })`.
  - "Smart generate" → `BunnyStreamApi.smartGenerate(libraryId, videoId, { ... })`. **Android-only** — iOS nie wystawia (capabilities.json: `api.ai-operations`).

Każda akcja pokazuje `BunnyResult` (`getOrNull`/`errorOrNull`), stan ładowania, komunikat błędu. Destructive actions (`deleteResolutions`, `deleteCaption`) z potwierdzeniem.

### 6.2. `VideoListScreen.tsx` — entry point

Dodać long-press / menu na wierszu wideo → "Manage" → `navigation.navigate('VideoManagement', { videoId, libraryId })`. Nie usuwać istniejących akcji (play, delete).

## 7. Kolejność implementacji

1. **Uprawnienia**: `example/app.json` (klucze iOS plist + Android permissions) + helper `example/src/media/permissions.ts`. Weryfikacja buildu.
2. **Example: `CameraScreen`** + nawigacja (`Camera`) + Home (aktywacja "Camera upload") + `App.tsx` rejestracja.
3. **Example: `LiveStreamsScreen`** — akcja "Go Live" na wierszu streama → `Camera` w trybie `live`.
4. **Example: `VideoManagementScreen`** + nawigacja (`VideoManagement`) + `VideoListScreen` entry point.
5. **Opcjonalnie: `useBunnyBroadcast` hook** (`src/broadcaster/hooks/`) — agregacja stanu broadcastu.
6. **Weryfikacja końcowa**: typecheck, lint, build obu platform, testy.

## 8. Weryfikacja

- `yarn typecheck` (root + example).
- `yarn lint` (root).
- `yarn test` (testy wrappera).
- Build Android example: `cd example && yarn android`.
- Build iOS example: `cd example && yarn ios`.
- Ręczny smoke test na urządzeniu/symulatorze:
  - Home → Camera upload → permission prompt → preview → start (Android natywny przycisk / iOS JS przycisk) → LIVE → elapsed → stop → weryfikacja nowego VOD w VideoList.
  - LiveStreams → stream → "Go Live" → Camera (tryb live) → start → ingest badges → stop → weryfikacja stanu streama.
  - Switch camera, mute/unmute.
  - Quality picker (iOS) — zmiana presetu.
  - Event log — weryfikacja zdarzeń (state, reconnect, failover, ingest, error).
  - VideoList → long-press → Manage → setThumbnail URL → reencode → deleteResolutions (dryRun → confirm) → weryfikacja.

## 9. Poza zakresem (następne etapy)

- `useBunnyBroadcast` hook (opcjonalny w tym planie, można dodać).
- Android `startBroadcast` bez natywnego przycisku (LUKA-1) — zależne od publicznego API Android SDK.
- Android `quality` konfigurowalne (LUKA-2) — zależne od Android SDK.
- Background broadcast / interruption resume (`broadcaster.background` = `backlog` w capabilities.json).
- Android TV (phase-7).
- Cached Bunny image loading (phase-7).
- `regenerateStreamKey` w wspólnym kontrakcie (platformowa luka — iOS-only).
- VOD `uploadThumbnail` na iOS (zależne od OpenAPI client iOS — obecnie `InvalidState`).
- `smartGenerate` na iOS (zależne od OpenAPI client iOS).
