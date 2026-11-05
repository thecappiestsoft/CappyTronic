#include "WiFi.h"
WiFiClass WiFi;
static char BJ[2048]; static bool bjr = false;
static const char *board() { if (!bjr) { int n = hw_board(BJ, sizeof BJ - 1); BJ[n < 0 ? 0 : n] = 0; bjr = true; } return BJ; }
wl_status_t WiFiClass::begin(const char *ssid, const char *pass, int32_t, const uint8_t *, bool) {
  (void)pass; if (ssid) strncpy(ssid_, ssid, sizeof ssid_ - 1);
  ct_request("{\"op\":\"wifi\",\"on\":1}", nullptr, 0); on = true; t0 = hw_now(); return WL_DISCONNECTED;
}
wl_status_t WiFiClass::status() { ct_cost(1); if (!on) return WL_IDLE_STATUS; return hw_now() - t0 >= 1.2 ? WL_CONNECTED : WL_DISCONNECTED; }
bool WiFiClass::disconnect(bool, bool) { ct_request("{\"op\":\"wifi\",\"on\":0}", nullptr, 0); on = false; return true; }
IPAddress WiFiClass::localIP() { if (status() != WL_CONNECTED) return IPAddress(); char ip[32]; ct_jstr(board(), "ip", ip, sizeof ip); return IPAddress(ip); }
uint8_t *WiFiClass::macAddress(uint8_t *mac) { const uint8_t m[6] = {0x24, 0x0a, 0xc4, 0x12, 0x34, 0x56}; memcpy(mac, m, 6); return mac; }
String WiFiClass::macAddress() { uint8_t m[6]; macAddress(m); char t[20]; snprintf(t, sizeof t, "%02X:%02X:%02X:%02X:%02X:%02X", m[0], m[1], m[2], m[3], m[4], m[5]); return String(t); }
int WiFiClass::hostByName(const char *host, IPAddress &ip) { char q[256]; snprintf(q, sizeof q, "{\"op\":\"dns\",\"host\":\"%s\"}", host); char r[256]; ct_request(q, r, sizeof r); char a[64]; if (!ct_jstr(r, "ip", a, sizeof a)) return 0; return ip.fromString(a) ? 1 : 0; }
// --- TCP ---
int WiFiClient::connect(const char *host, uint16_t port) {
  if (WiFi.status() != WL_CONNECTED) return 0;
  char q[320]; snprintf(q, sizeof q, "{\"op\":\"tcp_open\",\"host\":\"%s\",\"port\":%u}", host, port); char r[256]; ct_request(q, r, sizeof r);
  h = (int)ct_jnum(r, "h", 0); open = h > 0; rn = ri = 0; return open ? 1 : 0;
}
size_t WiFiClient::write(const uint8_t *buf, size_t n) {
  if (!open) return 0; char *q = (char *)malloc(n * 2 + 64), *hx = (char *)malloc(n * 2 + 1); ct_bin2hex(buf, (int)n, hx);
  snprintf(q, n * 2 + 64, "{\"op\":\"tcp_w\",\"h\":%d,\"d\":\"%s\"}", h, hx); char r[128]; ct_request(q, r, sizeof r); free(q); free(hx);
  if (ct_jnum(r, "e", 0)) { open = false; return 0; } ct_cost(20 + n * 0.1); return n;
}
void WiFiClient::fill() { if (!open || ri < rn) return; char q[64]; snprintf(q, sizeof q, "{\"op\":\"tcp_r\",\"h\":%d}", h); static char r[4200]; ct_request(q, r, sizeof r); char hx[4100]; ct_jstr(r, "d", hx, sizeof hx); rn = ct_hex2bin(hx, rb, sizeof rb); ri = 0; if (ct_jnum(r, "closed", 0) && !rn) open = false; ct_cost(20); }
int WiFiClient::available() { fill(); return rn - ri; }
int WiFiClient::read() { fill(); return ri < rn ? rb[ri++] : -1; }
int WiFiClient::read(uint8_t *buf, size_t n) { fill(); size_t k = 0; while (k < n && ri < rn) buf[k++] = rb[ri++]; return (int)k; }
int WiFiClient::peek() { fill(); return ri < rn ? rb[ri] : -1; }
void WiFiClient::stop() { if (h) { char q[64]; snprintf(q, sizeof q, "{\"op\":\"tcp_close\",\"h\":%d}", h); ct_request(q, nullptr, 0); } open = false; h = 0; rn = ri = 0; }
uint8_t WiFiClient::connected() { if (!open) return ri < rn; fill(); return open || ri < rn; }
