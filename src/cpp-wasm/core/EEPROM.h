#pragma once
#include "Arduino.h"
// EEPROM (ESP32/ESP8266/RP2040: emulowana we Flash) – begin(rozmiar), write/read, commit()
class EEPROMClass {
public:
  bool begin(size_t size) { if (size > 4096) size = 4096; n_ = size; return true; }
  uint8_t read(int a) { return a >= 0 && a < (int)n_ ? d_[a] : 0; }
  void write(int a, uint8_t v) { if (a >= 0 && a < (int)n_) d_[a] = v; }
  void update(int a, uint8_t v) { write(a, v); }
  bool commit() { ct_cost(20000); return true; }
  void end() { commit(); }
  size_t length() { return n_; }
  uint8_t &operator[](int a) { return d_[a & 4095]; }
  template <class T> T &get(int a, T &t) { if (a >= 0 && a + sizeof(T) <= n_) memcpy(&t, d_ + a, sizeof(T)); return t; }
  template <class T> const T &put(int a, const T &t) { if (a >= 0 && a + sizeof(T) <= n_) memcpy(d_ + a, &t, sizeof(T)); return t; }
private:
  uint8_t d_[4096]; size_t n_ = 512;
public:
  EEPROMClass() { memset(d_, 0xff, sizeof d_); }
};
extern EEPROMClass EEPROM;
