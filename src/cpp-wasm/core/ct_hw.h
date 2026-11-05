// CappyTronic – most między programem C++ (WebAssembly) a symulatorem. Funkcje dostarcza wątek symulacji (moduł "hw").
#pragma once
#include <stdint.h>
#include <stddef.h>
#define CT_IMPORT(n) __attribute__((import_module("hw"), import_name(#n)))
#ifdef __cplusplus
extern "C" {
#endif
CT_IMPORT(now) double hw_now(void);                       // czas symulacji [s]
CT_IMPORT(wall) double hw_wall(void);                     // czas „zegarowy” (epoch, s)
CT_IMPORT(sleep_until) void hw_sleep_until(double t);     // uśpienie do chwili t (wybudza też przerwanie)
CT_IMPORT(pin_mode) void hw_pin_mode(int g, int mode, int pull);
CT_IMPORT(pin_set) void hw_pin_set(int g, int v);
CT_IMPORT(pin_get) int hw_pin_get(int g);
CT_IMPORT(pin_out) int hw_pin_out(int g);
CT_IMPORT(pin_irq) void hw_pin_irq(int g, int trig);
CT_IMPORT(pwm) void hw_pwm(int g, double freq, double duty);
CT_IMPORT(adc) int hw_adc(int g);                         // napięcie na pinie [mV]
CT_IMPORT(events) int hw_events(int *buf, int max);       // zdarzenia przerwań: pary (gpio, zbocze)
CT_IMPORT(req) int hw_req(const char *q, int qlen, char *out, int outmax); // zapytanie JSON (I2C, SPI, UART, sieć…)
CT_IMPORT(out) void hw_out(const char *s, int n);         // port szeregowy USB → monitor
CT_IMPORT(board) int hw_board(char *out, int max);        // konfiguracja płytki (JSON)
CT_IMPORT(rx) int hw_rx(char *out, int max);              // dane z monitora portu szeregowego (bez czekania)
#ifdef __cplusplus
}
#endif
// pomocnicze (core.cpp)
#ifdef __cplusplus
extern "C" {
#endif
void ct_cost(double us);           // „czas procesora” zużyty przez operację – symulacja posuwa się dalej
void ct_poll(void);                // obsługa przerwań (attachInterrupt) w bezpiecznym miejscu
int ct_request(const char *json, char *out, int outmax);
const char *ct_jstr(const char *js, const char *key, char *buf, int max);   // pole tekstowe z JSON
double ct_jnum(const char *js, const char *key, double def);                 // pole liczbowe z JSON
int ct_hex2bin(const char *hex, uint8_t *out, int max);
void ct_bin2hex(const uint8_t *in, int n, char *out);
#ifdef __cplusplus
}
#endif
