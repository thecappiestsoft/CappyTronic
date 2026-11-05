#pragma once
#include "Arduino.h"
// Preferences (ESP32): pary klucz–wartość w pamięci nieulotnej (w symulacji: do końca uruchomienia)
class Preferences {
public:
  bool begin(const char *ns, bool ro = false) { (void)ro; ns_ = ns; return true; }
  void end() {}
  bool clear() { for (auto &e : e_) e.used = false; return true; }
  bool remove(const char *k) { E *x = find(k); if (x) x->used = false; return x != nullptr; }
  bool isKey(const char *k) { return find(k) != nullptr; }
  size_t putInt(const char *k, int32_t v) { return putS(k, String((long)v)); } size_t putUInt(const char *k, uint32_t v) { return putS(k, String((unsigned long)v)); }
  size_t putLong(const char *k, int32_t v) { return putInt(k, v); } size_t putULong(const char *k, uint32_t v) { return putUInt(k, v); }
  size_t putChar(const char *k, int8_t v) { return putInt(k, v); } size_t putUChar(const char *k, uint8_t v) { return putUInt(k, v); }
  size_t putShort(const char *k, int16_t v) { return putInt(k, v); } size_t putUShort(const char *k, uint16_t v) { return putUInt(k, v); }
  size_t putFloat(const char *k, float v) { return putS(k, String(v, 7)); } size_t putDouble(const char *k, double v) { return putS(k, String(v, 12)); }
  size_t putBool(const char *k, bool v) { return putS(k, v ? "1" : "0"); }
  size_t putString(const char *k, const char *v) { return putS(k, String(v)); } size_t putString(const char *k, const String &v) { return putS(k, v); }
  int32_t getInt(const char *k, int32_t d = 0) { E *x = find(k); return x ? x->v.toInt() : d; } uint32_t getUInt(const char *k, uint32_t d = 0) { E *x = find(k); return x ? strtoul(x->v.c_str(), 0, 10) : d; }
  int32_t getLong(const char *k, int32_t d = 0) { return getInt(k, d); } uint32_t getULong(const char *k, uint32_t d = 0) { return getUInt(k, d); }
  int8_t getChar(const char *k, int8_t d = 0) { return getInt(k, d); } uint8_t getUChar(const char *k, uint8_t d = 0) { return getUInt(k, d); }
  int16_t getShort(const char *k, int16_t d = 0) { return getInt(k, d); } uint16_t getUShort(const char *k, uint16_t d = 0) { return getUInt(k, d); }
  float getFloat(const char *k, float d = NAN) { E *x = find(k); return x ? x->v.toFloat() : d; } double getDouble(const char *k, double d = NAN) { E *x = find(k); return x ? x->v.toDouble() : d; }
  bool getBool(const char *k, bool d = false) { E *x = find(k); return x ? x->v == "1" : d; }
  String getString(const char *k, const String d = String()) { E *x = find(k); return x ? x->v : d; }
  size_t getString(const char *k, char *buf, size_t n) { E *x = find(k); if (!x || !n) return 0; strncpy(buf, x->v.c_str(), n - 1); buf[n - 1] = 0; return strlen(buf); }
  size_t freeEntries() { size_t n = 0; for (auto &e : e_) n += !e.used; return n; }
private:
  struct E { String k, v; bool used = false; };
  static E e_[64]; String ns_;
  E *find(const char *k) { String key = ns_ + "/" + k; for (auto &e : e_) if (e.used && e.k == key) return &e; return nullptr; }
  size_t putS(const char *k, const String &v) { E *x = find(k); if (!x) for (auto &e : e_) if (!e.used) { x = &e; x->k = ns_ + "/" + k; x->used = true; break; } if (!x) return 0; x->v = v; return v.length(); }
};
