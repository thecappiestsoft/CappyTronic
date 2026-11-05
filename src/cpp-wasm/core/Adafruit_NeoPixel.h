#pragma once
#include "Arduino.h"
#define NEO_RGB ((0 << 6) | (0 << 4) | (1 << 2) | (2))
#define NEO_RBG ((0 << 6) | (0 << 4) | (2 << 2) | (1))
#define NEO_GRB ((1 << 6) | (1 << 4) | (0 << 2) | (2))
#define NEO_GBR ((2 << 6) | (2 << 4) | (0 << 2) | (1))
#define NEO_BRG ((1 << 6) | (1 << 4) | (2 << 2) | (0))
#define NEO_BGR ((2 << 6) | (2 << 4) | (1 << 2) | (0))
#define NEO_RGBW ((3 << 6) | (0 << 4) | (1 << 2) | (2))
#define NEO_GRBW ((3 << 6) | (1 << 4) | (0 << 2) | (2))
#define NEO_KHZ800 0x0000
#define NEO_KHZ400 0x0100
typedef uint16_t neoPixelType;
// Adafruit_NeoPixel: diody WS2812 – show() wysyła kolory paska (strumień GRB) do symulatora
class Adafruit_NeoPixel {
public:
  Adafruit_NeoPixel(uint16_t n, int16_t pin = 6, neoPixelType t = NEO_GRB + NEO_KHZ800) : pin_(pin), type_(t) { updateLength(n); }
  Adafruit_NeoPixel() {}
  ~Adafruit_NeoPixel() { free(px_); }
  void begin() { if (pin_ >= 0) { pinMode(pin_, OUTPUT); digitalWrite(pin_, LOW); } }
  void show();
  void setPin(int16_t p) { pin_ = p; }
  void setPixelColor(uint16_t n, uint8_t r, uint8_t g, uint8_t b) { if (n < n_) { px_[n * 3] = r; px_[n * 3 + 1] = g; px_[n * 3 + 2] = b; } }
  void setPixelColor(uint16_t n, uint8_t r, uint8_t g, uint8_t b, uint8_t w) { (void)w; setPixelColor(n, r, g, b); }
  void setPixelColor(uint16_t n, uint32_t c) { setPixelColor(n, (uint8_t)(c >> 16), (uint8_t)(c >> 8), (uint8_t)c); }
  void fill(uint32_t c = 0, uint16_t first = 0, uint16_t count = 0) { uint16_t e = count ? first + count : n_; if (e > n_) e = n_; for (uint16_t i = first; i < e; i++) setPixelColor(i, c); }
  void setBrightness(uint8_t b) { br_ = b; }
  uint8_t getBrightness() const { return br_; }
  void clear() { if (px_) memset(px_, 0, n_ * 3); }
  void updateLength(uint16_t n) { free(px_); n_ = n; px_ = (uint8_t *)calloc(n ? n * 3 : 1, 1); }
  void updateType(neoPixelType t) { type_ = t; }
  uint8_t *getPixels() const { return px_; }
  uint16_t numPixels() const { return n_; }
  uint32_t getPixelColor(uint16_t n) const { if (n >= n_) return 0; return ((uint32_t)px_[n * 3] << 16) | ((uint32_t)px_[n * 3 + 1] << 8) | px_[n * 3 + 2]; }
  bool canShow() { return true; }
  static uint32_t Color(uint8_t r, uint8_t g, uint8_t b) { return ((uint32_t)r << 16) | ((uint32_t)g << 8) | b; }
  static uint32_t Color(uint8_t r, uint8_t g, uint8_t b, uint8_t w) { return ((uint32_t)w << 24) | Color(r, g, b); }
  static uint32_t ColorHSV(uint16_t hue, uint8_t sat = 255, uint8_t val = 255);
  static uint8_t gamma8(uint8_t x);
  static uint32_t gamma32(uint32_t x) { uint8_t *y = (uint8_t *)&x; for (int i = 0; i < 4; i++) y[i] = gamma8(y[i]); return x; }
  static uint8_t sine8(uint8_t x) { return (uint8_t)(127.5 + 127.5 * sin((x / 256.0) * 2 * PI - PI / 2) + 0.5) ; }
  void rainbow(uint16_t first_hue = 0, int8_t reps = 1, uint8_t saturation = 255, uint8_t brightness = 255, bool gammify = true) { for (uint16_t i = 0; i < n_; i++) { uint16_t hue = first_hue + (i * reps * 65536) / n_; uint32_t c = ColorHSV(hue, saturation, brightness); if (gammify) c = gamma32(c); setPixelColor(i, c); } }
private:
  int16_t pin_ = -1; neoPixelType type_ = NEO_GRB; uint16_t n_ = 0; uint8_t *px_ = nullptr; uint8_t br_ = 0;
};
