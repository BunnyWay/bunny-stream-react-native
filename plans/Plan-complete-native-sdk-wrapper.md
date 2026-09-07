# Plan uzupełnienia `bunny-stream-react-native` względem natywnych SDK

## 1. Cel

Celem jest doprowadzenie `bunny-stream-react-native` do roli kompletnego, stabilnego wrappera nad oficjalnymi SDK Bunny Stream dla Androida i iOS, z jednym publicznym API TypeScript, zgodnym zachowaniem na obu platformach i bez kopiowania logiki biznesowej natywnych SDK do JavaScriptu.

Plan obejmuje:

- inwentaryzację funkcji już przeniesionych;
- identyfikację brakujących i częściowo przeniesionych modułów;
- rozdzielenie funkcji wspólnych od funkcji dostępnych tylko na jednej platformie;
- kolejność implementacji, kontrakty, testy i kryteria akceptacji;
- przygotowanie wrappera na bazie najnowszych, niepublicznych jeszcze wersji SDK;
- końcowe przepięcie biblioteki na publiczne artefakty Android/iOS po zakończeniu zamkniętych testów SDK.

## 2. Zweryfikowana baza

Audyt wykonano 2026-09-04 na:

| Repozytorium | Branch | Commit |
| --- | --- | --- |
| `bunny-stream-react-native` | `ios-api-sdk` | `b54ceea` |
| `bunny-stream-android-private` | `feature/live_streams` | `fb86350` |
| `bunny-stream-ios-private` | `feature/ios-liveStream` | `8e222bb` |

Wszystkie trzy working tree były czyste podczas audytu.

### 2.1. Status SDK i ograniczenia realizacji planu

Natywne SDK Android i iOS są obecnie w fazie zamkniętych testów i nie zostały jeszcze opublikowane. Wrapper musi tymczasowo bazować na najnowszych prywatnych wersjach, ponieważ tylko one zawierają aktualną logikę live, DVR, recovery i live → VOD.

Obowiązują następujące zasady:

1. Podczas realizacji tego planu **nie wolno modyfikować** `bunny-stream-android-private` ani `bunny-stream-ios-private`.
2. Wszystkie implementacje wykonujemy wyłącznie w `bunny-stream-react-native`, korzystając z publicznych API dostępnych w aktualnych prywatnych wersjach SDK.
3. Brakującego API natywnego nie obchodzimy przez zmiany w prywatnych repozytoriach. Stosujemy bezpieczny workaround w bridge'u albo jawnie odkładamy funkcję.
4. Każdy tymczasowy workaround w kodzie RN musi mieć komentarz `TODO(Android SDK): ...` albo `TODO(iOS SDK): ...`, opisujący warunek jego usunięcia.
5. Lista zmian potrzebnych docelowo w natywnych SDK jest tylko rekomendacją dla ich właścicieli i znajduje się na końcu dokumentu; nie jest częścią implementacji wrappera przed publikacją SDK.
6. Publiczne wydania Android/iOS są zależnością release wrappera. Przepięcie z prywatnych snapshotów/ścieżek na publiczne pakiety jest ostatnim krokiem całego planu, opisanym jako **Faza 0B**.

### Moduły natywne

Android:

1. `:api` — REST API, repozytoria domenowe, basic upload i TUS upload.
2. `:player` — VOD, live/DVR, natywne kontrolki, DRM, reklamy, cast, fullscreen, PiP, napisy, audio, jakość, heatmapa.
3. `:recording` — nagrywanie z kamery i publikowanie RTMP/live, reconnect i ingest failover.
4. `:tv` — player i kontrolki Android TV.

Apple:

1. `BunnyStreamAPI` — wygenerowany klient API oraz stabilne domenowe API live streams.
2. `BunnyStreamUploader` — URLSession upload i resumable TUS upload.
3. `BunnyStreamPlayer` — VOD, live/DVR, FairPlay, reklamy, AirPlay, PiP, napisy, audio, jakość, heatmapa i watermark.
4. `BunnyStreamCameraUpload` — kamera, RTMP/live broadcast, controller, jakość, reconnect/failover.

## 3. Stan obecny wrappera React Native

### 3.1. Przeniesione i działające

#### Inicjalizacja

- `initialize(accessKey, libraryId)` przez `NativeBunnyStreamPlayer`.
- Android deleguje do globalnego `BunnyStreamApi.initialize`.
- iOS przechowuje konfigurację w thread-safe `BunnyStreamConfiguration`, ponieważ iOS SDK nie ma globalnego singletonu.
- Walidacja pustego klucza i niepoprawnego `libraryId` po stronie TypeScript.

#### Player VOD

- Jeden publiczny komponent `BunnyStreamPlayer` z `source.type === "vod"`.
- Fabric Native Component na Androidzie i iOS.
- Źródło: `videoId`, opcjonalny `libraryId`, `token`, `expires`.
- Props: `autoPlay`, `controls`.
- Komendy ref: `play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`, `mute`, `unmute`.
- Zdarzenia kontraktu: ready, state, progress, error, buffering, play, pause, end, volume, playback rate, video size, playback error.
- Kolejkowanie komend przed `ready` i ochrona przed starymi callbackami na Androidzie.
- Remount po zmianie tożsamości źródła.
- Natywne server-driven UI playera.

#### Player live

- Ten sam publiczny komponent z `source.type === "live"`.
- Osobne natywne hosty live na Androidzie i iOS.
- Polling, countdown, trailer, offline, DVR, recovery i live → VOD są pozostawione natywnym SDK.
- Zdarzenia `onLiveStateChange` i `onLiveError`.
- Token-auth dla live.
- Android emituje rozmiar wideo i pełniejsze dane stanu live.
- Bridge Android wymusza 1× dla aktywnego live, aby zapisane tempo VOD nie doprowadzało playera DVR do live edge.

#### REST API — obecny zakres

Publiczny `BunnyStreamApi` i `NativeBunnyStreamApi` działają na Androidzie i iOS. Przeniesiono:

- `isInitialized`;
- videos: `listVideos`, `getVideo`, `fetchVideoPlayData`, `createVideo`, `updateVideo`, `deleteVideo`;
- live streams: `listLiveStreams`, `getLiveStream`, `fetchLiveStreamPlayData`, `createLiveStream`, `updateLiveStream`, `deleteLiveStream`, `startLiveStream`, `stopLiveStream`;
- player settings: `fetchPlayerSettings`;
- token helper: `generateEmbedToken` i TS helper `signPlaybackToken`;
- wspólne modele `Video`, `LiveStream`, play data, player settings, requesty;
- `BunnyResult<T>` i wspólna taxonomia błędów;
- helpery `fold`, `map`, `getOrNull`, `errorOrNull`.

#### Warstwa React/TypeScript

- `useBunnyStreamPlayer` agregujący stan, progress i stabilne komendy.
- Reset stanu hooka po zmianie źródła.
- `sourceIdentityKey`.
- `useBunnyImage` dla Bunny CDN z wymaganym nagłówkiem `Referer`.
- Example zawiera listę VOD, listę live, VOD player, live player i ustawienia.

#### Funkcje działające transparentnie przez natywny player

Poniższe funkcje nie mają osobnego API JS, ale działają przez server-driven natywne kontrolki:

- Widevine na Androidzie i FairPlay na iOS;
- VAST/IMA ads;
- napisy;
- wybór jakości;
- audio tracks, jeśli źródło je zawiera;
- heatmapa w natywnym timeline;
- fullscreen;
- PiP;
- Chromecast na Androidzie i AirPlay na iOS;
- CMCD;
- dashboard theme, control tokens, compact controls i playback speeds.

To należy traktować jako **przeniesione dla natywnego UI**, ale nie jako kompletne programowalne API React Native.

## 4. Macierz luk

Legenda:

- **Gotowe** — wspólny kontrakt i implementacja Android/iOS.
- **Częściowe** — działa podstawowy przypadek lub tylko jedna platforma/warstwa.
- **Brak** — natywne SDK ma funkcję, wrapper jej nie wystawia.
- **Blokada SDK** — publiczne natywne API nie pozwala wykonać bezpiecznego bridge'a.

| Obszar | Android SDK | iOS SDK | RN | Status |
| --- | --- | --- | --- | --- |
| Inicjalizacja jednej biblioteki | Tak | Konstruktor per instancja | Tak | Gotowe |
| Wiele niezależnych bibliotek/instancji | `create/release` | Wiele `BunnyStreamAPI` | Nie | Brak |
| VOD playback | Tak | Tak | Tak | Gotowe |
| Live/DVR playback | Tak | Tak | Tak | Gotowe podstawowo |
| VOD komendy JS | Tak | Możliwe przez AVPlayer bridge | Tak | Gotowe podstawowo |
| Live komendy JS | Brak stabilnego wspólnego controllera | Brak publicznego controllera | No-op | Blokada SDK |
| VOD eventy | Bogate callbacki | Bridge obserwuje AVPlayer | Nierówne między platformami | Częściowe |
| Live state metadata | Bogate stany Android | Publiczny enum iOS | iOS gubi szczegóły | Częściowe |
| Watermark | Brak równoważnego publicznego API w playerze | Tak | Nie | Częściowe/platformowe |
| Custom icons/theme | Tak | Tak | Nie | Brak |
| Resume position | Tak | Brak równoważnego publicznego API | Nie | Częściowe/platformowe |
| Chapters/moments/retention callbacki | Tak | Dane używane wewnętrznie | Nie | Częściowe |
| Collections API | Tak | Dostępne w generated API | Nie | Brak |
| Rozszerzone video read API | Tak | Generated API | Nie | Brak |
| Video thumbnails | Tak | Generated API | Nie | Brak |
| Captions management | Tak | Generated API | Nie | Brak |
| Fetch/refetch video | Tak | Generated API | Nie | Brak |
| Reencode/repackage/resolution delete | Tak | Generated API | Nie | Brak |
| AI smart generate/transcription | Tak | Generated API | Nie | Brak |
| Live thumbnails | Tak | Stabilne API domenowe | Nie | Brak |
| Live ingest status | Tak | Stabilne API domenowe | Nie | Brak |
| Regenerate live stream key | Brak w domenowym Android API | Tak | Nie | Platformowa luka |
| Basic upload | Tak | Tak | Nie | Brak modułu |
| TUS resumable upload | Tak | Tak | Nie | Brak modułu |
| Camera/live broadcast | Tak | Tak | Nie | Brak komponentu/modułu |
| Android TV | Tak | Nie dotyczy | Nie | Brak/platformowe |
| Bunny image loading | Natywny CDN path | Kingfisher | Hook data URI | Częściowe |
| Dystrybucja natywnych zależności | Maven snapshot lokalny | Lokalny SwiftPM checkout | Lokalna konfiguracja | Blokada release |

## 5. Najważniejsze problemy obecnej implementacji

### 5.1. Nierówny kontrakt zdarzeń playera

Android emituje `onVolumeChange`, `onPlaybackRateChange`, `onVideoSizeChange` i `onPlaybackError`. iOS `BunnyStreamPlayerView.mm` emituje obecnie tylko:

- `onReady`;
- `onPlaybackStateChange`;
- `onProgress`;
- `onError`;
- `onBuffering`;
- `onPlay`;
- `onPause`;
- `onEnd`.

Wspólny TypeScript deklaruje więcej zdarzeń niż faktycznie wysyła iOS. To jest najważniejsza luka istniejącego publicznego kontraktu.

### 5.2. Niepełne eventy live na iOS

Bridge iOS mapuje live state wyłącznie do `(state, isLive)`. Tracone są:

- countdown timestamp i title;
- trailer video ID/scheduled start/title;
- offline/failure message;
- rozróżnienie reason;
- `dvrEnabled`;
- video size.

Android dostarcza część tych danych, więc zachowanie hooka jest platformowo nierówne.

### 5.3. Live custom controls

Publiczny ref dokumentuje komendy, ale wszystkie są no-op dla live. Nie należy obchodzić tego przez reflection ani dostęp do internal playerów. Wspólny live controller powinien najpierw pojawić się w obu natywnych SDK.

### 5.4. Tymczasowa integracja z niepublicznymi SDK

- Android używa `mavenLocal()` i `4.0.0-live.shadow.1-SNAPSHOT`.
- iOS podspec wymaga lokalnego `../bunny-stream-ios-private` przez `BUNNY_STREAM_IOS_SDK_PATH`.
- Podspec dołącza tylko `BunnyStreamPlayer` i `BunnyStreamAPI`; uploader i camera upload nie są podpięte.

Jest to świadomy stan developerski na czas zamkniętych testów SDK, nie błąd do naprawienia teraz. Pozwala rozwijać wrapper na najnowszej logice live przed publicznym wydaniem SDK. Paczka RN nie może zostać opublikowana w takim stanie; przepięcie na publiczne artefakty nastąpi jako ostatni krok (Faza 0B), po wydaniu obu natywnych SDK.

### 5.5. `useBunnyImage` jest rozwiązaniem funkcjonalnym, ale kosztownym

Konwersja całego obrazu do `data:` URI:

- zwiększa użycie pamięci;
- omija cache natywnego loadera;
- skaluje się źle dla list z wieloma thumbnailami.

Docelowo potrzebny jest natywny komponent/loader obrazu albo udokumentowany helper `ImageSource` z nagłówkiem i cache.

### 5.6. Rejestr aktualnych workaroundów oznaczonych `TODO`

- `android/build.gradle` — prywatny snapshot Maven na czas zamkniętych testów; usunięcie w Fazie 0B.
- `example/android/build.gradle` — `mavenLocal()` wymagane tylko przez example w fazie testów; usunięcie w Fazie 0B.
- `BunnyStreamReactNative.podspec` — lokalny checkout SwiftPM; usunięcie w Fazie 0B.
- `android/.../BunnyLiveStreamPlayerView.kt` — polling prędkości i aktywnego `currentPlayer`; usunięcie po gwarancji 1× i player replacement callbacku w publicznym Android SDK.
- `ios/BunnyStreamPlayerViewImpl.swift` — wyszukiwanie `AVPlayerLayer` + KVO; usunięcie po publicznym VOD controllerze/eventach w iOS SDK.
- `ios/BunnyLiveStreamPlayerViewImpl.swift` — brak live video size i części DVR metadata; uzupełnienie po rozszerzeniu publicznego callbacku iOS SDK.
- `ios/BunnyStreamApiModuleImpl.swift` — mapowanie generated video API; zastąpienie po stabilnych domenowych `VideoRepository`/`CollectionRepository` w iOS SDK.

Ten rejestr należy aktualizować przy każdym dodaniu lub usunięciu workaroundu. Komentarza `TODO` nie usuwamy wyłącznie dlatego, że SDK zostało opublikowane — najpierw publiczna wersja musi spełnić opisany warunek i przejść test regresyjny.

## 6. Docelowa architektura publicznego API

### 6.1. Moduły

1. `BunnyStreamPlayer` — inicjalizacja/config i komponent VOD/live.
2. `BunnyStreamApi` — repozytoria management API.
3. `BunnyStreamUpload` — basic/TUS upload oraz eventy transferów.
4. `BunnyStreamBroadcaster` — Fabric component kamery + komendy i eventy broadcastu.
5. `BunnyImage` — opcjonalny natywny komponent lub helper cache'owanego źródła.

Nie należy umieszczać uploadu, API management i player commands w jednym TurboModule.

### 6.2. Zasady kontraktu

- Publiczne typy TS nie zależą od wygenerowanych typów OpenAPI.
- Każda metoda asynchroniczna management API zwraca `Promise<BunnyResult<T>>`.
- Operacje transferowe zwracają stabilny `uploadId`, a stan płynie eventami/subskrypcją.
- Props i eventy mają identyczne znaczenie na obu platformach.
- Funkcja niedostępna na jednej platformie jest jawnie oznaczona jako platformowa; nie może być cichym no-op bez informacji.
- Destrukcyjne API (`deleteVideo`, `deleteResolutions`, cancel z usunięciem częściowego video) jest wyraźnie opisane.
- Token auth secret nie może być promowany jako funkcja produkcyjna klienta; `generateEmbedToken` pozostaje helperem demo/debug.
- Cały kod projektu (wrapper React Native) jest pisany **po angielsku**: nazwy zmiennych, funkcji, typów, klas, plików, opisy JSDoc/TSDoc, komentarze, komunikaty błędów, nazwy branchy i commity. Plan jest dokumentem wewnętrznym pisanym po polsku, ale nie jest kodem i nie wpływa na konwencję kodu. Wszelkie komentarze `TODO(Android SDK)` / `TODO(iOS SDK)` oraz opisy workaroundów w kodzie również po angielsku.

### 6.3. Struktura katalogów `src`

Obecnie `src/index.tsx` łączy zbyt wiele odpowiedzialności: publiczne eksporty paczki, inicjalizację SDK i walidację, publiczne typy playera, wybór implementacji VOD/live, implementację komponentu i ref commands, identyfikację źródła, eksport hooków oraz eksport całego API REST. Ma 442 linie, a sam `BunnyStreamPlayer` około 135 linii. Fallow nie wykrywa cykli ani martwych plików, więc reorganizacja jest przygotowaniem biblioteki na kolejne moduły, a nie pilną naprawą.

Dla tego projektu najlepszy jest podział **feature-first**, a nie ogólne katalogi typu `components/`, `services/`, `utils/`.

#### Docelowa struktura

```text
src/
├── index.ts
│
├── config/
│   ├── initialize.ts
│   ├── validation.ts
│   └── types.ts
│
├── player/
│   ├── index.ts
│   ├── BunnyStreamPlayer.tsx
│   ├── BunnyStreamPlayer.types.ts
│   ├── sourceIdentity.ts
│   │
│   ├── hooks/
│   │   ├── useBunnyStreamPlayer.ts
│   │   ├── useBunnyStreamPlayer.types.ts
│   │   └── index.ts
│   │
│   └── state/
│       ├── playerState.ts
│       ├── playerReducer.ts
│       └── playerEventHandlers.ts
│
├── api/
│   ├── index.ts
│   ├── BunnyStreamApi.ts
│   │
│   ├── result/
│   │   ├── BunnyResult.ts
│   │   └── resultHelpers.ts
│   │
│   └── models/
│       ├── common.ts
│       ├── video.ts
│       ├── liveStream.ts
│       ├── playerSettings.ts
│       ├── collections.ts
│       ├── statistics.ts
│       └── requests.ts
│
├── image/
│   ├── index.ts
│   ├── useBunnyImage.ts
│   └── types.ts
│
├── upload/
│   ├── index.ts
│   ├── BunnyStreamUpload.ts
│   ├── types.ts
│   └── hooks/
│       └── useBunnyUpload.ts
│
├── broadcaster/
│   ├── index.ts
│   ├── BunnyStreamBroadcaster.tsx
│   ├── types.ts
│   └── hooks/
│       └── useBunnyBroadcast.ts
│
├── specs/
│   ├── NativeBunnyStreamPlayer.ts
│   ├── NativeBunnyStreamApi.ts
│   ├── BunnyStreamPlayerNativeComponent.ts
│   ├── BunnyLiveStreamPlayerNativeComponent.ts
│   ├── NativeBunnyStreamUpload.ts
│   └── BunnyStreamBroadcasterNativeComponent.ts
│
└── __tests__/
    ├── public-api.test.ts
    ├── codegen-contract.test.ts
    └── ...
```

Katalogi `upload/` i `broadcaster/` powstałyby dopiero przy implementacji tych modułów (Fazy 3 i 5).

#### Główny `index.ts`

Główny entry point powinien być wyłącznie kontrolowanym publicznym API paczki:

```ts
export { initialize } from './config/initialize';

export {
  BunnyStreamPlayer,
  sourceIdentityKey,
  useBunnyStreamPlayer,
} from './player';

export type {
  BunnyStreamPlayerProps,
  BunnyStreamPlayerRef,
  BunnyStreamSource,
  PlayerState,
  PlayerProgress,
  UseBunnyStreamPlayerOptions,
  UseBunnyStreamPlayerResult,
} from './player';

export {
  BunnyStreamApi,
  errorOrNull,
  fold,
  getOrNull,
  map,
} from './api';

export type {
  BunnyError,
  BunnyResult,
  Video,
  VideoList,
  LiveStream,
  LiveStreamList,
} from './api';

export { useBunnyImage } from './image';
export type { UseBunnyImageResult } from './image';
```

Po ekstrakcji JSX plik można zmienić z `index.tsx` na `index.ts`.

#### Zasady eksportu

Dla biblioteki npm eksport jest częścią publicznego kontraktu i semantic versioning. Należy używać explicit exports:

```ts
export { BunnyStreamPlayer } from './BunnyStreamPlayer';
export type { BunnyStreamPlayerProps } from './BunnyStreamPlayer.types';
```

nie `export *`. To zapobiega przypadkowemu opublikowaniu helperów wewnętrznych.

Raw TurboModules (`NativeBunnyStreamPlayer`, `NativeBunnyStreamApi`) traktujemy jako wewnętrzne. Jeśli są potrzebne do integracji lub mockowania, udostępniamy je przez osobny subpath:

```ts
import { NativeBunnyStreamApi } from 'bunny-stream-react-native/native';
```

Nie miesza się raw Codegen API ze standardowym API konsumenckim.

#### Podział obecnego `index.tsx`

1. **Komponent playera** → `src/player/BunnyStreamPlayer.tsx`: `NativeVodView`, `NativeLiveView`, `React.forwardRef`, wybór VOD/live, mapowanie props, ref commands, remount przez `hostKey`.
2. **Publiczne typy playera** → `src/player/BunnyStreamPlayer.types.ts`: `BunnyStreamPlayerProps`, `BunnyStreamSource`, `BunnyStreamPlayerRef`, publiczne event payloads. Publiczne typy nie powinny być bezpośrednio zależne od speców Codegen, ponieważ spec jest kontraktem technicznym RN i może wymagać typów takich jak `Double`, `Int32` czy `WithDefault`.
3. **Inicjalizacja** → `src/config/initialize.ts` i `src/config/validation.ts`: `initialize`, `validateAccessKey`, `validateLibraryId`. Nie tworzymy klasy `BunnyStreamClient` tylko po to, by opakować globalną inicjalizację; dopóki natywna architektura jest oparta na jednej domyślnej konfiguracji, zwykła funkcja pozostaje najbardziej naturalna.
4. **Tożsamość źródła** → `src/player/sourceIdentity.ts`: `sourceIdentityKey`.
5. **Hook playera** → podział na `player/hooks/useBunnyStreamPlayer.ts`, `player/state/playerState.ts`, `player/state/playerReducer.ts`, `player/state/playerEventHandlers.ts`. Nie dzielimy każdej akcji reduktora na osobny plik — byłoby to nadmierne rozdrobnienie.
6. **API REST** → `src/api/` z podziałem `api/models/` według domen (video, liveStream, collections, statistics) i `api/result/` dla `BunnyResult` i helperów. Nie umieszczamy wszystkich typów SDK w globalnym `src/types.ts`; typ znajduje się obok domeny, do której należy.

#### `src/specs`

Specy Codegen pozostają w obecnym katalogu `src/specs/`. To wyraźna granica infrastrukturalna:

- pliki są konsumowane przez React Native Codegen;
- obowiązują w nich ograniczenia Codegen;
- nie powinny być głównym publicznym API dla użytkownika npm;
- komponenty i moduły domenowe mogą je importować, ale nie odwrotnie.

Nie przenosimy ich do `player/native/`, ponieważ `package.json` ma `"jsSrcsDir": "src/specs"` i zmiana położenia nie daje istotnej wartości, a komplikuje Codegen.

#### Feature barrels

Każda domena ma lokalny `index.ts` (`player/index.ts`, `api/index.ts`, `image/index.ts`). Zasady:

- główny `src/index.ts` importuje/re-eksportuje feature barrels;
- kod wewnątrz `player/` używa bezpośrednich importów;
- kod wewnątrz feature nie importuje własnego `index.ts`;
- feature barrels nie re-eksportują się wzajemnie.

To minimalizuje ryzyko cykli.

#### Subpath exports

Na ten moment zachowujemy jeden publiczny import:

```ts
import { BunnyStreamPlayer, BunnyStreamApi } from 'bunny-stream-react-native';
```

Gdy dojdą upload i broadcaster, można rozważyć subpath exports (`bunny-stream-react-native/api`, `bunny-stream-react-native/upload`). Wymaga to jednak zmian w `package.json.exports`, konfiguracji builder-bob, ścieżkach deklaracji TypeScript i testach `npm pack`. Nie wprowadzamy ich wyłącznie dla estetyki struktury katalogów — wewnętrzny podział nie wymaga zmiany publicznego sposobu importowania.

#### Kolejność refaktoryzacji

1. Utworzyć `player/BunnyStreamPlayer.types.ts` i przenieść typy.
2. Przenieść `sourceIdentityKey`.
3. Przenieść `initialize` i walidację do `config/`.
4. Przenieść komponent do `player/BunnyStreamPlayer.tsx`.
5. Zmienić główny entry point na cienki `src/index.ts`.
6. Podzielić `useBunnyStreamPlayer` na hook, reducer i typy.
7. Podzielić `api/types.ts` według domen.
8. Dopiero potem dodawać `upload/` i `broadcaster/`.

Każdy etap zachowuje dokładnie obecne publiczne eksporty i przechodzi:

```bash
yarn typecheck
yarn lint
yarn test
yarn prepare
npm pack --dry-run
```

Najważniejsza zasada: **katalogi według funkcji SDK, jeden cienki publiczny entry point i wyraźne oddzielenie publicznych typów od technicznych kontraktów Codegen**.

## 7. Plan implementacji

## Faza 0A — kontrakt i baseline dla prywatnych wersji SDK

Ta część Fazy 0 jest wykonywana na początku. Nie zmienia sposobu pobierania natywnych SDK.

### Zakres

1. Utworzyć automatycznie generowaną/utrzymywaną macierz capability per platform.
2. Dodać test publicznych eksportów i zgodności Codegen ↔ TypeScript.
3. Przypiąć dokładne commity obu prywatnych SDK używane przez development i CI zamknięte.
4. Zachować tymczasowe źródła zależności:
   - Android: `mavenLocal()` i snapshot z aktualnego commita SDK;
   - iOS: lokalny SwiftPM checkout wskazany przez `BUNNY_STREAM_IOS_SDK_PATH`.
5. Oznaczyć lokalne zależności i wszystkie workaroundy komentarzami `TODO`, podając warunek usunięcia.
6. Rozdzielić wymagane wersje SDK i RN od konfiguracji example, aby późniejsze przepięcie zmieniało możliwie mało miejsc.
7. Dodać buildy obu platform uruchamiane na prywatnych zależnościach w środowisku zamkniętych testów.

### Kryteria akceptacji

- Commity prywatnych SDK używane przez wrapper są jawnie zapisane.
- Android i iOS budują się z aktualnymi prywatnymi wersjami zawierającymi najnowszą logikę live.
- Każdy workaround zależny od braku publicznego API SDK ma komentarz `TODO(Android SDK)` albo `TODO(iOS SDK)`.
- W prywatnych repozytoriach nie ma żadnych zmian wykonanych w ramach rozwoju wrappera.

## Faza 1 — naprawa parytetu już wystawionego playera

### iOS VOD

1. Dodać realną emisję:
   - `onVolumeChange`;
   - `onPlaybackRateChange`;
   - `onVideoSizeChange`;
   - `onPlaybackError` albo usunąć/ujednolicić z `onError`, jeśli natywne SDK nie rozróżnia tych zdarzeń.
2. Ujednolicić semantykę `ready`, duration i pierwszej klatki.
3. Dodać cleanup wszystkich KVO, NotificationCenter i periodic time observerów.

### Live

1. Rozszerzyć mapowanie iOS, aby przenosiło countdown/trailer/offline/failure metadata już dostępne w publicznym `BunnyLiveStreamPlaybackState`.
2. Zachować `dvrEnabled` jako opcjonalne w kontrakcie RN, dopóki iOS SDK nie udostępni tej wartości w publicznym state/callbacku; oznaczyć miejsce mapowania `TODO(iOS SDK)`.
3. Udokumentować brak `onVideoSizeChange` dla live na iOS i oznaczyć bridge `TODO(iOS SDK)`; nie modyfikować iOS SDK w ramach tego planu.
4. Utrzymać bridge workaround pilnujący 1× dla live na Androidzie i objąć go testem regresyjnym. Oznaczyć `TODO(Android SDK)` z warunkiem usunięcia po publicznym wydaniu SDK gwarantującym 1× dla live/event.
5. Zmienić dokumentację ref: zamiast sugerować wspólne live commands, jawnie oznaczyć je jako VOD-only lub rozdzielić typy ref.
6. Wszystkie braki wymagające zmiany natywnego API przenieść do końcowej listy rekomendacji, bez edycji prywatnych repozytoriów.

### Testy

- iOS XCTest/host tests dla event mapping i cleanup.
- Android unit/instrumentation test race: zapisane 2× VOD → live DVR pozostaje 1× po `STATE_READY` i po rebuildzie.
- JS contract tests dla identycznych payloadów Android/iOS.
- E2E: VOD, live bez DVR, live DVR, countdown, trailer, offline, live → VOD.

## Faza 2 — brakujące read-only API i collections

Najpierw operacje bezpieczne i łatwe do testowania.

### Collections

Dodać:

- `listCollections`;
- `getCollection`;
- `createCollection`;
- `updateCollection`;
- `deleteCollection`;
- modele `VideoCollection`, `VideoCollectionList`.

### Video read API

Dodać:

- `fetchVideoHeatmap`;
- `fetchVideoHeatmapData`;
- `fetchVideoStatistics`;
- `fetchVideoResolutions`;
- `fetchVideoStorageSize`;
- modele statistics/resolution/storage.

### Live operational API

Dodać:

- `getLiveStreamStatus` / `ingestStatus`;
- `setLiveStreamThumbnail`;
- `uploadLiveStreamThumbnail`;
- `listLiveStreamThumbnails`;
- `deleteLiveStreamThumbnail`;
- model `LiveStreamThumbnail` i `LiveStreamIngestStatus`.

`regenerateStreamKey` nie wchodzi obecnie do wspólnego kontraktu, ponieważ stabilne domenowe API Androida nie ma odpowiednika. Można go dodać jako iOS-only tylko po świadomej decyzji produktowej, z jawnym typem capability/`UnsupportedPlatform`; rekomendację dodania odpowiednika na Androidzie zapisujemy w końcowej sekcji, bez modyfikowania prywatnego SDK.

### Implementacja

- Rozszerzyć `NativeBunnyStreamApi.ts`.
- Rozszerzyć Android `BunnyStreamApiModule.kt` i `BunnyApiMappers.kt`.
- Rozszerzyć iOS `BunnyStreamApiModuleImpl.swift`.
- Dodać typy i idiomatyczne overloady w `src/api`.
- Dodać testy mapperów natywnych i TS API delegation.

## Faza 3 — moduł uploadu

### Publiczny kontrakt

Dodać `NativeBunnyStreamUpload` i publiczny `BunnyStreamUpload`:

```ts
type UploadMode = 'basic' | 'tus';

type UploadEvent =
  | { type: 'started'; uploadId: string; videoId: string }
  | { type: 'progress'; uploadId: string; videoId: string; bytesUploaded: number; totalBytes: number; progress: number; pauseSupported: boolean }
  | { type: 'paused'; uploadId: string; videoId: string }
  | { type: 'completed'; uploadId: string; videoId: string }
  | { type: 'cancelled'; uploadId: string; videoId: string }
  | { type: 'failed'; uploadId: string; videoId?: string; error: BunnyError };
```

Metody:

- `startUpload({ libraryId, uri, title, collectionId, mode }) -> uploadId`;
- `continueUpload({ libraryId, videoId, uri }) -> uploadId` dla TUS;
- `pauseUpload(uploadId)`;
- `resumeUpload(uploadId)`;
- `cancelUpload(uploadId)`;
- `getUploadState(uploadId)`;
- subskrypcja eventów przez TurboModule event emitter.

### Android

- Delegować do `videoUploader` albo `tusVideoUploader`.
- Zamienić RN URI na Android `Uri` bez kopiowania całego pliku do JS.
- Kolekcjonować `Flow<UploadEvent>` w app-scoped scope.

### iOS

- Dołączyć produkt `BunnyStreamUploader` do podspec/integracji SwiftPM.
- Mapować URI/file URL/PHAsset do `VideoContent`.
- Ujednolicić tracker delegate do wspólnego `UploadEvent`.
- Jawnie opisać różnice w background upload i TUS lifecycle.

### Kryteria akceptacji

- Upload pliku >100 MB bez ładowania bajtów do pamięci JS.
- Progress po zmianie ekranu.
- Pause/resume TUS.
- Cancel kończy event stream i czyści zasoby.
- Powrót do aktywnego uploadu po ponownym zamontowaniu komponentu JS.

## Faza 4 — pełne video management API

Dodać w osobnych, małych grupach:

### Thumbnail i import

- `setThumbnail`;
- `uploadThumbnail`;
- `fetchNewVideo`;
- `refetchVideo`.

### Captions

- `addCaption`;
- `deleteCaption`;
- typ `AddCaptionRequest`.

### Encoding/storage

- `reencodeVideo`;
- `reencodeUsingCodec`;
- `repackageVideo`;
- `deleteResolutions` z obowiązkowym jawnym `dryRun` w pierwszym wywołaniu/rekomendowanym flow.

### AI

- `smartGenerate`;
- `transcribeVideo`;
- requesty i statusy smart generation/transcription.

Każda grupa powinna mieć osobny PR, mapper tests i example/debug screen. Nie należy wystawiać bezpośrednio generated OpenAPI client iOS jako publicznego API TS.

## Faza 5 — camera upload / live broadcaster

### Publiczny komponent

Dodać `BunnyStreamBroadcaster` jako Fabric Native Component, nie jako funkcję przesyłającą klatki przez JS.

Props:

- source: nowy recording albo istniejący live stream;
- `libraryId`, `streamId?`;
- quality: resolution, FPS, video bitrate, audio bitrate;
- camera position;
- auto-start opcjonalny;
- style i permission fallback hooks.

Komendy ref:

- `startBroadcast`;
- `stopBroadcast`;
- `switchCamera`;
- `mute`;
- `unmute`/`toggleMute`.

Eventy:

- state: idle/preparing/live;
- elapsed time;
- mute/camera state;
- reconnecting/reconnectFailed;
- primary/backup ingest status;
- failover;
- terminal error;
- permissions status.

### Android

- Dołączyć moduł `net.bunny:recording`.
- Hostować `StreamCameraUploadView`.
- Zmapować `RecordingStateListener`, duration i reconnect/ingest state.

### iOS

- Dołączyć `BunnyStreamCameraUpload`.
- Hostować `BunnyStreamCameraUploadView`.
- Użyć publicznego `BunnyBroadcastController` do komend i eventów.

### Kryteria akceptacji

- Permission flow bez natywnego crasha.
- Start/stop i poprawne zakończenie streamu po stronie Bunny.
- Front/back camera i mute.
- Reconnect oraz failover primary/backup.
- Background/interruption policy jawnie zgodna z platformą.

## Faza 6 — rozszerzone sterowanie playerem

### Wspólne rozszerzenia możliwe bez zmian SDK

- komendy `skipForward` i `skipBackward`/`replay` dla VOD;
- eventy/dane chapters, moments, retention graph;
- query/state dla dostępnych playback speeds;
- informacje o aktywnej jakości, napisach i audio tracku, jeśli natywne publiczne callbacki są dostępne;
- jawne eventy wejścia/wyjścia fullscreen, PiP i cast/AirPlay, jeśli SDK je publikuje.

### Funkcje wymagające wspólnego publicznego API w natywnych SDK

- live play/pause/seek/jump-to-live;
- live current position, seekable window i `isAtLiveEdge`;
- wspólne resume-position API;
- programowy wybór jakości/napisów/audio;
- jednolity watermark i custom icon model.

Dopóki oba SDK nie mają stabilnych publicznych controllerów, nie należy opierać produkcyjnego bridge'a na internal `MediaPlayer`, reflection ani wyszukiwaniu prywatnych widoków.

### Proponowany podział ref

```ts
type BunnyVodPlayerRef = {
  play(): void;
  pause(): void;
  seekTo(positionMs: number): void;
  skipForward(): void;
  skipBackward(): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  mute(): void;
  unmute(): void;
};

type BunnyLivePlayerRef = {
  // Dodać dopiero po udostępnieniu publicznego native controllera.
};
```

Pozwoli to usunąć obecne ciche no-op dla live na poziomie typów.

## Faza 7 — obrazy, TV i platform integrations

### Bunny images

Zastąpić lub uzupełnić `useBunnyImage` rozwiązaniem korzystającym z natywnego cache:

- `BunnyImage` Fabric component; albo
- helper zwracający source z headers, jeśli aktualne wersje RN niezawodnie wspierają nagłówki na obu platformach.

Wymagania: Referer, cancel, cache, resize, placeholder/error, brak base64 dla list.

### Android TV

Android TV jest modułem platformowym, bez odpowiednika iOS. Możliwe warianty:

1. pozostawić automatyczne `playVideoWithTVDetection` jako zachowanie Android-only;
2. dodać jawny prop `useNativeTvPlayer` i event powrotu z TV activity;
3. nie dołączać `:tv` do mobile artifact, jeśli zwiększa rozmiar paczki bez potrzeby.

Decyzję należy podjąć na podstawie docelowego zakresu produktu RN (mobile-only vs mobile+TV).

### Cast/PiP/fullscreen

Natywne przyciski już działają. Programowe komendy i eventy powinny zostać dodane dopiero po zdefiniowaniu wspólnej semantyki:

- Android Chromecast vs iOS AirPlay;
- lifecycle PiP;
- orientation i presentation fullscreen.

## Faza 0B — końcowe przepięcie na publiczne SDK i przygotowanie release

Ta część Fazy 0 jest wykonywana **jako ostatni element całego planu**, dopiero po publicznym wydaniu obu natywnych SDK. Do tego czasu wrapper pozostaje na przypiętych prywatnych wersjach z zamkniętych testów.

### Zakres

1. Android:
   - zastąpić `mavenLocal()` i `4.0.0-live.shadow.1-SNAPSHOT` oficjalnymi współrzędnymi oraz wersją publicznego Maven artifact;
   - usunąć lokalne repozytorium z wymaganej konfiguracji konsumenta;
   - zweryfikować, że publiczny artifact zawiera tę samą lub nowszą logikę live niż testowany commit prywatny.
2. iOS:
   - zastąpić lokalny `ios_sdk_path`/`BUNNY_STREAM_IOS_SDK_PATH` oficjalnym tagowanym SwiftPM URL albo oficjalnym binarnym artifactem;
   - podpiąć publiczne produkty wymagane przez player, API, uploader i camera upload;
   - zweryfikować zgodność publicznej wersji z testowanym commitem prywatnym.
3. Usunąć wyłącznie te workaroundy `TODO`, których warunki zostały spełnione przez publiczne wydania; pozostałe zachować i udokumentować.
4. Uruchomić pełny regression suite na publicznych paczkach, ze szczególnym uwzględnieniem live/DVR, live → VOD, uploadu i broadcastu.
5. Wykonać `npm pack` i instalację tarballa w dwóch czystych aplikacjach konsumenckich (Android/iOS), bez dostępu do prywatnych repozytoriów.
6. Dopiero po przejściu clean-consumer tests opublikować paczkę React Native.

### Kryteria akceptacji

- Żaden build release ani aplikacja konsumencka nie wymaga `mavenLocal()`.
- Żaden build release ani aplikacja konsumencka nie wymaga `BUNNY_STREAM_IOS_SDK_PATH` ani lokalnego checkoutu.
- Publiczne wersje SDK są jawnie przypięte i spełniają contract/regression tests.
- `npm pack` jest samowystarczalny z punktu widzenia konsumenta.
- README opisuje minimalne publiczne wersje SDK i wymagania platformowe.

## 8. Kolejność rekomendowana

1. **Faza 0A** — baseline, przypięcie commitów prywatnych SDK, testy kontraktu i oznaczenie workaroundów.
2. **Faza 1** — naprawa obiecanego już API playera i parytetu Android/iOS w samym wrapperze.
3. **Faza 2** — collections i bezpieczne read-only API dostępne przez obecne publiczne interfejsy SDK.
4. **Faza 3** — upload, ponieważ jest osobnym pełnym modułem obecnym w obu SDK i kluczową luką produktową.
5. **Faza 4** — pozostałe management API możliwe bez zmian w prywatnych SDK.
6. **Faza 5** — camera/live broadcaster.
7. **Faza 6** — rozszerzone sterowanie playerem; elementy wymagające nowego native API pozostają odłożone.
8. **Faza 7** — obrazy, TV i dodatkowe integracje platformowe.
9. **Faza 0B** — po wydaniu Android/iOS: jako ostatni krok przepięcie na publiczne paczki, clean-consumer tests i release RN.

## 9. Strategia PR-ów

Nie implementować całego planu w jednym PR. Zalecany podział:

1. `test: pin private native SDK baselines and capability contract`;
2. `fix(ios): complete VOD event contract`;
3. `fix(live): align Android and iOS live state payloads`;
4. `feat(api): add collections`;
5. `feat(api): add video insights and live ingest status`;
6. `feat(upload): add basic upload module`;
7. `feat(upload): add resumable TUS controls`;
8. `feat(api): add thumbnails and captions`;
9. `feat(api): add encoding and AI operations`;
10. `feat(broadcast): add native camera broadcaster`;
11. `feat(player): add advanced VOD events and commands`;
12. `feat(image): add cached Bunny image component`;
13. opcjonalnie `feat(android-tv): add TV integration`;
14. **ostatni PR po wydaniu SDK:** `build: switch to public Android and iOS SDK packages`.

Każdy PR powinien zawierać:

- Codegen spec;
- implementację Android i iOS albo jawne uzasadnienie platform-only;
- typy i publiczny wrapper TypeScript;
- testy TS;
- testy mapperów/lifecycle po stronie natywnej;
- przykład użycia w `example`;
- aktualizację README i capability matrix.

## 10. Definition of Done całego wrappera

Wrapper można uznać za kompletny, gdy:

- wszystkie wspólne publiczne funkcje natywnych SDK mają stabilny odpowiednik TypeScript;
- różnice platformowe są jawne w typach i dokumentacji;
- nie ma cichych no-op poza funkcjami oznaczonymi jako best-effort;
- Android i iOS emitują zgodne event payloads;
- upload basic i TUS działa bez kopiowania pliku przez JS;
- camera broadcaster korzysta wyłącznie z natywnego pipeline'u;
- VOD/live zachowują natywne DRM, ads, captions, quality, cast/AirPlay, PiP i fullscreen;
- paczka instaluje się w czystym projekcie bez prywatnych lokalnych repozytoriów;
- example demonstruje VOD, live/DVR, API, upload i broadcasting;
- CI uruchamia typecheck, lint, Jest, Android unit/build, iOS build/tests oraz clean-consumer install;
- ostatnim wykonanym krokiem było przepięcie na publiczne wydania Android/iOS zgodnie z Fazą 0B.

## 11. Podsumowanie zmian potrzebnych docelowo w natywnych SDK

Ta sekcja jest backlogiem dla właścicieli `bunny-stream-android-private` i `bunny-stream-ios-private`. **Nie wolno realizować tych zmian w natywnych repozytoriach w ramach obecnego planu wrappera.** Do czasu wydania odpowiednich API bridge RN używa oznaczonych workaroundów albo nie wystawia danej funkcji.

### Android SDK

1. Zagwarantować na poziomie playera, że `LIVE` i `EVENT` startują oraz pozostają na `1×` i nie przywracają prędkości zapamiętanej z VOD. Pozwoli to usunąć polling `currentPlayer.playbackParameters` z bridge'a RN.
2. Udostępnić stabilny publiczny controller live: play, pause, seek w DVR, jump-to-live, current position, seekable window i `isAtLiveEdge`.
3. Udostępnić callback/Flow informujący o utworzeniu i wymianie aktywnego playera zamiast wymagania pollingu singletona `DefaultBunnyPlayer.currentPlayer`.
4. Rozważyć controller/instancję playera niezależną od globalnego singletonu, aby wiele widoków mogło mieć jawne ownership bez bridge'owego `BunnyPlayerLease`.
5. Dodać `regenerateStreamKey` do stabilnego domenowego `LiveStreamRepository`, jeśli funkcja ma wejść do wspólnego API RN.
6. Ujednolicić publiczne eventy dla quality, subtitles, audio tracks, fullscreen, PiP i cast, jeśli mają być programowalnie dostępne w RN.
7. Udostępnić stabilny, cache'owany loader Bunny CDN z wymaganym Refererem, jeśli ma być współdzielony przez wrapper.

### iOS SDK

1. Udostępnić publiczny VOD controller lub publiczne callbacki/delegate dla playback state, progress, buffering, volume, rate, video size i playback errors. Pozwoli to usunąć wyszukiwanie wewnętrznego `AVPlayerLayer` oraz KVO wykonywane przez bridge RN.
2. Rozszerzyć publiczny live state/callback o `dvrEnabled`, video size, seekable window, current position i stan live edge.
3. Udostępnić publiczny live controller: play, pause, DVR seek i jump-to-live.
4. Udostępnić stabilne domenowe `VideoRepository` i `CollectionRepository`, analogiczne do `LiveStreamRepository`, aby wrapper nie musiał mapować wygenerowanych typów OpenAPI.
5. Rozważyć wspólne resume-position API zgodne funkcjonalnie z Androidem.
6. Ujednolicić publiczne eventy dla quality, subtitles, audio tracks, fullscreen, PiP i AirPlay, jeśli mają być programowalnie dostępne w RN.
7. Udostępnić natywny, cache'owany sposób ładowania Bunny CDN image z Refererem jako publiczny element SDK.

### Wspólne oczekiwania wobec przyszłych wydań

- zachować stabilność publicznych kontraktów używanych przez Codegen bridge;
- dokumentować minimalną wersję zawierającą każdą poprawkę usuwającą workaround;
- zapewnić zgodną semantykę live/DVR oraz event payloadów na obu platformach;
- nie wymagać od wrappera dostępu do internal/private playerów;
- przed usunięciem komentarza `TODO(... SDK)` potwierdzić poprawkę testem regresyjnym na publicznym artifactcie.
