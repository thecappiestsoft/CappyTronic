# CappyTronic – moduł neopixel (diody WS2812, np. wbudowana dioda RGB płytki)
from machine import Pin, _pid
from _net import req as _req, hexs as _hexs


class NeoPixel:
    ORDER = (1, 0, 2, 3)

    def __init__(self, pin, n, *, bpp=3, timing=1):
        self.pin = pin
        self._g = _pid(pin)
        self.n = n
        self.bpp = bpp
        self.buf = bytearray(n * bpp)

    def __len__(self):
        return self.n

    def __setitem__(self, i, v):
        if i < 0:
            i += self.n
        o = i * self.bpp
        for k in range(self.bpp):
            self.buf[o + k] = int(v[k]) & 255

    def __getitem__(self, i):
        o = i * self.bpp
        return tuple(self.buf[o:o + self.bpp])

    def fill(self, v):
        for i in range(self.n):
            self[i] = v

    def write(self):
        _req({'op': 'np', 'pin': self._g, 'd': _hexs(self.buf), 'bpp': self.bpp, 'order': 'rgb'})
