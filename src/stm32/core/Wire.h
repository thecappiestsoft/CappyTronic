#pragma once
#include "Arduino.h"
#define WIRE_HAS_END 1
#ifndef BUFFER_LENGTH
#define BUFFER_LENGTH 32
#endif
class TwoWire : public Stream {
public:
  TwoWire(int n) : n_(n) {}
  void begin(); void begin(uint8_t addr) { begin(); } void begin(int sda, int scl) { begin(); }
  void end(); void setClock(uint32_t hz); void setSDA(uint32_t) {} void setSCL(uint32_t) {}
  void beginTransmission(uint8_t a); void beginTransmission(int a) { beginTransmission((uint8_t)a); }
  uint8_t endTransmission(bool stop = true);
  uint8_t requestFrom(uint8_t a, uint8_t n, bool stop = true); uint8_t requestFrom(int a, int n) { return requestFrom((uint8_t)a, (uint8_t)n, true); } uint8_t requestFrom(int a, int n, int stop) { return requestFrom((uint8_t)a, (uint8_t)n, stop != 0); }
  size_t write(uint8_t c) override; size_t write(const uint8_t *b, size_t n) override; using Print::write;
  int available() override { return rn - ri; } int read() override { return ri < rn ? rb[ri++] : -1; } int peek() override { return ri < rn ? rb[ri] : -1; } void flush() override {}
  void setTimeout(uint16_t ms) { tmo = ms; } void onReceive(void (*)(int)) {} void onRequest(void (*)(void)) {}
private:
  int n_; uint8_t txa = 0, tb[BUFFER_LENGTH], rb[BUFFER_LENGTH]; int tn = 0, rn = 0, ri = 0; bool txing = false; uint32_t hz = 100000; uint16_t tmo = 25;
  bool wait(uint32_t bit, bool sr2 = false); void stop();
};
extern TwoWire Wire, Wire1;
