#include "Print.h"
#include <stdio.h>
#include <math.h>
size_t Print::printNumber(unsigned long long v, int base) { char t[72]; int i = 0; if (base < 2) base = 10; do { int d = v % base; t[i++] = d < 10 ? '0' + d : 'A' + d - 10; v /= base; } while (v); size_t n = 0; while (i) n += write((uint8_t)t[--i]); return n; }
size_t Print::printFloat(double v, int digits) {
  if (isnan(v)) return write("nan"); if (isinf(v)) return write("inf"); if (v > 4294967040.0 || v < -4294967040.0) return write("ovf");
  char t[64]; snprintf(t, sizeof t, "%.*f", digits < 0 ? 2 : digits, v); return write(t);
}
size_t Print::printf(const char *fmt, ...) { char small[256]; va_list ap; va_start(ap, fmt); int n = vsnprintf(small, sizeof small, fmt, ap); va_end(ap); if (n < 0) return 0;
  if (n < (int)sizeof small) return write((const uint8_t *)small, n);
  char *big = (char *)malloc(n + 1); if (!big) return 0; va_start(ap, fmt); vsnprintf(big, n + 1, fmt, ap); va_end(ap); size_t k = write((const uint8_t *)big, n); free(big); return k; }
