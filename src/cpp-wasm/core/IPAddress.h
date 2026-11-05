#pragma once
#include <stdint.h>
#include "Printable.h"
#include "WString.h"
class IPAddress : public Printable {
public:
  IPAddress() { a[0] = a[1] = a[2] = a[3] = 0; }
  IPAddress(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) { a[0] = b0; a[1] = b1; a[2] = b2; a[3] = b3; }
  IPAddress(uint32_t v) { memcpy(a, &v, 4); }
  IPAddress(const char *s) { fromString(s); }
  bool fromString(const char *s) { unsigned v[4] = {0}; int n = 0; const char *p = s; for (; *p && n < 4; p++) { if (*p == '.') n++; else if (*p >= '0' && *p <= '9') v[n] = v[n] * 10 + (*p - '0'); else return false; } if (n != 3) return false; for (int i = 0; i < 4; i++) a[i] = (uint8_t)v[i]; return true; }
  bool fromString(const String &s) { return fromString(s.c_str()); }
  operator uint32_t() const { uint32_t v; memcpy(&v, a, 4); return v; }
  uint8_t operator[](int i) const { return a[i]; }
  uint8_t &operator[](int i) { return a[i]; }
  bool operator==(const IPAddress &o) const { return memcmp(a, o.a, 4) == 0; }
  String toString() const { char t[16]; snprintf(t, sizeof t, "%u.%u.%u.%u", a[0], a[1], a[2], a[3]); return String(t); }
  size_t printTo(Print &p) const override;
private:
  uint8_t a[4];
};
extern const IPAddress INADDR_NONE;
