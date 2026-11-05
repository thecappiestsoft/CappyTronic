#include "Adafruit_NeoPixel.h"
void Adafruit_NeoPixel::show() {
  if (pin_ < 0 || !n_) return; size_t n = n_ * 3; uint8_t *t = (uint8_t *)malloc(n); for (size_t i = 0; i < n; i++) t[i] = br_ ? (uint8_t)((px_[i] * (uint16_t)br_) >> 8) : px_[i];
  char *hx = (char *)malloc(n * 2 + 1), *q = (char *)malloc(n * 2 + 96); ct_bin2hex(t, (int)n, hx);
  snprintf(q, n * 2 + 96, "{\"op\":\"np\",\"pin\":%d,\"d\":\"%s\",\"bpp\":3}", pin_, hx); ct_request(q, nullptr, 0); free(t); free(hx); free(q);
  ct_cost(n * 8 * 1.25 + 50); // 800 kHz: 1,25 µs na bit + reset
}
uint32_t Adafruit_NeoPixel::ColorHSV(uint16_t hue, uint8_t sat, uint8_t val) {
  uint8_t r, g, b; hue = (hue * 1530L + 32768) / 65536;
  if (hue < 510) { b = 0; if (hue < 255) { r = 255; g = hue; } else { r = 510 - hue; g = 255; } }
  else if (hue < 1020) { r = 0; if (hue < 765) { g = 255; b = hue - 510; } else { g = 1020 - hue; b = 255; } }
  else if (hue < 1530) { g = 0; if (hue < 1275) { r = hue - 1020; b = 255; } else { r = 255; b = 1530 - hue; } }
  else { r = 255; g = b = 0; }
  uint32_t v1 = 1 + val; uint16_t s1 = 1 + sat; uint8_t s2 = 255 - sat;
  return ((((((r * s1) >> 8) + s2) * v1) & 0xff00) << 8) | (((((g * s1) >> 8) + s2) * v1) & 0xff00) | (((((b * s1) >> 8) + s2) * v1) >> 8);
}
uint8_t Adafruit_NeoPixel::gamma8(uint8_t x) { return (uint8_t)(pow(x / 255.0, 2.6) * 255.0 + 0.5); }
