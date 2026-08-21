# Plan: rozszerzenie Android playera RN o funkcje z prywatnego SDK 4.0.0

## 1. Cel i zakres

Celem jest rozszerzenie istniejącej biblioteki `bunny-stream-react-native` o nowe funkcje playera dostępne na `origin/feature/live_streams` w `bunny-stream-android-private`, przy zachowaniu cienkiego bridge'a React Native.

Pierwszy zakres obejmuje:

- migrację istniejącego playera VOD z Android SDK 3.3.0 do 4.0.0;
- użycie nowych publicznych API SDK przeznaczonych dla custom controls;
- dodanie odtwarzacza live;
- natywne UI oraz możliwość wyłączenia go i zbudowania kontrolek w React Native;
- zachowanie stabilnego, typowanego API TypeScript.

Poza zakresem są: REST API do zarządzania biblioteką, lista/create/update/start/stop live streamów, upload, kamera, Android TV i implementacja iOS.

## 2. Zweryfikowane źródło zmian

- Lokalna ścieżka prywatnego SDK: `/Users/apple/Desktop/bunny-stream-android-private`.
- Aktualna biblioteka RN jest na gałęzi `player-state`.
- Obecny bridge używa `net.bunny:player:3.3.0` i `net.bunny:api:3.3.0`.
- Docelowy kod znajduje się na `origin/feature/live_streams`, obecnie commit `fb86350`.
- Gałąź live ma 122 commity ponad `main` i jest przygotowywana jako niewydane SDK 4.0.0.
- Publiczny artefakt SDK z live ma być dostępny przed wydaniem npm za około 6 tygodni.
- Development może korzystać z lokalnego snapshotu przypiętego do commita; paczka npm musi przed publikacją przejść na publiczny artefakt Maven.

Finalna implementacja musi zostać ponownie porównana z wydanym tagiem SDK — gałąź nadal może zmienić publiczne API.

## 3. Aktualny stan biblioteki RN

### Publiczne API

Istnieje jeden komponent `BunnyStreamPlayer` dla VOD z propsami:

- `videoId`, opcjonalne `libraryId`, `token`, `expires`;
- `autoPlay`;
- `controls`.

Ref udostępnia:

- `play()`;
- `pause()`;
- `seekTo(positionMs)`;
- `setVolume(volume)`;
- `setPlaybackRate(rate)`.

Eventy obejmują ready, playback state, progress, error, buffering, play, pause, end, volume i playback rate.

`useBunnyStreamPlayer`:

- agreguje stan niskiej częstotliwości;
- trzyma progress osobno, aby ograniczyć rerendery;
- zapewnia stabilne handlery i obiekt komend;
- resetuje stan po zmianie `videoId`;
- ma testy reducerów, handlerów i stabilności referencji.

### Bridge Android

Obecna implementacja ma wartościowe mechanizmy, które należy zachować:

- Fabric Native Component i Codegen;
- snapshot propsów oraz rozróżnienie zmiany źródła od zmiany UI;
- `GenerationToken` chroniący przed starymi callbackami;
- `CommandQueue` dla komend przed ready;
- idempotentny cleanup;
- `BunnyPlayerLease` dla pojedynczego silnika SDK;
- testowalna maszyna stanów Kotlin;
- coalescing eventów progress.

Jednocześnie bridge 3.3.0 posiada obejścia, które po migracji powinny zniknąć:

- podpina `Player.Listener` bezpośrednio do `DefaultBunnyPlayer.currentPlayer`;
- odpytuje singleton co 100 ms, aby znaleźć nowy Media3 player;
- sam odpytuje Media3 o progress;
- wyłącza kontrolki przez wyszukiwanie wewnętrznego `PlayerView` i ustawienie `useController`;
- odwołuje się do wewnętrznych resource ID SDK;
- ręcznie naprawia layout pola `exo_position`;
- ustawia volume i speed przez singleton zamiast publicznego widoku.

Te zależności od implementacji Media3 zwiększają ryzyko przy aktualizacji z 1.6.0 do 1.10.1.

### Example app

Example ma już:

- VOD z natywnymi kontrolkami;
- VOD z `controls={false}`;
- referencyjne JS controls: play/pause, seek ±10 s, progress i loading/error;
- konfigurację library ID i access key.

Nie ma live ani pełnego zestawu custom controls.

## 4. Nowe możliwości SDK 4.0.0 istotne dla playera

### VOD i wspólna warstwa playbacku

SDK dodaje publicznie:

- `BunnyStreamPlayer.controlsEnabled`;
- `onVideoSizeChanged`;
- `onPlaybackError`;
- `compactControls`;
- `onPlayingChanged`;
- `onMutedChanged`;
- `onLoadingChanged`;
- `onPlaybackSpeedChanged`;
- `onChaptersUpdated`;
- `onMomentsUpdated`;
- `onRetentionGraphUpdated`;
- `onPlayerTypeChanged`;
- `playbackSpeed`;
- `getPlaybackSpeeds()`;
- `isMuted()`, `mute()`, `unmute()`;
- DASH w silniku;
- Chromecast i Picture-in-Picture w natywnym UI.

`BunnyStreamPlayer.playVideo(videoId, ...)` pozostaje normalnym wejściem VOD.

### Live

SDK dodaje publiczny composable `BunnyLiveStreamPlayer`, który przyjmuje:

- `libraryId`;
- `streamId`;
- opcjonalne `token` i `expires`;
- `onVideoSizeChanged`;
- opcjonalną instancję `StreamApi`;
- opcjonalny `BunnyLiveStreamPlayerViewModel`.

Natywny live player obsługuje wewnątrz SDK:

- polling;
- loading/offline;
- countdown;
- trailer;
- automatyczne wejście w live;
- DVR i jump-to-live w natywnych kontrolkach;
- recovery po błędzie;
- przejście do nagrania VOD;
- lifecycle foreground/background;
- konfigurację wyglądu i kontrolek z dashboardu.

### Zmiany migracyjne

- `compileSdk >= 36`;
- Kotlin `>= 2.1`;
- JDK 17;
- `minSdk 26`;
- wymagany core library desugaring;
- Media3 1.10.1;
- lifecycle 2.10.0;
- `BunnyStreamApi.initialize` wymaga niepustego, nienullowalnego access key;
- SDK wspiera instancje `StreamApi`, ale dotychczasowy default instance nadal działa.

## 5. Docelowe publiczne API React Native

### Jeden komponent publiczny

Publicznie zachować jeden komponent `BunnyStreamPlayer` dla VOD i live. Podział Android SDK na klasyczny `View` oraz composable jest szczegółem implementacyjnym i nie powinien przenikać do wieloplatformowego API npm.

Źródło powinno być opisane przez TypeScript discriminated union:

```ts
type BunnyStreamSource =
  | {
      type: 'vod';
      videoId: string;
      libraryId?: number;
      token?: string;
      expires?: number;
    }
  | {
      type: 'live';
      streamId: string;
      libraryId: number;
      token?: string;
      expires?: number;
    };
```

Przykładowe użycie:

```tsx
<BunnyStreamPlayer source={{ type: 'vod', videoId }} />

<BunnyStreamPlayer
  source={{ type: 'live', streamId, libraryId }}
/>
```

Union uniemożliwia podanie `videoId` i `streamId` jednocześnie. Dla live `libraryId` pozostaje wymagane, zgodnie z natywnym composable.

Ponieważ pakiet nie został jeszcze publicznie wydany, można zastąpić obecne płaskie propsy źródła przez `source` bez warstwy deprecated. Jeżeli przed migracją pojawią się konsumenci, dodać czasowy adapter dla dotychczasowego `videoId`.

### Dwie implementacje wewnętrzne Androida

Pod jednym komponentem React mogą pozostać dwa wewnętrzne hosty Codegen/Fabric:

- VOD → istniejący `BunnyStreamPlayerView` opakowujący natywny Android `BunnyStreamPlayer`;
- live → wewnętrzny `BunnyLiveStreamPlayerView` hostujący `ComposeView` z natywnym composable.

Warstwa TypeScript wybiera właściwy host na podstawie `source.type`. Zmiana `vod ↔ live` powoduje kontrolowany remount natywnego hosta, cleanup poprzedniego źródła i reset hooka. Nazwa `BunnyLiveStreamPlayer` nie jest eksportowana z publicznego API npm.

Wewnętrzne specy Codegen mogą nadal używać płaskich propsów (`videoId` albo `streamId`), ponieważ React Native Codegen nie musi odwzorowywać publicznego unionu. Publiczny wrapper odpowiada za bezpieczne rozpakowanie `source` do właściwego hosta.

### Wspólny kontrakt sterowania

Docelowy ref bazowy:

- `play()`;
- `pause()`;
- `seekTo(positionMs)`;
- `setVolume(volume)`;
- `mute()`;
- `unmute()`;
- `setPlaybackRate(rate)`.

Live DVR powinien dodatkowo dostać `jumpToLive()`, ale dopiero gdy publiczne SDK wystawi taką komendę hostowi.

Wspólny stan powinien obejmować:

- playback state;
- playing;
- buffering;
- position i duration;
- volume i muted;
- playback rate;
- video size;
- error.

Stan specyficzny dla live:

- `liveState: loading | offline | countdown | trailer | live | vod`;
- informacja, czy DVR jest aktywny;
- informacja, czy player jest na live edge;
- cel countdown, jeśli SDK zdecyduje się wystawić go hostowi.

Nie tworzyć tych wartości heurystycznie w JavaScript — mają pochodzić z publicznego stanu SDK.

### Native i custom controls

Oba tryby jednego komponentu muszą obsługiwać:

- `controls={true}` — UI natywne;
- `controls={false}` — powierzchnia playbacku bez chrome, sterowana przez RN.

Custom controls pozostawiają w SDK: DRM, wybór źródła, telemetry, polling live, recovery i lifecycle.

## 6. Blokada w aktualnym API live SDK

Aktualny `BunnyLiveStreamPlayer` z gałęzi prywatnej:

- nie przyjmuje `controlsEnabled`;
- ukrywa wewnętrzny `BunnyStreamPlayer` w prywatnym `BunnyPlayerSurface`;
- nie wystawia komend playbacku;
- nie przekazuje callbacków playing/buffering/muted/progress/error;
- udostępnia stan streamu przez ViewModel, ale nie kontroler powierzchni playbacku.

Dlatego kompletne custom controls live nie mogą być zrealizowane jako cienki bridge wyłącznie na obecnym publicznym API.

Wymagana zmiana przed integracją custom live UI po stronie Android SDK:

- publiczny `BunnyLiveStreamPlayerController` lub równoważny stabilny interfejs;
- `controlsEnabled`/override dla composable;
- komendy play, pause, seek, jump-to-live, mute/unmute i playback rate tam, gdzie wspierane;
- obserwowalny playback state i progress;
- publiczny stan DVR/live-edge;
- publiczny stan prezentacji live;
- stabilna tożsamość kontrolera podczas rekompozycji i poprawny cleanup.

Nie stosować refleksji, prywatnych pól, globalnego `currentPlayer` ani kopii resolvera/pollingu w TypeScript.

Jeżeli finalne SDK nie dostarczy tego kontraktu, pierwsze wydanie może dostarczyć live wyłącznie z natywnym UI albo termin wydania custom-live musi zostać przesunięty. Nie oznaczać custom-live jako wspieranego częściowo.

## 7. Plan implementacji

### Faza 0 — przypięcie lokalnego SDK

- [ ] Przypiąć snapshot do `fb86350` lub nowszego jawnie wybranego commita.
- [ ] Opublikować lokalnie `api` i `player` z wersją zawierającą short SHA, np. `4.0.0-live.fb86350-SNAPSHOT`.
- [ ] Nie używać domyślnego `1.0.0-SNAPSHOT`.
- [ ] Dodać developerskie rozwiązanie `mavenLocal()` lub composite build bez wpływu na konfigurację wydania npm.
- [ ] Zapisać diff snapshotu względem 3.3.0 oraz procedurę aktualizacji snapshotu.

### Faza 1 — migracja builda i inicjalizacji

- [ ] Podbić zależności do snapshotu SDK 4.0.0.
- [ ] Włączyć core library desugaring również w module biblioteki, nie tylko example app.
- [ ] Dodać `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")`.
- [ ] Ujednolicić bezpośrednio importowane Media3 do 1.10.1 i lifecycle do 2.10.0.
- [ ] Sprawdzić minimalną kompatybilną wersję AGP/Gradle dla React Native 0.86 i SDK 4.0.0; nie kopiować bez potrzeby toolchainu repo SDK do biblioteki RN.
- [ ] Zmienić Codegen/TurboModule `initialize(accessKey: string, libraryId: number)` na nienullowalny access key.
- [ ] Walidować pusty access key i library ID przed wywołaniem SDK.
- [ ] Zaktualizować example, który obecnie przekazuje `null` dla pustego klucza.
- [ ] Nie dodawać jeszcze wieloinstancyjnego API `BunnyStreamApi.create`; obecny zakres może pozostać przy default instance.

### Faza 2 — migracja VOD bez regresji

- [ ] Zachować obecny komponent, props snapshot, source key, generation token, command queue i cleanup.
- [ ] Zastąpić ręczne `findPlayerView()/useController` przez `player.controlsEnabled`.
- [ ] Usunąć ręczną naprawę `exo_position`, jeśli layout 4.0.0 działa poprawnie pod Fabric; najpierw potwierdzić testem wizualnym.
- [ ] Podłączyć publiczne callbacki SDK: playing, muted, loading, speed, error i video size.
- [ ] Użyć `BunnyPlayer.ProgressListener` do progress zamiast własnego pollingu Media3.
- [ ] Zachować mały adapter Media3 tylko dla brakujących semantyk ready/end/buffering, jeżeli publiczne callbacki SDK nie wystarczą.
- [ ] Nie traktować `onLoadingChanged` jako buffering bez testu — dokumentacja SDK ostrzega, że callback występuje również podczas płynnego playbacku.
- [ ] Sterować speed oraz mute przez publiczny `BunnyStreamPlayer`.
- [ ] Ocenić volume: jeśli SDK nadal nie udostępnia setter/getter na widoku, ograniczyć użycie singletonu do odizolowanego adaptera.
- [ ] Zachować dotychczasowe nazwy eventów, jeśli ich semantyka nie ulega zmianie.
- [ ] Dodać `onVideoSizeChange`, `onMutedChange` oraz ewentualnie `onPlayerTypeChange`.
- [ ] Dopiero po realnym use case dodać rozbudowane payloady chapters, moments i retention graph; nie zwiększać pierwszego kontraktu bez konsumenta.

### Faza 3 — kompletne custom controls VOD

- [ ] Zachować `controls={false}`, ale mapować je na oficjalne `controlsEnabled=false`.
- [ ] Dodać komendy `mute` i `unmute`.
- [ ] Ustalić, czy `setVolume` pozostaje częścią wspólnego API Android/iOS.
- [ ] Dodać aktualną listę playback speeds tylko wtedy, gdy da się ją bezpiecznie dostarczyć eventem albo metodą asynchroniczną.
- [ ] Rozszerzyć hook o video size i stan mute pochodzący z oficjalnych callbacków.
- [ ] Zapewnić synchronizację custom UI po natywnym lifecycle, błędzie, zmianie prędkości i przejściu na Chromecast.
- [ ] Nie obiecywać w custom UI przycisków fullscreen/PiP/cast, dopóki Android SDK nie udostępnia publicznych komend do ich uruchomienia.

### Faza 4 — natywny live player w Fabric

- [ ] Dodać wewnętrzny spec Codegen i `BunnyLiveStreamPlayerViewManager`; nie eksportować ich jako osobnego komponentu publicznego.
- [ ] Utworzyć wrapper `FrameLayout` zawierający jeden `ComposeView`.
- [ ] Renderować w nim SDK-owy `BunnyLiveStreamPlayer`, bez reimplementacji pollingu i stanów.
- [ ] Propagować `LifecycleOwner`, `ViewModelStoreOwner` i `SavedStateRegistryOwner` z host Activity.
- [ ] Dobrać `ViewCompositionStrategy` odporną na przejściowy detach/reattach Fabric.
- [ ] Props źródła: `libraryId`, `streamId`, `token`, `expires`.
- [ ] Dodać `onVideoSizeChange`.
- [ ] Zdefiniować source key oraz poprawne odtworzenie ViewModelu po zmianie streamu — obecny ViewModel ignoruje drugi `start()`.
- [ ] Na unmount zakończyć kompozycję, obserwację lifecycle, polling i playback.
- [ ] Dodać manager do `BunnyStreamPlayerPackage`.

### Faza 5 — custom controls live

- [ ] Najpierw wprowadzić wymagany publiczny controller/state do Android SDK.
- [ ] Przekazać controller do composable w sposób zgodny z jego finalnym API.
- [ ] Przekazać wspólny publiczny prop `controls?: boolean` do wewnętrznego live Codegen.
- [ ] Mapować controller na ref commands RN.
- [ ] Emitować playback/live state z publicznego źródła SDK.
- [ ] Dodać `jumpToLive()` oraz jawne informacje o DVR/live edge.
- [ ] Zdefiniować zachowanie komend dla offline/countdown/trailer i przejścia live → VOD.
- [ ] Zachować overlaye statusów SDK nawet przy custom controls, chyba że finalne SDK jawnie wspiera ich zastępowanie.

### Faza 6 — TypeScript i hooki

- [ ] Dodać publiczny `BunnyStreamSource` jako discriminated union VOD/live.
- [ ] Zachować jeden eksport `BunnyStreamPlayer`, który wybiera wewnętrzny host na podstawie `source.type`.
- [ ] Zachować jeden `BunnyStreamPlayerRef`; komendy niedostępne w danym stanie/trybie muszą mieć jawnie zdefiniowaną semantykę.
- [ ] Zachować wspólne typy playbacku bez nazw Media3.
- [ ] Zachować jeden `useBunnyStreamPlayer`, rozszerzony o `sourceType` i typowany podstan live; nie dodawać osobnego publicznego hooka tylko dlatego, że Android używa Compose.
- [ ] Resetować hook po zmianie identity źródła (`type + videoId/streamId + libraryId + token + expires`), nie dopiero po `onReady`.
- [ ] Typować `onPlaybackStateChange.state` unionem zamiast `string`.
- [ ] Współdzielić typy payloadów między Codegen, propsami i hookami zamiast deklarować je trzykrotnie.
- [ ] Walidować liczby JS przed konwersją do Long: dodatni library ID, nieujemne `expires` i position.
- [ ] Zachować rozdzielenie high-frequency progress od pozostałego stanu.

### Faza 7 — example app

- [ ] Zachować oba istniejące ekrany VOD.
- [ ] Rozszerzyć custom VOD UI o mute/unmute, speed, video aspect ratio i poprawną synchronizację stanu.
- [ ] Dodać live z natywnymi kontrolkami przez ten sam publiczny `BunnyStreamPlayer` i `source.type='live'`.
- [ ] Dodać live z custom controls przez ten sam komponent po udostępnieniu controllera SDK.
- [ ] Dodać wejścia dla `streamId`, `libraryId`, `token` i `expires`.
- [ ] Pokazać pionowy live przez dynamiczny aspect ratio.
- [ ] Nie dodawać listy ani zarządzania streamami.
- [ ] Nie umieszczać access key ani tokenów w repo.

### Faza 8 — testy

#### Jednostkowe

- [ ] Zaktualizować Kotlin state mapping do callbacków SDK 4.0.0.
- [ ] Zachować testy command queue, generation token i lease.
- [ ] Dodać testy source key VOD/live i resetu po zmianie źródła.
- [ ] Dodać testy mapowania live state oraz DVR.
- [ ] Dodać testy hooka live, stabilności handlerów i resetu po zmianie streamu.
- [ ] Testować walidację access key/library ID/position/rate/volume.

#### Integracyjne Android

- [ ] VOD native controls i custom controls.
- [ ] Publiczny i token-secured VOD.
- [ ] Live: offline, countdown, trailer, running, DVR, recovery i VOD po zakończeniu.
- [ ] Publiczny i token-secured live.
- [ ] Zmiana `videoId` i `streamId` bez starych callbacków/pollingu.
- [ ] Background/foreground, rotacja, fullscreen, PiP i Chromecast dla natywnego UI.
- [ ] Mount/unmount oraz brak wycieków Compose/ViewModel/player.
- [ ] Zachowanie przy dwóch playerach; potwierdzić i udokumentować ograniczenie jednego aktywnego silnika.
- [ ] Debug i release z R8.

#### Dystrybucja

- [ ] Codegen, TypeScript, Jest i testy Kotlin.
- [ ] Build example debug/release.
- [ ] `npm pack --dry-run`.
- [ ] Instalacja tarballa w czystym projekcie RN New Architecture.
- [ ] Finalny test bez prywatnego repo, composite build i `mavenLocal()`.

### Faza 9 — przejście na publiczne SDK i publikacja

- [ ] Zapisać finalny tag oraz wersje Maven SDK z live.
- [ ] Porównać tag z używanym snapshotem i uwzględnić różnice.
- [ ] Zamienić snapshot na publiczne artefakty.
- [ ] Usunąć lokalne repozytoria z konfiguracji dystrybucyjnej.
- [ ] Opisać macierz kompatybilności npm ↔ Android SDK ↔ React Native ↔ Android API.
- [ ] Udokumentować osobno native i custom controls dla VOD/live.
- [ ] Udokumentować wymagania Android 4.0.0 i ograniczenie jednego aktywnego playera.
- [ ] Opisać bezpieczne użycie access key oraz embed token/`expires`.
- [ ] Nie publikować npm, dopóki czysta aplikacja nie pobiera wszystkich zależności z publicznych repozytoriów.

## 8. Kolejność priorytetów

1. Migracja builda i VOD do SDK 4.0.0.
2. Usunięcie prywatnych obejść Media3 na rzecz oficjalnego API custom controls.
3. Live z natywnym UI przez `ComposeView`.
4. Publiczny controller/state dla live w Android SDK.
5. Custom controls live.
6. Finalny artefakt Maven, test tarballa i publikacja npm.

Ta kolejność pozwala niezależnie zweryfikować regresje VOD, ryzyka Compose/Fabric oraz brakujące API custom-live.

## 9. Kryteria zakończenia

Zmiana jest gotowa, gdy:

1. VOD działa na publicznym SDK 4.0.0 bez regresji;
2. VOD custom controls używają publicznego API SDK zamiast wewnętrznego `PlayerView`;
3. live zachowuje natywny polling, countdown, trailer, DVR, recovery i live → VOD;
4. użytkownik może wyłączyć natywne UI i zbudować custom controls dla VOD i live;
5. custom-live nie używa refleksji, singletonowego `currentPlayer` ani duplikacji resolvera w JS;
6. lifecycle Fabric/Compose i zmiana źródła nie pozostawiają starego playera ani pollingu;
7. publiczne API TypeScript jest typowane i nie ujawnia Media3;
8. paczka instaluje się w czystym projekcie bez dostępu do prywatnego repo;
9. dokumentacja opisuje wyłącznie rzeczywiście dostępne funkcje i ograniczenia.
