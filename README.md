# CappyTronic

Edukacyjny symulator obwodów elektronicznych (w stylu TinkerCad) dla szkół: elementy elektroniczne, symulacja analogowa
i cyfrowa, mikrokontrolery programowane w Arduino C++, MicroPythonie i asemblerze, sieć (MQTT, HTTP, Ethernet),
eksport do JSON i KiCad oraz wgrywanie programów do prawdziwych płytek przez USB. Interfejs po polsku i angielsku,
działa offline.

Wersja: **2.4.1**

## Co jest w środku

* **Silnik symulacji:** analiza węzłowa (MNA) z metodą Newtona dla elementów nieliniowych, warstwa cyfrowa ze zdarzeniami
i czasem z dokładnością do cyklu procesora.
* **Mikrokontrolery:**

|Układ / płytka|Emulacja|Program|
|-|-|-|
|Arduino Uno, Nano, Mega, ATmega328P, ATtiny85|avr8js|Arduino C++ (avr-gcc)|
|ESP32-C3-Zero, ESP32 DevKit, NodeMCU ESP8266, Pico W|wątek Web Worker|MicroPython (WebAssembly) albo C++ (clang → WebAssembly)|
|STM32F103 Blue Pill|własny emulator ARM Cortex-M3 i peryferiów|Arduino C++ (arm-none-eabi-gcc)|
|PIC16F84A, PIC18F4550|własne emulatory rdzeni|asembler MPASM (wbudowany asembler) albo plik HEX|

* **Peryferia:** wyświetlacze (HD44780, SSD1306, ST7920, TFT), ekspandery, RTC, ADC/DAC, pamięci, CAN (MCP2515),
Ethernet (ENC28J60 z wirtualnym routerem).
* **Sieć:** wbudowany serwer MQTT (aedes), połączenia płytek przez sieć komputera; domyślnie tylko sieć lokalna.
* **Wgrywanie przez USB:** Web Serial. Obsługiwane metody:

  * STK500v1 – Uno, Nano, ATmega328P;
  * STK500v2 – Mega;
  * Arduino as ISP – ATtiny85;
  * bootloader UART STM32 – Blue Pill;
  * surowy REPL MicroPythona – ESP32, ESP8266, Pico W.

* **Biblioteka zewnętrzna (LCSC):** osobna zakładka palety z katalogiem popularnych części ze sklepu LCSC – opis niżej.

## Biblioteka zewnętrzna (LCSC)

Zakładka **Biblioteka zewnętrzna** w palecie części zawiera katalog popularnych elementów sprzedawanych w sklepie
[LCSC](https://www.lcsc.com/). Każda pozycja ma numer LCSC (np. `C25804`), numer producenta, producenta, obudowę
i parametry z karty katalogowej. Pozycję przeciąga się na matę jak zwykły element. Wstawiony element pamięta numer
LCSC: panel właściwości pokazuje dane pozycji, a eksport do KiCad dodaje pole `LCSC` (przydatne przy montażu w JLCPCB).

Katalog jest zapisany w aplikacji (`src/js/lcsc_catalog.js`) i działa bez internetu. Aplikacja nie pobiera danych
ze sklepu. Katalog zawiera tylko fakty (oznaczenia i parametry), bez opisów i zdjęć ze sklepu. Przed zamówieniem
sprawdź dostępność i dokładny wariant na lcsc.com.

**Wyszukiwarka.** Każde słowo zapytania musi pasować:

|Zapytanie|Znajduje|
|-|-|
|`C25804`, `c258`|numer LCSC (od początku numeru)|
|`0603WAF1002T5E`, `AMS1117`|numer producenta, nazwę rodziny|
|`rezystor 0402`, `mosfet p`, `schottky`|nazwę, kategorię, obudowę, typ|
|`10k`, `100n`, `3.3V`|wartości parametrów|
|`r=10k`, `c<=1u`, `vout=3.3`, `vds>=30`, `ic>0.5`|parametry z karty (`=`, `:`, `<`, `<=`, `>`, `>=`, przedrostki SI)|

Klucze parametrów: `r`, `pw` (moc), `c`, `v`, `vout`, `vin`, `i`, `vdrop`, `vf`, `vr`, `vz`, `vce`, `ic`, `hfe`,
`vds`, `id`, `vth`, `rds`, `gbw`, `ch`, `vcc`, `iq`, `baud`, `bits`. Pod polem wyszukiwania można też wybrać
kategorię i pokazać tylko pozycje z pełnym modelem.

**Co jest symulowane.** Katalog ma 72 pozycje. 68 z nich ma **pełny model**, czyli model elektryczny z parametrami
z karty katalogowej:

* rezystory 0402/0603/0805 (wartość i moc znamionowa) i kondensatory MLCC;
* diody LED SMD z napięciem przewodzenia z karty;
* diody: 1N4148W, M7 (1N4007), SS14 i B5819W (model 1N5819), SS34, SS210, Zener ZMM5V6;
* tranzystory BJT: MMBT3904, MMBT3906, MMBT2222A, 2N3906, S8050, SS8050, SS8550;
* MOSFET-y: 2N7002, BSS138, AO3400A, AO3401A, SI2301CDS;
* stabilizatory LDO: AMS1117 (1,8 / 3,3 / 5 V), XC6206, ME6211, AP2112K oraz TL431;
* wzmacniacze i komparatory: LM358, LM324, LMV324 (wyjście rail-to-rail), LM393;
* NE555, 74HC00, 74HC14, 74HC595, EEPROM AT24C02, transoptor PC817, przycisk TS-1187A i przekaźnik SRD-05VDC-SL-C.

Pozostałe 4 pozycje mają **model zastępczy**. Są to CH340G, CH340C, FT232RL i DS3231: symulator ma je jako moduły
z uproszczonym zestawem wyprowadzeń, a panel właściwości opisuje różnice. Elementy SMD są rysowane jak ich odpowiedniki
przewlekane i mają te same parametry elektryczne. Numery nóżek obudowy SMD podaje opis elementu. Wejście EN
stabilizatorów ME6211 i AP2112 jest w symulatorze zawsze włączone.

**Dodawanie pozycji.** Dopisz obiekt do tablicy `LCSC_CATALOG` w `src/js/lcsc_catalog.js`, np.:

```js
{ lcsc: 'C25804', mpn: '0603WAF1002T5E', mfr: 'UNI-ROYAL', pkg: '0603', cat: 'res', type: 'resistor',
  props: { r: 10e3, w: 0.1 }, p: { r: 10e3, pw: 0.1, tol: 1 }, sim: 'full' },
```

* `type` to istniejący element symulatora (klucz `PARTS`), a `props` to jego właściwości (np. `model`, `v`, `vf`).
  Dla rezystorów, kondensatorów i diod LED są skróty `lcR`, `lcC` i `lcLed`.
* `p` to parametry do wyszukiwania (liczby w jednostkach SI, klucze z `LCSC_PARAMS`).
* `sim: 'approx'` wymaga pola `note` z opisem różnic.
* Część bez modelu w symulatorze najpierw dopisz jako rodzinę w `src/js/parts_lcsc.js` (zob. `docs/ARCHITEKTURA.md`).

Numer LCSC i dane bierz z karty katalogowej producenta i strony produktu. Potem uruchom `node tests/t_lcsc.js`:
test sprawdza poprawność wszystkich pozycji i wstawia każdą z nich do symulacji.

## Struktura katalogów

```
src/
  shell.html            szablon strony (style CSS, układ okna)
  js/                   moduły aplikacji – sklejane w kolejności z scripts/config.mjs (MODULES)
    util, i18n            narzędzia, tłumaczenia PL/EN
    engine, draw          silnik symulacji (MNA, zdarzenia cyfrowe), rysowanie SVG
    parts\_\*.js            elementy: podstawowe, półprzewodniki, analogowe, logiczne, pasywne, mikrokontrolery AVR
    parts\_lcsc, lcsc\_catalog  biblioteka zewnętrzna: rodziny modeli i katalog części LCSC
    mcu.js                integracja avr8js (AVR), port szeregowy, zegar
    pyboard.js, parts\_py  płytki MicroPython/C++ (Worker + SharedArrayBuffer)
    periph.js, ethnet.js  moduły peryferyjne, ENC28J60 + wirtualna sieć
    picasm, pic16, pic18  asembler MPASM i emulatory PIC
    stm32.js, cpuchip.js  emulator Cortex-M3 + STM32F103, wspólna obsługa układów z własnym rdzeniem
    examples, ui, mats    przykłady, interfejs, maty z opisem modułów
    ui\_lcsc               zakładka „Biblioteka zewnętrzna” i wyszukiwarka katalogu
    kicad.js, ui\_net      eksport/import KiCad, panel MQTT
    upload.js             wgrywanie do prawdziwych urządzeń (Web Serial)
  assets/               ikony, dane (mapy pinów, czcionki wyświetlaczy)
  micropython/          wątek MicroPythona i moduły (machine, network, sterowniki)
  cpp-wasm/             rdzeń Arduino C++ dla płytek ESP/Pico (WebAssembly) i wątek uruchomieniowy
  stm32/                rdzeń Arduino CappyTronic dla STM32F103 (rejestry, startup, linker script)
  avr8js-entry.js       punkt wejścia do zbudowania avr8js
electron/               aplikacja desktopowa: proces główny, preload, sieć (MQTT/HTTP/TCP), usługi kompilacji
scripts/                skrypty budowania (Node.js) – opis niżej
packaging/              pliki dołączane do paczek (Linux: uruchamianie i instalacja; README dla Windows i macOS)
tests/                  testy (jsdom + kompilatory) – npm test
docs/ARCHITEKTURA.md    opis działania dla programistów

build-scripts/          skrypty budowania (dwuklik / terminal) – lokalnie i w Dockerze (docker-build.*)
```

Katalogi tworzone przez skrypty (nie należą do źródeł): `node\_modules/`, `vendor/` (pobrane kompilatory i źródła
bibliotek Arduino), `build/` (prekompilowane rdzenie, pliki pośrednie), `dist/` (wyniki).

## Wymagania do budowania

* **Node.js 20 lub nowszy** (z npm) – [https://nodejs.org](https://nodejs.org).
* **Internet przy pierwszym budowaniu.** Pobierane są pakiety npm, Electron, kompilatory (avr-gcc, wasi-sdk,
arm-none-eabi-gcc) i źródła bibliotek Arduino z GitHuba. Łącznie około 1 GB; kopie trafiają do `vendor/downloads`.
* **Polecenie `tar`.** Jest w systemie w Linuksie, macOS i Windows 10/11.
* **Linux:** do utworzenia paczki `.tar.gz` z dołączoną glibc (działa na starszych dystrybucjach) – system z glibc ≥ 2.36
(np. Ubuntu 23.04+, Debian 12+). Na starszym systemie paczka powstanie, ale będzie wymagała glibc ≥ 2.36.
* **macOS:** Xcode Command Line Tools (`xcode-select --install`). avr-gcc dla macOS pochodzi z Arduino (7.3.0),
na Apple Silicon działa przez Rosettę. Można też wskazać własny: `AVR\_GCC\_DIR=/ścieżka/do/avr-gcc`.

## Budowanie – gotowe skrypty

|System|Polecenie|Wynik w `dist/`|
|-|-|-|
|Linux|`./build-scripts/build-linux.sh`|`CappyTronic-2.4.1-Linux-x64.tar.gz`|
|Windows|`build-scripts\build-windows.bat` (dwuklik)|`CappyTronic-2.4.1-Windows-x64.zip`|
|macOS|`./build-scripts/build-mac.sh` albo dwuklik `build-scripts/build-mac.command`|`CappyTronic-2.4.1-macOS-<arch>.zip`|
|Jeden plik HTML|`./build-scripts/build-html.sh` / `build-scripts\build-html.bat`|`CappyTronic.html`|

Skrypty leżą w folderze `build-scripts/`, ale zawsze pracują w katalogu głównym repozytorium – można je uruchamiać
z dowolnego miejsca (także dwuklikiem). Wynik trafia do `dist/` w katalogu głównym.

### Budowanie w Dockerze (bez instalowania Node.js)

Jeśli nie chcesz instalować Node.js / npm albo masz inne ich wersje, użyj Dockera. Skrypt uruchamia czysty kontener
`node:20`, kopiuje do niego kod, instaluje zależności, buduje i **usuwa kontener**. Na komputerze zostaje tylko plik
wynikowy w `dist/` – bez `node_modules/`, `vendor/` i `build/`. Wymagany jest tylko Docker (Docker Desktop w Windows/macOS).

|System|Polecenie|
|-|-|
|Windows|`build-scripts\docker-build.bat` (dwuklik – pyta o cel) albo `docker-build.bat win\|linux\|mac\|html`|
|Linux / macOS|`./build-scripts/docker-build.sh win\|linux\|mac\|html`|

Opcje: `html --quick` – sam plik HTML bez kompilacji przykładów; `--remove-image` – po zakończeniu usuwa też obraz
`node:20` (domyślnie zostaje w Dockerze, aby kolejne budowanie nie pobierało go od nowa). Każde budowanie w Dockerze
pobiera kompilatory i biblioteki od zera (ok. 1 GB). Wersja dla macOS zbudowana w Dockerze nie ma podpisu ad-hoc
(`codesign`) – na Macu lepiej użyć `build-mac.sh`.

Każdy skrypt sprawdza Node.js, instaluje zależności (`npm ci`) i uruchamia `node scripts/build-all.mjs` z celem.
Kolejne kroki:

1. pobranie kompilatorów i źródeł;
2. prekompilacja rdzenia Arduino AVR i bibliotek;
3. rdzenie C++ (WebAssembly) i STM32;
4. kompilacja szkiców przykładów;
5. złożenie strony;
6. dla wersji desktopowych – spakowanie aplikacji Electron razem z odchudzonymi kompilatorami.

Pierwsze budowanie trwa kilka–kilkanaście minut. Kolejne korzystają z pobranych plików.

Plik HTML działa w przeglądarce bez instalacji i bez internetu. Ma symulację, MicroPythona, asembler PIC i
prekompilowane przykłady. Kompilacja C++ i serwer MQTT są tylko w wersji desktopowej. Wgrywanie przez USB działa
w Chrome i Edge.

Wersję dla Windows można zbudować także na Linuksie lub macOS: `node scripts/build-all.mjs --target=win`.
Potrzebne jest polecenie `zip`. Wersję dla macOS najlepiej budować na Macu – potrzebny jest podpis ad-hoc
(`codesign`).

### Pojedyncze kroki (npm)

```
npm ci                    # zależności
npm run deps              # pobranie kompilatorów i źródeł bibliotek Arduino (vendor/)
npm run toolchain         # pobranie + prekompilacja rdzeni: AVR (build/arduino), C++/WASM (build/cpp), STM32 (build/stm)
npm run examples          # kompilacja przykładów do build/hexes.json
npm run html              # tylko złożenie dist/CappyTronic.html (szybko, po zmianach w src/)
npm start                 # uruchomienie aplikacji desktopowej z kodu źródłowego (Electron)
npm test                  # testy (wymaga zbudowanej strony i rdzeni)
node scripts/package-desktop.mjs --platform=linux|win32|darwin \[--arch=x64|arm64]
```

Wersje narzędzi, adresy pobierania, listy bibliotek i parametry płytek są w jednym miejscu: `scripts/config.mjs`.

## Praca nad kodem

* **Typowy cykl:** zmiana w `src/js/…`, potem `npm run html` i odświeżenie `dist/CappyTronic.html` w przeglądarce
(albo `npm start`).
* **Moduły:** zwykłe skrypty (bez bundlera) sklejane w kolejności z `MODULES`. Każdy element definiuje funkcja `def()`
albo jej odmiany (`modPart`, `mcuPart`, `chipPart`, `pyBoardPart`). Element opisuje swoje piny, wygląd (`draw`),
zachowanie w symulacji (`sim.lin/nl/commit/onIn`) i odczyty. Szczegóły: `docs/ARCHITEKTURA.md`.
* **Teksty interfejsu:** `src/js/i18n.js`, zawsze w dwóch językach (`pl`, `en`).
* **Testy:** `tests/`. Każdy zestaw buduje obwód, uruchamia symulację i porównuje wyniki z danymi z kart katalogowych.
`npm test` uruchamia wszystkie, `node tests/run-all.js pic` – wybrane.

## Licencje

Kod CappyTronic - licencja MIT:
Copyright © 2026 CappySoft.pl

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

\---

Komponenty zewnętrzne i ich licencje – zob. `THIRD\_PARTY.md`. Paczka dla Windows zawiera rdzeń Arduino (LGPL 2.1) w postaci prekompilowanej; zgodnie z LGPL jego źródła są dostępne pod adresami z `THIRD\_PARTY.md`, a `npm run toolchain` pozwala zbudować archiwa ponownie.

