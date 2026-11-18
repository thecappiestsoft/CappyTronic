// CappyTronic – konfiguracja budowania: wersje, adresy narzędzi, biblioteki Arduino, kolejność modułów.
// Zmieniając wersję narzędzia, zmień też odpowiedni adres URL (i ewentualnie nazwę katalogu po rozpakowaniu).
export const APP = { name: 'CappyTronic', id: 'pl.cappysoft.cappytronic', version: '2.4.1', electron: '33.2.1', copyright: '© 2026 CappySoft.pl' };

// Moduły aplikacji (src/js) – sklejane w tej kolejności do jednego skryptu strony.
export const MODULES = ['util', 'i18n', 'engine', 'draw', 'parts_core', 'parts_semi', 'parts_analog', 'parts_logic', 'parts_passive', 'parts_lcsc', 'lcsc_catalog', 'mcu', 'parts_mcu',
  'pyboard', 'parts_py', 'periph', 'ethnet', 'picasm', 'pic16', 'pic18', 'stm32', 'cpuchip', 'examples', 'ui', 'ui_lcsc', 'mats', 'kicad', 'ui_net', 'upload'];

// Kompilatory pobierane dla platformy docelowej. Klucze platform: linux-x64, win32-x64, darwin-x64, darwin-arm64.
// {dir} = katalog główny po rozpakowaniu archiwum (jeśli archiwum ma jeden katalog nadrzędny, jest on pomijany).
export const TOOLCHAINS = {
  avr: { // avr-gcc 14.1 (Zak Kemble); na macOS – avr-gcc 7.3 z Arduino (działa także na Apple Silicon przez Rosettę)
    'linux-x64': 'https://github.com/ZakKemble/avr-gcc-build/releases/download/v14.1.0-1/avr-gcc-14.1.0-x64-linux.tar.bz2',
    'win32-x64': 'https://github.com/ZakKemble/avr-gcc-build/releases/download/v14.1.0-1/avr-gcc-14.1.0-x64-windows.zip',
    'darwin-x64': 'https://downloads.arduino.cc/tools/avr-gcc-7.3.0-atmel3.6.1-arduino7-x86_64-apple-darwin14.tar.bz2',
    'darwin-arm64': 'https://downloads.arduino.cc/tools/avr-gcc-7.3.0-atmel3.6.1-arduino7-x86_64-apple-darwin14.tar.bz2',
  },
  wasi: { // clang 19 + sysroot WASI – C++ dla płytek ESP32/ESP8266/Pico (WebAssembly)
    'linux-x64': 'https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/wasi-sdk-25.0-x86_64-linux.tar.gz',
    'win32-x64': 'https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/wasi-sdk-25.0-x86_64-windows.tar.gz',
    'darwin-x64': 'https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/wasi-sdk-25.0-x86_64-macos.tar.gz',
    'darwin-arm64': 'https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/wasi-sdk-25.0-arm64-macos.tar.gz',
  },
  arm: { // arm-none-eabi-gcc 13.3 (xPack) – STM32
    'linux-x64': 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v13.3.1-1.1/xpack-arm-none-eabi-gcc-13.3.1-1.1-linux-x64.tar.gz',
    'win32-x64': 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v13.3.1-1.1/xpack-arm-none-eabi-gcc-13.3.1-1.1-win32-x64.zip',
    'darwin-x64': 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v13.3.1-1.1/xpack-arm-none-eabi-gcc-13.3.1-1.1-darwin-x64.tar.gz',
    'darwin-arm64': 'https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v13.3.1-1.1/xpack-arm-none-eabi-gcc-13.3.1-1.1-darwin-arm64.tar.gz',
  },
};

// Źródła rdzenia Arduino i bibliotek (GitHub, konkretne commity – budowanie jest powtarzalne).
export const ARDUINO_SOURCES = {
  'ArduinoCore-avr': ['arduino/ArduinoCore-avr', '11b9130371e8447920edb65a75706a6c951e51fc'],
  'attiny': ['damellis/attiny', 'c68f63d878aad2d5529a0da4ee4af77c411a61bd'],
  'Adafruit-GFX-Library': ['adafruit/Adafruit-GFX-Library', '978b9f83edb0a335dbd996753a4a865137f325db'],
  'Adafruit_BusIO': ['adafruit/Adafruit_BusIO', '3b8364267c3ee6e16bad91bc2101aefbd5b5915f'],
  'Adafruit_SSD1306': ['adafruit/Adafruit_SSD1306', 'd94f699451d72286357cba7259055ffff2c2940b'],
  'Adafruit_SH110x': ['adafruit/Adafruit_SH110x', 'f29762e0c2de7d31364acb427b3b69efc7b8913e'],
  'Adafruit-PCD8544-Nokia-5110-LCD-library': ['adafruit/Adafruit-PCD8544-Nokia-5110-LCD-library', '87565cd21a2a79b3db48a851170a24eaadd33c8d'],
  'Adafruit-ST7735-Library': ['adafruit/Adafruit-ST7735-Library', 'd568339f957380ceb05dda57f6712c2704a6394f'],
  'Adafruit_ILI9341': ['adafruit/Adafruit_ILI9341', '1871d9597f0d67cd15e3a331b8952c5dd3d3c418'],
  'Adafruit_ADS1X15': ['adafruit/Adafruit_ADS1X15', '3d16518ab00f9f2f05473fc46930a312e72af685'],
  'Adafruit_MCP4725': ['adafruit/Adafruit_MCP4725', '705778cc8f1918880063b07547e78c6ded409a88'],
  'Adafruit-MCP23017-Arduino-Library': ['adafruit/Adafruit-MCP23017-Arduino-Library', '9e67e3732d1af68d8894b2f98c57bd9efa54027c'],
  'Adafruit_MCP3008': ['adafruit/Adafruit_MCP3008', '94e5003152294bf6877da976e079af476de3544f'],
  'Adafruit_NeoPixel': ['adafruit/Adafruit_NeoPixel', 'd514fc3beae85dd4c2b19781b93faa47bd6e996f'],
  'RTClib': ['adafruit/RTClib', '5298434167b770c4602661d682e3b340d565073f'],
  'LiquidCrystal': ['arduino-libraries/LiquidCrystal', '42022e0bb7e11829317467bab28ed42af23e0ee5'],
  'LiquidCrystal_I2C': ['johnrickman/LiquidCrystal_I2C', '738765e388816fb2a687d40436cd2604febce1b1'],
  'Servo': ['arduino-libraries/Servo', '440b319ec11ea2664df8ce201c271c935de28a2d'],
  'U8g2_Arduino': ['olikraus/U8g2_Arduino', 'b3a40de8822187c941b40cbbaaa77604a7ab90c7'],
  'XPT2046_Touchscreen': ['PaulStoffregen/XPT2046_Touchscreen', 'f956c5d8ce3bf39169c7378416b89e7cfe70a034'],
  'EtherCard': ['njh/EtherCard', '1b8b5a446461fd316985bbcc5cbac23a58a46743'],
  'arduino-CAN': ['sandeepmistry/arduino-CAN', 'b514e6b8596126a8f94f226b9906455393efd3a2'],
  'pubsubclient': ['knolleary/pubsubclient', '4eb0dc703522f687bbe4629b8252b0d71e6771f2'],
  'ArduinoJson': ['bblanchon/ArduinoJson', '1cd478f48e7c4cd142a0bd26ee17d63d70d04e3f'],
};

// Biblioteki Arduino AVR (nazwa → podkatalog w vendor/src) – prekompilowane do .a dla każdej płytki.
export const AVR_TARGETS = {
  uno: { mcu: 'atmega328p', f: '16000000L', variant: 'ArduinoCore-avr/variants/standard', board: 'ARDUINO_AVR_UNO' },
  nano: { mcu: 'atmega328p', f: '16000000L', variant: 'ArduinoCore-avr/variants/eightanaloginputs', board: 'ARDUINO_AVR_NANO' },
  mega: { mcu: 'atmega2560', f: '16000000L', variant: 'ArduinoCore-avr/variants/mega', board: 'ARDUINO_AVR_MEGA2560' },
  tiny85: { mcu: 'attiny85', f: '8000000L', variant: 'attiny/variants/tiny8', board: 'ARDUINO_attiny' },
};
export const AVR_LIBS = {
  Wire: 'ArduinoCore-avr/libraries/Wire/src', SPI: 'ArduinoCore-avr/libraries/SPI/src', EEPROM: 'ArduinoCore-avr/libraries/EEPROM/src', SoftwareSerial: 'ArduinoCore-avr/libraries/SoftwareSerial/src',
  LiquidCrystal: 'LiquidCrystal/src', LiquidCrystal_I2C: 'LiquidCrystal_I2C', Adafruit_BusIO: 'Adafruit_BusIO', Adafruit_GFX: 'Adafruit-GFX-Library',
  Adafruit_SSD1306: 'Adafruit_SSD1306', Adafruit_SH110X: 'Adafruit_SH110x', Adafruit_PCD8544: 'Adafruit-PCD8544-Nokia-5110-LCD-library', Adafruit_ST7735: 'Adafruit-ST7735-Library',
  Adafruit_ILI9341: 'Adafruit_ILI9341', RTClib: 'RTClib/src', Adafruit_ADS1X15: 'Adafruit_ADS1X15', Adafruit_MCP4725: 'Adafruit_MCP4725', Adafruit_MCP23017: 'Adafruit-MCP23017-Arduino-Library',
  Adafruit_MCP3008: 'Adafruit_MCP3008', U8g2: 'U8g2_Arduino/src', XPT2046_Touchscreen: 'XPT2046_Touchscreen', Servo: 'Servo/src', Adafruit_NeoPixel: 'Adafruit_NeoPixel',
  EtherCard: 'EtherCard/src', CAN: 'arduino-CAN/src',
};
// Biblioteki dla C++ (WebAssembly) i STM32 – wspólne, „uogólnione” kopie źródeł (makra architektur ukryte).
export const PORTABLE_LIBS = {
  Adafruit_BusIO: 'Adafruit_BusIO', Adafruit_GFX: 'Adafruit-GFX-Library', Adafruit_SSD1306: 'Adafruit_SSD1306', Adafruit_SH110X: 'Adafruit_SH110x', Adafruit_PCD8544: 'Adafruit-PCD8544-Nokia-5110-LCD-library',
  Adafruit_ST7735: 'Adafruit-ST7735-Library', Adafruit_ILI9341: 'Adafruit_ILI9341', LiquidCrystal_I2C: 'LiquidCrystal_I2C', LiquidCrystal: 'LiquidCrystal/src', RTClib: 'RTClib/src',
  Adafruit_ADS1X15: 'Adafruit_ADS1X15', Adafruit_MCP4725: 'Adafruit_MCP4725', Adafruit_MCP23017: 'Adafruit-MCP23017-Arduino-Library', Adafruit_MCP3008: 'Adafruit_MCP3008',
  XPT2046_Touchscreen: 'XPT2046_Touchscreen', PubSubClient: 'pubsubclient/src', U8g2: 'U8g2_Arduino/src', ArduinoJson: 'ArduinoJson/src',
};
export const STM_LIBS = ['Adafruit_BusIO', 'Adafruit_GFX', 'Adafruit_SSD1306', 'Adafruit_SH110X', 'Adafruit_PCD8544', 'Adafruit_ST7735', 'Adafruit_ILI9341', 'LiquidCrystal_I2C', 'LiquidCrystal', 'RTClib',
  'Adafruit_ADS1X15', 'Adafruit_MCP4725', 'Adafruit_MCP23017', 'Adafruit_MCP3008', 'XPT2046_Touchscreen', 'U8g2', 'ArduinoJson'];
// Płytki C++ (WebAssembly): parametry trafiają do wygenerowanego nagłówka ct_board.h
export const WASM_BOARDS = {
  esp32c3zero: { arch: 'ESP32', chip: 'ESP32-C3', cores: 1, f: 160, cost: 0.75, adc_bits: 12, adc_mv: 2500, pwm_f: 1000, pwm_r: 255,
    pins: { SDA: 8, SCL: 9, SS: 7, MOSI: 6, MISO: 5, SCK: 4, TX: 21, RX: 20, A0: 0, A1: 1, A2: 2, A3: 3, A4: 4, RGB_BUILTIN: 110, LED_BUILTIN: 110, BOOT_PIN: 9 },
    i2c1: [8, 9], uart1: [21, 20], uart2: [21, 20], extra: ['CONFIG_IDF_TARGET_ESP32C3=1', 'ARDUINO_ESP32C3_DEV=1'] },
  esp32devkit: { arch: 'ESP32', chip: 'ESP32-D0WD-V3', cores: 2, f: 240, cost: 0.5, adc_bits: 12, adc_mv: 3100, pwm_f: 1000, pwm_r: 255,
    pins: { SDA: 21, SCL: 22, SS: 5, MOSI: 23, MISO: 19, SCK: 18, TX: 1, RX: 3, LED_BUILTIN: 2, A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26, DAC1: 25, DAC2: 26, T0: 4, T3: 15 },
    i2c1: [21, 22], uart1: [10, 9], uart2: [17, 16], extra: ['CONFIG_IDF_TARGET_ESP32=1', 'ARDUINO_ESP32_DEV=1'] },
  nodemcu: { arch: 'ESP8266', chip: 'ESP8266EX', cores: 1, f: 80, cost: 1.5, adc_bits: 10, adc_mv: 3200, pwm_f: 1000, pwm_r: 255,
    pins: { SDA: 4, SCL: 5, SS: 15, MOSI: 13, MISO: 12, SCK: 14, TX: 1, RX: 3, LED_BUILTIN: 2, A0: 17, D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15, D9: 3, D10: 1 },
    i2c1: [4, 5], uart1: [2, -1], uart2: [2, -1], extra: ['ARDUINO_ESP8266_NODEMCU_ESP12E=1'] },
  picow: { arch: 'RP2040', chip: 'RP2040', cores: 2, f: 133, cost: 0.9, adc_bits: 10, adc_mv: 3300, pwm_f: 1000, pwm_r: 255,
    pins: { SDA: 4, SCL: 5, SS: 17, MOSI: 19, MISO: 16, SCK: 18, TX: 0, RX: 1, LED_BUILTIN: 64, A0: 26, A1: 27, A2: 28, PIN_LED: 64 },
    i2c1: [6, 7], uart1: [0, 1], uart2: [8, 9], extra: ['ARDUINO_RASPBERRY_PI_PICO_W=1', 'PICO_CYW43_SUPPORTED=1'] },
};
// Makra architektur ukrywane w bibliotekach dla WebAssembly (ich „szybkie ścieżki” piszą do rejestrów sprzętu, których w symulatorze nie ma).
export const ARCH_MACROS = ['ESP32', 'ESP8266', 'ARDUINO_ARCH_ESP32', 'ARDUINO_ARCH_ESP8266', 'ARDUINO_ARCH_RP2040', 'ESP_PLATFORM', 'CONFIG_IDF_TARGET_ESP32', 'CONFIG_IDF_TARGET_ESP32C3',
  'ARDUINO_ARCH_MBED', 'ARDUINO_ESP32_DEV', 'ARDUINO_ESP32C3_DEV', 'ARDUINO_ESP8266_NODEMCU_ESP12E', 'ARDUINO_RASPBERRY_PI_PICO_W'];
// Katalogi pomijane przy zbieraniu źródeł bibliotek.
export const SKIP_DIRS = ['examples', 'extras', 'test', 'tests', 'docs', '.git', '.github', 'fontconvert', 'samd', 'sam', 'stm32f4', 'nrf52', 'megaavr', 'mbed', 'renesas', 'esp32', 'esp8266', 'stm32'];
