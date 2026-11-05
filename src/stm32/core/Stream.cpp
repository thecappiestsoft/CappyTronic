#include "Arduino.h"
int Stream::timedRead() { unsigned long t0 = millis(); do { int c = read(); if (c >= 0) return c; delay(1); } while (millis() - t0 < tmo); return -1; }
int Stream::timedPeek() { unsigned long t0 = millis(); do { int c = peek(); if (c >= 0) return c; delay(1); } while (millis() - t0 < tmo); return -1; }
int Stream::peekNextDigit(bool dec) { for (;;) { int c = timedPeek(); if (c < 0) return c; if (c == '-' || (c >= '0' && c <= '9') || (dec && c == '.')) return c; read(); } }
bool Stream::find(const char *target) { return findUntil(target, nullptr); }
bool Stream::findUntil(const char *target, const char *term) { size_t n = strlen(target), k = 0, tn = term ? strlen(term) : 0, tk = 0; if (!n) return true; int c; while ((c = timedRead()) >= 0) { if (c == target[k]) { if (++k >= n) return true; } else k = (c == target[0]) ? 1 : 0; if (tn) { if (c == term[tk]) { if (++tk >= tn) return false; } else tk = 0; } } return false; }
long Stream::parseInt() { bool neg = false; long v = 0; int c = peekNextDigit(false); if (c < 0) return 0; do { if (c == '-') neg = true; else if (c >= '0' && c <= '9') v = v * 10 + c - '0'; read(); c = timedPeek(); } while (c >= '0' && c <= '9'); return neg ? -v : v; }
float Stream::parseFloat() { bool neg = false, frac = false; double v = 0, f = 1; int c = peekNextDigit(true); if (c < 0) return 0; do { if (c == '-') neg = true; else if (c == '.') frac = true; else if (c >= '0' && c <= '9') { if (frac) { f *= 0.1; v += (c - '0') * f; } else v = v * 10 + c - '0'; } read(); c = timedPeek(); } while ((c >= '0' && c <= '9') || (c == '.' && !frac)); return neg ? -v : v; }
size_t Stream::readBytes(char *buf, size_t n) { size_t k = 0; while (k < n) { int c = timedRead(); if (c < 0) break; buf[k++] = (char)c; } return k; }
size_t Stream::readBytesUntil(char term, char *buf, size_t n) { size_t k = 0; while (k < n) { int c = timedRead(); if (c < 0 || c == term) break; buf[k++] = (char)c; } return k; }
String Stream::readString() { String s; int c; while ((c = timedRead()) >= 0) s += (char)c; return s; }
String Stream::readStringUntil(char term) { String s; int c; while ((c = timedRead()) >= 0 && c != term) s += (char)c; return s; }
