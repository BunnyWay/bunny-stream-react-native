# Plan: Android player bridge

## Cel i zakres

Zaimplementować androidową część komponentu `BunnyStreamPlayerView` dla React Native New Architecture: opakować natywny `net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer` z modułu Gradle `net.bunny:player`, odwzorować istniejący kontrakt Codegen (props, komendy i zdarzenia) oraz zapewnić poprawny layout i lifecycle pod Fabric. Publiczne API JS/TS poza koniecznymi eksportami nie powinno być w tym zadaniu rozszerzane.

Poza MVP zidentyfikowano konkretne zapotrzebowanie klienta (mobile micro-drama) na **headless player z pełnym custom UI i podstawowym DRM** — patrz sekcja 11. Ten wymóg nie jest realizowany w obecnym zakresie zadania, ale kontrakt Codegen (komendy + eventy) jest od początku projektowany tak, by nie wymagał zmiany API po jego dodaniu.

## Stan wyjściowy i ustalenia

- Repozytorium jest szkieletem biblioteki; nie ma jeszcze katalogu `android/` ani natywnego bridge'a. README wprost opisuje bridge Android jako planowany.
- Kontrakt istnieje już w `src/specs/BunnyStreamPlayerNativeComponent.ts`: props `videoId`, `libraryId`, `token`, `expires`, `autoPlay`; komendy `play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`; dziesięć direct events.
- `src/specs/NativeBunnyStreamPlayer.ts` definiuje także wymagane `initialize(accessKey, libraryId)`, bez którego natywny player nie odtworzy filmu.
- Example używa React Native 0.86.2, Fabric i Hermes (`newArchEnabled=true`), więc będzie głównym środowiskiem integracyjnym.
- Oficjalny artefakt playera to `net.bunny:player`; należy przypiąć konkretną, zweryfikowaną wersję (obecnie 3.3.0), a nie używać `latest.release`.
- Bunny Android SDK wymaga minimum API 26, podczas gdy example ma obecnie `minSdkVersion = 24`; trzeba świadomie podnieść minimum Android projektu/example do 26 i udokumentować tę zmianę.
- `BunnyStreamPlayer` sam obsługuje attach/detach i obserwuje `ViewTreeLifecycleOwner`, ale korzysta z singletonu `DefaultBunnyPlayer`. Singleton ma tylko jeden slot `playerStateListener`, który jest **zajmowany przez wewnętrzny `BunnyPlayerView` SDK** — setter `bunnyPlayer` przypisuje tam listener kontrolek UI przy każdym `initializeVideo` i przy wejściu/wyjściu z fullscreen. Bridge nie może więc używać `PlayerStateListener` (konflikt występuje już przy jednym widoku RN); zamiast tego musi rejestrować własny Media3 `Player.Listener` na publicznym `DefaultBunnyPlayer.currentPlayer`.
- Media3 `Player.Listener` daje wprost `onPlaybackStateChanged` (`STATE_BUFFERING`/`STATE_READY`/`STATE_ENDED`), `onIsPlayingChanged`, `onPlayerError`, `onPlaybackParametersChanged` i `onVolumeChanged`, co pokrywa eventy RN bez heurystyk. `setVolume` i `setSpeed` są na `DefaultBunnyPlayer`, nie na publicznym widoku `BunnyStreamPlayer`. Progress dostarcza `BunnyPlayer.ProgressListener` widoku (tick co 250 ms).
- Zweryfikowano w kodzie źródłowym `bunny-stream-android` (main, 3.3.0), że **nie da się dziś w pełni wyłączyć natywnego UI kontrolek** przez publiczne API. `BunnyStreamPlayer`/`BunnyPlayerView` eksponują tylko `iconSet` i `progressTextColor`; sam `DefaultBunnyPlayer.playVideo()` ustawia na stałe `playerView.useController = true`. `PlayerSettings.controls` (z dashboardu) chowa tylko pojedyncze przyciski, nie wyłącza ramki kontrolera/gestów `PlayerControlView`. `hideDefaultControls()` istnieje jedynie w module camera-upload, nie w player.
- Silnik playbacku jest już odseparowany od UI: `DefaultBunnyPlayer.playVideo()` buduje `MediaItem`/`ExoPlayer`, a DRM (Widevine, CENC) jest ustawiane niezależnie od kontrolera przez `MediaItem.DrmConfiguration` sterowane serwerowo flagą `PlayerSettings.drmEnabled`. Oznacza to, że tryb headless (`useController = false`) i DRM nie są sprzecznymi wymaganiami — DRM działałby tak samo z włączonym, jak i wyłączonym natywnym kontrolerem.

## Plan implementacji

### 1. Dodać szkielet biblioteki Android i integrację Gradle/Codegen

- Utworzyć standardowy moduł biblioteki React Native w `android/` (`build.gradle`, manifest i źródła Kotlin w pakiecie `net.bunny.reactnative`).
- Skonfigurować Android Gradle Plugin, Kotlin, namespace, Java/Kotlin target zgodne z example i React Native oraz `minSdk = 26`.
- Dodać zależności `com.facebook.react:react-android` i przypięte `net.bunny:player:3.3.0`; polegać na Maven Central już obecnym w aplikacji.
- Włączyć React Native Gradle Plugin/codegen tak, aby moduł kompilował wygenerowane klasy `BunnyStreamPlayerViewManagerInterface`, `BunnyStreamPlayerViewManagerDelegate` i spec TurboModule.
- Uzupełnić metadane publikacji/autolinkingu: uwzględnić `android/` w paczce npm i sprawdzić `react-native config`, bez ręcznej rejestracji w example.
- Podnieść minSdk example do 26 i zaktualizować README/System Requirements, ponieważ jest to rzeczywisty wymóg zależności natywnej.

### 2. Zaimplementować inicjalizację Bunny SDK jako TurboModule

- Dodać `BunnyStreamPlayerModule` implementujący wygenerowany `NativeBunnyStreamPlayerSpec`.
- W `initialize` walidować i bezpiecznie konwertować JS `Double` na całkowity `Long` (wartość skończona, dodatnia, bez części ułamkowej), a następnie wywołać `BunnyStreamApi.initialize(applicationContext, accessKey, libraryId)` na właściwym wątku.
- Dodać `BunnyStreamPlayerPackage` rejestrujący TurboModule i ViewManager w sposób kompatybilny z autolinkingiem/New Architecture.
- Nie logować `accessKey`, tokenów ani pełnych URL-i playbacku.

### 3. Utworzyć kontrolowany wrapper widoku natywnego

- Dodać własny `BunnyStreamPlayerView : FrameLayout`, który posiada dokładnie jedną instancję SDK `BunnyStreamPlayer` jako child z `MATCH_PARENT` w obu wymiarach.
- W wrapperze przechowywać aktualny model props (`videoId`, opcjonalne `libraryId`, `token`, `expires`, `autoPlay`) oraz rozdzielić ustawianie props od rozpoczęcia ładowania.
- Uruchamiać/przeładowywać `playVideo(videoId, libraryId, "", token, expires)` dopiero w `onAfterUpdateTransaction`, gdy komplet props jest spójny; nie przeładowywać filmu przy identycznym zestawie wartości.
- Przy zmianie źródła anulować/wyciszyć zdarzenia należące do poprzedniej generacji ładowania, aby spóźnione callbacki nie zostały przypisane nowemu `videoId`.
- `autoPlay=true` pozostawić zgodne z zachowaniem SDK; dla `autoPlay=false` wstrzymać playback po osiągnięciu gotowości. Zmiana `false -> true` dla już załadowanego filmu powinna wywołać `play`, a `true -> false` — `pause`, bez ponownego pobierania filmu.

### 4. Zaimplementować ViewManager zgodny z Fabric

- Dodać `BunnyStreamPlayerViewManager : SimpleViewManager<BunnyStreamPlayerView>` implementujący wygenerowany `BunnyStreamPlayerViewManagerInterface` i korzystający z wygenerowanego delegate'a.
- Nazwa managera musi dokładnie odpowiadać Codegen: `BunnyStreamPlayerView`.
- Zaimplementować settery wszystkich props z poprawną obsługą wartości `null`/default (`autoPlay` domyślnie `true`) i konwersją `Double -> Long` dla `libraryId`/`expires`.
- Mapować wygenerowane komendy zarówno przez delegate Fabric, jak i — jeśli wymaga tego obsługiwany zakres RN — przez kompatybilny dispatch nazw/ID; wszystkie operacje wykonywać na UI thread.
- W `onDropViewInstance` wywołać idempotentny cleanup wrappera przed `super`, zamiast pozostawiać listener/progress coroutine przy odmontowanym reactTagu.

### 5. Odwzorować komendy RN na player

- `play` -> `BunnyStreamPlayer.play()`.
- `pause` -> `BunnyStreamPlayer.pause()`.
- `seekTo(positionMs)` -> walidacja wartości skończonej i nieujemnej, konwersja do `Long`, opcjonalne ograniczenie do znanego duration, następnie `seekTo`.
- `setVolume(volume)` -> ograniczenie do `0..1` i wywołanie `DefaultBunnyPlayer.getInstance(context).setVolume(...)` dla singletonu używanego przez widok.
- `setPlaybackRate(rate)` -> walidacja dodatniej, skończonej wartości i wywołanie `DefaultBunnyPlayer.getInstance(context).setSpeed(...)`; nie stosować reflection.
- Komendy przed gotowością albo kolejkować (`play`, seek/volume/rate), albo stosować do singletonu, jeśli SDK to wspiera; przyjąć jedną spójną semantykę i pokryć ją testami.

### 6. Zbudować adapter stanu i zdarzeń

- Nie używać `DefaultBunnyPlayer.playerStateListener` — ten pojedynczy slot jest zajmowany i nadpisywany przez wewnętrzny `BunnyPlayerView` SDK (setter `bunnyPlayer`, także przy fullscreen); nadpisanie go przez bridge zepsułoby kontrolki playera, a SDK i tak odebrałoby bridge'owi eventy przy kolejnym przypisaniu.
- Zamiast tego rejestrować własny Media3 `Player.Listener` bezpośrednio na publicznym `DefaultBunnyPlayer.currentPlayer` na czas attachu/aktywnego źródła; obsłużyć re-attach listenera przy zmianie instancji playera (np. przełączenie na CastPlayer, nowa sesja playbacku) oraz `BunnyPlayer.ProgressListener` na widoku dla progressu.
- Emitować direct events przez Fabric `EventDispatcher` uzyskany z `UIManagerHelper`, z poprawnym `surfaceId`, reactTagiem, nazwą zdarzenia z Codegen i dokładnym payloadem:

| Zdarzenie RN | Źródło / reguła mapowania |
| --- | --- |
| `onReady` | `onPlaybackStateChanged(STATE_READY)` — jednorazowo dla generacji źródła; payload `videoId`, `durationMs`. |
| `onPlaybackStateChange` | Adapterowa maszyna stanów: `idle` przed źródłem, `loading` od `playVideo` do pierwszego `STATE_READY`, `ready` po `STATE_READY`, `playing`/`paused` z `onIsPlayingChanged`, `ended` z `STATE_ENDED`, `error` z `onPlayerError`. Emitować tylko realne przejścia. |
| `onProgress` | `ProgressListener`; `positionMs`, `durationMs`, `progress` znormalizowany do `0..1`; ograniczyć częstotliwość do natywnych 250 ms i nie emitować po detach. |
| `onError` | `Player.Listener.onPlayerError` (`PlaybackException`); stabilny kod bridge'a, czytelny komunikat i `errorCodeName` jako kod natywny, bez sekretów. |
| `onBuffering` | `onPlaybackStateChanged(STATE_BUFFERING)` -> `true`, wyjście ze stanu -> `false`; emitować tylko przy zmianie wartości. Nie mapować z `onIsLoadingChanged`, które oznacza pobieranie danych, a nie buffering playbacku. |
| `onPlay` / `onPause` | Krawędzie `onIsPlayingChanged`, wraz z bieżącą pozycją i duration; nie emitować duplikatów po samym ustawieniu listenera. |
| `onEnd` | `onPlaybackStateChanged(STATE_ENDED)` — jednorazowo; zresetować przy seeku przed koniec lub zmianie źródła. |
| `onVolumeChange` | `Player.Listener.onVolumeChanged`; payload z aktualnym volume i `isMuted` (`volume == 0`); pokrywa też mute/unmute z kontrolek SDK. |
| `onPlaybackRateChange` | `Player.Listener.onPlaybackParametersChanged`; payload `rate`. |

- Rozdzielić `loading` od buffering i pilnować kolejności typowego przebiegu: `loading -> ready -> playing/paused`, a następnie progress/end.
- Ustalić zachowanie dla błędów pobierania metadanych, których SDK 3.3.0 obecnie tylko loguje. Jeżeli nie da się ich przechwycić publicznym API, odnotować ograniczenie i przygotować mały upstream change w Bunny Android SDK zamiast reflection lub kopiowania implementacji playera.

### 7. Zabezpieczyć sizing i layout pod Fabric

- Wrapper ma przyjmować rozmiar wyliczony przez Yoga/Fabric i zawsze mierzyć child dokładnymi specami odpowiadającymi swojej dostępnej szerokości/wysokości z uwzględnieniem paddingu.
- Nadpisać `onMeasure`/`onLayout` tylko w minimalnym zakresie potrzebnym do wymuszenia pełnego rozmiaru playera; nie wprowadzać samodzielnego aspect ratio, implicit height ani pętli `requestLayout`/`Choreographer`, dopóki test nie wykaże takiej konieczności.
- Obsłużyć zmianę wymiarów i rotację: child powinien zostać ponownie zmierzony/ułożony bez ponownego ładowania wideo, a Surface/PlayerView nie może pozostać w starym rozmiarze.
- Sprawdzić layout dla jawnego `width/height`, `width: 100%` + aspect ratio, flex, zmiany rozmiaru rodzica, rotacji i wejścia/wyjścia z fullscreen.
- Nie nadpisywać layoutu ustawionego przez Fabric za pomocą własnych stałych wymiarów; `MATCH_PARENT` dotyczy wyłącznie childa wewnątrz wrappera.

### 8. Domknąć lifecycle i zasady własności singletonu

- Na attach przypinać listenery i uruchamiać progress dopiero, gdy widok ma ważny reactTag/lifecycle owner; na detach usuwać `Player.Listener` z `currentPlayer`, zatrzymywać progress i blokować dalszą emisję eventów.
- Pozostawić natywnemu `BunnyStreamPlayer` jego obsługę `onPause/onResume` przez `ViewTreeLifecycleOwner`, ale dodać cleanup managera jako zabezpieczenie przy recyklingu/mount-unmount w Fabric.
- Cleanup musi być idempotentny i nie może emitować zdarzeń do usuniętego widoku. Nie wywoływać globalnego `release()` bez sprawdzenia własności, ponieważ resetuje singleton używany potencjalnie przez inny widok.
- Ponieważ SDK ma globalny player (singleton `DefaultBunnyPlayer` współdzielony przez wszystkie widoki), w pierwszej wersji jawnie egzekwować pojedynczy aktywny `BunnyStreamPlayerView` (przejęcie własności powinno zatrzymać/odłączyć poprzedni widok i opcjonalnie zgłosić kontrolowany błąd). Alternatywę wieloinstancyjną uzależnić od upstreamowego usunięcia singletonu.
- Zweryfikować scenariusze: background/foreground, nawigacja i unmount, szybki remount, Fast Refresh, zmiana `videoId` podczas ładowania, rotacja, fullscreen oraz zniszczenie Activity.

### 9. Udostępnić minimalne API JS i ekran demonstracyjny

- Wyeksportować z `src/index.ts` istniejący native component, typy props/events, `Commands` i metodę inicjalizacji w minimalnej, typowanej formie; nie projektować w tym zadaniu dodatkowego API playera.
- Rozbudować example o ekran inicjalizujący moduł i renderujący player z kontrolkami wywołującymi wszystkie komendy oraz logiem eventów.
- Dane testowe/credentials przekazywać przez lokalną konfigurację środowiska; nigdy nie commitować access key, tokenu ani prywatnego video ID.

### 10. Testy i weryfikacja

- Testy jednostkowe Kotlin dla walidacji liczb, reducer/state machine eventów, deduplikacji ready/end/play/pause, kolejki komend, re-attachu `Player.Listener` po zmianie `currentPlayer` i idempotentnego cleanupu; zależności od SDK schować za małym adapterem możliwym do podmiany w testach.
- Test regresyjny potwierdzający, że bridge nie dotyka `DefaultBunnyPlayer.playerStateListener` i że kontrolki natywnego UI (play/pause, mute, timebar) działają równolegle z eventami RN, także po przejściu przez fullscreen.
- Test managera/wrappera (Robolectric lub test instrumentacyjny) dla mapowania props, reloadu tylko po zmianie źródła, dispatchu komend i usuwania listenerów w `onDropViewInstance`.
- Testy layoutu/instrumentacyjne pod Fabric: poprawny measured size childa, resize/rotation oraz mount-unmount bez czarnego/zerowego Surface i bez crasha.
- Ręczny smoke test na emulatorze/urządzeniu API 26+ z New Architecture: publiczne i tokenowane video, autoplay on/off, wszystkie komendy, background/foreground, fullscreen, błąd sieci i błędny identyfikator.
- Uruchomić: `npm run codegen`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run example:typecheck`, testy Kotlin oraz `assembleDebug` example. Dodać kompilację/test Android do CI, ponieważ obecny workflow sprawdza tylko Codegen/TS/lint/build JS.
- Na końcu sprawdzić zawartość paczki npm (`npm pack --dry-run`), autolinking (`npx react-native config`) oraz brak sekretów/logów zawierających credentials.

### 11. Headless mode / pełny custom UI z DRM (poza obecnym MVP, wymaganie klienta — micro-drama)

- Kontekst: klient robiący mobilne micro-drama (krótkie, wertykalne wideo, własny feed/swipe UI) potrzebuje natywnego SDK typu headless — bez wbudowanych kontrolek — z zachowaniem podstawowego DRM. Obecne mobilne SDK Bunny (w tym Android) blokują to, bo UI kontrolera jest nierozłączne od playera.
- Ustalenie techniczne: zmiana wymagana w `bunny-stream-android` jest mała i lokalna — `DefaultBunnyPlayer.playVideo()` ma zahardkodowane `playerView.useController = true`; wystarczy wystawić to jako parametr/flagę (np. `useController: Boolean = true` na `BunnyStreamPlayer`/`playVideo`), bez zmian w warstwie DRM/ExoPlayer/MediaSourceFactory.
- DRM (Widevine/CENC) jest już skonfigurowany na poziomie `MediaItem.DrmConfiguration` w `DefaultBunnyPlayer`, sterowany serwerowo (`PlayerSettings.drmEnabled`) i całkowicie niezależny od `useController`/`BunnyPlayerView`. Nie wymaga to zmian, żeby działać w trybie headless — trzeba to tylko zweryfikować end-to-end po dodaniu flagi.
- Zakres do uzgodnienia z teamem Android (nie realizowany w tym zadaniu):
  1. Dodać do `bunny-stream-android` publiczny sposób wyłączenia natywnego kontrolera (np. `useController`/`useNativeControls`), domyślnie `true` dla zgodności wstecznej.
  2. Rozszerzyć kontrakt Codegen RN o odpowiadający prop (np. `useNativeControls`, domyślnie `true`), tak by przy `false` bridge nie renderował/nie zależał od `BunnyPlayerView` i całość kontroli (play/pause/seek/volume/rate + eventy) szła przez istniejące komendy i eventy z sekcji 5–6.
  3. Zweryfikować fullscreen w trybie headless — natywny fullscreen SDK (`FullScreenPlayerActivity`) jest częścią UI kontrolera; przy `useController=false` fullscreen musi być realizowany po stronie RN/JS (np. własny modal/Activity), nie przez SDK.
  4. Potwierdzić end-to-end, że DRM (Widevine) działa identycznie w obu trybach (z i bez natywnego UI) na urządzeniu z Widevine L1/L3.
- To rozszerzenie nie zmienia zakresu ani kryteriów akceptacji sekcji 1–10; jest tu udokumentowane jako uzgodniony z klientem wymóg, żeby kontrakt Codegen nie musiał być łamany, gdy zostanie zrealizowane.

## Architektura i wzorce projektowe

Dobór wzorców jest podyktowany konkretnymi problemami tego planu (singleton SDK, zajęty slot listenera, asynchroniczne przeładowania, deduplikacja eventów, lifecycle Fabric), a nie naśladownictwem trendów. Poniżej tylko wzorce, które realnie rozwiązują te problemy bez dodawania zbędnej złożoności.

### Struktura pakietów

```
net.bunny.reactnative
├── port/        # BunnyPlayerPort — kontrakt, którego bridge używa; zero zależności od SDK
├── adapter/     # SdkBunnyPlayerAdapter — realna implementacja nad BunnyStreamPlayer + DefaultBunnyPlayer
├── state/       # PlaybackState (sealed), transition() — czysty Kotlin, zero Androida
├── commands/    # CommandQueue, generation token
├── events/      # FabricEventEmitter, mappery payloadów
├── view/        # BunnyStreamPlayerView (wrapper), BunnyStreamPlayerViewManager
├── module/      # BunnyStreamPlayerModule (TurboModule), BunnyStreamPlayerPackage
└── ownership/   # BunnyPlayerLease
```

`state/` i `commands/` to czysty Kotlin bez zależności Androida — to je testuje się najszybciej i najmocniej w sekcji 10.

### Wzorce zastosowane

1. **Port/Adapter (Dependency Inversion)** — `BunnyPlayerPort` definiuje operacje, których bridge faktycznie potrzebuje (`play/pause/seekTo/setVolume/setSpeed/currentPlayer/addPlayerListener/removePlayerListener/setProgressListener`); `SdkBunnyPlayerAdapter` opakowuje `BunnyStreamPlayer` + `DefaultBunnyPlayer` i tłumaczy dziwactwa SDK (singleton, zajęty slot `playerStateListener`). Zyski: testy jednostkowe (sekcja 10) dostają fake, nie Robolectric z ExoPlayerem; tryb headless z sekcji 11 staje się drugą implementacją adaptera, a nie forkiem bridge'a; izolacja od zmian API między wersjami `net.bunny:player`. Realizuje postulat "zależności od SDK schować za adapterem" z sekcji 10.

2. **State machine dla mapowania eventów** — tabela w sekcji 6 to wprost specyfikacja automatu. `sealed class PlaybackState` (`Idle`, `Loading`, `Ready`, `Playing`, `Paused`, `Ended`, `Error`) + czysta funkcja `transition(state, Media3Event): Pair<State, List<RNEvent>>`; tylko realne przejścia emitują eventy, a przejścia niedozwolone (np. `Ended → Playing` bez nowego źródła) są z definicji odrzucane. Rozwiązuje naraz deduplikację `onReady`/`onEnd`/`onPlay`/`onPause`, kolejność `loading → ready → playing` i testowalność bez SDK. Realizuje wymóg "reducer/state machine eventów" z sekcji 10.

3. **Generation token (epoch) dla anulowania async** — `AtomicLong generation` przechwycony w closure'ach listenerów i emisjach progressu; przy zmianie źródła incrementuj i ignoruj wszystko ze starszej generacji. Jeden jawny mechanizm zamiast per-listener flag. Realizuje wymóg "anulować/wyciszyć zdarzenia należące do poprzedniej generacji ładowania" z sekcji 3.

4. **Command queue z ready-gate** — `enqueue(cmd, generation)`, przy `STATE_READY` dranij bieżącą generację, przy zmianie źródła wyrzuć całą. Czystsze niż rozrzucone `pendingPlay`/`pendingSeek`/`pendingVolume` po managerze i łatwe do pokrycia testem. Realizuje wymóg "kolejkować albo stosować do singletonu" z sekcji 5.

5. **Ownership lease dla singletonu** — obiekt `BunnyPlayerLease`: aktywny wrapper go posiada, nabycie nowego lease'u automatycznie odwołuje stary (wywołuje jego cleanup), zwolnienie jest idempotentne. Centralizuje logikę "kto jest właścicielem singletonu" w jednym miejscu i komponuje się z idempotentnym cleanupem z sekcji 8. Realizuje wymóg egzekucji pojedynczej aktywnej instancji z sekcji 8.

6. **Immutable props data class z equality diff** — `data class BunnyStreamPlayerProps(videoId, libraryId, token, expires, autoPlay)`; w `onAfterUpdateTransaction` porównaj `old == new` i przeładuj tylko przy różnicy. Trzymać props jako niemutowalny snapshot, nie mutowalne pola setowane pojedynczo przez setter'y delegate'a. Realizuje wymóg "nie przeładowywać filmu przy identycznym zestawie wartości" z sekcji 3.

7. **Idempotent Disposable dla cleanupu** — obiekt z `release()` ustawiającym flagę; kolejne wywołania są no-op. Sformalizowana idempotencja zamiast `if (!cleanedUp)` rozsianych po metodach. Realizuje wymóg idempotentnego cleanupu z sekcji 8.

8. **Thin EventEmitter z coalescingiem** — `FabricEventEmitter.dispatch(name, payload, coalesceKey?)` nad `EventDispatcher` z `UIManagerHelper`; `onProgress` z coalesce key = reactTag (nowszy nadpisuje starszy w tej samej klatce), `onPlaybackStateChange` bez coalescingu. Zdejmuje logikę dispatchu z adaptera eventów i daje jedno miejsce do pilnowania `surfaceId`/reactTaga. Realizuje wymóg dispatchu direct events z sekcji 6.

### Wzorce celowo niezastosowane (over-engineering)

- **Hilt/Dagger** — moduł bridge'a jest mały, ręczna konstrukcja w `Package` jest czytelniejsza i nie dodaje zależności buildowej.
- **MVVM/MVP/MVI** — bridge nie jest warstwą prezentacji; UI należy do JS. ViewModel to sztuczna warstwa bez odbiorcy.
- **Repository** — nie ma warstwy danych po stronie bridge'a; `BunnyStreamApi.initialize` to jeden wywołanie, nie źródło danych.
- **RxJava/Flow wszędzie** — callbacki wystarczą; tick 250 ms nie generuje backpressure. Flow tylko przy realnej kompozycji strumieni, a tu jej nie ma.
- **Drugi singleton po stronie bridge'a** — SDK już ma problem singletonu; nie dokładuj drugiego. Stan współdzielony (lease, generation) przekazywać przez instancję, nie przez `object`.

## Kryteria akceptacji

- Example pod Fabric renderuje natywny player w wymiarach zadanych przez React Native, także po resize/rotacji.
- Wszystkie props i pięć komend z istniejącego kontraktu Codegen działają i mają zdefiniowane zachowanie przed/po gotowości.
- Wszystkie zadeklarowane eventy mają zgodne payloady, nie dublują się i nie są emitowane po unmount.
- Player poprawnie pauzuje/wznawia się z lifecycle Activity, zwalnia listenery/coroutines przy unmount i nie crashuje przy szybkich zmianach widoku/źródła.
- Ograniczenie pojedynczej aktywnej instancji wynikające z singletonu SDK jest egzekwowane i udokumentowane albo usunięte przez uzgodnioną zmianę upstream.
- Android build, testy, Codegen, lint, typecheck i pakowanie biblioteki przechodzą w CI.
- Wymaganie headless/custom UI + DRM (sekcja 11) jest udokumentowane jako zgłoszona potrzeba klienta ze zdefiniowanym, małym zakresem zmiany upstream, gotowe do zaplanowania jako kolejne zadanie/fast-follow.
- Kod Kotlin bridge'a realizuje strukturę pakietów i wzorce z sekcji "Architektura i wzorce projektowe": `BunnyPlayerPort` izoluje SDK, `state/` i `commands/` są czystym Kotlinem testowalnym bez Androida/SDK, a wzorce celowo niezastosowane (Hilt, MVVM, RxJava, drugi singleton) rzeczywiście nie występują w kodzie.
