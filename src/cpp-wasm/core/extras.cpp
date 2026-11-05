#include "Arduino.h"
#include "EEPROM.h"
#include "Preferences.h"
#include <time.h>
#include <sys/time.h>
EEPROMClass EEPROM;
Preferences::E Preferences::e_[64];
// czas (NTP jest symulowany – zegar ustawia się od razu na czas komputera)
static long tzOff = 0, dstOff = 0;
void configTime(long gmtOffset_sec, int daylightOffset_sec, const char *, const char *, const char *) { tzOff = gmtOffset_sec; dstOff = daylightOffset_sec; }
void configTzTime(const char *, const char *, const char *, const char *) { tzOff = 0; dstOff = 0; }
bool getLocalTime(struct tm *info, uint32_t ms) { (void)ms; time_t t = (time_t)hw_wall() + tzOff + dstOff; struct tm *g = gmtime(&t); if (!g) return false; *info = *g; return true; }
