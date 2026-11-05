#pragma once
#include "Stream.h"
#define SERIAL_8N1 0x800001c
#define SERIAL_8E1 0x800001e
#define SERIAL_8O1 0x800001f
#define SERIAL_7N1 0x8000018
// port szeregowy: Serial = USB (monitor portu szeregowego), Serial1/Serial2 = UART na pinach płytki
class HardwareSerial : public Stream {
public:
  explicit HardwareSerial(int n) : num(n) {}
  void begin(unsigned long baud, uint32_t config = SERIAL_8N1, int8_t rxPin = -1, int8_t txPin = -1, bool invert = false, unsigned long timeout_ms = 20000UL, uint8_t rxfifo_full_thrhd = 112);
  void end() { on = false; }
  int available() override; int read() override; int peek() override; void flush() override {}
  size_t write(uint8_t c) override { return write(&c, 1); }
  size_t write(const uint8_t *buf, size_t n) override;
  using Print::write;
  int availableForWrite() override { return 128; }
  operator bool() const { return true; }
  void setDebugOutput(bool) {}
  void setPins(int8_t rx, int8_t tx) { if (rx >= 0) rxp = rx; if (tx >= 0) txp = tx; }
  unsigned long baudRate() { return baud; }
  void updateBaudRate(unsigned long b) { baud = b; }
  void setRxBufferSize(size_t) {} void setTxBufferSize(size_t) {}
private:
  int num; bool on = false; unsigned long baud = 115200; int rxp = -1, txp = -1;
  uint8_t rb[512]; int rh = 0, rt = 0;
  void fill();
};
extern HardwareSerial Serial;
extern HardwareSerial Serial1;
extern HardwareSerial Serial2;
