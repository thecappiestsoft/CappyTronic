// CappyTronic – I2C (sprzętowe I2C1: SCL = PB6, SDA = PB7; I2C2: SCL = PB10, SDA = PB11), tryb master
#include "Wire.h"
TwoWire Wire(1), Wire1(2);
static I2C_TypeDef *dev(int n) { return n == 1 ? I2C1 : I2C2; }
void TwoWire::begin() {
  I2C_TypeDef *I = dev(n_);
  if (n_ == 1) { RCC->APB1ENR |= 1u << 21; ct_gpio_mode(PB6, 0xF); ct_gpio_mode(PB7, 0xF); } else { RCC->APB1ENR |= 1u << 22; ct_gpio_mode(PB10, 0xF); ct_gpio_mode(PB11, 0xF); }
  I->CR1 = 1u << 15; I->CR1 = 0; I->CR2 = 36; setClock(hz);
}
void TwoWire::setClock(uint32_t h) {
  hz = h; I2C_TypeDef *I = dev(n_); uint32_t pe = I->CR1 & 1; I->CR1 &= ~1u;
  if (h <= 100000) { I->CCR = 36000000 / (2 * h); I->TRISE = 37; } else { uint32_t c = 36000000 / (3 * h); I->CCR = (1u << 15) | (c ? c : 1); I->TRISE = 12; }
  I->CR1 |= 1; (void)pe;
}
void TwoWire::end() { dev(n_)->CR1 = 0; }
bool TwoWire::wait(uint32_t bit, bool sr2) {
  I2C_TypeDef *I = dev(n_); uint32_t t0 = millis();
  while (!(I->SR1 & bit)) { if (I->SR1 & (1u << 10)) return false; if (millis() - t0 > tmo) return false; }
  return true;
}
void TwoWire::stop() { I2C_TypeDef *I = dev(n_); I->CR1 |= 1u << 9; uint32_t t0 = millis(); while ((I->SR2 & 2) && millis() - t0 < tmo) {} }
void TwoWire::beginTransmission(uint8_t a) { txa = a; tn = 0; txing = true; }
size_t TwoWire::write(uint8_t c) { if (!txing) return 0; if (tn >= BUFFER_LENGTH) return 0; tb[tn++] = c; return 1; }
size_t TwoWire::write(const uint8_t *b, size_t n) { size_t k = 0; while (k < n && write(b[k])) k++; return k; }
uint8_t TwoWire::endTransmission(bool sendStop) {
  I2C_TypeDef *I = dev(n_); txing = false;
  I->CR1 |= 1u << 8; if (!wait(1)) { stop(); return 4; }
  I->DR = txa << 1; if (!wait(2)) { I->SR1 &= ~(1u << 10); stop(); return 2; }
  (void)I->SR1; (void)I->SR2;
  for (int i = 0; i < tn; i++) { if (!wait(1u << 7)) { I->SR1 &= ~(1u << 10); stop(); return 3; } I->DR = tb[i]; }
  if (!wait(1u << 2)) { I->SR1 &= ~(1u << 10); stop(); return 3; }
  if (sendStop) stop();
  return 0;
}
uint8_t TwoWire::requestFrom(uint8_t a, uint8_t n, bool sendStop) {
  I2C_TypeDef *I = dev(n_); rn = ri = 0; if (n > BUFFER_LENGTH) n = BUFFER_LENGTH; if (!n) return 0;
  I->CR1 |= 1u << 10; I->CR1 |= 1u << 8; if (!wait(1)) { stop(); return 0; }
  I->DR = (a << 1) | 1; if (!wait(2)) { I->SR1 &= ~(1u << 10); stop(); return 0; }
  if (n == 1) I->CR1 &= ~(1u << 10);
  (void)I->SR1; (void)I->SR2;
  if (n == 1 && sendStop) I->CR1 |= 1u << 9;
  for (int i = 0; i < n; i++) {
    if (i == n - 2) { I->CR1 &= ~(1u << 10); }
    if (!wait(1u << 6)) break;
    if (i == n - 2 && sendStop) I->CR1 |= 1u << 9;
    rb[rn++] = I->DR;
  }
  I->CR1 |= 1u << 10; uint32_t t0 = millis(); while ((I->SR2 & 2) && millis() - t0 < tmo) {}
  return rn;
}
