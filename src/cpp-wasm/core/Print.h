#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdarg.h>
#include "WString.h"
#include "Printable.h"
class __FlashStringHelper;
// Arduino Print – formatowanie liczb i tekstu (print/println/printf)
class Print {
public:
  virtual ~Print() {}
  virtual size_t write(uint8_t c) = 0;
  virtual size_t write(const uint8_t *buf, size_t n) { size_t k = 0; while (n--) k += write(*buf++); return k; }
  size_t write(const char *s) { return s ? write((const uint8_t *)s, strlen(s)) : 0; }
  size_t write(const char *b, size_t n) { return write((const uint8_t *)b, n); }
  virtual int availableForWrite() { return 0; }
  virtual void flush() {}
  int getWriteError() { return err; } void clearWriteError() { err = 0; }
  size_t print(const __FlashStringHelper *s) { return write((const char *)s); }
  size_t print(const String &s) { return write((const uint8_t *)s.c_str(), s.length()); }
  size_t print(const char s[]) { return write(s); }
  size_t print(char c) { return write((uint8_t)c); }
  size_t print(unsigned char v, int base = 10) { return printNumber(v, base); }
  size_t print(int v, int base = 10) { return printSigned(v, base); }
  size_t print(unsigned int v, int base = 10) { return printNumber(v, base); }
  size_t print(long v, int base = 10) { return printSigned(v, base); }
  size_t print(unsigned long v, int base = 10) { return printNumber(v, base); }
  size_t print(long long v, int base = 10) { return printSigned(v, base); }
  size_t print(unsigned long long v, int base = 10) { return printNumber(v, base); }
  size_t print(double v, int digits = 2) { return printFloat(v, digits); }
  size_t print(const Printable &x) { return x.printTo(*this); }
  size_t println(void) { return write("\r\n"); }
  template <class T> size_t println(const T &v) { size_t n = print(v); return n + println(); }
  template <class T> size_t println(const T &v, int f) { size_t n = print(v, f); return n + println(); }
  size_t println(const char s[]) { size_t n = print(s); return n + println(); }
  size_t printf(const char *fmt, ...) __attribute__((format(printf, 2, 3)));
protected:
  int err = 0;
  size_t printNumber(unsigned long long v, int base);
  size_t printSigned(long long v, int base) { if (base == 10 && v < 0) { size_t n = write('-'); return n + printNumber((unsigned long long)(-v), 10); } return printNumber(base == 10 ? (unsigned long long)v : (unsigned long long)(unsigned long)v, base); }
  size_t printFloat(double v, int digits);
};
