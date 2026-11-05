#pragma once
#include <stdint.h>
#include <string.h>
#include <stdlib.h>
class __FlashStringHelper;
// Arduino String – tekst o zmiennej długości
class String {
public:
  String(const char *s = "");
  String(const String &s);
  String(String &&s);
  String(const __FlashStringHelper *s) : String((const char *)s) {}
  explicit String(char c);
  explicit String(unsigned char v, unsigned char base = 10);
  explicit String(int v, unsigned char base = 10);
  explicit String(unsigned int v, unsigned char base = 10);
  explicit String(long v, unsigned char base = 10);
  explicit String(unsigned long v, unsigned char base = 10);
  explicit String(long long v, unsigned char base = 10);
  explicit String(unsigned long long v, unsigned char base = 10);
  explicit String(float v, unsigned int decimals = 2);
  explicit String(double v, unsigned int decimals = 2);
  ~String();
  String &operator=(const String &s);
  String &operator=(String &&s);
  String &operator=(const char *s);
  String &operator=(const __FlashStringHelper *s) { return *this = (const char *)s; }
  bool reserve(unsigned int size);
  unsigned int length() const { return len; }
  bool isEmpty() const { return len == 0; }
  bool concat(const String &s); bool concat(const char *s); bool concat(const char *s, unsigned int n); bool concat(char c);
  bool concat(unsigned char v); bool concat(int v); bool concat(unsigned int v); bool concat(long v); bool concat(unsigned long v);
  bool concat(long long v); bool concat(unsigned long long v); bool concat(float v); bool concat(double v);
  bool concat(const __FlashStringHelper *s) { return concat((const char *)s); }
  template <class T> String &operator+=(const T &v) { concat(v); return *this; }
  int compareTo(const String &s) const;
  bool equals(const String &s) const; bool equals(const char *s) const;
  bool equalsIgnoreCase(const String &s) const;
  bool operator==(const String &s) const { return equals(s); }
  bool operator==(const char *s) const { return equals(s); }
  bool operator!=(const String &s) const { return !equals(s); }
  bool operator!=(const char *s) const { return !equals(s); }
  bool operator<(const String &s) const { return compareTo(s) < 0; }
  bool operator>(const String &s) const { return compareTo(s) > 0; }
  bool operator<=(const String &s) const { return compareTo(s) <= 0; }
  bool operator>=(const String &s) const { return compareTo(s) >= 0; }
  bool startsWith(const String &p) const; bool startsWith(const String &p, unsigned int off) const; bool endsWith(const String &s) const;
  char charAt(unsigned int i) const; void setCharAt(unsigned int i, char c);
  char operator[](unsigned int i) const; char &operator[](unsigned int i);
  void getBytes(unsigned char *buf, unsigned int n, unsigned int idx = 0) const;
  void toCharArray(char *buf, unsigned int n, unsigned int idx = 0) const { getBytes((unsigned char *)buf, n, idx); }
  const char *c_str() const { return buf ? buf : ""; }
  char *begin() { return buf; } char *end() { return buf + len; }
  int indexOf(char c) const; int indexOf(char c, unsigned int from) const; int indexOf(const String &s) const; int indexOf(const String &s, unsigned int from) const;
  int lastIndexOf(char c) const; int lastIndexOf(char c, unsigned int from) const; int lastIndexOf(const String &s) const; int lastIndexOf(const String &s, unsigned int from) const;
  String substring(unsigned int from) const; String substring(unsigned int from, unsigned int to) const;
  void replace(char a, char b); void replace(const String &a, const String &b);
  void remove(unsigned int idx); void remove(unsigned int idx, unsigned int n);
  void toLowerCase(); void toUpperCase(); void trim();
  long toInt() const; float toFloat() const; double toDouble() const;
  explicit operator bool() const { return true; }
private:
  char *buf = nullptr; unsigned int len = 0, cap = 0;
  void setTo(const char *s, unsigned int n);
};
String operator+(const String &a, const String &b);
String operator+(const String &a, const char *b);
String operator+(const char *a, const String &b);
String operator+(const String &a, char b);
String operator+(const String &a, int b);
String operator+(const String &a, unsigned int b);
String operator+(const String &a, long b);
String operator+(const String &a, unsigned long b);
String operator+(const String &a, float b);
String operator+(const String &a, double b);
