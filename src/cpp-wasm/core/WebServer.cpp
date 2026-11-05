#include "WebServer.h"
static String urldec(const String &s) { String r; for (unsigned i = 0; i < s.length(); i++) { char c = s[i]; if (c == '+') r += ' '; else if (c == '%' && i + 2 < s.length()) { char h[3] = {s[i + 1], s[i + 2], 0}; r += (char)strtol(h, 0, 16); i += 2; } else r += c; } return r; }
void WebServer::begin() {
  char q[96]; snprintf(q, sizeof q, "{\"op\":\"web_listen\",\"port\":%d}", port_); char r[256]; ct_request(q, r, sizeof r); on_ = true;
}
void WebServer::handleClient() {
  if (!on_) return; ct_cost(5);
  static char r[32768]; ct_request("{\"op\":\"web_poll\"}", r, sizeof r);
  int id = (int)ct_jnum(r, "id", 0); if (!id) return;
  id_ = id; sent_ = false; hdr_ = ""; chunk_ = ""; na_ = 0;
  char m[16], u[1024]; ct_jstr(r, "method", m, sizeof m); ct_jstr(r, "uri", u, sizeof u);
  String full(u); int qm = full.indexOf('?'); uri_ = qm >= 0 ? full.substring(0, qm) : full;
  method_ = !strcmp(m, "POST") ? HTTP_POST : !strcmp(m, "PUT") ? HTTP_PUT : !strcmp(m, "DELETE") ? HTTP_DELETE : !strcmp(m, "PATCH") ? HTTP_PATCH : HTTP_GET;
  String qs = qm >= 0 ? full.substring(qm + 1) : String("");
  static char body[8192]; ct_jstr(r, "body", body, sizeof body);
  if (method_ == HTTP_POST && strlen(body)) { if (qs.length()) qs += "&"; qs += body; an_[na_] = "plain"; av_[na_] = body; }
  int start = 0; while (start < (int)qs.length() && na_ < 23) { int amp = qs.indexOf('&', start); if (amp < 0) amp = qs.length(); String kv = qs.substring(start, amp); int eq = kv.indexOf('='); an_[na_] = urldec(eq >= 0 ? kv.substring(0, eq) : kv); av_[na_] = urldec(eq >= 0 ? kv.substring(eq + 1) : String("")); na_++; start = amp + 1; }
  for (int i = 0; i < nr_; i++) if ((r_[i].m == HTTP_ANY || r_[i].m == method_) && r_[i].uri == uri_) { r_[i].h(); if (!sent_) send(200, "text/plain", ""); return; }
  if (nf_) { nf_(); if (!sent_) send(404, "text/plain", "Not found"); } else send(404, "text/plain", "Not found: " + uri_);
}
void WebServer::send(int code, const char *type, const String &content) {
  if (!id_ || sent_) return; sent_ = true; String body = chunk_ + content; size_t n = body.length();
  char *hx = (char *)malloc(n * 2 + 1), *q = (char *)malloc(n * 2 + hdr_.length() + 256); ct_bin2hex((const uint8_t *)body.c_str(), (int)n, hx);
  snprintf(q, n * 2 + hdr_.length() + 256, "{\"op\":\"web_resp\",\"id\":%d,\"code\":%d,\"type\":\"%s\",\"headers\":{%s},\"body\":\"%s\"}", id_, code, type ? type : "text/html", hdr_.c_str(), hx);
  ct_request(q, nullptr, 0); free(hx); free(q); ct_cost(200);
}
String WebServer::arg(const String &name) { for (int i = 0; i < na_; i++) if (an_[i] == name) return av_[i]; return String(); }
String WebServer::arg(int i) { return i < na_ ? av_[i] : String(); }
String WebServer::argName(int i) { return i < na_ ? an_[i] : String(); }
bool WebServer::hasArg(const String &name) { for (int i = 0; i < na_; i++) if (an_[i] == name) return true; return false; }
