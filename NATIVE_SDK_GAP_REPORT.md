# Raport pokrycia funkcji natywnych SDK Bunny w React Native

Data analizy: **18 listopada 2026 r.**

## Zakres i metoda

Porównano dokumentację i publiczne API natywnych bibliotek z kodem tego
repozytorium: publicznym API TypeScript, kontraktami codegen oraz implementacjami
iOS i Androida.

Analiza dotyczy wersji zapisanych w
[`native-sdk-baselines.json`](native-sdk-baselines.json):

| Platforma | Wersja SDK | Commit |
| --- | --- | --- |
| Android | 4.2.2 | `e3374644a767f18325006595ce775cde042124b1` |
| iOS | 1.0.5 | `c8b71fa945e5938e35f8c69207f7577627a7dd07` |

Były to najnowsze opublikowane wydania w chwili sprawdzania. Raport opisuje
statyczną analizę dokumentacji i kodu. Nie obejmuje testów na urządzeniach ani
potwierdzenia zachowania usług Bunny dla konkretnego konta i konfiguracji.

## Ocena ogólna

React Native obejmuje większość głównych funkcji: odtwarzanie VOD i live,
odliczanie i trailer przed transmisją, DVR, przejście do nagrania, DRM,
casting przez natywne kontrolki, upload TUS, zarządzanie materiałami oraz
nadawanie z kamery.

Braki dotyczą przede wszystkim wybranych metod API, konfiguracji playera
i szczegółowości zdarzeń. Funkcja może działać automatycznie wewnątrz SDK,
mimo że nie ma osobnego interfejsu JavaScript.

## Potwierdzone braki w warstwie React Native

### 1. Sterowanie reklamami na Androidzie

Natywny player udostępnia:

- `vastTagUrl` — nadpisanie tagu VAST/VMAP dla konkretnego odtworzenia;
  `null` używa ustawień biblioteki, a pusty tekst wyłącza reklamy.
- `onAdPlayingChanged` — informację, czy aktualnie trwa reklama.

RN nie udostępnia tych opcji w propsach ani zdarzeniach playera. Reklamy
skonfigurowane w panelu Bunny mogą odtwarzać się automatycznie, ale aplikacja
nie może nadpisać tagu ani na podstawie tego zdarzenia ukryć własnych kontrolek.

Źródła: [reklamy Android](https://github.com/BunnyWay/bunny-stream-android/blob/4.2.2/docs/guides/ads.md),
[`BunnyStreamPlayer.types.ts`](src/player/BunnyStreamPlayer.types.ts),
[`BunnyStreamPlayerNativeComponent.ts`](src/specs/BunnyStreamPlayerNativeComponent.ts).

### 2. Brak tokenów w dwóch metodach API Androida

Natywne `fetchVideoHeatmap` i `pollLiveStream` mają warianty przyjmujące
`token` oraz `expires`. Odpowiedniki RN przyjmują wyłącznie ID biblioteki
i materiału.

Uniemożliwia to przekazanie autoryzacji do tych wywołań dla bibliotek
chronionych tokenem. Nie oznacza to braku tokenów w samym playerze:
źródła VOD/live oraz metody pobierające play data już je obsługują.
Osobna metoda RN `fetchVideoHeatmapData` również przyjmuje token.

Źródła: [VideoRepository](https://github.com/BunnyWay/bunny-stream-android/blob/4.2.2/bunny-stream-api/src/main/java/net/bunny/api/video/domain/VideoRepository.kt),
[LiveStreamRepository](https://github.com/BunnyWay/bunny-stream-android/blob/4.2.2/bunny-stream-api/src/main/java/net/bunny/api/livestream/domain/LiveStreamRepository.kt),
[`BunnyStreamApi.ts`](src/api/BunnyStreamApi.ts),
[`NativeBunnyStreamApi.ts`](src/specs/NativeBunnyStreamApi.ts).

### 3. Własne nagłówki odtwarzania VOD na iOS

Natywny `BunnyStreamPlayer` przyjmuje `headers`, np. własny `Referer`,
przekazywany do żądań manifestu i segmentów. Publiczne źródło i propsy RN
nie udostępniają nagłówków, a implementacja iOS nie przekazuje tego argumentu.

Ma to znaczenie dla integracji wymagających własnego referrera lub dodatkowych
nagłówków. Nie oznacza braku domyślnej obsługi nagłówków przez SDK.

Źródła: [player iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamPlayer/Player/BunnyStreamPlayer.swift),
[`BunnyStreamPlayer.types.ts`](src/player/BunnyStreamPlayer.types.ts),
[`BunnyStreamPlayerViewImpl.swift`](ios/BunnyStreamPlayerViewImpl.swift).

### 4. Własne ikony natywnych kontrolek

Android udostępnia `PlayerIconSet`, a iOS `PlayerIcons`. RN nie ma propa
pozwalającego podmienić ikony w natywnym interfejsie playera.

Można ukryć kontrolki przez `controls={false}` i zbudować własny interfejs VOD,
ale wymaga to zastąpienia całych kontrolek zamiast zmiany samych ikon.

Źródła: [player Android](https://github.com/BunnyWay/bunny-stream-android/blob/4.2.2/bunny-stream-player/README.md),
[dokumentacja playera iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamPlayer/BunnyStreamPlayer.docc/BunnyStreamPlayer.md),
[`BunnyStreamPlayer.types.ts`](src/player/BunnyStreamPlayer.types.ts).

### 5. Pełna konfiguracja prędkości na Androidzie

Natywny `PlaybackSpeedConfig` pozwala ustawić `enableSpeedControl`,
`defaultSpeed`, `allowedSpeeds`, `showSpeedBadge` i `rememberLastSpeed`.

RN pozwala zmieniać prędkość i odczytywać dostępne prędkości, ale nie przekazuje
tego obiektu konfiguracji. Brakuje m.in. sterowania listą opcji w natywnym menu
i zapamiętywaniem ostatniego wyboru.

Źródła: [PlaybackSpeedConfig](https://github.com/BunnyWay/bunny-stream-android/blob/4.2.2/bunny-stream-player/src/main/java/net/bunny/bunnystreamplayer/config/PlaybackSpeedConfig.kt),
[`playbackSpeeds.ts`](src/player/playbackSpeeds.ts),
[`BunnyStreamPlayer.types.ts`](src/player/BunnyStreamPlayer.types.ts).

### 6. Niezależne instancje klientów SDK

Android pozwala tworzyć instancje przez `BunnyStreamApi.create(config)`
i zwalniać je przez `release()`. iOS pozwala tworzyć osobne klienty API.

RN korzysta z globalnej konfiguracji `initialize(accessKey, libraryId)`.
Obsługuje inne `libraryId` w źródłach i wywołaniach API, ale nie udostępnia
niezależnych klientów z różnymi kluczami i osobnym cyklem życia.

To ograniczenie zarządzania konfiguracją i klientami; nie należy utożsamiać
go z możliwością równoczesnego odtwarzania wielu filmów. Androidowy silnik
odtwarzania pozostaje współdzielony.

Źródła: [API Android](https://github.com/BunnyWay/bunny-stream-android/blob/4.2.2/bunny-stream-api/README.md),
[API iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamAPI/BunnyStreamAPI.swift),
[`initialize.ts`](src/config/initialize.ts),
[`BunnyStreamConfiguration.swift`](ios/BunnyStreamConfiguration.swift).

### 7. Regeneracja klucza transmisji

Publiczne repozytorium live w SDK iOS udostępnia `regenerateStreamKey`.
RN nie ma odpowiedniej metody ani kontraktu codegen.

Publiczny `LiveStreamRepository` Androida 4.2.2 również nie udostępnia tej
operacji. Wspólne API wymagałoby więc rozszerzenia także warstwy Androida.

Źródła: [repozytorium live iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamAPI/Domain/LiveStreamRepository.swift),
[`BunnyStreamApi.ts`](src/api/BunnyStreamApi.ts).

### 8. Dane oEmbed

Publiczny klient wygenerowany w SDK iOS udostępnia `getOEmbed`, zwracający
m.in. HTML osadzenia, miniaturę i metadane. RN nie udostępnia odpowiednika.
Funkcja ma mniejsze znaczenie dla natywnego odtwarzania mobilnego.

Źródła: [klient iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamAPI/GeneratedSources/Client.swift),
[`BunnyStreamApi.ts`](src/api/BunnyStreamApi.ts).

### 9. Dodatkowe opcje uploadu i diagnostyki live na iOS

- Natywny `TUSVideoUploader.make` pozwala ustawić `chunkSize`. RN tworzy
  uploader z ustawieniami domyślnymi i nie udostępnia tej opcji.
- Natywny callback błędów live przekazuje `Error`, w tym
  `BunnyLiveStreamError` z informacjami o rodzaju błędu, statusie HTTP
  i `isPermanent`. RN przekazuje przez `onLiveError` sam komunikat,
  a implementacja iOS filtruje błędy przejściowe. Ogranicza to diagnostykę
  aplikacji, choć nie wyłącza automatycznego odzyskiwania połączenia przez SDK.

Źródła: [uploader iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamUploader/VideoUploader/TUS/TUSVideoUploader.swift),
[live player iOS](https://github.com/BunnyWay/bunny-stream-ios/blob/1.0.5/Sources/BunnyStreamPlayer/BunnyStreamLivePlayer.swift),
[`BunnyStreamUploadModuleImpl.swift`](ios/BunnyStreamUploadModuleImpl.swift),
[`BunnyLiveStreamPlayerViewImpl.swift`](ios/BunnyLiveStreamPlayerViewImpl.swift).

## Ograniczenia pochodzące z natywnych SDK

Poniższych przypadków nie należy traktować jako prostego braku mostka RN:

- Publiczne interfejsy playerów live nie oferują kontrolera do zewnętrznego
  `play`, `pause` i `seek`. Sterowanie pozostaje dostępne przez natywne UI,
  w granicach konfiguracji DVR.
- Publiczny kontroler playera iOS nie udostępnia metody wyboru jakości.
  Natywne menu jakości działa, ale wspólne programowe API wymaga rozszerzenia SDK.
- Androidowy moduł kamery nie oferuje pełnego publicznego sterowania jakością
  kodowania ani publicznej metody rozpoczęcia transmisji odpowiadającej
  kontrolerowi iOS. RN ma przez to ograniczenia opisane w typach i poradnikach.
- Część operacji zarządzania dostępnych na Androidzie, np. `smartGenerate`,
  nie ma odpowiednika w publicznym kliencie iOS. Samo dodanie deklaracji RN
  nie zapewni zgodności platform.

## Rozbieżności w dokumentacji React Native

### Watermark na Androidzie

Typy i poradnik opisują watermark jako funkcję tylko dla iOS. Kod Androida
parsuje jednak prop i przekazuje go do natywnego playera zarówno dla VOD,
jak i live. Dokumentacja zaniża zakres implementacji.

Źródła: [`BunnyStreamPlayer.types.ts`](src/player/BunnyStreamPlayer.types.ts),
[`BunnyStreamPlayerView.kt`](android/src/main/java/net/bunny/reactnative/view/BunnyStreamPlayerView.kt),
[`BunnyLiveStreamPlayerView.kt`](android/src/main/java/net/bunny/reactnative/view/BunnyLiveStreamPlayerView.kt).

### Programowe PiP na iOS

Dokumentacja i typy opisują `enterPiP()` jako niewykonywane na iOS. Kod Obj-C++
przekazuje jednak komendę do implementacji Swift, która używa własnego
`AVPictureInPictureController` powiązanego z odnalezionym `AVPlayerLayer`.

Implementacja istnieje. Jej skuteczność i ograniczenia wymagają weryfikacji
na urządzeniu z odpowiednią konfiguracją audio i PiP. Nie należy na podstawie
samych opisów klasyfikować tej funkcji jako niezaimplementowanej.

Źródła: [`BunnyStreamPlayerView.mm`](ios/BunnyStreamPlayerView.mm),
[`BunnyStreamPlayerViewImpl.swift`](ios/BunnyStreamPlayerViewImpl.swift),
[`picture-in-picture-and-cast.md`](docs/guides/picture-in-picture-and-cast.md).

### Wersja zależności Android TV

Poradnik pokazuje `net.bunny:tv:4.1.0`, choć bieżąca przypięta wersja SDK to
4.2.2. Przykład należy uzgodnić z `native-sdk-baselines.json`, zgodnie
z wymaganiem używania tej samej wersji modułów SDK.

Źródło: [`picture-in-picture-and-cast.md`](docs/guides/picture-in-picture-and-cast.md).

## Zalecana kolejność prac

1. Uzupełnić `token` i `expires` w `fetchVideoHeatmap` oraz `pollLiveStream`.
2. Udostępnić stan reklamy na Androidzie i opcjonalne nadpisanie tagu.
3. Udostępnić nagłówki odtwarzania VOD na iOS.
4. Poprawić opisy watermarka, PiP i wersji Android TV; zweryfikować PiP
   na urządzeniu.
5. Rozważyć `PlaybackSpeedConfig`, własne ikony i bogatsze błędy live.
6. Według potrzeb produktu zaprojektować niezależnych klientów,
   regenerację kluczy transmisji, oEmbed i konfigurację fragmentów TUS.

Zmiany kontraktów w `src/specs/` wymagają aktualizacji obu platform w jednym
zestawie zmian, zgodnie z [`ARCHITECTURE.md`](ARCHITECTURE.md). Powyższe
zalecenia są planem dalszych prac; w ramach raportu nie zmieniano implementacji.
