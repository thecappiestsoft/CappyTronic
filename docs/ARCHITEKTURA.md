# CappyTronic – architektura dla programistów

## Jak powstaje aplikacja

`scripts/build-html.mjs` skleja pliki z `src/js` w kolejności z `scripts/config.mjs` (`MODULES`) w jeden skrypt.
Wstawia go do szablonu `src/shell.html` razem z:

- emulatorem AVR (avr8js, zbudowanym esbuildem),
- edytorem CodeMirror,
- czcionkami i obrazkami (data: URL),
- MicroPythonem (WebAssembly, base64),
- plikami Pythona z `src/micropython/lib`,
- prekompilowanymi przykładami (`build/hexes.json`).

Wynik to jeden plik `dist/CappyTronic.html`. Ten sam plik jest stroną aplikacji desktopowej (`electron/`).
Moduły to zwykłe skrypty: współdzielą zasięg globalny i nie używają `import`. Stałe i funkcje zdefiniowane
wcześniej są dostępne w modułach późniejszych.

Aplikacja desktopowa (Electron) dodaje usługi, których nie ma w przeglądarce. Strona korzysta z nich przez
`window.cappyNative` (`electron/preload.js`):

| Plik | Rola |
|---|---|
| `electron/compiler.js` | kompilacja Arduino AVR (avr-gcc + prekompilowane rdzenie z `build/arduino`) |
| `electron/cppcompiler.js` | C++ dla płytek ESP/Pico: clang → WebAssembly (rdzeń z `build/cpp`) |
| `electron/stmcompiler.js` | STM32: arm-none-eabi-gcc (rdzeń z `build/stm`) |
| `electron/net.js` | serwer MQTT (aedes), klient MQTT/HTTP/TCP płytek, serwery WWW płytek, kontrola adresów (domyślnie tylko sieć lokalna) |
| `electron/main.js` | okno, zapis plików, wybór portu szeregowego do wgrywania (Web Serial) |

## Stan i symulacja

- `S` (`ui.js`) – projekt: `comps` (elementy: `{id, type, x, y, rot, props}`), `wires` (`{a:{c,t}, b:{c,t}, pts}`), `mats`.
- `PARTS[type]` – definicje elementów. Rejestruje je `def(id, P)` (`parts_core.js`) i jej odmiany: `modPart` (moduły),
  `mcuPart` (AVR), `pyBoardPart` (płytki MicroPython/C++), `chipPart` (`cpuchip.js` – PIC, STM32).
- `CIR` (`engine.js`) – skompilowany obwód: węzły, urządzenia (`CIR.devs`, każde `{c, P, n[], s, …}`), sieci cyfrowe.
  `changed()` unieważnia go po zmianie projektu.
- `E` – stan symulatora (czas `E.t`, krok, flaga przeliczenia). `simStep(dt)` wykonuje krok:
  1. programy mikrokontrolerów (`mcuRun`);
  2. rozwiązanie MNA metodą Newtona;
  3. zdarzenia cyfrowe;
  4. `commit` urządzeń.

Haki urządzenia (`P.sim`):

| Hak | Do czego służy |
|---|---|
| `lin(d, S)` | części liniowe: `S.G` (konduktancja), `S.I` (źródło prądowe), `S.V` (źródło napięciowe) |
| `nl(d, S)` | części nieliniowe (prąd i pochodne – Newton) |
| `post(d)` | przełączanie trybów po zbieżności (np. modele piecewise wzmacniaczy) |
| `dyn`, `int` | elementy dynamiczne, węzły wewnętrzne |
| `init(d)` | stan początkowy, rejestracja słuchaczy pinów (`eListen`) i sterowników (`eDrive`) |
| `onIn(d, pin, lvl)` | zmiana stanu logicznego na wejściu |
| `commit(d)` | koniec kroku: odczyty, ostrzeżenia (`d.s.warn` → klucz `w_…` w `i18n.js`) |
| `mcuRun(d, dt)` | wykonanie programu przez `dt` sekund |

`eDrive(d, pin, poziom, R, vcc, gnd, podciąganie)` ustawia wyjście cyfrowe (źródło Thevenina). `eNow()` podaje
dokładny czas zdarzenia w trakcie wykonywania programu mikrokontrolera.

## Mikrokontrolery

| Rodzina | Plik | Opis |
|---|---|---|
| AVR | `mcu.js` | avr8js; rejestry portów przez nasłuch zapisu; USART/TWI/SPI połączone z modułami szybką ścieżką bajtową |
| PIC16F84A / PIC18F4550 | `pic16.js`, `pic18.js` | interpretery rozkazów z cyklami, peryferia; asembler MPASM w `picasm.js` (dwa przebiegi, makra, `__CONFIG`/`CONFIG`, Intel HEX) |
| STM32F103 | `stm32.js` | interpreter Thumb-2 (ARMv7-M), NVIC, SysTick, peryferia RM0008; `WFI` przewija czas do najbliższego zdarzenia; błędy dostępu → HardFault z komunikatem |
| Płytki MicroPython / C++ | `pyboard.js` | program działa w Web Workerze, synchronizacja przez SharedArrayBuffer (`PYL` – układ pamięci) |

Wspólną obsługę układów z własnym rdzeniem (zasilanie, MCLR/NRST, start oscylatora, sterowanie nóżkami,
rezystory podciągające, ADC, port szeregowy, EEPROM) zapewnia `chipPart` w `cpuchip.js`. Rdzeń udostępnia:
`cycles`, `f`, `run(do_cyklu)`, `reset(por)`, `setInputs({A,B,…})`, `pinState(port, bit)` oraz zdarzenia
`onPins` i `onTx`.

Płytki MicroPython / C++ w szczegółach:

- MicroPython to oficjalny port WebAssembly z modułami symulatora w `src/micropython/lib` (`machine.py`, `network.py`…).
- C++ to program WebAssembly z importami `hw` (`src/cpp-wasm/core/ct_hw.h`) i minimalnym WASI (`src/cpp-wasm/worker.js`).
- Żądania wejścia/wyjścia (I2C, SPI, sieć…) obsługuje `pyService` w wątku strony.

## Wgrywanie do prawdziwych płytek (`upload.js`)

Protokoły działają na abstrakcyjnym łączu (`SerialLink`: `write`, `read(n, ms)`, `readUntil`, `setSignals`), więc
`tests/t_upload.js` sprawdza je na symulowanych bootloaderach.

| Protokół | Płytki |
|---|---|
| STK500v1 | Optiboot – Uno, Nano, ATmega328P; ArduinoISP – ATtiny85 (z kasowaniem przez polecenia ISP) |
| STK500v2 | Mega 2560 |
| AN3155 | bootloader UART STM32 – Blue Pill |
| surowy REPL MicroPythona | ESP32, ESP8266, Pico W: zapis `main.py` i używanych sterowników |

Wybór metody zależy od typu płytki (`uploadMethod`). W Electronie listę portów podaje proces główny
(`select-serial-port`), a strona pokazuje ją w swoim oknie dialogowym.

## Dodawanie elementu – przykład

```js
def('my_led', {
  cat: 'basic', name: { pl: 'Moja dioda', en: 'My LED' },
  pins: [{ x: 0, y: 0, n: { pl: 'Anoda', en: 'Anode' } }, { x: 40, y: 0, n: { pl: 'Katoda', en: 'Cathode' } }],
  draw: (c, r) => `<circle cx="20" cy="0" r="8" fill="${r.on ? '#f44' : '#622'}"/>`,
  sim: {
    nl(d, S) { /* prąd diody i pochodne, np. diodeI(...) */ },
    commit(d) { d.s.on = dVp(d, 0, 1) > 1.8; },
  },
});
```

Teksty dla użytkownika dodaje się w obu językach w `i18n.js`. Element trafia do testów w `tests/t_parts.js`
(automatyczny przegląd wszystkich elementów).

## Testy

`npm test` uruchamia `tests/run-all.js`. Testy ładują `dist/CappyTronic.html` do jsdom i budują obwody kodem.
Tam, gdzie trzeba, kompilują szkice tymi samymi kompilatorami co aplikacja (`tests/tools.js`). Sprawdzają:

- przebiegi czasowe;
- wartości z kart katalogowych;
- wyniki programów (port szeregowy, wyświetlacze);
- zgodność eksportu KiCad z `kicad-cli`, jeśli jest zainstalowany.
