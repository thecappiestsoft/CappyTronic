#include "WString.h"
#include <stdio.h>
#include <ctype.h>
static void utoa_b(unsigned long long v, int base, char *out) { char t[72]; int i = 0; if (base < 2) base = 10; do { int d = v % base; t[i++] = d < 10 ? '0' + d : 'A' + d - 10; v /= base; } while (v); int k = 0; while (i) out[k++] = t[--i]; out[k] = 0; }
static void itoa_b(long long v, int base, char *out) { if (v < 0 && base == 10) { out[0] = '-'; utoa_b((unsigned long long)(-v), base, out + 1); } else utoa_b((unsigned long long)v, base, out); }
void String::setTo(const char *s, unsigned int n) { if (!reserve(n)) return; memmove(buf, s, n); buf[n] = 0; len = n; }
bool String::reserve(unsigned int size) { if (buf && cap >= size) return true; char *nb = (char *)realloc(buf, size + 1); if (!nb) return false; if (!buf) nb[0] = 0; buf = nb; cap = size; return true; }
String::String(const char *s) { setTo(s ? s : "", s ? strlen(s) : 0); }
String::String(const String &s) { setTo(s.c_str(), s.len); }
String::String(String &&s) { buf = s.buf; len = s.len; cap = s.cap; s.buf = nullptr; s.len = s.cap = 0; }
String::String(char c) { char t[2] = {c, 0}; setTo(t, 1); }
String::String(unsigned char v, unsigned char b) { char t[72]; utoa_b(v, b, t); setTo(t, strlen(t)); }
String::String(int v, unsigned char b) { char t[72]; if (b == 10) itoa_b(v, b, t); else utoa_b((unsigned int)v, b, t); setTo(t, strlen(t)); }
String::String(unsigned int v, unsigned char b) { char t[72]; utoa_b(v, b, t); setTo(t, strlen(t)); }
String::String(long v, unsigned char b) { char t[72]; if (b == 10) itoa_b(v, b, t); else utoa_b((unsigned long)v, b, t); setTo(t, strlen(t)); }
String::String(unsigned long v, unsigned char b) { char t[72]; utoa_b(v, b, t); setTo(t, strlen(t)); }
String::String(long long v, unsigned char b) { char t[72]; if (b == 10) itoa_b(v, b, t); else utoa_b((unsigned long long)v, b, t); setTo(t, strlen(t)); }
String::String(unsigned long long v, unsigned char b) { char t[72]; utoa_b(v, b, t); setTo(t, strlen(t)); }
String::String(float v, unsigned int d) { char t[64]; snprintf(t, sizeof t, "%.*f", (int)d, (double)v); setTo(t, strlen(t)); }
String::String(double v, unsigned int d) { char t[64]; snprintf(t, sizeof t, "%.*f", (int)d, v); setTo(t, strlen(t)); }
String::~String() { free(buf); }
String &String::operator=(const String &s) { if (this != &s) setTo(s.c_str(), s.len); return *this; }
String &String::operator=(String &&s) { if (this != &s) { free(buf); buf = s.buf; len = s.len; cap = s.cap; s.buf = nullptr; s.len = s.cap = 0; } return *this; }
String &String::operator=(const char *s) { setTo(s ? s : "", s ? strlen(s) : 0); return *this; }
bool String::concat(const char *s, unsigned int n) { if (!s) return false; if (!reserve(len + n)) return false; memmove(buf + len, s, n); len += n; buf[len] = 0; return true; }
bool String::concat(const String &s) { return concat(s.c_str(), s.len); }
bool String::concat(const char *s) { return s ? concat(s, strlen(s)) : false; }
bool String::concat(char c) { return concat(&c, 1); }
bool String::concat(unsigned char v) { return concat(String(v)); }
bool String::concat(int v) { return concat(String(v)); }
bool String::concat(unsigned int v) { return concat(String(v)); }
bool String::concat(long v) { return concat(String(v)); }
bool String::concat(unsigned long v) { return concat(String(v)); }
bool String::concat(long long v) { return concat(String(v)); }
bool String::concat(unsigned long long v) { return concat(String(v)); }
bool String::concat(float v) { return concat(String(v)); }
bool String::concat(double v) { return concat(String(v)); }
int String::compareTo(const String &s) const { return strcmp(c_str(), s.c_str()); }
bool String::equals(const String &s) const { return len == s.len && strcmp(c_str(), s.c_str()) == 0; }
bool String::equals(const char *s) const { return strcmp(c_str(), s ? s : "") == 0; }
bool String::equalsIgnoreCase(const String &s) const { if (len != s.len) return false; for (unsigned i = 0; i < len; i++) if (tolower(buf[i]) != tolower(s.buf[i])) return false; return true; }
bool String::startsWith(const String &p) const { return p.len <= len && strncmp(c_str(), p.c_str(), p.len) == 0; }
bool String::startsWith(const String &p, unsigned int off) const { return off + p.len <= len && strncmp(c_str() + off, p.c_str(), p.len) == 0; }
bool String::endsWith(const String &s) const { return s.len <= len && strcmp(c_str() + len - s.len, s.c_str()) == 0; }
char String::charAt(unsigned int i) const { return i < len ? buf[i] : 0; }
void String::setCharAt(unsigned int i, char c) { if (i < len) buf[i] = c; }
char String::operator[](unsigned int i) const { return charAt(i); }
char &String::operator[](unsigned int i) { static char dummy; if (i >= len) { dummy = 0; return dummy; } return buf[i]; }
void String::getBytes(unsigned char *out, unsigned int n, unsigned int idx) const { if (!n || !out) return; if (idx >= len) { out[0] = 0; return; } unsigned int k = len - idx; if (k > n - 1) k = n - 1; memcpy(out, buf + idx, k); out[k] = 0; }
int String::indexOf(char c) const { return indexOf(c, 0); }
int String::indexOf(char c, unsigned int from) const { if (from >= len) return -1; const char *p = strchr(buf + from, c); return p ? p - buf : -1; }
int String::indexOf(const String &s) const { return indexOf(s, 0); }
int String::indexOf(const String &s, unsigned int from) const { if (from > len) return -1; const char *p = strstr(c_str() + from, s.c_str()); return p ? p - buf : -1; }
int String::lastIndexOf(char c) const { return len ? lastIndexOf(c, len - 1) : -1; }
int String::lastIndexOf(char c, unsigned int from) const { if (!len) return -1; if (from >= len) from = len - 1; for (int i = from; i >= 0; i--) if (buf[i] == c) return i; return -1; }
int String::lastIndexOf(const String &s) const { return lastIndexOf(s, len); }
int String::lastIndexOf(const String &s, unsigned int from) const { if (s.len > len) return -1; if (from > len - s.len) from = len - s.len; for (int i = from; i >= 0; i--) if (strncmp(buf + i, s.c_str(), s.len) == 0) return i; return -1; }
String String::substring(unsigned int from) const { return substring(from, len); }
String String::substring(unsigned int from, unsigned int to) const { if (from > to) { unsigned t = from; from = to; to = t; } if (from >= len) return String(""); if (to > len) to = len; String r; r.setTo(buf + from, to - from); return r; }
void String::replace(char a, char b) { for (unsigned i = 0; i < len; i++) if (buf[i] == a) buf[i] = b; }
void String::replace(const String &a, const String &b) { if (!a.len) return; String r; int i = 0, j; while ((j = indexOf(a, i)) >= 0) { r.concat(buf + i, j - i); r.concat(b); i = j + a.len; } r.concat(buf + i, len - i); *this = r; }
void String::remove(unsigned int idx) { remove(idx, len); }
void String::remove(unsigned int idx, unsigned int n) { if (idx >= len) return; if (n > len - idx) n = len - idx; memmove(buf + idx, buf + idx + n, len - idx - n + 1); len -= n; }
void String::toLowerCase() { for (unsigned i = 0; i < len; i++) buf[i] = tolower(buf[i]); }
void String::toUpperCase() { for (unsigned i = 0; i < len; i++) buf[i] = toupper(buf[i]); }
void String::trim() { if (!len) return; unsigned a = 0, b = len; while (a < b && isspace((unsigned char)buf[a])) a++; while (b > a && isspace((unsigned char)buf[b - 1])) b--; memmove(buf, buf + a, b - a); len = b - a; buf[len] = 0; }
long String::toInt() const { return atol(c_str()); }
float String::toFloat() const { return (float)atof(c_str()); }
double String::toDouble() const { return atof(c_str()); }
String operator+(const String &a, const String &b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, const char *b) { String r(a); r.concat(b); return r; }
String operator+(const char *a, const String &b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, char b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, int b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, unsigned int b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, long b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, unsigned long b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, float b) { String r(a); r.concat(b); return r; }
String operator+(const String &a, double b) { String r(a); r.concat(b); return r; }
