# Komponenty zewnętrzne

CappyTronic korzysta z poniższych projektów. Ich kody źródłowe są dostępne pod podanymi adresami (wersje i commity
są zapisane w `scripts/config.mjs` i `package.json`), a skrypty z katalogu `scripts/` pobierają je i budują ponownie.

## Biblioteki osadzone w aplikacji

| Komponent | Licencja | Źródło |
|---|---|---|
| Electron 33 (z Chromium i Node.js) | MIT (Chromium: BSD i inne – `LICENSES.chromium.html` w paczce) | https://github.com/electron/electron |
| avr8js – emulator AVR | MIT | https://github.com/wokwi/avr8js |
| CodeMirror 5 – edytor kodu | MIT | https://github.com/codemirror/codemirror5 |
| MicroPython (WebAssembly, pakiet @micropython/micropython-webassembly-pyscript) | MIT | https://github.com/micropython/micropython |
| Czcionka znaków HD44780 (A00) – z wokwi-elements | MIT | https://github.com/wokwi/wokwi-elements |
| Czcionka 5×7 (glcdfont) – z Adafruit GFX | BSD | https://github.com/adafruit/Adafruit-GFX-Library |
| Czcionki Baloo 2, Lexend, JetBrains Mono (Fontsource) | SIL Open Font License 1.1 | https://fontsource.org |
| aedes – serwer MQTT | MIT | https://github.com/moscajs/aedes |
| MQTT.js | MIT | https://github.com/mqttjs/MQTT.js |

## Kompilatory dołączane do aplikacji desktopowej

| Komponent | Licencja | Źródło |
|---|---|---|
| AVR-GCC 14.1, Binutils 2.42 (kompilacje Zaka Kemble) | GPL-3.0 z wyjątkiem GCC Runtime Library | https://github.com/ZakKemble/avr-gcc-build |
| AVR-LibC 2.2 | BSD-3-Clause | https://github.com/avrdudes/avr-libc |
| AVR-GCC 7.3 dla macOS (Arduino) | GPL-3.0 z wyjątkiem GCC Runtime Library | https://github.com/arduino/toolchain-avr |
| wasi-sdk 25: Clang/LLVM 19, LLD, libc++ | Apache-2.0 WITH LLVM-exception | https://github.com/WebAssembly/wasi-sdk |
| wasi-libc | Apache-2.0 WITH LLVM-exception, MIT, CC0 (części) | https://github.com/WebAssembly/wasi-libc |
| xPack GNU Arm Embedded GCC 13.3 (GCC, Binutils) | GPL-3.0 z wyjątkiem GCC Runtime Library | https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack |
| newlib / newlib-nano (w xPack) | licencje BSD i podobne (COPYING.NEWLIB) | https://sourceware.org/newlib/ |

Programy kompilowane przez użytkownika nie podlegają licencji GPL kompilatora (wyjątek GCC Runtime Library).

## Rdzeń Arduino i biblioteki (prekompilowane w paczce; źródła – adresy poniżej)

| Biblioteka | Licencja | Źródło |
|---|---|---|
| ArduinoCore-avr (rdzeń, Wire, SPI, EEPROM, SoftwareSerial) | LGPL-2.1 | https://github.com/arduino/ArduinoCore-avr |
| attiny (definicje ATtiny85) | brak jawnej licencji w repozytorium | https://github.com/damellis/attiny |
| Servo | LGPL-2.1 | https://github.com/arduino-libraries/Servo |
| LiquidCrystal | LGPL-2.1 | https://github.com/arduino-libraries/LiquidCrystal |
| LiquidCrystal_I2C | brak jawnej licencji w repozytorium | https://github.com/johnrickman/LiquidCrystal_I2C |
| Adafruit GFX, SSD1306, SH110X, PCD8544, MCP23017, MCP4725, ADS1X15 | BSD | https://github.com/adafruit |
| Adafruit BusIO, RTClib, ST7735, ILI9341 | MIT | https://github.com/adafruit |
| Adafruit MCP3008 | MIT | https://github.com/adafruit/Adafruit_MCP3008 |
| Adafruit NeoPixel | LGPL-3.0 | https://github.com/adafruit/Adafruit_NeoPixel |
| U8g2 | BSD-2-Clause | https://github.com/olikraus/U8g2_Arduino |
| XPT2046_Touchscreen | MIT | https://github.com/PaulStoffregen/XPT2046_Touchscreen |
| EtherCard | GPL-2.0 | https://github.com/njh/EtherCard |
| arduino-CAN | MIT | https://github.com/sandeepmistry/arduino-CAN |
| PubSubClient | MIT | https://github.com/knolleary/pubsubclient |
| ArduinoJson | MIT | https://github.com/bblanchon/ArduinoJson |

Uwagi:
- Biblioteki na licencjach LGPL są w paczkach w postaci prekompilowanych archiwów `.a`. Programy użytkownika są
  z nimi łączone podczas kompilacji w aplikacji. Źródła są dostępne pod adresami z tabeli, a `npm run toolchain`
  buduje archiwa ponownie, także ze zmienionych źródeł (katalog `vendor/src`).
- EtherCard jest na licencji GPL-2.0. Program używający tej biblioteki, rozpowszechniany dalej, podlega warunkom GPL.
- Rdzenie CappyTronic dla STM32 (`src/stm32/core`) i dla płytek ESP/Pico w WebAssembly (`src/cpp-wasm/core`) to
  własny kod (MIT). Pliki `WString`, `Print`, `Stream` są zgodne z API Arduino.

## Narzędzia używane tylko przy budowaniu

esbuild (MIT), @electron/packager (BSD-2-Clause), extract-zip (BSD-2-Clause), jsdom (MIT – testy).
