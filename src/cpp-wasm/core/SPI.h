#pragma once
#include "Arduino.h"
#define SPI_MODE0 0
#define SPI_MODE1 1
#define SPI_MODE2 2
#define SPI_MODE3 3
#define SPI_CLOCK_DIV2 2
#define SPI_CLOCK_DIV4 4
#define SPI_CLOCK_DIV8 8
#define SPI_CLOCK_DIV16 16
#define SPI_CLOCK_DIV32 32
#define SPI_CLOCK_DIV64 64
#define SPI_CLOCK_DIV128 128
#define HSPI 2
#define VSPI 3
#define FSPI 0
class SPISettings { public: SPISettings(uint32_t c = 1000000, uint8_t o = MSBFIRST, uint8_t m = SPI_MODE0) : clock(c), order(o), mode(m) {} uint32_t clock; uint8_t order, mode; };
// SPI – przesyłanie bajtów do urządzeń wybranych pinem CS (zapytanie do symulatora; bloki wysyłane naraz)
class SPIClass {
public:
  explicit SPIClass(int bus = 0) : bus(bus) {}
  void begin(int8_t sck = -1, int8_t miso = -1, int8_t mosi = -1, int8_t ss = -1);
  void end() {}
  void beginTransaction(SPISettings s) { set = s; }
  void endTransaction() {}
  void setBitOrder(uint8_t o) { set.order = o; } void setDataMode(uint8_t m) { set.mode = m; } void setFrequency(uint32_t f) { set.clock = f; } void setClockDivider(uint32_t d) { set.clock = 16000000 / (d ? d : 4); } void setHwCs(bool) {}
  uint8_t transfer(uint8_t v);
  uint16_t transfer16(uint16_t v);
  uint32_t transfer32(uint32_t v);
  void transfer(void *buf, size_t n);
  void transferBytes(const uint8_t *out, uint8_t *in, uint32_t n);
  void writeBytes(const uint8_t *d, uint32_t n) { transferBytes(d, nullptr, n); }
  void write(uint8_t v) { transferBytes(&v, nullptr, 1); }
  void write16(uint16_t v) { uint8_t b[2] = {(uint8_t)(v >> 8), (uint8_t)v}; transferBytes(b, nullptr, 2); }
  void write32(uint32_t v) { uint8_t b[4] = {(uint8_t)(v >> 24), (uint8_t)(v >> 16), (uint8_t)(v >> 8), (uint8_t)v}; transferBytes(b, nullptr, 4); }
  void writePixels(const void *data, uint32_t bytes);
  void writePattern(const uint8_t *data, uint8_t size, uint32_t repeat);
  int8_t pinSS() { return ssP; }
private:
  int bus; int8_t sckP = -1, misoP = -1, mosiP = -1, ssP = -1; SPISettings set;
  void pins();
};
extern SPIClass SPI;
