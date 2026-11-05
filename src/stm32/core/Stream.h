#pragma once
#include "Print.h"
// Arduino Stream – odczyt z limitem czasu (readString, parseInt…)
class Stream : public Print {
public:
  virtual int available() = 0;
  virtual int read() = 0;
  virtual int peek() = 0;
  void setTimeout(unsigned long ms) { tmo = ms; }
  unsigned long getTimeout() { return tmo; }
  bool find(const char *target); bool find(char c) { char t[2] = {c, 0}; return find(t); }
  bool findUntil(const char *target, const char *term);
  long parseInt(); float parseFloat();
  size_t readBytes(char *buf, size_t n); size_t readBytes(uint8_t *buf, size_t n) { return readBytes((char *)buf, n); }
  size_t readBytesUntil(char term, char *buf, size_t n); size_t readBytesUntil(char term, uint8_t *buf, size_t n) { return readBytesUntil(term, (char *)buf, n); }
  String readString(); String readStringUntil(char term);
protected:
  unsigned long tmo = 1000;
  int timedRead(); int timedPeek(); int peekNextDigit(bool dec);
};
