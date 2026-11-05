#pragma once
#include "Arduino.h"
#define MIN_PULSE_WIDTH 544
#define MAX_PULSE_WIDTH 2400
#define DEFAULT_PULSE_WIDTH 1500
// Servo (ESP32Servo / arduino-pico / ESP8266): impulsy 50 Hz z PWM
class Servo {
public:
  uint8_t attach(int pin) { return attach(pin, MIN_PULSE_WIDTH, MAX_PULSE_WIDTH); }
  uint8_t attach(int pin, int mn, int mx) { pin_ = pin; min_ = mn; max_ = mx; writeMicroseconds(us_); return 1; }
  void detach() { if (pin_ >= 0) analogWrite(pin_, 0); pin_ = -1; }
  void write(int v) { if (v < MIN_PULSE_WIDTH) { if (v < 0) v = 0; if (v > 180) v = 180; v = map(v, 0, 180, min_, max_); } writeMicroseconds(v); }
  void writeMicroseconds(int us) { if (us < min_) us = min_; if (us > max_) us = max_; us_ = us; if (pin_ >= 0) { hw_pwm(pin_, hz_, us / (1e6 / hz_)); hw_pin_mode(pin_, 10, 0); } ct_cost(2); }
  int read() { return map(us_, min_, max_, 0, 180); }
  int readMicroseconds() { return us_; }
  bool attached() { return pin_ >= 0; }
  void setPeriodHertz(int hz) { hz_ = hz > 0 ? hz : 50; }
private:
  int pin_ = -1, min_ = MIN_PULSE_WIDTH, max_ = MAX_PULSE_WIDTH, us_ = DEFAULT_PULSE_WIDTH, hz_ = 50;
};
class ESP32PWM { public: static void allocateTimer(int) {} };
