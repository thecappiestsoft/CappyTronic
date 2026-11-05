// CappyTronic – SPI (SPI1: SCK PA5, MISO PA6, MOSI PA7; SPI2: SCK PB13, MISO PB14, MOSI PB15), tryb master
#include "SPI.h"
SPIClass SPI(1), SPI_2(2);
static SPI_TypeDef *dev(int n) { return n == 1 ? SPI1 : SPI2; }
void SPIClass::begin() {
  if (n_ == 1) { RCC->APB2ENR |= 1u << 12; ct_gpio_mode(PA5, 0xB); ct_gpio_mode(PA6, 0x4); ct_gpio_mode(PA7, 0xB); }
  else { RCC->APB1ENR |= 1u << 14; ct_gpio_mode(PB13, 0xB); ct_gpio_mode(PB14, 0x4); ct_gpio_mode(PB15, 0xB); }
  apply(4000000, MSBFIRST, SPI_MODE0);
}
void SPIClass::end() { dev(n_)->CR1 = 0; }
void SPIClass::apply(uint32_t clk, uint8_t order, uint8_t mode) {
  uint32_t pclk = n_ == 1 ? 72000000 : 36000000, br = 0; while (br < 7 && (pclk >> (br + 1)) > clk) br++;
  SPI_TypeDef *S = dev(n_); S->CR1 = 0;
  S->CR1 = (1u << 9) | (1u << 8) | (1u << 2) | (br << 3) | (order == LSBFIRST ? (1u << 7) : 0) | (mode & 3) | (1u << 6);
}
void SPIClass::beginTransaction(SPISettings s) { apply(s.clock, s.order, s.mode); }
void SPIClass::setBitOrder(uint8_t o) { SPI_TypeDef *S = dev(n_); if (o == LSBFIRST) S->CR1 |= 1u << 7; else S->CR1 &= ~(1u << 7); }
void SPIClass::setDataMode(uint8_t m) { SPI_TypeDef *S = dev(n_); S->CR1 = (S->CR1 & ~3u) | (m & 3); }
void SPIClass::setClockDivider(uint32_t d) { apply((n_ == 1 ? 72000000 : 36000000) / (d ? d : 4), (dev(n_)->CR1 & (1u << 7)) ? LSBFIRST : MSBFIRST, dev(n_)->CR1 & 3); }
uint8_t SPIClass::transfer(uint8_t v) { SPI_TypeDef *S = dev(n_); while (!(S->SR & 2)) {} *(volatile uint8_t *)&S->DR = v; while (!(S->SR & 1)) {} return (uint8_t)S->DR; }
uint16_t SPIClass::transfer16(uint16_t v) { uint16_t r = transfer(v >> 8) << 8; return r | transfer(v & 255); }
void SPIClass::transfer(void *buf, size_t n) { uint8_t *b = (uint8_t *)buf; for (size_t i = 0; i < n; i++) b[i] = transfer(b[i]); }
