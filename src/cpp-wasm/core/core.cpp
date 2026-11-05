// CappyTronic – implementacja rdzenia Arduino na mostku „hw” (wątek symulacji)
#include "Arduino.h"

/* ---------- zapytania JSON i proste narzędzia ---------- */
static char RESP[65536];
extern "C" int ct_request(const char *json, char *out, int outmax) {
  int n = hw_req(json, (int)strlen(json), out ? out : RESP, out ? outmax : (int)sizeof(RESP) - 1);
  if (n < 0) n = 0; (out ? out : RESP)[n] = 0; return n;
}
static const char *jfind(const char *js, const char *key) {
  char pat[64]; snprintf(pat, sizeof pat, "\"%s\":", key); const char *p = strstr(js, pat); return p ? p + strlen(pat) : nullptr;
}
extern "C" const char *ct_jstr(const char *js, const char *key, char *buf, int max) {
  const char *p = jfind(js, key); if (!p || *p != '"') { if (max) buf[0] = 0; return nullptr; }
  p++; int k = 0;
  while (*p && *p != '"' && k < max - 1) {
    if (*p == '\\' && p[1]) { p++; char c = *p; if (c == 'n') c = '\n'; else if (c == 't') c = '\t'; else if (c == 'r') c = '\r'; else if (c == 'u') { unsigned v = 0; for (int i = 1; i <= 4 && p[i]; i++) { char h = p[i]; v = v * 16 + (h <= '9' ? h - '0' : (h | 32) - 'a' + 10); } p += 4; if (v < 0x80) c = (char)v; else { if (v < 0x800) { buf[k++] = 0xC0 | (v >> 6); c = 0x80 | (v & 63); } else { buf[k++] = 0xE0 | (v >> 12); if (k < max - 1) buf[k++] = 0x80 | ((v >> 6) & 63); c = 0x80 | (v & 63); } } } buf[k++] = c; p++; continue; }
    buf[k++] = *p++;
  }
  buf[k] = 0; return buf;
}
extern "C" double ct_jnum(const char *js, const char *key, double def) { const char *p = jfind(js, key); if (!p) return def; if (*p == '"') return def; return atof(p); }
static int hexv(char c) { return c <= '9' ? c - '0' : (c | 32) - 'a' + 10; }
extern "C" int ct_hex2bin(const char *hex, uint8_t *out, int max) { int n = 0; while (hex[0] && hex[1] && n < max) { out[n++] = (uint8_t)(hexv(hex[0]) * 16 + hexv(hex[1])); hex += 2; } return n; }
extern "C" void ct_bin2hex(const uint8_t *in, int n, char *out) { static const char *H = "0123456789abcdef"; for (int i = 0; i < n; i++) { out[2 * i] = H[in[i] >> 4]; out[2 * i + 1] = H[in[i] & 15]; } out[2 * n] = 0; }

/* ---------- czas i „koszt” instrukcji ---------- */
static double ctT0 = 0, debt = 0;   // debt: czas procesora [s] zużyty od ostatniego uśpienia
static bool irqOn = true;
static double now_s() { return hw_now() + debt; }
static void settle() { if (debt > 0) { double t = hw_now() + debt; debt = 0; hw_sleep_until(t); } }
extern "C" void ct_cost(double us) { debt += us * 1e-6 * CT_COST_SCALE; if (debt > 200e-6) { settle(); ct_poll(); } }
unsigned long millis(void) { ct_cost(0.05); return (unsigned long)((now_s() - ctT0) * 1000.0); }
unsigned long micros(void) { ct_cost(0.05); return (unsigned long)((now_s() - ctT0) * 1e6); }
static void sleep_to(double t) {
  settle();
  for (;;) { ct_poll(); double n = hw_now(); if (n >= t - 1e-9) break; hw_sleep_until(t); }
}
void delay(unsigned long ms) { sleep_to(now_s() + ms / 1000.0); }
void delayMicroseconds(unsigned int us) { if (us < 150) ct_cost(us / CT_COST_SCALE); else sleep_to(now_s() + us * 1e-6); }
void yield(void) { ct_cost(1); ct_poll(); }

/* ---------- piny ---------- */
enum { M_IN = 1, M_OUT = 3, M_OD = 7, M_PWM = 10, M_ADC = 20 };
static uint8_t pmode[128];
static inline bool rgbPin(uint8_t p) { return p >= 100 && p < 164; }
void pinMode(uint8_t pin, uint8_t mode) {
  if (rgbPin(pin)) return;
  int m = (mode & 0x10) ? M_OD : (mode & OUTPUT) == OUTPUT ? M_OUT : M_IN, pull = (mode & PULLUP) ? 2 : (mode & PULLDOWN) ? 1 : 0;
  if (pin < 128) pmode[pin] = m; hw_pin_mode(pin, m, pull); ct_cost(1);
}
void digitalWrite(uint8_t pin, uint8_t val) {
  if (rgbPin(pin)) { uint8_t b = val ? RGB_BRIGHTNESS : 0; neopixelWrite(pin - 100, b, b, b); return; }
  if (pin < 128 && pmode[pin] == M_PWM) { hw_pin_mode(pin, M_OUT, 0); pmode[pin] = M_OUT; }
  hw_pin_set(pin, val ? 1 : 0); ct_cost(0.2);
}
int digitalRead(uint8_t pin) { ct_cost(0.2); if (pin < 128 && (pmode[pin] == M_OUT || pmode[pin] == M_OD) && 0) return hw_pin_out(pin); return hw_pin_get(pin); }

/* ---------- ADC ---------- */
static int adcBits = CT_ADC_BITS;
void analogReadResolution(uint8_t bits) { if (bits >= 1 && bits <= 16) adcBits = bits; }
void analogSetAttenuation(int) {}
void analogSetPinAttenuation(uint8_t, int) {}
void analogReference(uint8_t) {}
static int adcPin(uint8_t pin) { int g = pin; if (g < 128 && pmode[g] != M_ADC) { hw_pin_mode(g, M_ADC, 0); pmode[g] = M_ADC; } return g; }
uint32_t analogReadMilliVolts(uint8_t pin) { int mv = hw_adc(adcPin(pin)); ct_cost(10); if (mv < 0) mv = 0; if (mv > CT_ADC_FS_MV) mv = CT_ADC_FS_MV; return (uint32_t)mv; }
int analogRead(uint8_t pin) {
  double f = analogReadMilliVolts(pin) / (double)CT_ADC_FS_MV;
#ifdef CT_ARCH_ESP8266
  return (int)(f * 1024 + 0.5) > 1024 ? 1024 : (int)(f * 1024 + 0.5);
#else
  int mx = (1 << adcBits) - 1; return (int)(f * mx + 0.5);
#endif
}

/* ---------- PWM: analogWrite, LEDC (ESP32), tone ---------- */
static uint32_t awFreq = CT_PWM_FREQ, awRange = CT_PWM_RANGE;
void analogWriteResolution(uint8_t bits) { if (bits >= 1 && bits <= 16) awRange = (1u << bits) - 1; }
void analogWriteFrequency(uint32_t f) { awFreq = f; }
void analogWriteFreq(uint32_t f) { awFreq = f; }
void analogWriteRange(uint32_t r) { awRange = r; }
static void pwmOut(uint8_t pin, double f, double duty) {
  if (pin >= 128) return;
  if (duty <= 0) { hw_pwm(pin, 0, 0); hw_pin_mode(pin, M_OUT, 0); hw_pin_set(pin, 0); pmode[pin] = M_OUT; }
  else if (duty >= 1) { hw_pwm(pin, 0, 0); hw_pin_mode(pin, M_OUT, 0); hw_pin_set(pin, 1); pmode[pin] = M_OUT; }
  else { hw_pwm(pin, f, duty); pmode[pin] = M_PWM; }
  ct_cost(2);
}
void analogWrite(uint8_t pin, int value) { if (value < 0) value = 0; if ((uint32_t)value > awRange) value = awRange; pwmOut(pin, awFreq, (double)value / awRange); }
struct Ledc { int pin = -1; uint32_t freq = 0; uint8_t res = 8; uint32_t duty = 0; bool setup = false; };
static Ledc ch[16]; static Ledc pinL[64];
uint32_t ledcSetup(uint8_t c, uint32_t freq, uint8_t res) { if (c >= 16) return 0; ch[c].freq = freq; ch[c].res = res; ch[c].setup = true; return freq; }
void ledcAttachPin(uint8_t pin, uint8_t c) { if (c >= 16 || pin >= 64) return; ch[c].pin = pin; pinL[pin] = ch[c]; pinL[pin].pin = c; pwmOut(pin, ch[c].freq, (double)ch[c].duty / ((1u << ch[c].res))); }
void ledcDetachPin(uint8_t pin) { if (pin < 64) { pinL[pin].freq = 0; pwmOut(pin, 0, 0); } }
bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t res) { if (pin >= 64) return false; pinL[pin].freq = freq; pinL[pin].res = res; pinL[pin].duty = 0; pinL[pin].pin = -1; pinL[pin].setup = true; pwmOut(pin, freq, 0); return true; }
bool ledcAttachChannel(uint8_t pin, uint32_t freq, uint8_t res, uint8_t c) { ledcSetup(c, freq, res); ledcAttachPin(pin, c); pinL[pin].setup = true; return true; }
bool ledcWrite(uint8_t x, uint32_t duty) {
  // ESP32 Arduino 3.x: ledcWrite(pin, …); 2.x: ledcWrite(kanał, …) – rozpoznajemy po tym, co zostało skonfigurowane
  if (x < 64 && pinL[x].setup && pinL[x].pin < 0) { pinL[x].duty = duty; pwmOut(x, pinL[x].freq, (double)duty / (1u << pinL[x].res)); return true; }
  if (x < 16 && ch[x].setup) { ch[x].duty = duty; for (int p = 0; p < 64; p++) if (pinL[p].freq && pinL[p].pin == x) pwmOut(p, ch[x].freq, (double)duty / (1u << ch[x].res)); return true; }
  if (x < 64 && pinL[x].setup) { pinL[x].duty = duty; pwmOut(x, pinL[x].freq, (double)duty / (1u << pinL[x].res)); return true; }
  return false;
}
uint32_t ledcRead(uint8_t x) { if (x < 64 && pinL[x].setup) return pinL[x].duty; if (x < 16) return ch[x].duty; return 0; }
uint32_t ledcWriteTone(uint8_t x, uint32_t f) { if (x < 64 && pinL[x].setup && pinL[x].pin < 0) { pinL[x].freq = f; pwmOut(x, f, f ? 0.5 : 0); return f; } if (x < 16) { ch[x].freq = f; for (int p = 0; p < 64; p++) if (pinL[p].freq && pinL[p].pin == x) pwmOut(p, f, f ? 0.5 : 0); } return f; }
bool ledcDetach(uint8_t pin) { ledcDetachPin(pin); if (pin < 64) pinL[pin].setup = false; return true; }
bool ledcChangeFrequency(uint8_t pin, uint32_t f, uint8_t res) { if (pin >= 64) return false; pinL[pin].freq = f; pinL[pin].res = res; pwmOut(pin, f, (double)pinL[pin].duty / (1u << res)); return true; }
static double toneEnd[128];
void tone(uint8_t pin, unsigned int f, unsigned long dur) { pwmOut(pin, f, f ? 0.5 : 0); if (pin < 128) toneEnd[pin] = dur ? now_s() + dur / 1000.0 : 0; }
void tone(uint8_t pin, unsigned int f) { tone(pin, f, 0); }
void noTone(uint8_t pin) { pwmOut(pin, 0, 0); if (pin < 128) toneEnd[pin] = 0; }

/* ---------- WS2812 / dioda RGB ---------- */
void neopixelWrite(uint8_t pin, uint8_t r, uint8_t g, uint8_t b) {
  char q[96]; uint8_t px[3] = {r, g, b}; char hx[8]; ct_bin2hex(px, 3, hx);
  snprintf(q, sizeof q, "{\"op\":\"np\",\"pin\":%d,\"d\":\"%s\",\"bpp\":3}", pin, hx); ct_request(q, nullptr, 0); ct_cost(30);
}
void rgbLedWrite(uint8_t pin, uint8_t r, uint8_t g, uint8_t b) { neopixelWrite(pin >= 100 ? pin - 100 : pin, r, g, b); }

/* ---------- przerwania ---------- */
struct Isr { voidFuncPtr f = nullptr; voidFuncPtrArg fa = nullptr; void *arg = nullptr; int trig = 0; };
static Isr isr[128]; static bool inIsr = false;
void ct_interrupts(int on) { irqOn = on != 0; if (irqOn) ct_poll(); }
void attachInterrupt(uint8_t pin, voidFuncPtr fn, int mode) { if (pin >= 128) return; int tr = mode == RISING || mode == ONHIGH ? 1 : mode == FALLING || mode == ONLOW ? 2 : 3; isr[pin].f = fn; isr[pin].fa = nullptr; isr[pin].trig = tr; hw_pin_irq(pin, tr); }
void attachInterruptArg(uint8_t pin, voidFuncPtrArg fn, void *arg, int mode) { if (pin >= 128) return; attachInterrupt(pin, nullptr, mode); isr[pin].fa = fn; isr[pin].arg = arg; }
void detachInterrupt(uint8_t pin) { if (pin >= 128) return; isr[pin] = Isr(); hw_pin_irq(pin, 0); }
extern "C" void ct_poll(void) {
  for (int p = 0; p < 128; p++) if (toneEnd[p] > 0 && hw_now() >= toneEnd[p]) { toneEnd[p] = 0; pwmOut(p, 0, 0); }
  if (!irqOn || inIsr) return;
  int ev[128]; int n = hw_events(ev, 64);
  inIsr = true;
  for (int i = 0; i < n; i++) { int g = ev[2 * i], e = ev[2 * i + 1]; if (g < 0 || g >= 128) continue; Isr &h = isr[g]; if (!(h.trig & e)) continue; if (h.f) h.f(); else if (h.fa) h.fa(h.arg); }
  inIsr = false;
}

/* ---------- pomiar impulsu, rejestry przesuwne ---------- */
unsigned long pulseIn(uint8_t pin, uint8_t state, unsigned long timeout) {
  double t0 = now_s(), lim = timeout * 1e-6;
  auto wait = [&](int lvl) { while (hw_pin_get(pin) != lvl) { if (now_s() - t0 > lim) return false; hw_sleep_until(hw_now() + 5e-6); } return true; };
  settle();
  if (!wait(!state)) return 0; if (!wait(state)) return 0; double s = hw_now(); if (!wait(!state)) return 0; return (unsigned long)((hw_now() - s) * 1e6);
}
unsigned long pulseIn(uint8_t pin, uint8_t state) { return pulseIn(pin, state, 1000000UL); }
unsigned long pulseInLong(uint8_t pin, uint8_t state, unsigned long timeout) { return pulseIn(pin, state, timeout); }
void shiftOut(uint8_t d, uint8_t c, uint8_t order, uint8_t v) { for (int i = 0; i < 8; i++) { int b = order == LSBFIRST ? (v >> i) & 1 : (v >> (7 - i)) & 1; digitalWrite(d, b); digitalWrite(c, HIGH); digitalWrite(c, LOW); } }
uint8_t shiftIn(uint8_t d, uint8_t c, uint8_t order) { uint8_t v = 0; for (int i = 0; i < 8; i++) { digitalWrite(c, HIGH); int b = digitalRead(d); if (order == LSBFIRST) v |= b << i; else v |= b << (7 - i); digitalWrite(c, LOW); } return v; }

/* ---------- matematyka ---------- */
long map(long x, long a, long b, long c, long d) { if (b == a) return c; return (x - a) * (d - c) / (b - a) + c; }
static uint32_t rs = 0x12345678;
static uint32_t xr() { rs ^= rs << 13; rs ^= rs >> 17; rs ^= rs << 5; return rs; }
long random(long hb) { if (hb <= 0) return 0; return xr() % hb; }
long random(long lo, long hi) { if (lo >= hi) return lo; return lo + random(hi - lo); }
void randomSeed(unsigned long s) { if (s) rs = (uint32_t)s; }
uint32_t esp_random(void) { return xr(); }
uint16_t makeWord(uint16_t w) { return w; }
uint16_t makeWord(uint8_t h, uint8_t l) { return (h << 8) | l; }
uint32_t getCpuFrequencyMhz(void) { return F_CPU / 1000000; }
bool setCpuFrequencyMhz(uint32_t) { return true; }
float temperatureRead(void) { return 42.0f; }

/* ---------- port szeregowy ---------- */
HardwareSerial Serial(0);
HardwareSerial Serial1(1);
HardwareSerial Serial2(2);
void HardwareSerial::begin(unsigned long b, uint32_t, int8_t rx, int8_t tx, bool, unsigned long, uint8_t) {
  baud = b; on = true;
  if (num == 1) { rxp = rx >= 0 ? rx : CT_UART1_RX; txp = tx >= 0 ? tx : CT_UART1_TX; }
  if (num == 2) { rxp = rx >= 0 ? rx : CT_UART2_RX; txp = tx >= 0 ? tx : CT_UART2_TX; }
}
size_t HardwareSerial::write(const uint8_t *buf, size_t n) {
  if (!n) return 0;
  if (num == 0) { hw_out((const char *)buf, (int)n); ct_cost(n * 0.5); return n; }
  if (txp < 0) return 0;
  char *q = (char *)malloc(n * 2 + 64); char *hx = (char *)malloc(n * 2 + 1); ct_bin2hex(buf, (int)n, hx);
  snprintf(q, n * 2 + 64, "{\"op\":\"uart_w\",\"tx\":%d,\"d\":\"%s\"}", txp, hx); ct_request(q, nullptr, 0); free(q); free(hx);
  ct_cost(n * 10.0e6 / baud); return n;
}
void HardwareSerial::fill() {
  char tmp[1024]; int n = 0;
  if (num == 0) n = hw_rx(tmp, sizeof tmp);
  else if (rxp >= 0) { char q[64]; snprintf(q, sizeof q, "{\"op\":\"uart_r\",\"rx\":%d}", rxp); ct_request(q, nullptr, 0); char hx[2050]; ct_jstr(RESP, "d", hx, sizeof hx); n = ct_hex2bin(hx, (uint8_t *)tmp, sizeof tmp); }
  for (int i = 0; i < n; i++) { int nh = (rh + 1) % (int)sizeof rb; if (nh == rt) break; rb[rh] = tmp[i]; rh = nh; }
}
int HardwareSerial::available() { ct_cost(0.5); if (rh == rt) fill(); return (rh - rt + (int)sizeof rb) % (int)sizeof rb; }
int HardwareSerial::read() { if (rh == rt) fill(); if (rh == rt) return -1; int c = rb[rt]; rt = (rt + 1) % (int)sizeof rb; return c; }
int HardwareSerial::peek() { if (rh == rt) fill(); return rh == rt ? -1 : rb[rt]; }

size_t IPAddress::printTo(Print &p) const { return p.print(toString()); }
const IPAddress INADDR_NONE(0, 0, 0, 0);

/* ---------- ESP ---------- */
EspClass ESP;
void EspClass::restart() { ct_request("{\"op\":\"reset\"}", nullptr, 0); for (;;) hw_sleep_until(hw_now() + 1); }
void EspClass::deepSleep(uint64_t us) { char q[64]; snprintf(q, sizeof q, "{\"op\":\"deepsleep\",\"ms\":%llu}", (unsigned long long)(us / 1000)); ct_request(q, nullptr, 0); for (;;) hw_sleep_until(hw_now() + 1); }
extern "C" unsigned char __heap_base;
uint32_t EspClass::getFreeHeap() { return 250000; }
const char *EspClass::getChipModel() { return CT_CHIP_MODEL; }
uint8_t EspClass::getChipCores() { return CT_CHIP_CORES; }
uint32_t EspClass::getCpuFreqMHz() { return F_CPU / 1000000; }
uint64_t EspClass::getEfuseMac() { return 0x0000a0b1c2d3e4f5ULL; }
uint32_t EspClass::getChipId() { return 0x00c2d3e4; }
uint32_t EspClass::getCycleCount() { return (uint32_t)(now_s() * F_CPU); }

/* ---------- start programu ---------- */
extern "C" void ct_runtime_init(void);
__attribute__((weak)) void ct_runtime_init(void) {}
int main(void) {
  ctT0 = hw_now();
  ct_runtime_init();
  setup();
  for (;;) { loop(); ct_cost(CT_LOOP_US); ct_poll(); }
  return 0;
}
