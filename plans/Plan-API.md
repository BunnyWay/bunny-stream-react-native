# Plan: moduł API dla `bunny-stream-react-native` + przeniesienie logiki example z `bunny-stream-android-private`

## 1. Cel i zakres

Celem jest dodanie modułu REST API do `bunny-stream-react-native` jako osobnego TurboModule `NativeBunnyStreamApi`, opakowującego repozytoria z `bunny-stream-api` (`net.bunny:api`) za jednym idiomatycznym, typowanym API TypeScript, oraz przeniesienie logiki listowania/odtwarzania z example app Android SDK private do example app RN — tak, aby listy video i live streams były pobierane z API zamiast wpisywane ręcznie.

**W zakresie:**

- Nowy TurboModule `NativeBunnyStreamApi` (Codegen spec + implementacja natywna Android) wystawiający metody `VideoRepository` i `LiveStreamRepository` jako funkcje Promise-based.
- Pełny kontrakt TypeScript: typy domenowe (`Video`, `LiveStream`, `VideoList`, `LiveStreamList`), envelope `BunnyResult` + typowana taxonomia `BunnyError`.
- Warstwa publiczna TS: `BunnyStreamApi` z metodami `listVideos`, `getVideo`, `fetchVideoPlayData`, `deleteVideo`, `createVideo`, `updateVideo`, `listLiveStreams`, `getLiveStream`, `fetchLiveStreamPlayData`, `createLiveStream`, `updateLiveStream`, `deleteLiveStream`.
- Przebudowa example app: `VideoListScreen` pobiera listę z API (jak `LibraryScreen`), nowy `LiveStreamsScreen` pobiera listę live (jak `LiveStreamsScreen` z demo Android), usunięcie ręcznego wpisywania ID (`DirectVideoPlayModal`, `DirectLivePlayModal`, `AddVideoIdModal`, logika AsyncStorage video IDs).
- Przebudowa `PlayerScreen` z inline toggle built-in ↔ custom controls (zamiast osobnego ekranu `PlayerCustom`).

**Poza zakresem:**

- Implementacja iOS (TS kontrakt platformowo-agnostyczny, ale bez natywnego stuba iOS — obsłużone osobno po mostku iOS z `Plan-iOS.md`).
- Upload (TUS/basic), kamera, collection repository, settings repository, statystyki, heatmapy, captions, reencode, AI features — w późniejszych fazach.
- Edytor live stream (create/update UI) — tylko metody API; ekrany edycji w późniejszej fazie.

## 2. Zweryfikowane źródła (Android SDK private)

### Punkt wejścia: `BunnyStreamApi` (`bunny-stream-api/.../BunnyStreamApi.kt`)

- `BunnyStreamApi.initialize(context, accessKey, libraryId)` — już wywoływane przez istniejący `NativeBunnyStreamPlayer.initialize`.
- `BunnyStreamApi.getInstance()` → `StreamApi` z repozytoriami: `videoRepository`, `liveStreamRepository`, `collectionRepository`, `settingsRepository`, `videoUploader`, `tusVideoUploader`.
- `BunnyStreamApi.isInitialized()` — guard przed wywołaniami.

### Repozytoria do opakowania

- **`VideoRepository`** (`video/domain/VideoRepository.kt`): `listVideos(libraryId, page, itemsPerPage, search, orderBy, collectionId)`, `getVideo`, `fetchVideoPlayData(libraryId, videoId, token, expires)`, `deleteVideo`, `createVideo`, `updateVideo`, `setThumbnail`, `fetchVideoStatistics`, `fetchVideoHeatmap`, `fetchVideoResolutions`, `fetchVideoStorageSize`, captions, reencode, AI.
- **`LiveStreamRepository`** (`livestream/domain/LiveStreamRepository.kt`): `listLiveStreams(libraryId, page, itemsPerPage, search, orderBy, collectionId)`, `getLiveStream`, `pollLiveStream`, `fetchLiveStreamPlayData(libraryId, streamId, token, expires)`, `createLiveStream`, `updateLiveStream`, `deleteLiveStream`, `startLiveStream`, `stopLiveStream`, thumbnails, `getLiveStreamStatus`.

### Envelope wyników: `BunnyResult<T>` (`error/BunnyResult.kt`)

- `BunnyResult.Ok(value)` / `BunnyResult.Err(error: BunnyError)`.
- `BunnyError` (`error/BunnyError.kt`): sealed class — `Network`, `Http(httpStatus, message)`, `Auth(401/403)`, `NotFound(404)`, `Decode`, `LocalFile`, `InvalidState`. Każdy ma `message`, `httpStatus`, `isTerminal` (`401/403/404/410` = terminal).
- Helpery: `fold(onOk, onErr)`, `getOrNull()`, `errorOrNull()`.

### Modele domenowe

- **`Video`** (`video/domain/model/Video.kt`): `id`, `videoLibraryId`, `title`, `description?`, `status: VideoModelStatus`, `lengthSeconds`, `width?`, `height?`, `availableResolutions: List<String>`, `storageSizeBytes`, `encodeProgress`, `thumbnailFileName?`, `thumbnailBlurhash?`, `views`, `captions`, `chapters`, `moments`, … (33 pola, większość z defaultami).
- **`VideoList`**: `totalItems`, `currentPage`, `itemsPerPage`, `items: List<Video>`.
- **`LiveStream`** (`livestream/domain/model/LiveStream.kt`): `id`, `videoLibraryId`, `title`, `description?`, `status: LiveStreamStatus`, `isPublic`, `scheduledStartTime?`, `streamKey?`, `playbackUrlHls?`, `dvrEnabled`, `recordVod`, `availableResolutions?`, `width?`, `height?`, `framerate?`, `preStreamTrailerVideoId?`, `primaryIngestUrl?`, `backupIngestUrl?`, …
- **`LiveStreamList`**: `totalItems`, `currentPage`, `itemsPerPage`, `items: List<LiveStream>`.
- **`LiveStreamStatus`** (`model/LiveStreamStatus.kt`): enum `UNKNOWN(0)`, `CREATED(1)`, `SCHEDULED(2)`, `PREVIEW(3)`, `RUNNING(4)`, `ENDED(5)`, `VOD_PROCESSING(6)`, `ERROR(7)`.
- **`VideoModelStatus`**: `CREATED(0)`, `UPLOADED(1)`, `PROCESSING(2)`, `TRANSCODING(3)`, `FINISHED(4)`, `UPLOAD_FAILED(6)`.
- **`LiveStreamCreateRequest`** (`livestream/domain/model/LiveStreamCreateRequest.kt`) — do create/update.
- **`CreateVideoRequest`/`UpdateVideoRequest`** (`video/domain/model/VideoRequests.kt`) — do create/update video.

### Logika example do przeniesienia (demo Android)

- **`LibraryScreen` + `LibraryViewModel`**: `loadLibrary()` → `videoRepository.listVideos(libraryId)`, mapowanie `SdkVideo.toVideo()` (status 0-6 → enum, `lengthSeconds` → duration, `views` → viewCount), `SwipeRefresh`, `VideoItem` (karta 16:9 z thumbnail, pill status + views, menu delete), poll status co 5 s gdy video w stanie transitional, enrich thumbnails przez `fetchPlayerSettings`.
- **`LiveStreamsScreen` + `LiveStreamsViewModel`**: `load()` → `liveStreamRepository.listLiveStreams(libraryId)`, `LiveStreamItem` (karta z tytułem, pill status/public/dvr/vod, scheduled time, przycisk watch + menu edit/delete/go-live), `SwipeRefresh`, `createStream`/`updateStream`/`deleteStream`.
- **`PlayerScreen` + `PlayerViewModel`**: `fetchVideoPlayData` dla metadanych, poll status co 5 s, `NativeControlsSection` z `Switch` przełączającym `controlsEnabled`.

## 3. Aktualny stan biblioteki RN

### Istniejący TurboModule

`src/specs/NativeBunnyStreamPlayer.ts` → tylko `initialize(accessKey, libraryId)`. Implementacja Android w `android/.../module/BunnyStreamPlayerModule.kt` deleguje do `BunnyStreamApi.initialize`. **Nie ruszamy** — `initialize` zostaje, nowy moduł API korzysta z tej samej zarejestrowanej instancji przez `BunnyStreamApi.getInstance()`.

### Struktura bridge Android

`android/src/main/java/net/bunny/reactnative/` — `module/`, `view/`, `adapter/`, `state/`, `commands/`, `events/`, `BunnyStreamPlayerPackage.kt` (rejestruje moduł + view managery). Nowy moduł API dodamy obok, w tym samym package, zarejestrowany w `BunnyStreamPlayerPackage`.

### Example app (do przebudowy)

- `HomeScreen`: opcje "Video player" → `VideoList` (AsyncStorage IDs), "Direct video play" → `DirectVideoPlayModal`, "Direct video play (custom)" → `CustomControlsPlayerScreen`, "Direct live stream play" → `DirectLivePlayModal`.
- `VideoListScreen`: ręcznie dodawane ID z AsyncStorage (`loadVideoIds`/`addVideoId`/`removeVideoId`), `AddVideoIdModal`.
- `PlayerScreen`: przyjmuje `videoId` z `VideoList`/`DirectVideoPlayModal`, natywne kontrolki + speed picker.
- `CustomControlsPlayerScreen`: osobny ekran z custom JS controls.
- `LivePlayerScreen`: przyjmuje `streamId` z `DirectLivePlayModal`.
- `storage.ts`: `loadVideoIds`/`saveVideoIds`/`addVideoId`/`removeVideoId` — do usunięcia; `loadSettings`/`saveSettings` zostaje.

## 4. Architektura: nowy TurboModule `NativeBunnyStreamApi`

### Decyzja: osobny TurboModule

Odzwierciedla podział natywnego SDK (`:api` vs `:player`). `initialize` zostaje w `NativeBunnyStreamPlayer` (bo to konfiguracja globalna SDK). Moduł API korzysta z `BunnyStreamApi.getInstance()` — tej samej instancji, którą `initialize` zarejestrował.

### Kontrakt Codegen (`src/specs/NativeBunnyStreamApi.ts`)

TurboModule `'BunnyStreamApi'` z metodami Promise-based. Każda metoda zwraca `Promise<T>` gdzie `T` to plain object (Codegen nie wspiera sealed classes — mapujemy `BunnyResult` na JS-owy envelope `{ ok: true, value } | { ok: false, error }`).

```typescript
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // — VideoRepository (odczyt + zarządzanie) —
  listVideos(
    libraryId: Double,
    page?: Double,
    itemsPerPage?: Double,
    search?: string,
    orderBy?: string,
    collectionId?: string,
  ): Promise<VideoListResult>;
  getVideo(libraryId: Double, videoId: string): Promise<VideoResult>;
  fetchVideoPlayData(
    libraryId: Double,
    videoId: string,
    token?: string,
    expires?: Double,
  ): Promise<VideoPlayDataResult>;
  deleteVideo(libraryId: Double, videoId: string): Promise<UnitResult>;
  createVideo(libraryId: Double, request: CreateVideoRequestInput): Promise<VideoResult>;
  updateVideo(libraryId: Double, videoId: string, request: UpdateVideoRequestInput): Promise<UnitResult>;

  // — LiveStreamRepository (odczyt + zarządzanie) —
  listLiveStreams(
    libraryId: Double,
    page?: Double,
    itemsPerPage?: Double,
    search?: string,
    orderBy?: string,
    collectionId?: string,
  ): Promise<LiveStreamListResult>;
  getLiveStream(libraryId: Double, streamId: string): Promise<LiveStreamResult>;
  fetchLiveStreamPlayData(
    libraryId: Double,
    streamId: string,
    token?: string,
    expires?: Double,
  ): Promise<LiveStreamPlayDataResult>;
  createLiveStream(libraryId: Double, request: LiveStreamCreateRequestInput): Promise<LiveStreamResult>;
  updateLiveStream(libraryId: Double, streamId: string, request: LiveStreamCreateRequestInput): Promise<UnitResult>;
  deleteLiveStream(libraryId: Double, streamId: string): Promise<UnitResult>;

  // — status SDK —
  isInitialized(): boolean;
}
```

**Wzorzec envelope w JS:** każda metoda natywna zwraca plain object:

```typescript
// sukces
{ ok: true, value: {...} }
// porażka
{ ok: false, error: { kind: 'Auth'|'NotFound'|'Network'|'Http'|'Decode'|'InvalidState', httpStatus: number, message: string, isTerminal: boolean } }
```

Native konwertuje `BunnyResult` → ten kształt. `UnitResult` = `{ ok: true, value: null } | { ok: false, error }`.

**Dlaczego Promise + envelope zamiast rzucania:** taxonomia `BunnyError` (terminal vs transient, `Auth` vs `NotFound`) to pierwszorzędna informacja dla UI (decyzja retry vs give-up). Rzucanie w JS gubiłoby typ błędu za `catch (e)`. Envelope odzwierciedla natywny `BunnyResult` i pozwala `fold`-style pattern matching w TS.

### Mapowanie typów domenowych (Codegen `Object`/`ObjectLiteral`)

Definiujemy typy wyników jako `Object` w spec (Codegen generuje `ReadableMap` po stronie natywnej). Pełne definicje TS typów w osobnym pliku `src/api/types.ts` (patrz sekcja 5).

## 5. Warstwa TypeScript (public API)

### `src/api/types.ts` — typy domenowe

Odzwierciedlają modele Android SDK, okrojone o pola niepotrzebne w RN (Parcelize, Android-specific). Nullability zgodna z API.

```typescript
export type VideoStatus = 0 | 1 | 2 | 3 | 4 | 6; // CREATED..FINISHED, UPLOAD_FAILED
export type LiveStreamStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Video {
  id: string;
  videoLibraryId: number;
  title: string;
  description: string | null;
  collectionId: string | null;
  status: VideoStatus;
  lengthSeconds: number;
  width: number | null;
  height: number | null;
  availableResolutions: string[];
  storageSizeBytes: number;
  encodeProgress: number;
  thumbnailFileName: string | null;
  thumbnailBlurhash: string | null;
  views: number;
  // ... (okrojone captions/chapters/moments — opcjonalnie w fazie 2)
}

export interface VideoList {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: Video[];
}

export interface LiveStream {
  id: string;
  videoLibraryId: number;
  title: string;
  description: string | null;
  status: LiveStreamStatus;
  isPublic: boolean;
  scheduledStartTime: string | null;
  streamKey: string | null;
  playbackUrlHls: string | null;
  dvrEnabled: boolean;
  recordVod: boolean;
  availableResolutions: string | null;
  preStreamTrailerVideoId: string | null;
  // ...
}

export interface LiveStreamList {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: LiveStream[];
}

export interface VideoPlayData { /* url, playerConfig, ... — okrojone */ }
export interface LiveStreamPlayData { /* hlsUrl, playerConfig, ... */ }

export interface CreateVideoRequestInput { title: string; collectionId?: string; ... }
export interface UpdateVideoRequestInput { title?: string; ... }
export interface LiveStreamCreateRequestInput {
  title: string;
  description?: string;
  isPublic?: boolean;
  dvrEnabled?: boolean;
  recordVod?: boolean;
  scheduledStartTime?: string;
  ...
}

// — Envelope błędów —
export type BunnyErrorKind = 'Network' | 'Http' | 'Auth' | 'NotFound' | 'Decode' | 'LocalFile' | 'InvalidState';
export interface BunnyError {
  kind: BunnyErrorKind;
  httpStatus: number;
  message: string;
  isTerminal: boolean;
}
export type BunnyResult<T> = { ok: true; value: T } | { ok: false; error: BunnyError };
```

### `src/api/BunnyStreamApi.ts` — public API wrapper

Idiomatyczna warstwa TS nad TurboModule: konwersja `Double`↔`number`, walidacja argumentów, pomocnicze `fold`/`getOrNull`/`map`, helpery status enum.

```typescript
import NativeBunnyStreamApi from '../specs/NativeBunnyStreamApi';

export const BunnyStreamApi = {
  isInitialized(): boolean { return NativeBunnyStreamApi.isInitialized(); },

  async listVideos(libraryId: number, opts?: {
    page?: number; itemsPerPage?: number; search?: string; orderBy?: string; collectionId?: string;
  }): Promise<BunnyResult<VideoList>> {
    return NativeBunnyStreamApi.listVideos(
      libraryId, opts?.page ?? 1, opts?.itemsPerPage ?? 100,
      opts?.search ?? null, opts?.orderBy ?? 'date', opts?.collectionId ?? null,
    );
  },

  async getVideo(libraryId: number, videoId: string): Promise<BunnyResult<Video>> { ... },
  async fetchVideoPlayData(libraryId: number, videoId: string, token?: string, expires?: number): Promise<BunnyResult<VideoPlayData>> { ... },
  async deleteVideo(libraryId: number, videoId: string): Promise<BunnyResult<void>> { ... },
  async createVideo(libraryId: number, request: CreateVideoRequestInput): Promise<BunnyResult<Video>> { ... },
  async updateVideo(libraryId: number, videoId: string, request: UpdateVideoRequestInput): Promise<BunnyResult<void>> { ... },

  async listLiveStreams(libraryId: number, opts?: {...}): Promise<BunnyResult<LiveStreamList>> { ... },
  async getLiveStream(libraryId: number, streamId: string): Promise<BunnyResult<LiveStream>> { ... },
  async fetchLiveStreamPlayData(...): Promise<BunnyResult<LiveStreamPlayData>> { ... },
  async createLiveStream(libraryId: number, request: LiveStreamCreateRequestInput): Promise<BunnyResult<LiveStream>> { ... },
  async updateLiveStream(...): Promise<BunnyResult<void>> { ... },
  async deleteLiveStream(...): Promise<BunnyResult<void>> { ... },
};

// Helpery envelope (odzwierciedlają Kotlin ext z BunnyResult.kt)
export function fold<T, R>(result: BunnyResult<T>, onOk: (v: T) => R, onErr: (e: BunnyError) => R): R;
export function getOrNull<T>(result: BunnyResult<T>): T | null;
export function errorOrNull<T>(result: BunnyResult<T>): BunnyError | null;

// Enumy status z helperami (jak LiveStreamStatus.fromValue, VideoStatus)
export const VideoStatusEnum = { CREATED: 0, UPLOADED: 1, PROCESSING: 2, TRANSCODING: 3, FINISHED: 4, UPLOAD_FAILED: 6 } as const;
export const LiveStreamStatusEnum = { UNKNOWN: 0, CREATED: 1, SCHEDULED: 2, PREVIEW: 3, RUNNING: 4, ENDED: 5, VOD_PROCESSING: 6, ERROR: 7 } as const;
export const TRANSITIONAL_VIDEO_STATUSES = new Set([0, 1, 2, 3]); // jak VideoStatus.TRANSITIONAL
```

### Eksport z `src/index.tsx`

Dodać re-eksport: `export { BunnyStreamApi, fold, getOrNull, errorOrNull } from './api/BunnyStreamApi';` oraz wszystkie typy z `./api/types`.

## 6. Implementacja natywna Android

### `android/.../module/BunnyStreamApiModule.kt`

Nowy TurboModule rozszerzający wygenerowany `NativeBunnyStreamApiSpec`. Każda metoda:

1. Guard `BunnyStreamApi.isInitialized()` → reject z `InvalidState` jeśli nie.
2. Wywołanie suspend repozytorium w coroutine (`CoroutineScope(Dispatchers.IO)`), `Promise` jako callback.
3. Mapowanie `BunnyResult` → `WritableNativeMap` envelope (`ok`/`value` lub `ok`/`error`).
4. Mapowanie modeli domenowych (`Video`, `LiveStream`, …) → `WritableNativeMap`/`WritableNativeArray`.

```kotlin
@ReactModule(name = BunnyStreamApiModule.NAME)
class BunnyStreamApiModule(reactContext: ReactApplicationContext) :
    NativeBunnyStreamApiSpec(reactContext) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun listVideos(
        libraryId: Double, page: Double, itemsPerPage: Double,
        search: String?, orderBy: String?, collectionId: String?,
        promise: Promise,
    ) {
        scope.launch {
            if (!BunnyStreamApi.isInitialized()) {
                promise.resolve(errorEnvelope(InvalidState("BunnyStreamApi not initialized")))
                return@launch
            }
            val result = BunnyStreamApi.getInstance().videoRepository.listVideos(
                libraryId.toLong(), page.toInt(), itemsPerPage.toInt(),
                search, orderBy ?: "date", collectionId,
            )
            promise.resolve(result.toWritableMap())
        }
    }
    // ... analogicznie dla pozostałych metod
}
```

### `android/.../module/BunnyApiMappers.kt`

Osobny plik z mapowaniami (czystymi funkcjami, testowalnymi):

- `Video.toWritableMap()` — pełny model → map (pomijamy pola Android-specific jak Parcelize).
- `LiveStream.toWritableMap()`.
- `VideoList.toWritableMap()` / `LiveStreamList.toWritableMap()`.
- `BunnyResult<T>.toWritableMap(valueMapper: (T) -> WritableMap)`.
- `BunnyError.toWritableMap()` → `{ kind, httpStatus, message, isTerminal }` (kind z `when (this) { is Network -> "Network"; is Auth -> "Auth"; ... }`).

### Rejestracja w `BunnyStreamPlayerPackage.kt`

Dodać `BunnyStreamApiModule` do `createNativeModules()`.

### `package.json` > `codegenConfig.android.modules`

Dodać `'BunnyStreamApi'` do listy modułów Codegen.

## 7. Zmiany w example app (przeniesienie logiki z demo Android)

### Nowy ekran: `VideoListScreen` (przebudowa — jak `LibraryScreen`)

- **Zastąpuje** obecny ekran z AsyncStorage. Pobiera `BunnyStreamApi.listVideos(libraryId)`.
- Stany: `loading` / `empty` / `loaded` / `error` (jak `VideoListUiState`).
- `FlatList` kart video: thumbnail (jeśli dostępny), tytuł, pill status + views, duration.
- Pull-to-refresh (`RefreshControl`) — jak `SwipeRefresh` w demo.
- Tap na kartę → `navigation.navigate('Player', { videoId, libraryId })`.
- Poll status co 5 s gdy video transitional (jak `LibraryViewModel.onStatusPollTick`) — `useEffect` z `setInterval`, re-fetch gdy `videos.some(v => TRANSITIONAL.has(v.status))`.
- Enrich thumbnails: w fazie 1 używamy `thumbnailFileName` z `listVideos` (jeśli SDK wystawia URL) lub pomijamy — pełny enrich przez `fetchPlayerSettings` to faza 2 (wymaga settings repository).
- Brak "Add Video ID" — lista z API jest źródłem prawdy.

### Nowy ekran: `LiveStreamsScreen` (jak `LiveStreamsScreen` z demo)

- **Nowy ekran** pobierający `BunnyStreamApi.listLiveStreams(libraryId)`.
- Stany: `empty` / `loading` / `loaded` / `error` (jak `LiveStreamListUiState`).
- `FlatList` kart live stream: tytuł, pill status (`LiveStreamStatusEnum`) + public/dvr/vod, scheduled time, przycisk watch.
- Tap na kartę / przycisk watch → `navigation.navigate('LivePlayer', { streamId, libraryId })`.
- Pull-to-refresh.
- W fazie 1: tylko watch (odtwarzanie). Edit/delete/create → faza 2 (wymaga ekranu edytora).

### `PlayerScreen` — przebudowa z inline toggle built-in ↔ custom controls

Zamiast osobnego ekranu `PlayerCustom`, `PlayerScreen` dostaje przełącznik built-in ↔ custom controls inline:

- Przycisk toggle (np. w sekcji pod playerem) przełączający `controls` prop na `BunnyStreamPlayer`.
- Gdy `controls={true}` (domyślnie) — natywne kontrolki SDK.
- Gdy `controls={false}` — ukryte natywne, wyświetlane **custom controls JS** w tym samym ekranie: play/pause, seek bar (na bazie `onProgress`), speed picker, pozycja/czas.
- Custom controls korzystają z istniejącego `useBunnyStreamPlayer` hook (już zwraca `state`, `progress`, `controls` ref API — `play`/`pause`/`seekTo`/`setPlaybackRate`/`mute`/`unmute`).
- Wzorzec: jeden ekran, jeden `BunnyStreamPlayer`, warunkowo renderowane JS controls w zależności od stanu toggle.

To odzwierciedla podejście z demo Android (`PlayerScreen.kt` ma `NativeControlsSection` z `Switch` przełączającym `controlsEnabled`), ale w RN dodatkowo renderujemy własne JS controls gdy natywne są wyłączone (demo Android nie ma custom controls — SDK Android wystawia `controlsEnabled` ale nie ma JS warstwy).

### `HomeScreen` — przebudowa

- "Video player" → `VideoList` (teraz z API).
- **Nowa opcja** "Live streams" → `LiveStreamsScreen`.
- **Usunąć**: "Direct video play", "Direct video play (custom)", "Direct live stream play" + odpowiadające modale.
- Brak osobnej ścieżki custom controls — toggle jest w `PlayerScreen`.

### `navigation/types.ts` — zmiany

```typescript
export type RootStackParamList = {
  Home: undefined;
  VideoList: undefined;
  LiveStreams: undefined;          // NOWY
  Settings: undefined;
  Player: { videoId: string; libraryId: number };
  LivePlayer: { streamId: string; libraryId: number; token?: string; expires?: number };
};
```

**Usuwam** `PlayerCustom` — nie ma osobnego ekranu custom controls.

### `App.tsx` — dodać `LiveStreams` screen do Stack, usunąć `PlayerCustom`

### Pliki do usunięcia

- `example/src/screens/DirectVideoPlayModal.tsx`
- `example/src/screens/DirectLivePlayModal.tsx`
- `example/src/screens/CustomControlsPlayerScreen.tsx`
- `example/src/components/AddVideoIdModal.tsx`
- Z `storage.ts`: `loadVideoIds`/`saveVideoIds`/`addVideoId`/`removeVideoId`/`parseVideoIdsFromEnv` + `VIDEO_IDS_KEY`. Zostają `loadSettings`/`saveSettings`/`clearSettings` + `Settings` type.

### `LivePlayerScreen` — bez zmian strukturalnych

Już przyjmuje `streamId` z nawigacji — teraz źródłem jest `LiveStreamsScreen` zamiast `DirectLivePlayModal`. Ekran playera zostaje jak jest (renderuje `BunnyStreamPlayer` z `source: live`).

## 8. Fazy implementacji

### Faza 1 — Kontrakt Codegen + typy TS (bez natywności)

1. Utworzyć `src/specs/NativeBunnyStreamApi.ts` (Codegen spec).
2. Dodać `'BunnyStreamApi'` do `package.json > codegenConfig.android.modules`.
3. Utworzyć `src/api/types.ts` (typy domenowe + envelope).
4. Utworzyć `src/api/BunnyStreamApi.ts` (wrapper TS).
5. Dodać re-eksporty w `src/index.tsx`.
6. Uruchomić Codegen → wygenerować `NativeBunnyStreamApiSpec.java`.

### Faza 2 — Implementacja natywna Android

1. `BunnyStreamApiModule.kt` — wszystkie metody z coroutine + Promise.
2. `BunnyApiMappers.kt` — mapowania modeli + `BunnyResult` envelope.
3. Rejestracja w `BunnyStreamPlayerPackage.kt`.
4. Testy jednostkowe mappers (czyste funkcje, JVM).

### Faza 3 — Example app: VideoListScreen z API + PlayerScreen toggle

1. Przebudować `VideoListScreen` — fetch `listVideos`, stany, `FlatList` kart, pull-to-refresh, poll status.
2. Przebudować `PlayerScreen` — dodać toggle built-in/custom controls + render JS controls gdy `controls={false}`.
3. Usunąć `CustomControlsPlayerScreen`, `AddVideoIdModal`, logikę AsyncStorage video IDs.
4. Zaktualizować `HomeScreen` (usunąć Direct play + custom play opcje).
5. Zweryfikować: lista ładuje się, tap → `PlayerScreen`, toggle controls działa, custom controls sterują playbackem.

### Faza 4 — Example app: LiveStreamsScreen z API

1. Utworzyć `LiveStreamsScreen` — fetch `listLiveStreams`, stany, `FlatList` kart, pull-to-refresh, watch.
2. Dodać do nawigacji + `HomeScreen`.
3. Usunąć `DirectLivePlayModal`.
4. Zweryfikować: lista ładuje się, watch → `LivePlayerScreen` odtwarza.

### Faza 5 — Weryfikacja + testy

1. Testy TS: wrapper `BunnyStreamApi` (mock TurboModule), helpery `fold`/`getOrNull`, mapowania envelope.
2. Testy natywne: `BunnyApiMappers` (Video/LiveStream → WritableMap, BunnyResult → envelope, BunnyError kind mapping).
3. E2E example: lista video + odtwarzanie, lista live + odtwarzanie, pull-to-refresh, stany empty/error, toggle custom controls.
4. Lint + typecheck (`tsc`, `lint`).

## 9. Testy

### TS (`src/__tests__/`)

- `api/BunnyStreamApi.test.ts` — mock `NativeBunnyStreamApi`, weryfikacja argumentów/conwersji Double↔number, envelope ok/err.
- `api/types.test.ts` — helpery `fold`/`getOrNull`/`errorOrNull`, enumy status.

### Android (`android/src/test/`)

- `module/BunnyApiMappersTest.kt` — `Video.toWritableMap()`, `LiveStream.toWritableMap()`, `BunnyResult.Ok/Err.toWritableMap()`, `BunnyError` kind mapping (Network/Http/Auth/NotFound/Decode/InvalidState), `isTerminal` flaga.
- `module/BunnyStreamApiModuleTest.kt` — guard `isInitialized`, delegacja do repozytorium (mock `BunnyStreamApi`/repozytoria).

## 10. Kwestie otwarte / do potwierdzenia w trakcie

1. **Thumbnail URL w `listVideos`**: Android demo enrichuje thumbnail przez `fetchPlayerSettings` (osobne wywołanie per video). W fazie 1 sprawdzimy czy `Video.thumbnailFileName` + znany CDN host wystarczą do zbudowania URL, czy potrzebny enrich. Jeśli enrich — dodać `fetchPlayerSettings` do modułu API (mimo że settings repo jest "poza zakresem" — to jedyna metoda z `SettingsRepository` potrzebna dla listy).
2. **`VideoPlayData` / `LiveStreamPlayData` kształt**: te modele zawierają URL + player config. Określić dokładne pola do wystawienia w TS podczas implementacji (zależne od tego, czego używa example — obecnie player sam fetchuje play data natywnie, więc te metody API są dla metadanych, nie dla playbacku).
