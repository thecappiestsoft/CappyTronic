#include "SPI.h"
SPIClass SPI(0);
void SPIClass::pins() { if (sckP < 0) sckP = CT_SPI_SCK; if (mosiP < 0) mosiP = CT_SPI_MOSI; if (misoP < 0) misoP = CT_SPI_MISO; if (ssP < 0) ssP = CT_SPI_SS; }
void SPIClass::begin(int8_t sck, int8_t miso, int8_t mosi, int8_t ss) { sckP = sck; misoP = miso; mosiP = mosi; ssP = ss; pins(); }
static uint8_t rev8(uint8_t b) { b = (b & 0xF0) >> 4 | (b & 0x0F) << 4; b = (b & 0xCC) >> 2 | (b & 0x33) << 2; return (b & 0xAA) >> 1 | (b & 0x55) << 1; }
void SPIClass::transferBytes(const uint8_t *out, uint8_t *in, uint32_t n) {
  pins(); const uint32_t CH = 4096;
  static char q[2 * CH + 128]; static char r[2 * CH + 64]; static char hx[2 * CH + 2]; static uint8_t tmp[CH];
  for (uint32_t off = 0; off < n; off += CH) {
    uint32_t k = n - off < CH ? n - off : CH;
    for (uint32_t i = 0; i < k; i++) tmp[i] = out ? out[off + i] : 0xff;
    if (set.order == LSBFIRST) for (uint32_t i = 0; i < k; i++) tmp[i] = rev8(tmp[i]);
    ct_bin2hex(tmp, k, hx);
    snprintf(q, sizeof q, "{\"op\":\"spi\",\"sck\":%d,\"mosi\":%d,\"miso\":%d,\"d\":\"%s\"}", sckP, mosiP, misoP, hx);
    ct_request(q, r, sizeof r);
    if (in) { char rh[2 * CH + 2]; ct_jstr(r, "r", rh, sizeof rh); int m = ct_hex2bin(rh, in + off, k); if (set.order == LSBFIRST) for (int i = 0; i < m; i++) in[off + i] = rev8(in[off + i]); }
    ct_cost(k * 8.0e6 / (set.clock ? set.clock : 1000000) + 5);
  }
}
uint8_t SPIClass::transfer(uint8_t v) { uint8_t r = 0xff; transferBytes(&v, &r, 1); return r; }
uint16_t SPIClass::transfer16(uint16_t v) { uint8_t o[2] = {(uint8_t)(v >> 8), (uint8_t)v}, i[2]; if (set.order == LSBFIRST) { o[0] = (uint8_t)v; o[1] = v >> 8; } transferBytes(o, i, 2); return set.order == LSBFIRST ? (i[1] << 8 | i[0]) : (i[0] << 8 | i[1]); }
uint32_t SPIClass::transfer32(uint32_t v) { uint32_t hi = transfer16(v >> 16); return hi << 16 | transfer16((uint16_t)v); }
void SPIClass::transfer(void *buf, size_t n) { uint8_t *b = (uint8_t *)buf; uint8_t *in = (uint8_t *)malloc(n); transferBytes(b, in, n); memcpy(b, in, n); free(in); }
// ESP32: piksele 16-bitowe wysyłane starszym bajtem najpierw
void SPIClass::writePixels(const void *data, uint32_t bytes) { const uint8_t *s = (const uint8_t *)data; uint8_t *t = (uint8_t *)malloc(bytes); for (uint32_t i = 0; i + 1 < bytes; i += 2) { t[i] = s[i + 1]; t[i + 1] = s[i]; } transferBytes(t, nullptr, bytes); free(t); }
void SPIClass::writePattern(const uint8_t *d, uint8_t size, uint32_t rep) { uint32_t n = size * rep; uint8_t *t = (uint8_t *)malloc(n); for (uint32_t i = 0; i < rep; i++) memcpy(t + i * size, d, size); transferBytes(t, nullptr, n); free(t); }
