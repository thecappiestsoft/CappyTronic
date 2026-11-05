#include "Wire.h"
TwoWire Wire(0), Wire1(1);
void TwoWire::pins() { if (sdaP < 0) sdaP = num ? CT_I2C1_SDA : CT_I2C_SDA; if (sclP < 0) sclP = num ? CT_I2C1_SCL : CT_I2C_SCL; }
bool TwoWire::begin(int sda, int scl, uint32_t f) { if (sda >= 0) sdaP = sda; if (scl >= 0) sclP = scl; if (f) freq = f; pins(); return true; }
uint8_t TwoWire::endTransmission(bool stop) {
  pins(); txOn = false; static char q[1024], hx[600]; ct_bin2hex(tx, txn, hx);
  snprintf(q, sizeof q, "{\"op\":\"i2c\",\"scl\":%d,\"sda\":%d,\"ops\":[{\"t\":\"w\",\"a\":%d,\"d\":\"%s\",\"s\":%d}]}", sclP, sdaP, txa, hx, stop ? 1 : 0);
  static char r[256]; ct_request(q, r, sizeof r);
  ct_cost((txn + 1) * 9.0e6 / freq + 20);
  return ct_jnum(r, "e", 0) ? 2 : 0;  // 2 = brak potwierdzenia adresu (NACK)
}
size_t TwoWire::requestFrom(uint8_t addr, size_t n, bool stop) {
  pins(); if (n > sizeof rx) n = sizeof rx; rxn = rxi = 0;
  char q[160]; snprintf(q, sizeof q, "{\"op\":\"i2c\",\"scl\":%d,\"sda\":%d,\"ops\":[{\"t\":\"r\",\"a\":%d,\"n\":%d}]}", sclP, sdaP, addr, (int)n);
  static char r[1200]; ct_request(q, r, sizeof r);
  ct_cost((n + 1) * 9.0e6 / freq + 20);
  if (ct_jnum(r, "e", 0)) return 0;
  const char *p = strstr(r, "\"r\":[\""); if (!p) return 0; p += 6;
  while (p[0] && p[1] && p[0] != '"' && rxn < (int)n) { rx[rxn++] = (uint8_t)strtol((char[]){p[0], p[1], 0}, nullptr, 16); p += 2; }
  return rxn;
}
