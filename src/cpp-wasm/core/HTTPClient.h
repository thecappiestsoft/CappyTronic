#pragma once
#include "WiFi.h"
#define HTTP_CODE_OK 200
#define HTTP_CODE_CREATED 201
#define HTTP_CODE_MOVED_PERMANENTLY 301
#define HTTP_CODE_FOUND 302
#define HTTP_CODE_BAD_REQUEST 400
#define HTTP_CODE_UNAUTHORIZED 401
#define HTTP_CODE_FORBIDDEN 403
#define HTTP_CODE_NOT_FOUND 404
#define HTTP_CODE_INTERNAL_SERVER_ERROR 500
#define HTTPC_ERROR_CONNECTION_REFUSED (-1)
#define HTTPC_ERROR_SEND_HEADER_FAILED (-2)
#define HTTPC_ERROR_SEND_PAYLOAD_FAILED (-3)
#define HTTPC_ERROR_NOT_CONNECTED (-4)
#define HTTPC_ERROR_CONNECTION_LOST (-5)
#define HTTPC_ERROR_NO_STREAM (-6)
#define HTTPC_ERROR_NO_HTTP_SERVER (-7)
#define HTTPC_ERROR_TOO_LESS_RAM (-8)
#define HTTPC_ERROR_ENCODING (-9)
#define HTTPC_ERROR_STREAM_WRITE (-10)
#define HTTPC_ERROR_READ_TIMEOUT (-11)
// HTTPClient (ESP32 / ESP8266): zapytania HTTP wykonuje komputer (domyślnie tylko sieć lokalna)
class HTTPClient {
public:
  bool begin(const String &url) { url_ = url; hdr_ = ""; return true; }
  bool begin(WiFiClient &, const String &url) { return begin(url); }
  bool begin(const String &host, uint16_t port, const String &uri = "/") { return begin("http://" + host + ":" + String((unsigned)port) + uri); }
  void end() { body_ = ""; }
  void addHeader(const String &name, const String &value) { if (hdr_.length()) hdr_ += ","; hdr_ += "\"" + esc(name) + "\":\"" + esc(value) + "\""; }
  void setTimeout(uint16_t ms) { tmo_ = ms; } void setConnectTimeout(int32_t) {} void setReuse(bool) {} void setUserAgent(const String &) {} void setFollowRedirects(int) {}
  void setAuthorization(const char *user, const char *pass);
  int GET() { return sendRequest("GET", nullptr, 0); }
  int POST(const String &p) { return sendRequest("POST", (const uint8_t *)p.c_str(), p.length()); }
  int POST(const uint8_t *p, size_t n) { return sendRequest("POST", p, n); }
  int PUT(const String &p) { return sendRequest("PUT", (const uint8_t *)p.c_str(), p.length()); }
  int PATCH(const String &p) { return sendRequest("PATCH", (const uint8_t *)p.c_str(), p.length()); }
  int sendRequest(const char *type, const String &p) { return sendRequest(type, (const uint8_t *)p.c_str(), p.length()); }
  int sendRequest(const char *type, const uint8_t *p = nullptr, size_t n = 0);
  String getString() { return body_; }
  int getSize() { return body_.length(); }
  bool connected() { return false; }
  static String errorToString(int e);
  WiFiClient &getStream() { return cl_; }
private:
  String url_, hdr_, body_; uint16_t tmo_ = 5000; WiFiClient cl_;
  static String esc(const String &s) { String r; for (unsigned i = 0; i < s.length(); i++) { char c = s[i]; if (c == '"' || c == '\\') r += '\\'; if ((uint8_t)c < 32) { char t[8]; snprintf(t, 8, "\\u%04x", c); r += t; } else r += c; } return r; }
};
