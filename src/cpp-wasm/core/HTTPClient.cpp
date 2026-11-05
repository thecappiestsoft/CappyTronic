#include "HTTPClient.h"
static const char *B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
void HTTPClient::setAuthorization(const char *user, const char *pass) { String s = String(user) + ":" + pass, o; int v = 0, b = -6; for (unsigned i = 0; i < s.length(); i++) { v = (v << 8) + (uint8_t)s[i]; b += 8; while (b >= 0) { o += B64[(v >> b) & 63]; b -= 6; } } if (b > -6) o += B64[((v << 8) >> (b + 8)) & 63]; while (o.length() % 4) o += '='; addHeader("Authorization", "Basic " + o); }
int HTTPClient::sendRequest(const char *type, const uint8_t *p, size_t n) {
  if (WiFi.status() != WL_CONNECTED) return HTTPC_ERROR_NOT_CONNECTED;
  size_t cap = n * 2 + url_.length() * 2 + hdr_.length() + 256; char *q = (char *)malloc(cap), *hx = (char *)malloc(n * 2 + 1); ct_bin2hex(p ? p : (const uint8_t *)"", (int)n, hx);
  snprintf(q, cap, "{\"op\":\"http\",\"method\":\"%s\",\"url\":\"%s\",\"headers\":{%s},\"body\":\"%s\",\"timeout\":%d}", type, esc(url_).c_str(), hdr_.c_str(), hx, (tmo_ + 999) / 1000);
  static char r[65536]; ct_request(q, r, sizeof r); free(q); free(hx);
  ct_cost(2000);
  int e = (int)ct_jnum(r, "e", 0); if (e) return e == 13 ? HTTPC_ERROR_CONNECTION_REFUSED : e == 110 ? HTTPC_ERROR_READ_TIMEOUT : HTTPC_ERROR_CONNECTION_REFUSED;
  const char *bp = strstr(r, "\"body\":\""); body_ = "";
  if (bp) { bp += 8; const char *end = strchr(bp, '"'); size_t hn = end ? (size_t)(end - bp) : 0; char *bin = (char *)malloc(hn / 2 + 1); char *tmp = (char *)malloc(hn + 1); memcpy(tmp, bp, hn); tmp[hn] = 0; int m = ct_hex2bin(tmp, (uint8_t *)bin, hn / 2); bin[m] = 0; body_ = String(bin); free(bin); free(tmp); }
  return (int)ct_jnum(r, "status", -1);
}
String HTTPClient::errorToString(int e) { switch (e) { case -1: return "connection refused"; case -4: return "not connected"; case -5: return "connection lost"; case -11: return "read Timeout"; default: return "error " + String(e); } }
