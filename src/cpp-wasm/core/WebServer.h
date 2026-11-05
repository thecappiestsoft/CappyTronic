#pragma once
#include "WiFi.h"
typedef enum { HTTP_ANY = 0, HTTP_GET = 1, HTTP_HEAD = 2, HTTP_POST = 3, HTTP_PUT = 4, HTTP_PATCH = 5, HTTP_DELETE = 6, HTTP_OPTIONS = 7 } HTTPMethod;
#define CONTENT_LENGTH_UNKNOWN ((size_t)-1)
// WebServer (ESP32) / ESP8266WebServer: serwer WWW płytki – komputer udostępnia go pod adresem http://localhost:8080 (port widać w monitorze)
class WebServer {
public:
  typedef void (*THandler)(void);
  explicit WebServer(int port = 80) : port_(port) {}
  void begin();
  void begin(uint16_t port) { port_ = port; begin(); }
  void close() {} void stop() {}
  void on(const char *uri, THandler h) { on(uri, HTTP_ANY, h); }
  void on(const char *uri, HTTPMethod m, THandler h) { if (nr_ < 32) { r_[nr_].uri = uri; r_[nr_].m = m; r_[nr_].h = h; nr_++; } }
  void on(const char *uri, HTTPMethod m, THandler h, THandler) { on(uri, m, h); }
  void onNotFound(THandler h) { nf_ = h; }
  void handleClient();
  void send(int code, const char *type = nullptr, const String &content = String(""));
  void send(int code, const String &type, const String &content) { send(code, type.c_str(), content); }
  void send(int code, const char *type, const char *content) { send(code, type, String(content)); }
  void send_P(int code, const char *type, const char *content) { send(code, type, String(content)); }
  void send_P(int code, const char *type, const char *content, size_t n) { String s; s.concat(content, n); send(code, type, s); }
  void sendHeader(const String &n, const String &v, bool = false) { if (hdr_.length()) hdr_ += ","; hdr_ += "\"" + n + "\":\"" + v + "\""; }
  void setContentLength(size_t) {}
  void sendContent(const String &s) { chunk_ += s; }
  String arg(const String &name); String arg(int i); String argName(int i); int args() { return na_; } bool hasArg(const String &name);
  String uri() { return uri_; } HTTPMethod method() { return method_; }
  String header(const String &) { return String(); } bool hasHeader(const String &) { return false; } void collectHeaders(const char *[], size_t) {}
  WiFiClient client() { return WiFiClient(); }
  bool authenticate(const char *, const char *) { return true; } void requestAuthentication() {}
private:
  struct R { String uri; HTTPMethod m; THandler h; }; R r_[32]; int nr_ = 0; THandler nf_ = nullptr; int port_ = 80; bool on_ = false;
  int id_ = 0; String uri_, hdr_, chunk_, an_[24], av_[24]; int na_ = 0; HTTPMethod method_ = HTTP_GET; bool sent_ = false;
};
typedef WebServer ESP8266WebServer;
