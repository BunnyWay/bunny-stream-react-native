# Plan: reorganizacja `example/src` — struktura feature-based

Data: 2026-09-20. Zakres: tylko `example/src` (aplikacja RN-CLI). `example-expo/` poza zakresem — to osobna, minimalna apka.

## 1. Cel

Example ma być wizytówką biblioteki: osoba widząca `bunny-stream-react-native` pierwszy raz powinna w ~1 minutę znaleźć ekran demonstrujący interesującą ją funkcję (player VOD, live, upload, resume positions). Priorytety:

1. **Czytelność dla newcomera** — nazwy folderów = funkcje biblioteki, nie typy plików.
2. **Bez over-engineeringu** — to example, nie produkcja. Żadnych barrel-eksportów per folder, aliasów, warstw `domain/data/ui`. Jedna zmiana strukturalna, zero nowych abstrakcji.
3. **Minimalny diff w plikach** — przenosimy i dzielimy, nie przepisujemy logiki.

## 2. Diagnoza obecnego stanu

```text
src/
  App.tsx          — init SDK + 13 ekranów w jednym Stack.Navigator
  types.ts         — martwy plik (Settings zduplikowany w storage.ts, VideoItem nieużywany)
  screens/         — 14 plików płasko, od 73 do 1704 linii
  components/      — 5 komponentów wspólnych (Header, ScreenWrapper, HomeOption, ResumeDialog, BunnyThumbnail)
  navigation/      — tylko types.ts
  storage/         — storage.ts (settings + direct play), resumeSettings.ts
  media/           — picker.ts, permissions.ts
  theme/           — colors.ts, styles.ts
  assets/, types/  — ok
```

Problemy:

- **`screens/LiveStreamsScreen.tsx` ma 1704 linie** i zawiera 4 komponenty (`LiveStreamsScreen`, `LiveStreamCard`, `LiveStreamEditorModal` ~700 linii, `RtmpIngestModal`), helpery czasu (`parseHms/formatHms/validateHms`, `formatScheduled`, `updateRtmpRow`) i 5 StyleSheetów. To główny problem czytelności.
- **`DirectVideoPlayModal` nie jest ekranem** — to modal renderowany z `HomeScreen`, a leży w `screens/`.
- **Płaska lista 14 ekranów** nie pokazuje, które pliki demonstrują którą funkcję biblioteki — trzeba czytać `HomeScreen`, żeby zrozumieć mapowanie.
- **`types.ts` jest martwy** — `Settings` zdefiniowany drugi raz w `storage/storage.ts`, `VideoItem` nieużywany nigdzie.

Graf nawigacji (zweryfikowany grepem) — naturalne granice feature'ów:

- Home → VideoList → Player, VideoManagement; Home → Player (direct play)
- Home → LiveStreams → LivePlayer, Camera(live), TrailerPicker, ThumbnailPicker (oba pickery wracają do LiveStreams z parametrem)
- Home → VideoUpload → Player; Home → Camera(new)
- Home → ResumePositions → Player; Home → ResumeSettings; Home → Settings

## 3. Rozważane podejścia

### A. Type-based (status quo, poprawiony)

`screens/`, `components/`, `hooks/`… — zostaje płasko, dopisuje się podfoldery w `screens/`. Odrzucone: podfoldery w `screens/` to de facto feature-based, tylko z gorszą nazwą; `components/` mieszałby komponenty wspólne z feature'owymi.

### B. Feature-based lekki — **REKOMENDOWANE**

Foldery per funkcja biblioteki (zgodne z sekcjami HomeScreen), reszta zostaje na poziomie `src/`. Pliki współdzielone (theme, storage, media, navigation) zostają globalne — nie ma potrzeby duplikować warstw `shared/` w example.

### C. Pełny feature-sliced (features/ + shared/ + app/)

Każdy feature z własnymi `components/`, `hooks/`; globalny `shared/` z wewnętrznymi podfolderami. Odrzucone: dla 13 ekranów to przesada — newcomer musiałby skakać po 3 poziomach katalogów, żeby znaleźć np. `Header`.

## 4. Docelowa struktura

```text
src/
  App.tsx                     — tylko: init SDK + SafeAreaProvider + <RootNavigator/>
  navigation/
    types.ts                  — RootStackParamList (bez zmian)
    RootNavigator.tsx         — wydzielony Stack.Navigator z App.tsx (mapa ekranów w jednym miejscu)
  theme/                      — bez zmian
  assets/                     — bez zmian
  types/                      — bez zmian (env.d.ts, images.d.ts)
  components/                 — komponenty współdzielone:
    Header.tsx                  bez zmian
    ScreenWrapper.tsx           bez zmian
    BunnyThumbnail.tsx          bez zmian
    ResumeDialog.tsx            bez zmian (docelowo na Dialog.tsx — patrz §5.2)
    ToggleRow.tsx               NOWY — label + opcjonalny subtitle + Switch (§5.2)
    Dialog.tsx                  NOWY — shell modala: overlay + karta + tytuł + buttons (§5.2)
    OutlineButton.tsx           NOWY — przycisk z ramką primary, warianty danger/disabled (§5.2)
    StatusPill.tsx              NOWY — pill statusu z kolorem tła (§5.2)
    ProgressBar.tsx             NOWY — track + fill procentowy (§5.2)
    ListStateView.tsx           NOWY — loading / empty / error+retry dla FlatList (§5.2)
  storage/
    settings.ts               — przemianowane storage.ts + NOWY helper loadLibraryConfig() (§5.2)
    resumeSettings.ts         — bez zmian
  utils/
    format.ts                 — NOWY — formatTime/formatDuration/formatHms/formatTimestamp/formatBytes (§5.2)
  media/                      — picker.ts, permissions.ts — bez zmian
  features/
    home/
      HomeScreen.tsx
      DirectVideoPlayModal.tsx   — przeniesiony z screens/ (to modal, nie ekran)
      HomeOption.tsx             — przeniesiony z components/ (używany tylko tu)
    playback/                    — VOD: lista + player + zarządzanie
      VideoListScreen.tsx
      PlayerScreen.tsx           — PlayIcon/PauseIcon zostają w pliku (~20 linii)
      VideoManagementScreen.tsx  — Section/LabeledInput/ActionButton zostają w pliku
    live/
      LiveStreamsScreen.tsx      — po podziale: lista + stan UI (~300 linii)
      LiveStreamCard.tsx         — wydzielony z LiveStreamsScreen
      LiveStreamEditorModal.tsx  — wydzielony z LiveStreamsScreen (~700 linii, największy komponent)
      RtmpIngestModal.tsx        — wydzielony z LiveStreamsScreen
      constants.ts               — LIVE_STATUS_COLORS (dziś zduplikowane w LiveStreamsScreen i LivePlayerScreen)
      time.ts                    — parseHms/formatHms/validateHms/updateRtmpRow
      LivePlayerScreen.tsx
      TrailerPickerScreen.tsx
      ThumbnailPickerScreen.tsx
    upload/
      VideoUploadScreen.tsx
      CameraScreen.tsx           — tryby 'new' | 'live'; wołany z Home i LiveStreams
    resume/
      ResumePositionsScreen.tsx
      ResumeSettingsScreen.tsx
    settings/
      SettingsScreen.tsx
```

Decyzje i kompromisy:

- **`CameraScreen` w `upload/`**, mimo że LiveStreams też do niego nawigatuje (mode `'live'`). W HomeScreen jest w sekcji „Upload", więc newcomer szuka go tam. Alternatywa: osobny `features/camera/` — odrzucone, 1-plikowy feature to szum.
- **`BunnyThumbnail` i `ResumeDialog` zostają w `components/`** — używane przez >1 feature (thumbnail: live + playback; resume dialog: player + potencjalnie resume).
- **`HomeOption` idzie do `features/home/`** — używany wyłącznie przez HomeScreen.
- **Bez `index.ts` (barrels)** — importy wskazują konkretny plik, łatwiej grepać i skakać „go to definition". Jedyny koszt: 13 linii importów w `RootNavigator.tsx`.
- **Ekrany <600 linii zostają jednoplikowe** — wewnętrzne pomocnicze komponenty (`UploadRowCard`, `IngestBadge`, `PlayIcon`) zostają w swoich ekranach. Wydzielanie ich to właśnie „rozdrabnianie", którego chcemy uniknąć.

## 5.1. Podział `LiveStreamsScreen.tsx` (1704 → 6 plików)

| Nowy plik | Zawartość | ~linie |
| --- | --- | --- |
| `LiveStreamsScreen.tsx` | komponent ekranu, `loadStreams`, handlery, `renderItem`, `listStyles`, `fabStyles` | ~300 |
| `LiveStreamCard.tsx` | `LiveStreamCard` + `cardStyles` | ~200 |
| `LiveStreamEditorModal.tsx` | modal create/edit + `ThumbnailPreview` + `createStyles` + `rtmpStyles` | ~720 |
| `RtmpIngestModal.tsx` | modal z ingest URLs | ~60 |
| `time.ts` | `parseHms`, `formatHms`, `validateHms`, `formatScheduled`, `updateRtmpRow`, `STATUS_COLORS` | ~60 |

Szczegóły implementacyjne:

- `STATUS_COLORS` trafia do `time.ts` (lub na górę `LiveStreamCard.tsx` — używane tylko tam; preferowane: `LiveStreamCard.tsx`).
- `LiveStreamEditorModal` potrzebuje propów: `stream`, `libraryId`, `pickedTrailerVideoId`, `pickedThumbnailUrl`, `onClose`, `onSaved`, `navigation` (dla pickerów). Callbacki `onTrailerConsumed`/`onThumbnailConsumed` zostają w ekranie.
- Helpery `parseHms/formatHms/validateHms` są pure — eksport z `time.ts` bez zmian sygnatur.

## 5.2. Duplikaty do wydzielenia (audyt 2026-09-20)

Przejrzano wszystkie ekrany. Poniżej realne duplikaty — tabela pokazuje wzorzec, miejsca występowania i cel ekstrakcji. Ekstrahujemy tylko to, co występuje ≥3 razy lub jest kopią 1:1; reszta zostaje lokalnie.

### Wysoki priorytet (duplikacja 1:1 lub ≥4 miejsca)

| Wzorzec | Występuje w | Ekstrakcja | Oszczędność |
| --- | --- | --- | --- |
| `UiState` union + `ListEmptyComponent` (loading / `videoListEmpty` / error+Retry) | VideoListScreen, LiveStreamsScreen, TrailerPickerScreen, ThumbnailPickerScreen — **4 identyczne bloki ~25 linii** | `components/ListStateView.tsx` (`state: 'loading'\|'empty'\|'error'`, `emptyText`, `onRetry`) + wspólny `type AsyncListState<T>` | ~80 linii, jeden wzorzec do naśladowania |
| `LIVE_STATUS_COLORS` | LiveStreamsScreen i LivePlayerScreen — **kopia 1:1 z tym samym komentarzem** | `features/live/constants.ts` | ~10 linii + spójność |
| `formatTime(ms)` → `m:ss` | PlayerScreen, ResumePositionsScreen, ResumeDialog — **3 identyczne kopie** | `utils/format.ts` | ~20 linii |
| `formatTimestamp/formatScheduled/formatDate` → `new Date(iso).toLocaleString()` | LivePlayerScreen, LiveStreamsScreen, ResumePositionsScreen — **3 identyczne kopie pod różnymi nazwami** | `utils/format.ts` jako `formatTimestamp` | ~15 linii |
| `formatBytes` / `formatSize` | VideoUploadScreen (`formatBytes`) i PlayerScreen (`formatSize` — tylko MB) | `utils/format.ts` jako `formatBytes` | ~10 linii |
| `formatHms` / `parseHms` / `validateHms` | LiveStreamsScreen | `utils/format.ts` (formatHms) + `features/live/time.ts` (parse/validate — logika DVR, nie generyczna) | — |
| Toggle row: label (+subtitle/hint) + `Switch` | LiveStreamEditorModal (**6× w jednym pliku**), VideoUploadScreen (`settingsRow`), ResumeSettingsScreen (`switchRow`) | `components/ToggleRow.tsx` (`label`, `subtitle?`, `value`, `onValueChange`) | ~60 linii; PlayerScreen i CameraScreen mają własne implementacje toggle — patrz „decyzje" niżej |
| Shell modala: overlay + karta + title + subtitle + buttons | `styles.modalOverlay/modalContent/modalTitle/modalButtons` (DirectVideoPlayModal, delete-confirm, RtmpIngestModal) + `modalBackdrop/modalCard/modalTitle` (ResumePositionsScreen — **równoległa, prawie identyczna implementacja**) + `ResumeDialog` (trzeci wariant) | `components/Dialog.tsx` (`visible`, `title`, `subtitle?`, `onClose`, `children`, `actions?`) | ~80 linii; ResumeDialog i modale w ResumePositions migrują na Dialog |
| Outlined button: border primary + text primary | `mgmtStyles.actionButton`, `uploadStyles.actionButton`, `createStyles.pickerButton`, `cameraStyles.actionSecondary`, `cardStyles.manageButton` (VideoList), `ResumePositions.actionButton` (wariant filled-tint) | `components/OutlineButton.tsx` (`label`, `onPress`, `danger?`, `disabled?`, `compact?`) | ~50 linii stylów |
| Error box: red-tint box + tekst | `uploadStyles.errorBox`, `createStyles.errorBox`, `cameraStyles.errorBox`, `playerStyles.errorPanel`, `mgmtStyles.statusBox+statusErr` | `components/StatusBanner.tsx` (`message`, `variant: 'error'\|'ok'`) — pokrywa też `statusOk` w VideoManagement | ~40 linii |
| Rozwiązywanie `libraryId`/`accessKey`: `loadSettings()` + `?? BUNNY_*` + `parseInt` + `isNaN` | App.tsx, HomeScreen (2×), VideoListScreen, LiveStreamsScreen, VideoUploadScreen, CameraScreen, SettingsScreen, DirectVideoPlayModal — **~8 kopii** | `loadLibraryConfig(): Promise<{accessKey, libraryId: number \| null}>` w `storage/settings.ts` | ~50 linii, jedno miejsce z logiką fallbacku |

### Średni priorytet (2–3 miejsca, sensowna ekstrakcja)

| Wzorzec | Występuje w | Ekstrakcja |
| --- | --- | --- |
| Progress bar: track + fill `%` | `uploadStyles.progressTrack/Fill` (VideoUpload), `createStyles.uploadProgressTrack/Fill` (editor), `styles.positionBar/Fill` (PlayerScreen) | `components/ProgressBar.tsx` (`progress: 0..1`) |
| Status pill (rounded, tekst) | `uploadStyles.statusPill`, `cardStyles.pill` (LiveStreamCard), `videoCardStyles.pill`, `cardStyles.statusPill` (LivePlayer) | `components/StatusPill.tsx` (`label`, `color?` — domyślnie tint primary) |
| Card: surface + radius + elevation + shadow | **10 definicji** — `styles.card` już istnieje w theme, ale nikt go nie używa (każdy ekran definiuje własny z drobnymi różnicami: radius 12 vs 16, padding) | Ujednolicić: lokalne style rozpinają `...styles.card` i nadpisują tylko różnice; albo `components/Card.tsx`. Preferowane: spread `styles.card` — zero nowych komponentów |
| LabeledInput (label + TextInput) | VideoManagement (`LabeledInput`), editor modal (`label`+`input` ×8), Settings/ResumeSettings (`sectionTitle`+`input`) | `components/LabeledInput.tsx` — ale style celowo się różnią (modal vs screen); **odroczone** — najpierw ujednolicić `styles.input` w theme, ekstrakcja tylko jeśli po ujednoliceniu nadal jest powtórzenie |
| Properties card (label/value rows) | `metaStyles` (PlayerScreen), `cardStyles.propRow` (LivePlayerScreen) | `components/PropertiesCard.tsx` (`rows: {label, value}[]`) — łączy VideoPropertiesCard i LiveStreamPropertiesCard, oba i tak „mirror Android demo" |
| `ItemSeparatorComponent={() => <View style={{height:12}}/>}` | 4× w FlatList | `const ListSeparator` w `components/` — trywialne, ale za darmo |

### Niski / sprzątanie bez ekstrakcji

- `PlayerScreen.toggleStyles` — ręczny switch zbudowany z View (knob), mimo że RN `Switch` jest dostępny → zamienić na `ToggleRow` (zmiana wyglądu, ale spójność > pixel-parity w example).
- `CameraScreen.toggleButton` — toggle jako przycisk ON/OFF → zamienić na `ToggleRow` z `Switch`.
- `styles.errorButton` — **myląca nazwa**: to generyczny primary button modala (używany jako Delete/Done/Cancel/Retry), nie „error button" → przemianować na `modalButton`/`modalPrimaryButton` w theme przy migracji na `Dialog`.
- `Black20Color()` w `theme/styles.ts` — helper zwracający zawsze `'#000000'` → usunąć, wpisać `#000`.
- `Header.tsx` re-eksportuje `colors` (linia 56) — nikt tego nie używa (`import { colors } from '../theme/colors'` wszędzie) → usunąć.
- `formatDuration` w PlayerScreen (z godzinami) vs VideoListScreen (m:ss) — ujednolicić do jednej wersji z godzinami w `utils/format.ts`.

### Szacunek

Ekstrakcje high+medium: **~450–550 linii** mniej, przy ~12 nowych plikach (z czego 7 to <40 linii). `LiveStreamsScreen` po podziale + ekstrakcjach: ~1704 → ~950–1000 linii w 6 plikach. `PlayerScreen`: 533 → ~450. `VideoUploadScreen`: 563 → ~480.

## 5.3. Audyt kolorów — konwencja „kolory tylko z theme/"

Konwencja projektu: kolory pochodzą z `theme/colors.ts` (paleta brandowa + semantyczne `colors.*`). Stan faktyczny: **~110 hardkodowanych literałów** (`#hex`, `rgba()`) poza theme. Część to dokładnie kolory z palety wpisane wartością — np. `#FD8D32` (= `Orange60`), `#25588f` (= `Blue40`), `#CB670D` (= `Orange40`), a `rgba(24,61,109,…)` i `rgba(37,88,143,…)` to `Blue60`/`Blue40` z alfą.

### Literały z istniejącym odpowiednikiem w palecie

| Literał | Token | Miejsca |
| --- | --- | --- |
| `#FD8D32` | `Orange60` / `colors.primary` | App.tsx (`ActivityIndicator`), ResumeSettingsScreen (`Button color`) |
| `#25588f` | `Blue40` / `colors.onSurfaceVariant` | DirectVideoPlayModal |
| `#CB670D` | `Orange40` | TrailerPickerScreen (`warning`) |
| `#FFFFFF`, `#fff` | `White` / `colors.onPrimary` | ~10 miejsc (Player, Camera, LiveStreams, LivePlayer, VideoUpload) |
| `#000`, `#000000` | `Black` | ~7 `shadowColor` + `textShadowColor` + container Camera |
| `rgba(24,61,109,x)` | `Blue60` (= `onSurface`) z alfą .1/.15/.18/.2 | ~10 miejsc — bordery, tracki, tinted buttons, divider |
| `rgba(37,88,143,0.1)` | `Blue40` (= `onSurfaceVariant`) z alfą | 3 miejsca — pill backgrounds |
| `rgba(0,0,0,…)` | `Black` z alfą | scrimy .4/.45/.5, chip .7, errorOverlay .85, hairline .06/.1 |

### Nowe tokeny do dodania w `colors.ts`

| Token | Wartość | Zastępuje | Miejsca |
| --- | --- | --- | --- |
| `error` | `#D32F2F` | `#d32f2f` ×17 **oraz `#B00020` ×4 — dwa różne red, ujednolicić** | wszystkie ekrany |
| `errorTint` | `rgba(211,47,47,0.1)` | errorBox bg ×5 + `rgba(176,0,32,.1)` ×2 | VideoUpload, LiveStreams, Camera, LivePlayer, ResumePositions |
| `success` | `#2E7D32` | ×2 (upload completed, IngestBadge live) | VideoUpload, Camera |
| `successTint` | `rgba(46,125,50,0.1)` | `statusOk` w VideoManagement | VideoManagement |
| `warning` | `#F9A825` | ×3 (preparing badge, ingest connecting) | Camera |
| `processing` / `processingTint` | `#7E57C2` / `rgba(126,87,194,0.12)` | encoding pill | VideoList |
| `live` | `#E53935` | `STATUS_COLORS.RUNNING` | live constants (×2 pliki) |
| `placeholder` | `#999999` | `placeholderTextColor="#999"` **×11** | editor modal, DirectVideoPlayModal |
| `neutral60/50/40/30` | `#666` / `#888` / `#aaa` / `#bbb` | muted/disabled teksty, statusy CREATED/ENDED/UNKNOWN | ~10 miejsc |
| `surfaceVariant` | `#F5F5F5` | copyable row bg | RtmpIngest |
| `surfaceDark` | `#1A1A2E` | thumbnail placeholder bg ×4 | VideoList, ThumbnailPicker, LiveStreams |
| `scrim` | `rgba(0,0,0,0.45)` | modalOverlay .5, menuOverlay .4, backdrop .45 — **ujednolicić** | wszystkie modale |
| `scrimStrong` | `rgba(0,0,0,0.85)` | errorOverlay | Player |
| `chipDark` | `rgba(0,0,0,0.7)` | cast chip | Player |
| `onPrimary85` / `onPrimary60` | `rgba(255,255,255,.85)` / `.6` | teksty na ciemnym overlay | Player, theme/styles |
| `onSurface10` / `onSurface15` / `onSurface20` | `rgba(24,61,109,.1/.15/.2)` | tracki, bordery, tinted buttons | ~8 miejsc (`divider` pokrywa .18) |
| `onSurfaceVariant10` | `rgba(37,88,143,.1)` | pill bg | 3 miejsca |
| `hairline` | `rgba(0,0,0,0.06)` | borderBottom w kartach | LiveStreams, LivePlayer |

### Zasada po migracji

- Zero literałów `#…`/`rgba(…)` poza `theme/` (wyjątek: komentarze o mirrorze z natywnych appek).
- `STATUS_COLORS` (live) i `STATUS_PILL_BG` (upload) mapują na tokeny (`colors.live`, `colors.error`, `colors.success`, `neutral50`…).
- Jeden error red: `colors.error` (dziś `#d32f2f` i `#B00020` współistnieją). Jeden scrim: `colors.scrim` (dziś .4/.45/.5).
- `styles.errorButton` → rename na `modalButton` (to primary button modala, nie error).

### Skala i kolejność

~15 nowych tokenów w `colors.ts`; ~110 czystych zamian literał → token, zero zmian layoutu. Robić **po** ekstrakcji komponentów — wtedy `errorBox`/`pill`/`toggle` mają jedną definicję i zamiana to 1 linia zamiast 5.

## 5.4. Audyt martwego kodu — całe repo (2026-09-20)

Przejrzano całe repozytorium (biblioteka `src/`, `example/`, `docs/`, `plans/`, `scripts/`, `plugin/`). **Biblioteka `src/` jest czysta** — każdy plik ma importera, a `index.ts` eksportuje wyłącznie publiczne API (chronione snapshotem `public-api.test.ts`). Martwy kod jest tylko w `example/` i na roocie repo.

### Pliki do usunięcia

| Plik | Powód |
| --- | --- |
| `example/src/types.ts` | martwy — `Settings` zduplikowany w `storage.ts`, `VideoItem` nieużywany (już w §6) |
| `live-features.md` | audyt z 2 września, **nadrzędny przez `live-features-updated.md`**; oba leżą luźno na roocie repo |
| `.DS_Store` ×~12 | nie trackowane (gitignore łapie), ale śmieci w working tree — `find . -name .DS_Store -not -path './node_modules/*' -delete` |
| `example/build/`, `example/dist/` | artefakty (codegen output, jsbundles) — gitignored; `yarn clean` ich nie czyści, można usunąć ręcznie |

### Martwe eksporty w `example/`

| Symbol | Plik | Referencje |
| --- | --- | --- |
| `clearSettings` | `storage/storage.ts` | 0 |
| `checkBroadcastPermissions` | `media/permissions.ts` | 0 |
| `videoIdRow`, `videoIdText`, `removeButton`, `removeButtonText`, `loadingText` | `theme/styles.ts` | 0 — resztki po starym ekranie listy |
| `Orange80`, `Orange40`, `Blue80`, `Black20`, `Black60`, `Clear` | `theme/colors.ts` | 0 — warstwa palety mirror `Color.kt`; `Orange40`/`Blue40` zyskają użycie przy §5.3 (tokeny). **Decyzja: zostawić jako paletę źródłową dla tokenów, dopisać komentarz „palette layer — używać przez colors.*"** |

### Sprawdzone — zostają

- `plans/Audit-public-sdk-alignment.md`, `plans/Expo-integration.md` — aktualne (z dziś), żyjące dokumenty; `example-expo/` istnieje (minimalna apka, prace w toku).
- `docs/capabilities.json` + `CAPABILITIES.md` — źródło + wygenerowany artefakt (`yarn capabilities:generate`).
- `scripts/*.mjs` — wszystkie 3 podpięte pod npm scripts.
- `native-sdk-baselines.json`, `app.plugin.js`, `lefthook.yml`, `turbo.json`, `example/src/types/*.d.ts` — używane.
- `live-features-updated.md` — aktualny audyt, ale luźny na roocie → **przenieść do `plans/`** (konsekwencja z `Example-app-reorganization.md`).

## 6. Drobiazgi porządkowe

1. **Usunąć `src/types.ts`** — martwy plik; `Settings` już jest w `storage.ts`. Przy okazji usunąć duplikat: `Settings` eksportować tylko z `storage/settings.ts`.
2. **`storage/storage.ts` → `storage/settings.ts`** — nazwa mówi co jest w środku. W środku są też `loadDirectPlayValues/saveDirectPlayValues` — zostają (rozdrabnianie na osobny plik niepotrzebne).
3. **Wydzielić `RootNavigator.tsx`** — `App.tsx` robi się czytelny: init + navigator. Cała tabela „route → ekran" w jednym pliku obok `types.ts`.
4. **Importy** — po przeniesieniach zaktualizować ścieżki `../components/…` → `../../components/…` itd. (feature jest o 1 poziom głębiej). ESLint/import-order już wymusza porządek — `yarn lint` to wyłapie.

## 7. Kolejność wykonania (7 commitów)

1. **Move bez zmian logiki** — `git mv` ekranów do `features/`, `DirectVideoPlayModal` + `HomeOption` do `features/home/`, rename `storage.ts` → `settings.ts`, delete `types.ts`. Fix importów. Weryfikacja: `tsc --noEmit` + lint.
2. **Wydzielenie `RootNavigator`** — mechaniczne przeniesienie JSX z `App.tsx`.
3. **Podział `LiveStreamsScreen`** — największy krok, osobny commit dla czytelnego diffa.
4. **Wspólne utilsy** — `utils/format.ts`, `features/live/constants.ts` (LIVE_STATUS_COLORS), `loadLibraryConfig()` w `storage/settings.ts`. Zamiana kopii na importy we wszystkich ekranach.
5. **Wspólne komponenty** — `ToggleRow`, `Dialog`, `OutlineButton`, `StatusBanner`, `StatusPill`, `ProgressBar`, `ListStateView`, `PropertiesCard`. Migracja ekranów po jednym wzorcu na raz (łatwy review).
6. **Tokeny kolorów** — rozszerzenie `colors.ts` (~15 tokenów, §5.3) + mechaniczna zamiana ~110 literałów na tokeny.
7. **Sprzątanie** — duplikat `Settings`, `Black20Color()`, re-export `colors` z Header, rename `errorButton`, martwe eksporty i klucze stylów (§5.4), `git mv live-features-updated.md plans/`, usunięcie `live-features.md` i `.DS_Store`, ostateczny lint/typecheck.

## 8. Weryfikacja

- `yarn --cwd example typecheck` (lub `tsc --noEmit` z `example/tsconfig.json`)
- `yarn lint` na `example/`
- Smoke test: `yarn example start` + przejście każdej pozycji z Home (13 ekranów). Minimum: build Android/iOS bez błędów bundlera (Metro wyłapie złe importy natychmiast).

## 9. Poza zakresem

- `example-expo/` — osobna apka, 3 pliki, nie wymaga reorganizacji.
- Zmiany w samej bibliotece (`src/` roota).
- Refaktor logiki ekranów (hooki, wspólne fetchowanie) — świadomie odkładamy; example ma pokazywać API biblioteki wprost, nie wzorce architektoniczne.

## 10. Status wdrożenia (2026-09-20) — ✅ ukończone

Wszystkie 7 commitów wdrożone na branchu `fixes`:

1. ✅ Przeniesienie ekranów do `features/`, `storage.ts` → `settings.ts`, usunięcie `types.ts`.
2. ✅ `navigation/RootNavigator.tsx` wydzielony z `App.tsx`.
3. ✅ `LiveStreamsScreen.tsx` (1704 → ~290 linii) + `LiveStreamCard`, `LiveStreamEditorModal`,
   `RtmpIngestModal`, `constants.ts`, `time.ts`.
4. ✅ `utils/format.ts` (formatTime/formatDuration/formatTimestamp/formatBytes),
   `loadLibraryConfig()` — migracja ~8 kopii rozwiązywania konfiguracji.
5. ✅ 8 wspólnych komponentów w `components/`; ~950 linii duplikacji usunięte
   (commit: −947/+380 w migracji).
6. ✅ `colors.ts` rozszerzone o ~30 tokenów semantycznych (status, neutralne, scrimy,
   hairline, warianty alfa); **0 literałów kolorów** poza `theme/colors.ts`.
   Ujednolicono 2 czerwienie błędów i 3 scrimy; `Black20Color()` usunięte.
7. ✅ Martwe eksporty (`checkBroadcastPermissions`), 5 kluczy stylów, `live-features.md`,
   `.DS_Store`, `example/build`+`dist`; `errorButton` → `primaryButton`;
   `live-features-updated.md` → `plans/`.

Weryfikacja końcowa: `typecheck` (root + example) ✅, `eslint` ✅, `jest` 157/157 ✅,
`capabilities:check` ✅. `native-baselines:check` pominięty — wymaga zsynchronizowanego
checkoutu sąsiedniego repo `bunny-stream-android` (środowiskowe, niezwiązane ze zmianami).

Pozostawione świadomie: paleta (`Orange80`, `Blue80`, `Black20`…) jako mirror `Color.kt`,
eksporty `index.ts` biblioteki (publiczne API).
