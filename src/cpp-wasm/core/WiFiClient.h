#pragma once
#include "Client.h"
// WiFiClient: połączenie TCP przez komputer (zasady jak w zakładce MQTT: domyślnie tylko sieć lokalna)
class WiFiClient : public Client {
public:
  WiFiClient() {}
  ~WiFiClient() {}
  int connect(IPAddress ip, uint16_t port) override { return connect(ip.toString().c_str(), port); }
  int connect(const char *host, uint16_t port) override;
  int connect(const char *host, uint16_t port, int32_t) { return connect(host, port); }
  size_t write(uint8_t c) override { return write(&c, 1); }
  size_t write(const uint8_t *buf, size_t n) override;
  using Print::write;
  int available() override; int read() override; int read(uint8_t *buf, size_t n) override; int peek() override;
  void flush() override {} void stop() override; uint8_t connected() override; operator bool() override { return connected(); }
  void setInsecure() {} void setCACert(const char *) {} void setTimeout(uint32_t ms) { Stream::setTimeout(ms); }
  void setNoDelay(bool) {}
  int h = 0;
private:
  uint8_t rb[2048]; int rn = 0, ri = 0; bool open = false;
  void fill();
};
typedef WiFiClient WiFiClientSecure;
