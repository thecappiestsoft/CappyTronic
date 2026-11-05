#pragma once
#include "Arduino.h"
#define SPI_MODE0 0x00
#define SPI_MODE1 0x01
#define SPI_MODE2 0x02
#define SPI_MODE3 0x03
#define SPI_CLOCK_DIV2 2
#define SPI_CLOCK_DIV4 4
#define SPI_CLOCK_DIV8 8
#define SPI_CLOCK_DIV16 16
#define SPI_CLOCK_DIV32 32
#define SPI_CLOCK_DIV64 64
#define SPI_CLOCK_DIV128 128
#define SPI_HAS_TRANSACTION 1
class SPISettings { public: SPISettings(uint32_t c = 4000000, uint8_t o = MSBFIRST, uint8_t m = SPI_MODE0) : clock(c), order(o), mode(m) {} uint32_t clock; uint8_t order, mode; };
class SPIClass {
public:
  SPIClass(int n) : n_(n) {}
  void begin(); void end(); void beginTransaction(SPISettings s); void endTransaction() {}
  uint8_t transfer(uint8_t v); uint16_t transfer16(uint16_t v); void transfer(void *buf, size_t n);
  void transfer(const void *tx, void *rx, size_t n) { const uint8_t *t = (const uint8_t *)tx; uint8_t *r = (uint8_t *)rx; for (size_t i = 0; i < n; i++) { uint8_t x = transfer(t ? t[i] : 0xFF); if (r) r[i] = x; } }
  void setBitOrder(uint8_t o); void setDataMode(uint8_t m); void setClockDivider(uint32_t d); void usingInterrupt(int) {}
  void setMOSI(uint32_t) {} void setMISO(uint32_t) {} void setSCLK(uint32_t) {} void setSSEL(uint32_t) {}
private: int n_; void apply(uint32_t clk, uint8_t order, uint8_t mode);
};
extern SPIClass SPI, SPI_2;
