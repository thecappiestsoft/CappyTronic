#pragma once
#include <stdint.h>
#include "WString.h"
// obiekt ESP (ESP32 / ESP8266): restart, uśpienie, informacje o układzie
class EspClass {
public:
  void restart();
  void reset() { restart(); }
  void deepSleep(uint64_t us);
  uint32_t getFreeHeap();
  uint32_t getHeapSize() { return 327680; }
  uint32_t getMinFreeHeap() { return getFreeHeap(); }
  uint32_t getMaxAllocHeap() { return getFreeHeap(); }
  const char *getChipModel();
  uint8_t getChipRevision() { return 3; }
  uint8_t getChipCores();
  uint32_t getCpuFreqMHz();
  uint32_t getFlashChipSize() { return 4 * 1024 * 1024; }
  uint64_t getEfuseMac();
  uint32_t getChipId();
  const char *getSdkVersion() { return "CappyTronic"; }
  String getResetReason() { return String("Power on"); }
  uint32_t getCycleCount();
};
extern EspClass ESP;
