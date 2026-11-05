// CappyTronic – rdzeń Arduino dla STM32F103 (Blue Pill): zegar 72 MHz, GPIO, czas, ADC, PWM, przerwania EXTI, UART
#include "Arduino.h"
uint32_t SystemCoreClock = 8000000;
static volatile uint32_t ms_ticks = 0;
static GPIO_TypeDef *const PORTS[3] = {GPIOA, GPIOB, GPIOC};
extern "C" void SystemInit(void) {
  // HSE 8 MHz -> PLL x9 = 72 MHz; APB1 = 36 MHz, APB2 = 72 MHz, ADC = 12 MHz; Flash: 2 cykle oczekiwania
  RCC->CR |= 1u << 16;
  for (uint32_t i = 0; i < 100000 && !(RCC->CR & (1u << 17)); i++) {}
  FLASH->ACR = 0x10 | 2;
  RCC->CFGR = (RCC->CFGR & ~0x003FFFF0u) | (7u << 18) | (1u << 16) | (4u << 8) | (2u << 14);
  RCC->CR |= 1u << 24;
  while (!(RCC->CR & (1u << 25))) {}
  RCC->CFGR = (RCC->CFGR & ~3u) | 2u;
  while (((RCC->CFGR >> 2) & 3u) != 2u) {}
  SystemCoreClock = 72000000;
}
extern "C" void SysTick_Handler(void) { ms_ticks++; }
static void init(void) {
  RCC->APB2ENR |= (1u << 0) | (1u << 2) | (1u << 3) | (1u << 4); // AFIO, GPIOA–C
  AFIO->MAPR = (AFIO->MAPR & ~(7u << 24)) | (2u << 24); // JTAG wyłączony, SWD zostaje (PA15, PB3, PB4 wolne)
  SysTick->LOAD = SystemCoreClock / 1000 - 1; SysTick->VAL = 0; SysTick->CTRL = 7;
  CoreDebug_DEMCR |= 1u << 24; DWT->CYCCNT = 0; DWT->CTRL |= 1;
  __enable_irq();
}
unsigned long millis(void) { return ms_ticks; }
unsigned long micros(void) {
  uint32_t m, v; do { m = ms_ticks; v = SysTick->VAL; } while (m != ms_ticks);
  return m * 1000 + (SysTick->LOAD - v) / (SystemCoreClock / 1000000);
}
void yield(void) {}
void delay(unsigned long ms) { uint32_t t0 = millis(); while (millis() - t0 < ms) { yield(); __WFI(); } }
void delayMicroseconds(unsigned int us) { uint32_t t0 = DWT->CYCCNT, n = us * (SystemCoreClock / 1000000); while (DWT->CYCCNT - t0 < n) {} }
// ---- GPIO ----
extern "C" void ct_gpio_mode(uint32_t pin, uint32_t cfg4) {
  if (pin >= NUM_DIGITAL_PINS) return; GPIO_TypeDef *g = PORTS[pin >> 4]; uint32_t b = pin & 15;
  volatile uint32_t *cr = b < 8 ? &g->CRL : &g->CRH; uint32_t sh = (b & 7) * 4;
  *cr = (*cr & ~(15u << sh)) | (cfg4 << sh);
}
static uint8_t pwm_on[NUM_DIGITAL_PINS];
void pinMode(uint32_t pin, uint32_t mode) {
  if (pin >= NUM_DIGITAL_PINS) return; GPIO_TypeDef *g = PORTS[pin >> 4]; uint32_t m = 1u << (pin & 15);
  pwm_on[pin] = 0;
  switch (mode) {
    case OUTPUT: ct_gpio_mode(pin, 0x3); break;              // push-pull 50 MHz
    case OUTPUT_OPEN_DRAIN: ct_gpio_mode(pin, 0x7); break;   // open drain
    case INPUT_PULLUP: ct_gpio_mode(pin, 0x8); g->BSRR = m; break;
    case INPUT_PULLDOWN: ct_gpio_mode(pin, 0x8); g->BRR = m; break;
    case INPUT_ANALOG: ct_gpio_mode(pin, 0x0); break;
    default: ct_gpio_mode(pin, 0x4); break;                  // wejście pływające
  }
}
void digitalWrite(uint32_t pin, uint32_t val) {
  if (pin >= NUM_DIGITAL_PINS) return;
  if (pwm_on[pin]) pinMode(pin, OUTPUT);
  GPIO_TypeDef *g = PORTS[pin >> 4]; uint32_t m = 1u << (pin & 15); if (val) g->BSRR = m; else g->BRR = m;
}
int digitalRead(uint32_t pin) { if (pin >= NUM_DIGITAL_PINS) return 0; return (PORTS[pin >> 4]->IDR >> (pin & 15)) & 1; }
void digitalToggle(uint32_t pin) { if (pin >= NUM_DIGITAL_PINS) return; PORTS[pin >> 4]->ODR ^= 1u << (pin & 15); }
// ---- ADC1 ----
static int adc_bits = 10; static bool adc_ready = false;
void analogReadResolution(int bits) { adc_bits = bits < 1 ? 1 : bits > 16 ? 16 : bits; }
int analogRead(uint32_t pin) {
  int ch = pin < 8 ? (int)pin : pin == PB0 ? 8 : pin == PB1 ? 9 : pin >= 0x80 ? (int)(pin - 0x80) : -1;
  if (pin < 0x80) { if (ch < 0) return 0; ct_gpio_mode(pin, 0x0); }
  if (!adc_ready) {
    RCC->APB2ENR |= 1u << 9; ADC1->CR2 = 1; delayMicroseconds(2);
    ADC1->CR2 |= 1u << 3; while (ADC1->CR2 & (1u << 3)) {}
    ADC1->CR2 |= 1u << 2; while (ADC1->CR2 & (1u << 2)) {}
    { uint32_t s = 0; for (int i = 0; i < 10; i++) s |= 5u << (i * 3); ADC1->SMPR2 = s; ADC1->SMPR1 = s & 0xFFFFFF; } // 55,5 cyklu
    adc_ready = true;
  }
  if (ch >= 16) ADC1->CR2 |= 1u << 23;
  ADC1->SQR3 = ch; ADC1->CR2 |= 1; // start konwersji
  uint32_t t0 = millis(); while (!(ADC1->SR & 2) && millis() - t0 < 5) {}
  uint32_t v = ADC1->DR & 0xFFF;
  return adc_bits >= 12 ? (int)(v << (adc_bits - 12)) : (int)(v >> (12 - adc_bits));
}
// ---- PWM (timery) ----
struct PwmMap { uint8_t pin, tim, ch; };
static const PwmMap PWM[] = { {PA8, 1, 1}, {PA9, 1, 2}, {PA10, 1, 3}, {PA11, 1, 4}, {PA0, 2, 1}, {PA1, 2, 2}, {PA2, 2, 3}, {PA3, 2, 4}, {PA6, 3, 1}, {PA7, 3, 2}, {PB0, 3, 3}, {PB1, 3, 4}, {PB6, 4, 1}, {PB7, 4, 2}, {PB8, 4, 3}, {PB9, 4, 4} };
static TIM_TypeDef *const TIMS[5] = {0, TIM1, TIM2, TIM3, TIM4};
static int pwm_bits = 8; static uint32_t pwm_freq = 1000; static uint32_t tim_freq[5];
void analogWriteResolution(int bits) { pwm_bits = bits < 1 ? 1 : bits > 16 ? 16 : bits; }
void analogWriteFrequency(uint32_t f) { pwm_freq = f ? f : 1000; }
static void timSetup(int t, uint32_t freq) {
  TIM_TypeDef *T = TIMS[t];
  if (t == 1) RCC->APB2ENR |= 1u << 11; else RCC->APB1ENR |= 1u << (t - 2);
  if (tim_freq[t] == freq && (T->CR1 & 1)) return;
  uint32_t clk = 72000000, psc = 0, arr = clk / freq; while (arr > 65536) { psc++; arr = clk / (freq * (psc + 1)); }
  T->CR1 = 0; T->PSC = psc; T->ARR = arr - 1; T->EGR = 1; if (t == 1) T->BDTR = 1u << 15; T->CR1 = 1; tim_freq[t] = freq;
}
extern "C" int ct_pwm(uint32_t pin, uint32_t freq, uint32_t high_ns_or_duty, int mode) { // mode 0: wypełnienie 0..65535, 1: czas w µs
  for (const PwmMap &p : PWM) if (p.pin == pin) {
    timSetup(p.tim, freq); TIM_TypeDef *T = TIMS[p.tim];
    uint32_t top = T->ARR + 1, ccr = mode ? (uint32_t)((uint64_t)high_ns_or_duty * 72 / (T->PSC + 1)) : (uint32_t)(((uint64_t)high_ns_or_duty * top) / 65535);
    if (ccr > top) ccr = top;
    volatile uint32_t *ccmr = p.ch <= 2 ? &T->CCMR1 : &T->CCMR2; uint32_t sh = ((p.ch - 1) & 1) * 8;
    *ccmr = (*ccmr & ~(0xFFu << sh)) | ((6u << 4) | 8u) << sh;
    (&T->CCR1)[p.ch - 1] = ccr; T->CCER |= 1u << ((p.ch - 1) * 4);
    ct_gpio_mode(pin, 0xB); pwm_on[pin] = 1; return 1;
  }
  return 0;
}
void analogWrite(uint32_t pin, int value) {
  int maxv = (1 << pwm_bits) - 1; if (value < 0) value = 0; if (value > maxv) value = maxv;
  if (!ct_pwm(pin, pwm_freq, (uint32_t)value * 65535u / maxv, 0)) { pinMode(pin, OUTPUT); digitalWrite(pin, value > maxv / 2); }
}
void tone(uint8_t pin, unsigned int f, unsigned long dur) {
  if (!f) { noTone(pin); return; }
  if (!ct_pwm(pin, f, 32768, 0)) return;
  if (dur) { extern void ct_tone_stop(uint8_t, unsigned long); ct_tone_stop(pin, dur); }
}
void tone(uint8_t pin, unsigned int f) { tone(pin, f, 0); }
static uint8_t tone_pin = 0xFF; static uint32_t tone_end = 0;
void ct_tone_stop(uint8_t pin, unsigned long dur) { tone_pin = pin; tone_end = millis() + dur; }
void noTone(uint8_t pin) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); if (pin == tone_pin) tone_pin = 0xFF; }
void ct_poll(void) { if (tone_pin != 0xFF && (int32_t)(millis() - tone_end) >= 0) noTone(tone_pin); }
// ---- przerwania zewnętrzne (EXTI) ----
static voidFuncPtr exti_fn[16];
void attachInterrupt(uint32_t pin, voidFuncPtr fn, uint32_t mode) {
  if (pin >= NUM_DIGITAL_PINS) return; uint32_t line = pin & 15, port = pin >> 4;
  exti_fn[line] = fn; RCC->APB2ENR |= 1;
  AFIO->EXTICR[line >> 2] = (AFIO->EXTICR[line >> 2] & ~(15u << ((line & 3) * 4))) | (port << ((line & 3) * 4));
  if (mode == RISING || mode == CHANGE) EXTI->RTSR |= 1u << line; else EXTI->RTSR &= ~(1u << line);
  if (mode == FALLING || mode == CHANGE) EXTI->FTSR |= 1u << line; else EXTI->FTSR &= ~(1u << line);
  EXTI->PR = 1u << line; EXTI->IMR |= 1u << line;
  int irq = line < 5 ? EXTI0_IRQn + (int)line : line < 10 ? EXTI9_5_IRQn : EXTI15_10_IRQn; NVIC_SetPriority(irq, 6); NVIC_EnableIRQ(irq);
}
void detachInterrupt(uint32_t pin) { if (pin >= NUM_DIGITAL_PINS) return; uint32_t line = pin & 15; EXTI->IMR &= ~(1u << line); exti_fn[line] = 0; }
static void exti_run(uint32_t lo, uint32_t hi) { uint32_t pr = EXTI->PR; for (uint32_t l = lo; l <= hi; l++) if (pr & (1u << l)) { EXTI->PR = 1u << l; if (exti_fn[l]) exti_fn[l](); } }
extern "C" { void EXTI0_IRQHandler(void) { exti_run(0, 0); } void EXTI1_IRQHandler(void) { exti_run(1, 1); } void EXTI2_IRQHandler(void) { exti_run(2, 2); } void EXTI3_IRQHandler(void) { exti_run(3, 3); }
  void EXTI4_IRQHandler(void) { exti_run(4, 4); } void EXTI9_5_IRQHandler(void) { exti_run(5, 9); } void EXTI15_10_IRQHandler(void) { exti_run(10, 15); } }
// ---- różne ----
unsigned long pulseIn(uint32_t pin, uint32_t state, unsigned long timeout) {
  uint32_t t0 = micros();
  while (digitalRead(pin) == (int)state) if (micros() - t0 > timeout) return 0;
  while (digitalRead(pin) != (int)state) if (micros() - t0 > timeout) return 0;
  uint32_t s = micros(); while (digitalRead(pin) == (int)state) if (micros() - t0 > timeout) return 0;
  return micros() - s;
}
unsigned long pulseIn(uint32_t pin, uint32_t state) { return pulseIn(pin, state, 1000000UL); }
unsigned long pulseInLong(uint32_t pin, uint32_t state, unsigned long timeout) { return pulseIn(pin, state, timeout); }
void shiftOut(uint32_t dataPin, uint32_t clockPin, uint32_t bitOrder, uint8_t val) { for (int i = 0; i < 8; i++) { digitalWrite(dataPin, bitOrder == LSBFIRST ? (val >> i) & 1 : (val >> (7 - i)) & 1); digitalWrite(clockPin, HIGH); digitalWrite(clockPin, LOW); } }
uint8_t shiftIn(uint32_t dataPin, uint32_t clockPin, uint32_t bitOrder) { uint8_t v = 0; for (int i = 0; i < 8; i++) { digitalWrite(clockPin, HIGH); if (bitOrder == LSBFIRST) v |= digitalRead(dataPin) << i; else v |= digitalRead(dataPin) << (7 - i); digitalWrite(clockPin, LOW); } return v; }
long map(long x, long a, long b, long c, long d) { return (x - a) * (d - c) / (b - a) + c; }
static uint32_t rnd = 1;
void randomSeed(unsigned long s) { if (s) rnd = s; }
long random(long howbig) { if (howbig <= 0) return 0; rnd = rnd * 1103515245u + 12345u; return (long)((rnd >> 1) % (uint32_t)howbig); }
long random(long a, long b) { if (a >= b) return a; return random(b - a) + a; }
uint16_t makeWord(uint16_t w) { return w; }
uint16_t makeWord(uint8_t h, uint8_t l) { return (h << 8) | l; }
// ---- port szeregowy (USART1: PA9/PA10, USART2: PA2/PA3, USART3: PB10/PB11) ----
HardwareSerial Serial1(1), Serial2(2), Serial3(3);
static USART_TypeDef *uart(int n) { return n == 1 ? USART1 : n == 2 ? USART2 : USART3; }
void HardwareSerial::begin(unsigned long baud, uint8_t config) {
  USART_TypeDef *U = uart(n_); uint32_t clk;
  if (n_ == 1) { RCC->APB2ENR |= 1u << 14; clk = 72000000; ct_gpio_mode(PA9, 0xB); ct_gpio_mode(PA10, 0x4); }
  else if (n_ == 2) { RCC->APB1ENR |= 1u << 17; clk = 36000000; ct_gpio_mode(PA2, 0xB); ct_gpio_mode(PA3, 0x4); }
  else { RCC->APB1ENR |= 1u << 18; clk = 36000000; ct_gpio_mode(PB10, 0xB); ct_gpio_mode(PB11, 0x4); }
  U->CR1 = 0; U->BRR = (clk + baud / 2) / baud; U->CR2 = (config & 0x08) ? (2u << 12) : 0;
  U->CR1 = (1u << 13) | (1u << 3) | (1u << 2) | (1u << 5) | ((config & 0x20) ? (1u << 10) | (1u << 12) : 0) | ((config & 0x10) ? (1u << 9) : 0);
  int irq = n_ == 1 ? USART1_IRQn : n_ == 2 ? USART2_IRQn : USART3_IRQn; NVIC_SetPriority(irq, 2); NVIC_EnableIRQ(irq); on = true;
}
void HardwareSerial::end() { flush(); uart(n_)->CR1 = 0; on = false; }
int HardwareSerial::available() { return (int)((rh - rt) & 127); }
int HardwareSerial::peek() { return rh == rt ? -1 : rb[rt]; }
int HardwareSerial::read() { if (rh == rt) return -1; int c = rb[rt]; rt = (rt + 1) & 127; return c; }
int HardwareSerial::availableForWrite() { return 127 - (int)((th - tt) & 127); }
void HardwareSerial::flush() { if (!on) return; while (th != tt) {} while (!(uart(n_)->SR & (1u << 6))) {} }
size_t HardwareSerial::write(uint8_t c) {
  if (!on) return 0; uint16_t nh = (th + 1) & 127;
  while (nh == tt) { if (__get_PRIMASK()) { irq(); } }
  tb[th] = c; th = nh; uart(n_)->CR1 |= 1u << 7; return 1;
}
void HardwareSerial::irq() {
  USART_TypeDef *U = uart(n_); uint32_t sr = U->SR;
  if (sr & (1u << 5)) { uint8_t c = U->DR; uint16_t nh = (rh + 1) & 127; if (nh != rt) { rb[rh] = c; rh = nh; } }
  if ((sr & (1u << 7)) && (U->CR1 & (1u << 7))) { if (th != tt) { U->DR = tb[tt]; tt = (tt + 1) & 127; } else U->CR1 &= ~(1u << 7); }
}
extern "C" { void USART1_IRQHandler(void) { Serial1.irq(); } void USART2_IRQHandler(void) { Serial2.irq(); } void USART3_IRQHandler(void) { Serial3.irq(); } }
void serialEvent() __attribute__((weak)); void serialEvent() {}
void serialEventRun(void) { if (Serial1.available()) serialEvent(); }
// ---- start programu ----
int main(void) { init(); setup(); for (;;) { loop(); ct_poll(); serialEventRun(); } }
// ---- funkcje systemowe newlib ----
extern "C" {
extern char _end, _estack;
static char *heap = &_end;
void *_sbrk(int incr) { char *p = heap; if (heap + incr > &_estack - 1024) { return (void *)-1; } heap += incr; return p; }
int _write(int fd, char *buf, int len) { for (int i = 0; i < len; i++) Serial1.write((uint8_t)buf[i]); return len; }
int _read(int, char *, int) { return 0; }
int _close(int) { return -1; } int _lseek(int, int, int) { return 0; } int _fstat(int, void *) { return 0; } int _isatty(int) { return 1; }
int _getpid(void) { return 1; } int _kill(int, int) { return -1; } void _exit(int) { for (;;) {} }
void __cxa_pure_virtual() { for (;;) {} }
}
