#pragma once
#include "Arduino.h"
#include "Client.h"
typedef enum { WL_NO_SHIELD = 255, WL_IDLE_STATUS = 0, WL_NO_SSID_AVAIL = 1, WL_SCAN_COMPLETED = 2, WL_CONNECTED = 3, WL_CONNECT_FAILED = 4, WL_CONNECTION_LOST = 5, WL_DISCONNECTED = 6 } wl_status_t;
typedef enum { WIFI_OFF = 0, WIFI_STA = 1, WIFI_AP = 2, WIFI_AP_STA = 3 } wifi_mode_t;
#define WIFI_MODE_STA WIFI_STA
#define WIFI_MODE_AP WIFI_AP
#define WIFI_MODE_NULL WIFI_OFF
#define WIFI_AUTH_OPEN 0
#define WIFI_AUTH_WPA2_PSK 3
// Wi-Fi jest symulowane: połączenie z siecią „CappyNet” – ruch (MQTT, HTTP) idzie przez sieć komputera
class WiFiClass {
public:
  wl_status_t begin(const char *ssid, const char *pass = nullptr, int32_t ch = 0, const uint8_t *bssid = nullptr, bool connect = true);
  wl_status_t begin(const String &s, const String &p) { return begin(s.c_str(), p.c_str()); }
  wl_status_t status();
  bool isConnected() { return status() == WL_CONNECTED; }
  bool disconnect(bool wifioff = false, bool erase = false);
  bool reconnect() { begin(ssid_, nullptr); return true; }
  bool mode(wifi_mode_t m) { mode_ = m; return true; }
  wifi_mode_t getMode() { return mode_; }
  bool config(IPAddress, IPAddress, IPAddress, IPAddress = IPAddress(), IPAddress = IPAddress()) { return true; }
  bool setHostname(const char *h) { strncpy(host_, h, sizeof host_ - 1); return true; }
  const char *getHostname() { return host_; }
  bool hostname(const char *h) { return setHostname(h); }
  void setAutoReconnect(bool) {} void persistent(bool) {} void setSleep(bool) {} void setTxPower(int) {}
  bool softAP(const char *, const char * = nullptr, int = 1, int = 0, int = 4) { mode_ = WIFI_AP; return true; }
  IPAddress softAPIP() { return IPAddress(192, 168, 4, 1); }
  IPAddress localIP(); IPAddress gatewayIP() { return IPAddress(192, 168, 50, 1); } IPAddress subnetMask() { return IPAddress(255, 255, 255, 0); } IPAddress dnsIP(uint8_t = 0) { return IPAddress(192, 168, 50, 1); }
  String macAddress(); uint8_t *macAddress(uint8_t *mac);
  String SSID() { return String(ssid_); } int32_t RSSI() { return status() == WL_CONNECTED ? -52 : 0; } int32_t channel() { return 6; }
  int16_t scanNetworks(bool = false, bool = false) { return 3; }
  String SSID(uint8_t i) { const char *n[] = {"CappyNet", "Szkola-WiFi", "Infotech-Lab"}; return String(n[i % 3]); }
  int32_t RSSI(uint8_t i) { const int r[] = {-48, -63, -71}; return r[i % 3]; }
  uint8_t encryptionType(uint8_t) { return WIFI_AUTH_WPA2_PSK; }
  void scanDelete() {}
  int hostByName(const char *host, IPAddress &ip);
private:
  char ssid_[64] = {0}; char host_[33] = "cappy-board"; wifi_mode_t mode_ = WIFI_STA; double t0 = -1; bool on = false;
};
extern WiFiClass WiFi;
#include "WiFiClient.h"
