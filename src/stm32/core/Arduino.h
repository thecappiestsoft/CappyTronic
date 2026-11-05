// CappyTronic – rdzeń Arduino dla STM32F103C8 (Blue Pill), zgodny z API STM32duino
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include "stm32f1.h"
#include "pins_arduino.h"
#include "Binary.h"
#define ARDUINO 10819
#define ARDUINO_ARCH_STM32F1_CAPPY 1
#define ARDUINO_BLUEPILL_F103C8 1
#define STM32F1xx 1
#define STM32F103xB 1
#define F_CPU 72000000L
#define VARIANT_ARDUINO_STM32_BLUEPILL 1
#define HIGH 0x1
#define LOW 0x0
#define INPUT 0x0
#define OUTPUT 0x1
#define INPUT_PULLUP 0x2
#define INPUT_PULLDOWN 0x3
#define OUTPUT_OPEN_DRAIN 0x4
#define INPUT_ANALOG 0x5
#define INPUT_FLOATING INPUT
#define CHANGE 2
#define FALLING 3
#define RISING 4
#define LSBFIRST 0
#define MSBFIRST 1
#define PI 3.1415926535897932384626433832795
#define HALF_PI 1.5707963267948966192313216916398
#define TWO_PI 6.283185307179586476925286766559
#define DEG_TO_RAD 0.017453292519943295769236907684886
#define RAD_TO_DEG 57.295779513082320876798154814105
#define EULER 2.718281828459045235360287471352
#define DEC 10
#define HEX 16
#define OCT 8
#define BIN 2
#define radians(deg) ((deg) * DEG_TO_RAD)
#define degrees(rad) ((rad) * RAD_TO_DEG)
#define sq(x) ((x) * (x))
#define lowByte(w) ((uint8_t)((w) & 0xff))
#define highByte(w) ((uint8_t)((w) >> 8))
#define bitRead(value, bit) (((value) >> (bit)) & 0x01)
#define bitSet(value, bit) ((value) |= (1UL << (bit)))
#define bitClear(value, bit) ((value) &= ~(1UL << (bit)))
#define bitToggle(value, bit) ((value) ^= (1UL << (bit)))
#define bitWrite(value, bit, bitvalue) ((bitvalue) ? bitSet(value, bit) : bitClear(value, bit))
#define bit(b) (1UL << (b))
#define _BV(b) (1UL << (b))
#define clockCyclesPerMicrosecond() (SystemCoreClock / 1000000L)
#define interrupts() __enable_irq()
#define noInterrupts() __disable_irq()
#define NOT_A_PIN 0xFF
#define NOT_AN_INTERRUPT -1
#define PROGMEM
#define PGM_P const char *
#define PSTR(s) (s)
#define F(s) ((const __FlashStringHelper *)(s))
#define pgm_read_byte(addr) (*(const uint8_t *)(addr))
#define pgm_read_word(addr) (*(const uint16_t *)(addr))
#define pgm_read_dword(addr) (*(const uint32_t *)(addr))
#define pgm_read_float(addr) (*(const float *)(addr))
#define pgm_read_ptr(addr) (*(void *const *)(addr))
#define pgm_read_byte_near(a) pgm_read_byte(a)
#define pgm_read_word_near(a) pgm_read_word(a)
#define memcpy_P memcpy
#define strcpy_P strcpy
#define strlen_P strlen
#define strcmp_P strcmp
#define strncpy_P strncpy
#define sprintf_P sprintf
#define snprintf_P snprintf
typedef uint8_t byte;
typedef uint8_t BitOrder;
typedef uint8_t PinStatus;
typedef uint32_t PinMode;
typedef uint32_t pin_size_t;
typedef bool boolean;
typedef uint16_t word;
typedef void (*voidFuncPtr)(void);
typedef void (*callback_function_t)(void);
class __FlashStringHelper;
#ifdef __cplusplus
extern "C" {
#endif
extern uint32_t SystemCoreClock;
void pinMode(uint32_t pin, uint32_t mode);
void digitalWrite(uint32_t pin, uint32_t val);
int digitalRead(uint32_t pin);
void digitalToggle(uint32_t pin);
int analogRead(uint32_t pin);
void analogReadResolution(int bits);
void analogWrite(uint32_t pin, int value);
void analogWriteResolution(int bits);
void analogWriteFrequency(uint32_t freq);
unsigned long millis(void);
unsigned long micros(void);
void delay(unsigned long ms);
void delayMicroseconds(unsigned int us);
void yield(void);
void attachInterrupt(uint32_t pin, voidFuncPtr fn, uint32_t mode);
void detachInterrupt(uint32_t pin);
unsigned long pulseIn(uint32_t pin, uint32_t state, unsigned long timeout);
unsigned long pulseInLong(uint32_t pin, uint32_t state, unsigned long timeout);
void shiftOut(uint32_t dataPin, uint32_t clockPin, uint32_t bitOrder, uint8_t val);
uint8_t shiftIn(uint32_t dataPin, uint32_t clockPin, uint32_t bitOrder);
void tone(uint8_t pin, unsigned int frequency, unsigned long duration);
void noTone(uint8_t pin);
void ct_gpio_mode(uint32_t pin, uint32_t cfg4);
#ifdef __cplusplus
}
#endif
#ifdef __cplusplus
#include <algorithm>
#include "WString.h"
#include "Print.h"
#include "Stream.h"
#include "HardwareSerial.h"
template <class T, class U> static inline auto min(const T &a, const U &b) -> decltype(a < b ? a : b) { return b < a ? b : a; }
template <class T, class U> static inline auto max(const T &a, const U &b) -> decltype(a < b ? a : b) { return a < b ? b : a; }
#define _min(a, b) ((a) < (b) ? (a) : (b))
#define _max(a, b) ((a) > (b) ? (a) : (b))
template <class T, class L, class H> static inline T constrain(T x, L lo, H hi) { return x < lo ? (T)lo : (x > hi ? (T)hi : x); }
long map(long x, long in_min, long in_max, long out_min, long out_max);
long random(long howbig);
long random(long howsmall, long howbig);
void randomSeed(unsigned long seed);
uint16_t makeWord(uint16_t w);
uint16_t makeWord(uint8_t h, uint8_t l);
void tone(uint8_t pin, unsigned int frequency);
unsigned long pulseIn(uint32_t pin, uint32_t state);
using std::abs;
void setup(void);
void loop(void);
#endif
