// CappyTronic – rdzeń Arduino dla płytek ESP32 / ESP8266 / RP2040 uruchamianych w symulatorze (WebAssembly)
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include "ct_hw.h"
#include "ct_board.h"   // generowany przy kompilacji: piny i nazwa płytki
#include "Binary.h"

#define ARDUINO 10819
#define HIGH 0x1
#define LOW 0x0
#define INPUT 0x01
#define OUTPUT 0x03
#define PULLUP 0x04
#define INPUT_PULLUP 0x05
#define PULLDOWN 0x08
#define INPUT_PULLDOWN 0x09
#define OPEN_DRAIN 0x10
#define OUTPUT_OPEN_DRAIN 0x13
#define ANALOG 0xC0
#define RISING 0x01
#define FALLING 0x02
#define CHANGE 0x03
#define ONLOW 0x04
#define ONHIGH 0x05
#define LSBFIRST 0
#define MSBFIRST 1
#define PI 3.1415926535897932384626433832795
#define HALF_PI 1.5707963267948966192313216916398
#define TWO_PI 6.283185307179586476925286766559
#define DEG_TO_RAD 0.017453292519943295769236907684886
#define RAD_TO_DEG 57.295779513082320876798154814105
#define EULER 2.718281828459045235360287471352
#define SERIAL 0x0
#define DISPLAY 0x1
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
#define clockCyclesPerMicrosecond() ((long)(F_CPU / 1000000L))
#define interrupts() ct_interrupts(1)
#define noInterrupts() ct_interrupts(0)
#define digitalPinToInterrupt(p) (p)
#define digitalPinIsValid(p) ((p) >= 0 && (p) < 100)
#define NOT_A_PIN -1
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
#define IRAM_ATTR
#define ICACHE_RAM_ATTR
#define DRAM_ATTR
#define RTC_DATA_ATTR
#define ARDUINO_ISR_ATTR

typedef uint8_t byte;
typedef uint8_t BitOrder;
typedef uint8_t PinStatus;
typedef uint8_t PinMode;
typedef uint8_t pin_size_t;
typedef bool boolean;
typedef uint16_t word;
typedef void (*voidFuncPtr)(void);
typedef void (*voidFuncPtrArg)(void *);
class __FlashStringHelper;

#ifdef __cplusplus
extern "C" {
#endif
void pinMode(uint8_t pin, uint8_t mode);
void digitalWrite(uint8_t pin, uint8_t val);
int digitalRead(uint8_t pin);
int analogRead(uint8_t pin);
void analogReadResolution(uint8_t bits);
uint32_t analogReadMilliVolts(uint8_t pin);
void analogWrite(uint8_t pin, int value);
void analogWriteResolution(uint8_t bits);
void analogWriteFrequency(uint32_t freq);
void analogWriteRange(uint32_t range);
void analogWriteFreq(uint32_t freq);
void analogSetAttenuation(int atten);
void analogSetPinAttenuation(uint8_t pin, int atten);
void analogReference(uint8_t mode);
unsigned long millis(void);
unsigned long micros(void);
void delay(unsigned long ms);
void delayMicroseconds(unsigned int us);
void yield(void);
void attachInterrupt(uint8_t pin, voidFuncPtr fn, int mode);
void attachInterruptArg(uint8_t pin, voidFuncPtrArg fn, void *arg, int mode);
void detachInterrupt(uint8_t pin);
unsigned long pulseIn(uint8_t pin, uint8_t state, unsigned long timeout);
unsigned long pulseInLong(uint8_t pin, uint8_t state, unsigned long timeout);
void shiftOut(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder, uint8_t val);
uint8_t shiftIn(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder);
void tone(uint8_t pin, unsigned int frequency, unsigned long duration);
void noTone(uint8_t pin);
void ct_interrupts(int on);
// ESP32: LEDC (PWM), dioda RGB, rdzeń
bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution);
bool ledcAttachChannel(uint8_t pin, uint32_t freq, uint8_t resolution, uint8_t channel);
bool ledcWrite(uint8_t pinOrChannel, uint32_t duty);
uint32_t ledcRead(uint8_t pin);
uint32_t ledcWriteTone(uint8_t pin, uint32_t freq);
bool ledcDetach(uint8_t pin);
uint32_t ledcSetup(uint8_t channel, uint32_t freq, uint8_t resolution);
void ledcAttachPin(uint8_t pin, uint8_t channel);
void ledcDetachPin(uint8_t pin);
bool ledcChangeFrequency(uint8_t pin, uint32_t freq, uint8_t resolution);
void neopixelWrite(uint8_t pin, uint8_t r, uint8_t g, uint8_t b);
void rgbLedWrite(uint8_t pin, uint8_t r, uint8_t g, uint8_t b);
uint32_t esp_random(void);
uint32_t getCpuFrequencyMhz(void);
bool setCpuFrequencyMhz(uint32_t mhz);
int temperatureRead_int(void);
float temperatureRead(void);
#ifdef __cplusplus
}
#endif

#ifdef __cplusplus
#include <algorithm>
#include "WString.h"
#include "Print.h"
#include "Stream.h"
#include "HardwareSerial.h"
#include "IPAddress.h"
#include "Esp.h"

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
unsigned long pulseIn(uint8_t pin, uint8_t state);
using std::abs;
#include <time.h>
void configTime(long gmtOffset_sec, int daylightOffset_sec, const char *server1, const char *server2 = nullptr, const char *server3 = nullptr);
void configTzTime(const char *tz, const char *server1, const char *server2 = nullptr, const char *server3 = nullptr);
bool getLocalTime(struct tm *info, uint32_t ms = 5000);
void setup(void);
void loop(void);
#endif
