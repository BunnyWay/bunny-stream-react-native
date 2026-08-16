# Plan: Dostosowanie example app do Android demo

Cel: Dostosować example app React Native do struktury i funkcji demo app z `bunny-stream-android-main`, uwzględniając ograniczenia obecnego API biblioteki RN.

---

## Kontekst

### Android example app (`bunny-stream-android-main/app/`)

Bogata aplikacja demo z 7 ekranami/funkcjami:

**Home Screen** — 3 sekcje z opcjami:

- **Actions**: Video player (lista filmów), Video Upload, Camera Upload, Direct video play
- **Resume Positions**: Resume Position Settings, Manage Resume Positions
- **Configuration**: Bunny Stream Configuration

**Pozostałe ekrany:**

- Settings (Library ID + Access Key)
- Library (lista filmów z miniaturkami, upload, delete, TUS upload toggle)
- Player (player + kontrola prędkości + karta właściwości filmu + resume dialog)
- Resume Position Settings (enable, retention days, min watch time, thresholds)
- Resume Position Management (lista zapisanych pozycji)
- Recording Activity (nagrywanie z kamery + upload)

### React Native library API (`src/index.tsx`)

Obecnie wystawia tylko:

- `initialize(accessKey, libraryId)`
- `BunnyStreamPlayer` — komponent z props: `videoId`, `libraryId`, `token`, `expires`, `autoPlay` + event handlery
- Ref commands: `play`, `pause`, `seekTo`, `setVolume`, `setPlaybackRate`

**Nie wystawia:** API listy filmów, uploadu, nagrywania z kamery, zarządzania resume positions.

---

## Zmiany

### A. Zależności (do zainstalowania w `example/`)

- `react-native-dotenv` — dev dependency (Babel plugin do wczytywania `.env`)
- `@react-native-async-storage/async-storage` — dependency (persystencja ustawień)

### B. Konfiguracja env

- **`example/babel.config.js`** — dodanie presetu `react-native-dotenv`:

  ```js
  ['module:react-native-dotenv', {
    moduleName: '@env',
    path: '.env',
    safe: false,
    allowUndefined: true,
  }]
  ```

- **`example/.env`** — nowy plik z obecnymi domyślnymi wartościami:

  ```
  BUNNY_ACCESS_KEY=eed581d7-235a-4bea-a78968ee066d-5ea3-4011
  BUNNY_LIBRARY_ID=726775
  BUNNY_VIDEO_ID=575cfbfe-08c0-4d2e-b0f4-3a81a0357d4b
  ```

- **`example/.gitignore`** (lub root `.gitignore`) — dodanie wpisu `.env` (zachować `.env.example` jeśli będzie)

### C. Storage manager (`example/src/storage.ts` — nowy plik)

Prosty moduł opakowujący AsyncStorage:

- `loadSettings(): Promise<Settings | null>` — wczytuje `{ accessKey, libraryId }` z AsyncStorage
- `saveSettings(settings): Promise<void>` — zapisuje
- `clearSettings(): Promise<void>` — czyści
- Klucze: `@bunny_demo/access_key`, `@bunny_demo/library_id`
- Typ `Settings = { accessKey: string | null; libraryId: string }`

**Dodatkowo — lista video IDs:**

- `loadVideoIds(): Promise<string[]>` — wczytuje listę zapisanych video IDs
- `saveVideoIds(ids: string[]): Promise<void>` — zapisuje listę
- `addVideoId(id: string): Promise<string[]>` — dodaje ID na początek listy (uniknąć duplikatów), zwraca nową listę
- `removeVideoId(id: string): Promise<string[]>` — usuwa ID z listy, zwraca nową listę
- Klucz: `@bunny_demo/video_ids`
- Typ: `string[]`
- Fallback: jeśli storage pusty, seeduj z `BUNNY_VIDEO_ID` z `.env` (jako jedyny element listy)

### D. Zmiany w `example/src/App.tsx`

**1. Inicjalizacja z fallbackiem (mount effect):**

```ts
React.useEffect(() => {
  (async () => {
    const stored = await loadSettings();
    const accessKey = stored?.accessKey ?? ENV_BUNNY_ACCESS_KEY;
    const libraryId = stored?.libraryId ?? ENV_BUNNY_LIBRARY_ID;
    setAccessKey(accessKey);
    setLibraryId(libraryId);
    initialize(accessKey, parseInt(libraryId, 10));
  })();
}, []);
```

- Import z `@env`: `import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID, BUNNY_VIDEO_ID } from '@env'`
- Domyślny `videoId` w `HomeScreen` = `BUNNY_VIDEO_ID` (z env, fallback hardcoded jeśli undefined)

**2. `handleSaveSettings` — persystencja:**

```ts
const handleSaveSettings = async () => {
  // ... walidacja (jak obecnie)
  initialize(accessKey || null, libId);
  await saveSettings({ accessKey, libraryId });
  setScreen('home');
};
```

**3. Stan ładowania:**

- Dodać `const [loading, setLoading] = React.useState(true)` — pokazuje loading/empty dopóki AsyncStorage nie zwróci wartości (uniknąć mrugania hardcoded defaults)

**4. Home Screen — struktura sekcji (jak w Androidzie):**

- **Sekcja "Actions":**
  - `Video player` → **aktywne** (otwiera nowy ekran VideoList — lista zapisanych video IDs)
  - `Video Upload` → wyszarzone, "Coming soon" (brak upload API)
  - `Camera upload` → wyszarzone, "Coming soon" (brak camera API)
  - `Direct video play` → aktywne (otwiera modal — szybkie odtworzenie bez zapisywania do listy)
- **Sekcja "Resume Positions":**
  - `Resume Position Settings` → wyszarzone, "Coming soon"
  - `Manage Resume Positions` → wyszarzone, "Coming soon"
- **Sekcja "Configuration":**
  - `BunnyStream Configuration` → aktywne (otwiera Settings)
- Komponent `HomeOption` dostanie prop `disabled` + `badge` ("Coming soon") i styl wyszarzenia

**5. Oznaczenie "React Native" w UI:**

- Header Home Screen — tytuł zmieniony z `BunnyStream Demo` na `BunnyStream Demo (React Native)` — widoczne od razu na ekranie głównym
- Alternatywnie: mały badge/subtitle pod tytułem w headerze, np. `React Native` jako mniejszy tekst pod `BunnyStream Demo`

**6. Direct Video Play modal — dodanie pola Library ID:**

- Dwa pola: **Video ID** + **Video Library ID** (placeholder: "Use default")
- Logika: jeśli Library ID w modalu jest puste → użyj globalnego z `libraryId` state; jeśli wypełnione → nadpisz per-odtwarzanie
- `PlayerParams` dostaje opcjonalne `libraryId` (już ma, ale będzie nadpisywane z modala)
- Walidacja: Video ID wymagane; Library ID opcjonalne (musi być liczbą jeśli wypełnione)

**7. Nowy ekran: VideoList (lista zapisanych video IDs):**

Ponieważ biblioteka RN nie ma jeszcze API do pobierania listy filmów z Bunny Stream, ekran ten działa jako lokalna lista zakładek video IDs.

- **Nawigacja:** nowy stan `Screen = 'home' | 'settings' | 'player' | 'videoList'`
- **Źródło danych:** `loadVideoIds()` z storage.ts, fallback do `BUNNY_VIDEO_ID` z `.env` (seed przy pierwszym uruchomieniu)
- **UI:**
  - Header z tytułem "Video List" + przycisk back (jak w innych ekranach)
  - Na górze listy: przycisk **"+ Add Video ID"** (orange, primary) → otwiera modal z polem TextInput na video ID
  - Lista pozycji (ScrollView/FlatList): każda pozycja pokazuje video ID (skrócone z ellipsis), tap → `onPlayVideo(id)` → otwiera PlayerScreen
  - Opcjonalnie: przycisk usuwania (×) na każdej pozycji → `removeVideoId(id)` + odśwież listę
  - Empty state: "No videos yet. Tap + to add one."
- **Dodawanie nowego ID:**
  - Modal z TextInput (placeholder "Video ID")
  - Po zatwierdzeniu: `addVideoId(id)` → zapis do storage + odśwież listę
  - Walidacja: niepuste, brak duplikatów (jeśli istnieje, Alert "Already in list")
  - Nowe ID dodawane na początek listy
- **Persystencja:** lista przeżywa restart aplikacji (AsyncStorage)
- **Styl:** zgodny z sekcją E — białe tło, karty z cieniem, tekst Blue60, przycisk add w orange

**8. Player Screen — uproszczona kontrola prędkości:**

- Sekcja "Playback Speed" pod playerem z przyciskami: **0.5x, 1.0x, 1.5x, 2.0x**
- Aktywny przycisk wyróżniony (kolor primary `#FD8D32` — orange)
- Używa `playerRef.current?.setPlaybackRate(speed)`
- `currentSpeed` state lokalnie w `PlayerScreen`
- Zachowuję istniejący `status` text

**9. Settings Screen — dostrojenie etykiet:**

- Sekcja "Video Library ID" → zostaje (zgodne z Androidem)
- Sekcja "Video Library API Key" → zostaje (zgodne z Androidem)
- Brak zmian strukturalnych — tylko ew. dopasowanie kolejności/etykiet do Androida (już są zgodne)

### E. Kolorystyka i styl (zgodne z `BunnyStreamTheme` z Androida)

Android app używa light theme z `Theme.kt`:

| Token Androida      | Hex         | Zastosowanie w RN example                              |
| ------------------- | ----------- | ----------------------------------------------------- |
| `primary` Orange60  | `#FD8D32`   | Header background, akcenty, aktywny przycisk prędkości |
| `onPrimary` White   | `#FFFFFF`   | Tekst w headerze, tekst na przyciskach primary        |
| `background` White  | `#FFFFFF`   | Tło ekranów (zamiast obecnego `#f5f5f7`)              |
| `onSurface` Blue60  | `#183D6D`   | Główny tekst (option titles, sekcje)                  |
| `onSurfaceVariant` Blue40 | `#25588F` | Tekst poboczny (subtitle, etykiety)             |
| `Orange40`          | `#CB670D`   | Hover/pressed stan orange (opcjonalnie)              |
| `Blue60`            | `#183D6D`   | Tło player screen (zamiast czarnego) — opcjonalnie   |

**Konkretne zmiany w stylach `App.tsx`:**

- `container.backgroundColor`: `#f5f5f7` → `#FFFFFF`
- `header.backgroundColor`: `#6c2bd9` (purple) → `#FD8D32` (orange)
- `headerTitle.color`: `#fff` → zostaje (white on orange)
- `backButtonText.color`: `#fff` → zostaje
- `sectionTitle.color`: `#666` → `#25588F` (Blue40)
- `optionTitle.color`: `#1a1a1a` → `#183D6D` (Blue60)
- `optionSubtitle.color`: `#999` → `#25588F` (Blue40)
- `divider.backgroundColor`: `#e5e5e5` → `rgba(24,61,109,0.18)` (Blue60 @ 18%)
- `card` shadow: zostaje, ale `backgroundColor` surface → `#FFFFFF`
- `input`: białe tło + border `#FD8D32` (orange) na focus (jeśli możliwe)
- `saveButtonContainer` / Button: kolor primary orange `#FD8D32`
- Player screen: `playerContainer.backgroundColor` `#000` → `#183D6D` (Blue60) lub zostawić czarne dla kontrastu wideo — do decyzji przy implementacji
- Aktywny przycisk prędkości: `#FD8D32` (orange) z białym tekstem
- StatusBar: `backgroundColor` → `#FD8D32`, `barStyle` → `light-content` (białe ikony na orange)

### Czego NIE zmieniam

- Logiki `initialize` na mount (rozszerzone o storage fallback)
- Struktury nawigacji (`screen` state: 'home' | 'settings' | 'player' | 'videoList')
- Event handlerów playera (`onReady`, `onPlay`, `onPause`, `onEnd`, `onError`, `onProgress`)

---

## Pliki do modyfikacji / stworzenia

## Pliki do modyfikacji / stworzenia

- **Modyfikacja:** `example/babel.config.js`, `example/package.json`, `example/.gitignore`
- **Nowe:** `example/.env`, cała struktura `example/src/` (patrz sekcja F)

### F. Struktura folderów (Wariant A — feature-first)

Struktura odzwierciedla pakiety feature z Androida (`home/`, `settings/`, `player/`, `library/`), zaadaptowana do konwencji RN/TypeScript. `App.tsx` przestaje być monolitem — logika ekranów trafia do osobnych plików.

```
example/src/
├── App.tsx                    # Root: stan nawigacji + inicjalizacja (env + storage)
├── navigation/
│   └── types.ts               # type Screen, PlayerParams, nawigacja
├── theme/
│   ├── colors.ts              # Orange60 #FD8D32, Blue60 #183D6D, Blue40 #25588F... (z Color.kt)
│   └── styles.ts              # shared StyleSheet (header, card, input, divider...)
├── storage/
│   └── storage.ts             # AsyncStorage wrapper (settings + videoIds)
├── screens/
│   ├── HomeScreen.tsx         # sekcje Actions / Resume Positions / Configuration
│   ├── SettingsScreen.tsx     # Library ID + Access Key (z persystencją)
│   ├── PlayerScreen.tsx       # BunnyStreamPlayer + speed control + status
│   └── VideoListScreen.tsx    # lista zapisanych video IDs + add/remove
├── components/
│   ├── HomeOption.tsx         # wiersz opcji (prop disabled + "Coming soon" badge)
│   ├── Header.tsx             # wspólny header z back button (orange #FD8D32)
│   └── AddVideoIdModal.tsx    # modal do dodawania ID (używany w Home + VideoList)
└── types.ts                   # Settings, VideoItem, shared types
```

**Mapowanie Android → RN:**

| Android (Kotlin package) | RN (folder) |
| ----------------------------------- | ---------------------- |
| `ui/theme/` (Color, Theme, Type) | `theme/` (colors, styles) |
| `data/` (SimpleResumePositionStorage) | `storage/` (storage.ts) |
| `home/`, `settings/`, `player/`, `library/` | `screens/` (po jednym pliku na ekran) |
| `navigation/AppNavHost.kt` | `navigation/types.ts` + logika w `App.tsx` |
| współdzielone composables | `components/` |

**Korzyści:**

- Łatwa rozszerzalność — nowe feature (upload, camera, resume) to nowe pliki w `screens/` bez modyfikacji istniejących
- `theme/colors.ts` jako single source of truth dla kolorów Bunny
- Separacja zmartwień: ekran vs komponent vs storage vs theme

## Kolejność implementacji

1. Zainstalować deps (`yarn add` w `example/`)
2. Skonfigurować babel + stworzyć `.env` + `.gitignore`
3. Stworzyć strukturę folderów z sekcji F (`theme/`, `storage/`, `navigation/`, `types.ts`)
4. Stworzyć komponenty współdzielone (`components/`)
5. Stworzyć ekrany (`screens/`)
6. Przepisać `App.tsx` jako root z nawigacją + inicjalizacją
7. Zweryfikować: `yarn typecheck` w `example/`
