# Etap 1: działająca aplikacja example

Celem pierwszego etapu jest utworzenie powtarzalnego środowiska developerskiego, w którym aplikacja React Native korzysta lokalnie z kodu biblioteki i działa na iOS oraz Androidzie z włączoną New Architecture.

## Najważniejsza korekta zakresu

W tym etapie **nie definiujemy jeszcze TurboModule ani komponentu Fabric**. Sam Codegen może działać bez gotowej implementacji natywnej, ale testowy spec nie zweryfikowałby integracji end-to-end, a eksport modułu przez `TurboModuleRegistry.getEnforcing` przed jego rejestracją mógłby powodować błąd uruchomieniowy. Konfigurację Codegen dodamy na początku etapu 2 razem z pierwszym pionowym wycinkiem playera.

Nie dodajemy też `babel-plugin-module-resolver`. Metro oraz lokalna zależność npm wystarczą, a dodatkowy alias tworzyłby drugi, zbędny mechanizm rozwiązywania modułów.

## Zakres

### 1. Ustalenie wersji narzędzi

Przed wygenerowaniem aplikacji sprawdzić aktualną stabilną wersję React Native i wymagane przez nią wersje Node, React, Xcode, CocoaPods, JDK i Android Gradle Plugin.

- Przypiąć konkretną wersję React Native w `example/package.json`; nie pozostawiać `latest`.
- Użyć wersji, w której New Architecture jest domyślna i wspierana produkcyjnie.
- Ujednolicić Node w `.nvmrc`, `package.json#engines` i CI. Obecny `react-native-builder-bob@0.43.0` wymaga co najmniej Node `20.19.0` albo `22.12.0`, więc obecne `engines.node >=18` jest nieprawidłowe. Preferowana wersja: Node 22 zgodna z CI.
- Nie ustalać jeszcze minimalnego `peerDependencies.react-native` wyłącznie na podstawie historycznego progu New Architecture. Docelowy floor wyznaczyć w etapie 2 po sprawdzeniu użytych API Codegen/Fabric oraz natywnych SDK Bunny. W etapie 1 zachować obecny peer range jako tymczasowy i opisać w README, że biblioteka jest w budowie, a docelowa minimalna wersja RN zostanie ustalona przed pierwszym wydaniem.

### 2. Wygenerowanie `example/`

Utworzyć czystą aplikację React Native CLI w katalogu `example/` z nazwą `BunnyStreamExample`, przypinając wersję RN ustaloną w kroku 1.

Aplikacja powinna zawierać standardowe katalogi:

- `example/ios/`
- `example/android/`
- `example/src/` albo prosty `example/App.tsx`
- konfiguracje Metro, Babel i TypeScript wygenerowane dla wybranej wersji RN

Nie kopiować ręcznie konfiguracji ze starszych template'ów. Punktem wyjścia ma być oficjalny template zgodny z przypiętą wersją RN.

### 3. Lokalne połączenie example z biblioteką

W `example/package.json` dodać bibliotekę jako lokalną zależność:

```json
"bunny-stream-react-native": "file:.."
```

W publicznym mapowaniu pakietu dodać warunek/entry point `react-native` wskazujący na `src/index.ts`, pozostawiając `main`, `module` i `types` dla opublikowanych artefaktów w `lib/`. Dzięki temu Metro w example konsumuje źródła, a Node/bundlery konsumentów nadal używają zbudowanej paczki.

Skonfigurować Metro tak, aby:

- obserwował root biblioteki,
- respektował entry point `react-native` i ładował kod biblioteki z `src/`,
- rozwiązywał `react` i `react-native` wyłącznie z `example/node_modules`, zapobiegając powstaniu dwóch kopii Reacta,
- nie wymagał `npm run build` po każdej zmianie TypeScript w `src/`.

Nie dodawać aliasu Babel, chyba że test uruchomieniowy wykaże problem, którego nie da się rozwiązać konfiguracją Metro.

### 4. Minimalny ekran smoke-test

Zastąpić ekran startowy prostym widokiem, który importuje `BUNNY_STREAM_REACT_NATIVE_VERSION` z nazwy pakietu i wyświetla ją na ekranie.

Smoke-test ma potwierdzić:

1. import przez publiczny entry point pakietu,
2. lokalne rozwiązywanie źródeł przez Metro,
3. Fast Refresh po zmianie kodu w `src/`,
4. działanie aplikacji na obu platformach,
5. aktywną New Architecture.

Nie dodawać jeszcze playera, eventów, uploadu ani dostępu do Bunny API.

### 5. Skrypty developerskie

W root `package.json` dodać jednoznaczne skrypty delegujące do example, np.:

- `example:start`
- `example:ios`
- `example:android`
- `example:typecheck`

Skrypty powinny działać bez ręcznego przechodzenia do `example/`. Należy uważać na lifecycle `prepare`: lokalna zależność `file:..` może uruchamiać build biblioteki podczas instalacji, dlatego po instalacji zweryfikować brak zapętlenia i poprawne użycie istniejącego `bob build`.

### 6. Gitignore i dokumentacja

Rozszerzyć `.gitignore` o artefakty aplikacji example, między innymi:

- `example/node_modules/`
- `example/ios/Pods/`
- `example/ios/build/`
- `example/android/.gradle/`
- `example/android/build/`
- `example/android/app/build/`
- `example/android/local.properties`

Nie ignorować plików projektu i lockfile potrzebnych do powtarzalnego buildu.

Zaktualizować:

- `README.md` — wymagania developerskie, informację, że planowana implementacja natywna będzie „New Architecture only”, i sposób uruchomienia example,
- `CONTRIBUTING.md` — instalacja zależności oraz komendy iOS/Android,
- `.nvmrc` i `package.json#engines` — spójna wersja Node.

Nie tworzyć osobnego dokumentu architektury w tym etapie.

### 7. CI dla etapu 1

Rozszerzyć istniejący job linuksowy tylko o tanią weryfikację JavaScript/TypeScript example:

- instalacja zależności example w sposób zgodny z wybranym układem lockfile,
- typecheck example,
- zachowanie dotychczasowych `lint`, `typecheck`, `build` i Fallow dla biblioteki.

Nie dodawać jeszcze pełnych buildów iOS/Android do CI. Wymagałyby macOS/JDK/Android SDK oraz znacznie wydłużyły pipeline, a przed powstaniem kodu natywnego dawałyby niewielką wartość. Natywne joby CI dodać razem z pierwszą implementacją bridge'a.

## Pliki objęte zmianą

### Nowe

- `example/package.json`
- `example/package-lock.json` lub lockfile wynikający z przyjętego układu npm
- `example/App.tsx` i pliki startowe
- `example/metro.config.js`
- `example/babel.config.js`
- `example/tsconfig.json`
- `example/ios/**`
- `example/android/**`

### Modyfikowane

- `package.json` — entry point `react-native`, skrypty example i poprawiony `engines.node`; bez `codegenConfig` na tym etapie
- `.nvmrc`
- `.gitignore`
- `README.md`
- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`

### Bez zmian w tym etapie

- `src/index.ts`, poza ewentualnym zachowaniem obecnego eksportu wersji do smoke-testu
- brak `src/specs/**`
- brak root `ios/**` i `android/**` biblioteki
- brak `codegenConfig`
- brak zależności Bunny Stream iOS/Android

## Kryteria akceptacji

- [ ] Instalacja zależności od czystego checkoutu jest udokumentowana i powtarzalna.
- [ ] `npm run lint`, `npm run typecheck` i `npm run build` przechodzą w root.
- [ ] Typecheck example przechodzi.
- [ ] Example uruchamia się na symulatorze iOS i emulatorze Android.
- [ ] Na obu platformach wyświetlana jest wersja importowana jako `bunny-stream-react-native`.
- [ ] Logi buildu potwierdzają włączoną New Architecture.
- [ ] Zmiana wartości eksportowanej z `src/index.ts` pojawia się przez Fast Refresh bez ręcznego `bob build`.
- [ ] Metro nie zgłasza dwóch kopii Reacta ani problemów z symlinkiem/local package.
- [ ] CI nadal przechodzi i dodatkowo sprawdza TypeScript example.

## Następny etap

Etap 2 powinien zdefiniować pierwszy pionowy wycinek API: minimalny Fabric `BunnyPlayerView` z jednym identyfikatorem źródła oraz podstawowymi eventami. Dopiero wtedy dodajemy `codegenConfig`, target Codegen, wygenerowane interfejsy i minimalne implementacje iOS/Android. TurboModule dla metod niezwiązanych bezpośrednio z widokiem można zaplanować po uruchomieniu playera end-to-end.
