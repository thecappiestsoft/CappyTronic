#pragma once
#include "Arduino.h"
// CappyTronic – serwo na sprzętowym PWM 50 Hz (piny timerów: PA0–PA3, PA6–PA11, PB0, PB1, PB6–PB9)
#define MIN_PULSE_WIDTH 544
#define MAX_PULSE_WIDTH 2400
#define DEFAULT_PULSE_WIDTH 1500
extern "C" int ct_pwm(uint32_t pin, uint32_t freq, uint32_t v, int mode);
class Servo {
public:
  uint8_t attach(int pin, int mn = MIN_PULSE_WIDTH, int mx = MAX_PULSE_WIDTH) { pin_ = pin; mn_ = mn; mx_ = mx; writeMicroseconds(us_); return 1; }
  void detach() { if (pin_ >= 0) pinMode(pin_, INPUT); pin_ = -1; }
  void write(int v) { if (v < 200) { if (v < 0) v = 0; if (v > 180) v = 180; v = map(v, 0, 180, mn_, mx_); } writeMicroseconds(v); }
  void writeMicroseconds(int us) { us_ = us < mn_ ? mn_ : us > mx_ ? mx_ : us; if (pin_ >= 0) ct_pwm(pin_, 50, us_, 1); }
  int read() { return map(us_, mn_, mx_, 0, 180); }
  int readMicroseconds() { return us_; }
  bool attached() { return pin_ >= 0; }
private: int pin_ = -1, mn_ = MIN_PULSE_WIDTH, mx_ = MAX_PULSE_WIDTH, us_ = DEFAULT_PULSE_WIDTH;
};
