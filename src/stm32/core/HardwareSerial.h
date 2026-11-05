#pragma once
#include "Stream.h"
#define SERIAL_8N1 0x06
#define SERIAL_8E1 0x26
#define SERIAL_8O1 0x36
#define SERIAL_8N2 0x0E
class HardwareSerial : public Stream {
public:
  HardwareSerial(int n) : n_(n) {}
  void begin(unsigned long baud, uint8_t config = SERIAL_8N1);
  void end();
  int available() override;
  int peek() override;
  int read() override;
  void flush() override;
  int availableForWrite() override;
  size_t write(uint8_t c) override;
  using Print::write;
  operator bool() { return true; }
  void irq();
  int n_;
  volatile uint16_t rh = 0, rt = 0, th = 0, tt = 0; uint8_t rb[128], tb[128]; bool on = false;
};
extern HardwareSerial Serial1, Serial2, Serial3;
#define Serial Serial1
void serialEventRun(void);
