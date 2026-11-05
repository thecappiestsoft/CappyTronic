# CappyTronic

Edukacyjny symulator obwodów elektronicznych (w stylu TinkerCad) dla szkół: elementy elektroniczne, symulacja analogowa
i cyfrowa, mikrokontrolery programowane w Arduino C++, MicroPythonie i asemblerze, sieć (MQTT, HTTP, Ethernet),
eksport do JSON i KiCad oraz wgrywanie programów do prawdziwych płytek przez USB. Interfejs po polsku i angielsku,
działa offline.

Wersja: **2.4.0**

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

## Struktura katalogów

```
src/
  shell.html            szablon strony (style CSS, układ okna)
  js/                   moduły aplikacji – sklejane w kolejności z scripts/config.mjs (MODULES)
    util, i18n            narzędzia, tłumaczenia PL/EN
    engine, draw          silnik symulacji (MNA, zdarzenia cyfrowe), rysowanie SVG
    parts\_\*.js            elementy: podstawowe, półprzewodniki, analogowe, logiczne, pasywne, mikrokontrolery AVR
    mcu.js                integracja avr8js (AVR), port szeregowy, zegar
    pyboard.js, parts\_py  płytki MicroPython/C++ (Worker + SharedArrayBuffer)
    periph.js, ethnet.js  moduły peryferyjne, ENC28J60 + wirtualna sieć
    picasm, pic16, pic18  asembler MPASM i emulatory PIC
    stm32.js, cpuchip.js  emulator Cortex-M3 + STM32F103, wspólna obsługa układów z własnym rdzeniem
    examples, ui, mats    przykłady, interfejs, maty z opisem modułów
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

build-scripts		pliki do budowania aplikacji desktopowych i pliku 			html
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
|Linux|`./build-linux.sh`|`CappyTronic-2.4.0-Linux-x64.tar.gz`|
|Windows|`build-windows.bat` (dwuklik)|`CappyTronic-2.4.0-Windows-x64.zip`|
|macOS|`./build-mac.sh` albo dwuklik `build-mac.command`|`CappyTronic-2.4.0-macOS-<arch>.zip`|
|Jeden plik HTML|`./build-html.sh` / `build-html.bat`|`CappyTronic.html`|

!Skrypty znajdują się w folderze build-scripts/!

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

