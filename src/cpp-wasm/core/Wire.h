#pragma once
#include "Arduino.h"
#define WIRE_HAS_END 1
#define I2C_BUFFER_LENGTH 128
#define BUFFER_LENGTH 128
// TwoWire – magistrala I2C (zapytania do symulatora: zapis/odczyt całych transakcji)
class TwoWire : public Stream {
public:
  explicit TwoWire(int n) : num(n) {}
  bool begin(int sda = -1, int scl = -1, uint32_t freq = 0);
  bool begin(uint8_t addr) { (void)addr; return begin(); }
  bool end() { return true; }
  bool setPins(int sda, int scl) { if (sda >= 0) sdaP = sda; if (scl >= 0) sclP = scl; return true; }
  void setClock(uint32_t f) { freq = f; }
  uint32_t getClock() { return freq; }
  void setTimeOut(uint16_t) {} void setTimeout(uint16_t) {} void setWireTimeout(uint32_t = 25000, bool = false) {}
  void beginTransmission(uint8_t addr) { txa = addr; txn = 0; txOn = true; }
  void beginTransmission(int addr) { beginTransmission((uint8_t)addr); }
  uint8_t endTransmission(bool stop = true);
  uint8_t endTransmission(uint8_t stop) { return endTransmission((bool)stop); }
  size_t requestFrom(uint8_t addr, size_t n, bool stop = true);
  uint8_t requestFrom(int addr, int n) { return (uint8_t)requestFrom((uint8_t)addr, (size_t)n, true); }
  uint8_t requestFrom(int addr, int n, int stop) { return (uint8_t)requestFrom((uint8_t)addr, (size_t)n, stop != 0); }
  uint8_t requestFrom(uint8_t addr, uint8_t n) { return (uint8_t)requestFrom(addr, (size_t)n, true); }
  uint8_t requestFrom(uint8_t addr, uint8_t n, uint8_t stop) { return (uint8_t)requestFrom(addr, (size_t)n, stop != 0); }
  size_t write(uint8_t c) override { if (!txOn || txn >= (int)sizeof tx) return 0; tx[txn++] = c; return 1; }
  size_t write(const uint8_t *b, size_t n) override { size_t k = 0; while (k < n && write(b[k])) k++; return k; }
  using Print::write;
  int available() override { return rxn - rxi; }
  int read() override { return rxi < rxn ? rx[rxi++] : -1; }
  int peek() override { return rxi < rxn ? rx[rxi] : -1; }
  void flush() override {}
  void onReceive(void (*)(int)) {} void onRequest(void (*)(void)) {}
private:
  int num, sdaP = -1, sclP = -1; uint32_t freq = 100000; uint8_t txa = 0; uint8_t tx[256]; int txn = 0; bool txOn = false; uint8_t rx[256]; int rxn = 0, rxi = 0;
  void pins();
};
extern TwoWire Wire;
extern TwoWire Wire1;
