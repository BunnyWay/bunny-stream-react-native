# Plan: audyt modułu upload + integracja example app

## 1. Cel

Dwa cele wykonywane sekwencyjnie:

1. **Audyt kompletności modułu `BunnyStreamUpload`** względem natywnych SDK i example appów (`bunny-stream-ios-private`, `bunny-stream-android-private`). Moduł kamery (`BunnyStreamBroadcaster`) jest świadomie poza zakresem — to następny etap (phase-5 w `docs/capabilities.json`).
2. **Rozszerzenie example app** o obsługę uploadu: opcja "Video Upload" z Home, oraz upload trailera i thumbnaila przy tworzeniu/edycji live streama — wiernie oddające UX natywnych example appów, bez usuwania istniejących funkcjonalności.

Audyt i example appy natywne wykonano 2026-09-09 na aktualnych working tree `bunny-stream-ios-private` i `bunny-stream-android-private`.

## 2. Decyzje przyjęte w planie

| Decyzja | Wybór | Uzasadnienie |
| --- | --- | --- |
| Picker mediów | **`react-native-image-picker` w example app** (nie w wrapperze) | Picker to ogólna zdolność RN, nie funkcja SDK Bunny Stream. Zweryfikowano grepami w `Sources` iOS i `api/player` Android — SDK nie wystawia pickera; natywne example appy używają systemowych frameworków (PhotosUI, AndroidX Activity), nie SDK. Wrapper pozostaje czystym opakowaniem SDK; example app jako aplikacja-host używa sprawdzonej paczki community, która opakowuje dokładnie te same systemowe API (`PHPickerViewController`/`PickVisualMedia`). Brak puchaczienia paczki npm o funkcję niezwiązaną z Bunny. |
| Screen Video Upload | **Osobny screen `VideoUpload`** | Najbliższe iOS natywnemu (`VideoUploaderView` z listą wierszy uploadów). Obsługuje wiele równoległych uploadów. |
| Trailer w LiveEditor | **Upload z galerii + wybór z biblioteki** | Pełna parzystość z iOS `TrailerPickerView` i Android `TrailerPickerScreen`. |

## 3. Audyt modułu `BunnyStreamUpload`

### 3.1. Co jest gotowe i poprawne

- **Kontrakt TS** (`src/upload/BunnyStreamUpload.ts`, `src/upload/types.ts`): `startUpload`, `continueUpload`, `pauseUpload`, `resumeUpload`, `cancelUpload`, `getUploadState`, `addUploadListener`, `restoreUploads`. Typy `UploadEvent` (started/progress/paused/completed/cancelled/failed), `UploadState`, `StartUploadOptions`, `ContinueUploadOptions`, `UploadHandle`, `UploadMode`. Spójne z natywnym modelem zdarzeń.
- **Spec Codegen** (`src/specs/NativeBunnyStreamUpload.ts`): poprawny TurboModule z `addListener`/`removeListeners` dla emitera zdarzeń.
- **Android** (`android/.../BunnyStreamUploadModule.kt`): pełny lifecycle, kolekcja Flow `observeUpload`, mapowanie `UploadEvent`→JS, snapshot `getUploadState` z `lastEvents`, envelope `BunnyResult`. Poprawnie deleguje do `videoUploader`/`tusVideoUploader`.
- **iOS** (`ios/BunnyStreamUploadModuleImpl.swift` + `.mm`): lifecycle, `UploadTrackerObservable` + Combine, mapowanie `UploadStatus`→JS, pre-provisioning `videoId` przez `createVideo` (iOS uploader tego wymaga). Podspec (`BunnyStreamReactNative.podspec`) poprawnie linkuje `BunnyStreamUploader`.
- **Testy** (`src/__tests__/upload.BunnyStreamUpload.test.ts`): pokrywają delegację wszystkich metod i normalizację opcji.
- **Eksport** (`src/index.ts`): `BunnyStreamUpload` i typy są publicznie eksportowane.
- **API thumbnail live** (`BunnyStreamApi.uploadLiveStreamThumbnail`/`setLiveStreamThumbnail`/`deleteLiveStreamThumbnail`/`listLiveStreamThumbnails`): zaimplementowane na obu platformach, gotowe do użycia w example app.

### 3.2. Znalezione luki i bugi (do naprawy w ramach tego planu)

#### BUG-1 (krytyczny): iOS zwraca `videoId` jako `uploadId` w handle

`BunnyStreamUploadModuleImpl.swift:246-252` — po `uploader.uploadVideo(with: info)` promise resolves z `["uploadId": videoId, "videoId": videoId]`. Rzeczywisty `uploadId` to `UploadVideoInfo.uuid` (inny UUID), emitowany w zdarzeniach przez `observeTracker`.

Skutki:

- JS otrzymuje handle z `uploadId = videoId`.
- Zdarzenia niosą `uploadId = uuid` (inna wartość) → **JS nie potrafi skorelować zdarzeń z handle**.
- `pauseUpload`/`resumeUpload`/`cancelUpload` wywołane z zwróconym `uploadId` (videoId) → `findUploadInfo(videoId)` parsuje UUID OK, ale szuka `info.uuid == videoId` → brak trafienia → **NotFound**. Pause/resume/cancel na iOS są zepsute.

Naprawa: po `uploadVideo(with:)` odczekać na pierwsze zdarzenie z trackera dla tego `videoId` (mapowanie `videoIdToUploadId` już istnieje) i rozwiązać promise z prawdziwym `uploadId` (`info.uuid.uuidString`). Alternatywnie: rozwiązać natychmiast z `uploadId = videoId` i zaktualizować kontrakt TS tak, by `UploadHandle` niosł też `videoId`, a zdarzenia korelować po `videoId` (nie `uploadId`). Pierwsze rozwiązanie jest spójniejsze z Androidem i kontraktem — **rekomendowane**.

#### BUG-2 (średni): iOS `UploadHandle` niesie dodatkowe pole `videoId`

Kontrakt TS `UploadHandle` deklaruje tylko `{ uploadId: string }`. iOS zwraca `{ uploadId, videoId }`. Android zwraca `{ uploadId }`. Niektórene równości platformowe. Po naprawie BUG-1 pole `videoId` można usunąć z odpowiedzi iOS lub utrzymać jako opcjonalne w typie — **rekomendacja: usunąć z odpowiedzi iOS**, zostawić czysty `{ uploadId }`.

#### LUKA-1: `restoreUploads()` jest no-op placeholderem

`BunnyStreamUpload.ts:130-138` — funkcja istnieje, ale nic nie robi (komentarze TODO dla iOS i Android). iOS TUS przeżywa śmierć procesu przez background `URLSession`; `TUSVideoUploader.make` wywołuje `start()` przy tworzeniu, więc uploadery są tworzone lazy w module i przy pierwszym użyciu przywracają się same. To jest akceptowalne na ten etap — **pozostawić jako no-op z TODO**, udokumentować w JSDoc, że przywracanie następuje lazy. Nie blokuje example app.

#### LUKA-2: brak hooka `useBunnyUpload`

`src/upload/hooks/` istnieje ale jest pusty. Plan docelowy (`Plan-complete-native-sdk-wrapper.md` §6.1) przewiduje `useBunnyUpload`. Nie jest wymagany dla example app (example może subskrybować `addUploadListener` bezpośrednio), ale **rekomendowane** dodać prosty hook agregujący stan uploadów dla wygody i spójności z `useBunnyStreamPlayer`. Zakres: opcjonalny w tym planie.

#### LUKA-3: Android ignoruje `title` i `collectionId`

`BunnyStreamUploadModule.kt:78-86` — `startUpload` przyjmuje `title`/`collectionId` z JS dla parzystości z iOS, ale natywny `VideoUploader.startUpload(libraryId, uri)` ich nie przyjmuje; są ignorowane (komentarz w kodzie to opisuje). To ograniczenie Android SDK, nie bug wrappera. **Pozostawić z istniejącym komentarzem**. W example app tytuł dla iOS ustawimy przez `title`, a na Android SDK i tak użyje nazwy pliku.

### 3.3. Werdykt kompletności

Moduł uploadu jest **funkcjonalnie kompletny poza BUG-1/BUG-2 na iOS**, które muszą zostać naprawione, aby pause/resume/cancel działały w example app na iOS. Pozostałe luki są akceptowalne na ten etap. Moduł kamery jest świadomie poza zakresem (phase-5).

## 4. Picker mediów w example app (`react-native-image-picker`)

Picker to odpowiedzialność aplikacji-hosta, nie wrappera SDK. Example app dodaje `react-native-image-picker` jako zależność **wyłącznie example appy** (`example/package.json`), nie paczki wrappera. Biblioteka opakowuje dokładnie te same systemowe API, których używają natywne example appy: `PHPickerViewController` (iOS) i `ActivityResultContracts.PickVisualMedia` (Android).

### 4.1. Instalacja

```bash
cd example && yarn add react-native-image-picker
```

Wersja: stabilna, opublikowana >7 dni temu (zgodnie z regułami projektu). Brak zmian w `package.json` wrappera (root) — picker nie trafia do publikowanej paczki npm.

### 4.2. Uprawnienia

- **Android**: `PickVisualMedia`/PhotoPicker (Android 13+) nie wymaga uprawnień; fallback na starszych wersjach obsługiwany transparentnie przez bibliotekę. Brak zmian w `AndroidManifest.xml`.
- **iOS**: `PHPickerViewController` (iOS 14+) nie wymaga `NSPhotoLibraryUsageDescription`. Brak zmian w `Info.plist`.

### 4.3. Użycie w example app

Helper moduł `example/src/media/picker.ts` opakowujący `launchImageLibrary` w formę zgodną z resztą example appy:

```ts
import { launchImageLibrary } from 'react-native-image-picker';

// Wideo: mediaType 'video', selectionLimit konfigurowalny.
// Zwraca { uri, fileName } lub null przy anulowaniu.
export async function pickVideo(selectionLimit = 1): Promise<PickedFile[] | null>;

// Obraz: mediaType 'photo', selectionLimit 1.
export async function pickImage(): Promise<PickedFile | null>;
```

Zwrócone `uri` (`file://` na iOS, `file://`/`content://` na Android) przekazywane bezpośrednio do `BunnyStreamUpload.startUpload({ uri })` i `BunnyStreamApi.uploadLiveStreamThumbnail(libraryId, streamId, uri)`.

## 5. Example app — zmiany

Nienaruszone: wszystkie istniejące screeny (`VideoListScreen`, `LiveStreamsScreen`, `LivePlayerScreen`, `PlayerScreen`, `SettingsScreen`, `DirectVideoPlayModal`), nawigacja, storage, theme. **Nie usuwamy żadnej funkcjonalności.**

### 5.1. Nawigacja (`example/src/navigation/types.ts`)

Dodać do `RootStackParamList`:

```ts
VideoUpload: undefined;
TrailerPicker: { libraryId: number };
ThumbnailPicker: { libraryId: number; streamId: string };
```

`TrailerPicker`/`ThumbnailPicker` to osobne screeny wyboru z biblioteki (otwierane z `LiveStreamEditorModal` jako push, nie modal — potrzebują `navigation.goBack()` z wynikiem).

### 5.2. Home screen (`example/src/screens/HomeScreen.tsx`)

Zastąpić placeholder "Video Upload" (badge "Coming soon", disabled) aktywnym `HomeOption` nawigującym do `VideoUpload`. Pozostawić "Camera upload" jako "Coming soon" (phase-5). Resume Positions pozostają bez zmian.

### 5.3. Nowy screen `VideoUploadScreen.tsx`

Struktura wzorowana na iOS `VideoUploaderView` + Android `VideoUploadControls`:

- **Header** z back.
- **Sekcja ustawień**: przełącznik "Use TUS resumable upload" (jak Android checkbox), domyślnie `true`.
- **Przycisk "Pick videos"** → `pickVideo(5)` (helper `example/src/media/picker.ts`) → dla każdego pliku `BunnyStreamUpload.startUpload({ libraryId, uri, title: fileName, mode })`.
- **Lista wierszy uploadów** (aktywne + zakończone w tej sesji), każdy wiersz:
  - tytuł + `videoId` (skrócone),
  - stan: `uploading` (pasek postępu `progress` 0..1 + `%`), `paused`, `completed`, `cancelled`, `failed` (komunikat błędu),
  - przyciski: pause/resume (gdy `pauseSupported === 'supported'`), cancel (gdy aktywny), retry (gdy `failed` i `!error.isTerminal` — `continueUpload` gdy znany `videoId`, inaczej `startUpload`).
- **Subskrypcja** `BunnyStreamUpload.addUploadListener` w `useEffect`, stan w `useRef` mapie `uploadId → row`, render przez `useState` trigger.
- Po `completed` — opcjonalny link "Play" → `navigation.navigate('Player', { videoId, libraryId })`.
- `libraryId` z `loadSettings()` jak inne screeny.

### 5.4. `LiveStreamsScreen.tsx` — `LiveStreamEditorModal` trailer

Rozszerzyć sekcję "Pre-stream trailer" (obecnie tylko `TextInput` na `trailerVideoId`):

- Gdy `trailerEnabled`:
  - Przycisk **"Upload trailer video"** → `pickVideo(1)` (helper) → `BunnyStreamUpload.startUpload({ libraryId, uri, title: fileName, mode: 'basic' })` (jak iOS/Android — basic uploader dla trailera) → subskrypcja zdarzeń → po `completed` ustaw `trailerVideoId = event.videoId`, pokaż wiersz "Uploading… X%".
  - Przycisk **"Choose from library"** → `navigation.navigate('TrailerPicker', { libraryId })` → nowy `TrailerPickerScreen` listuje `BunnyStreamApi.listVideos` → po wyborze wraca z `videoId` (przez `navigation.navigate` z parametrem powrotu lub `setParams`/callback).
  - Gdy `trailerVideoId` ustawione — pokaż skrócone ID + przycisk "Remove".
- `preStreamTrailerVideoId` w payload create/update = `trailerEnabled ? trailerVideoId : null` (już jest).

Nowy screen `TrailerPickerScreen.tsx`: lista wideo z biblioteki (`listVideos`), wybór zwraca `videoId` do editora.

### 5.5. `LiveStreamsScreen.tsx` — `LiveStreamEditorModal` thumbnail

Rozszerzyć sekcję "Thumbnail" (obecnie tylko `TextInput` na `thumbnailUrl`):

- Gdy `thumbnailEnabled`:
  - Przycisk **"Choose from Photos"** → `pickImage()` (helper) → po utworzeniu/zapisie streama wywołać `BunnyStreamApi.uploadLiveStreamThumbnail(libraryId, streamId, uri)`.
  - Istniejące pole **Image URL** pozostaje (→ `setLiveStreamThumbnail`).
  - Gdy edycja (`isEdit`): przycisk **"Browse generated thumbnails"** → `navigation.navigate('ThumbnailPicker', { libraryId, streamId })` → `ThumbnailPickerScreen` listuje `BunnyStreamApi.listLiveStreamThumbnails` → wybór zwraca URL → `setLiveStreamThumbnail`.
  - Podgląd obrazka (jeśli `thumbnailUrl` lub wybrany URI).
- **Kluczowa zmiana w flow zapisu**: thumbnail jest aplikowany **po** utworzeniu/aktualizacji streama (jak natywne appy), bo `uploadLiveStreamThumbnail`/`setLiveStreamThumbnail` wymagają `streamId`. Obecnie `handleSave` rozwiązuje się po `createLiveStream`/`updateLiveStream`. Należy:
  1. wykonać create/update → pobrać `streamId` (z wyniku `createLiveStream` — trzeba odczytać `id` zwracanego `LiveStream`; `updateLiveStream` ma już `stream.id`),
  2. jeśli `thumbnailEnabled` i wybrany lokalny URI → `uploadLiveStreamThumbnail`, jeśli URL → `setLiveStreamThumbnail`,
  3. jeśli `!thumbnailEnabled` i `isEdit` i był wcześniej thumbnail → `deleteLiveStreamThumbnail`,
  4. dopiero wtedy `onDone()`.
- `createLiveStream` musi zwracać `LiveStream` z `id` — zweryfikować, że `BunnyStreamApi.createLiveStream` zwraca pełny obiekt (już zmapowane w `BunnyStreamApi.ts`).

Nowy screen `ThumbnailPickerScreen.tsx`: lista `listLiveStreamThumbnails` z podglądem, wybór zwraca URL.

### 5.6. Rejestracja screenów w `App.tsx`

Dodać do `Stack.Navigator`:

```tsx
<Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
<Stack.Screen name="TrailerPicker" component={TrailerPickerScreen} />
<Stack.Screen name="ThumbnailPicker" component={ThumbnailPickerScreen} />
```

### 5.7. Zależności example app

- Dodaj `react-native-image-picker` do `example/package.json` (`yarn add react-native-image-picker` w katalogu `example`). Wyłącznie zależność example appy — **nie** paczki wrappera (root `package.json` bez zmian). Wrapper pozostaje czystym opakowaniem SDK bez zależności pickerowych.
- Brak innych nowych zewnętrznych zależności.

## 6. Kolejność implementacji

1. **Naprawa BUG-1 + BUG-2 w iOS** (`BunnyStreamUploadModuleImpl.swift`) — odczekanie na prawdziwy `uploadId` z trackera przed resolve; czysty `{ uploadId }` w odpowiedzi. Weryfikacja ręczna.
2. **Example app: instalacja `react-native-image-picker`** + helper `example/src/media/picker.ts` (`pickVideo`/`pickImage`).
3. **Example: `VideoUploadScreen`** + nawigacja (`VideoUpload`) + Home (aktywacja opcji).
4. **Example: `TrailerPickerScreen` + `ThumbnailPickerScreen`** + nawigacja.
5. **Example: rozszerzenie `LiveStreamEditorModal`** o trailer upload + thumbnail upload (z dwufazowym zapisem: create/update stream → apply thumbnail po uzyskaniu `streamId`).
6. **Weryfikacja końcowa**: typecheck, lint, build obu platform, testy.

## 7. Weryfikacja

- `yarn typecheck` (root + example).
- `yarn lint` (root).
- `yarn test` (testy wrappera, w tym zaktualizowane dla uploadu iOS).
- Build Android example: `cd example && yarn build:android` (lub `yarn android`).
- Build iOS example: `cd example && yarn ios`.
- Ręczny smoke test na urządzeniu/symulatorze:
  - Home → Video Upload → pick wideo → progres → completed → Play.
  - Pause/resume/cancel na iOS (po naprawie BUG-1) i Android TUS.
  - LiveStreams → New → upload trailera z galerii → wybór z biblioteki → thumbnail z galerii → create → weryfikacja thumbnaila na streama.
  - Edycja istniejącego streama → browse generated thumbnails → zmiana → save.

## 8. Poza zakresem (następne etapy)

- Moduł kamery / broadcaster (phase-5).
- `useBunnyUpload` hook (opcjonalny w tym planie, można dodać).
- Przeżywanie śmierci procesu uploadu (LUKA-1) — pozostaje z TODO.
- Video thumbnails/captions management API (phase-4).
- Cached Bunny image loading (phase-7).
- Picker w wrapperze — świadomie odrzucone; picker to odpowiedzialność aplikacji-hosta.
