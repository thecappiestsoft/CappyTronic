# CappyTronic – moduł machine (zgodny z MicroPythonem dla ESP32 / RP2040)
import _hw, _rt, _net
from _net import req as _req, hexs as _hexs, unhex as _unhex, BOARD as _B

_GPIO = set(_B['gpio'])


def _dflt(kind, id, n):
    t = _B.get(kind) or {}
    v = t.get(str(id))
    if v is None and t:
        v = t[sorted(t.keys())[0]]
    return v or [None] * n
_NAMES = _B.get('names', {})


def _pid(p):
    if isinstance(p, Pin):
        return p._id
    if isinstance(p, str):
        if p in _NAMES:
            return _NAMES[p]
        if p.upper().startswith('GP') and p[2:].isdigit():
            return int(p[2:])
        if p.upper().startswith('GPIO') and p[4:].isdigit():
            return int(p[4:])
        raise ValueError('invalid pin')
    return int(p)


class Pin:
    IN = 1
    OUT = 3
    OPEN_DRAIN = 7
    ALT = 15
    ALT_OPEN_DRAIN = 16
    PULL_DOWN = 1
    PULL_UP = 2
    PULL_HOLD = 4
    IRQ_RISING = 1
    IRQ_FALLING = 2
    IRQ_LOW_LEVEL = 4
    IRQ_HIGH_LEVEL = 8
    WAKE_LOW = 4
    WAKE_HIGH = 5
    DRIVE_0 = 0
    DRIVE_1 = 1
    DRIVE_2 = 2
    DRIVE_3 = 3

    def __init__(self, id, mode=-1, pull=-1, *, value=None, drive=None, alt=None, hold=None):
        g = _pid(id)
        if g not in _GPIO:
            raise ValueError('invalid pin')
        if _B.get('port') == 'esp8266' and 6 <= g <= 11:
            raise ValueError('pin used by flash memory')
        self._id = g
        self._last_irq = 0
        self.init(mode, pull, value=value)

    def init(self, mode=-1, pull=-1, *, value=None, drive=None, alt=None, hold=None):
        if value is not None:
            _hw.pin_set(self._id, 1 if value else 0)
        if mode != -1 or pull != -1:
            if mode == -1 or mode is None:
                mode = _hw.pin_mode_get(self._id) or Pin.IN
            if pull == -1 or pull is None:
                pull = 0
            _hw.pin_mode(self._id, mode, pull)
        return None

    def value(self, v=None):
        if v is None:
            _rt.poll()
            return _hw.pin_get(self._id)
        _hw.pin_set(self._id, 1 if v else 0)

    def __call__(self, v=None):
        return self.value(v)

    def on(self):
        _hw.pin_set(self._id, 1)

    def off(self):
        _hw.pin_set(self._id, 0)

    def high(self):
        _hw.pin_set(self._id, 1)

    def low(self):
        _hw.pin_set(self._id, 0)

    def toggle(self):
        _hw.pin_set(self._id, 1 - _hw.pin_out(self._id))

    def irq(self, handler=None, trigger=3, *, priority=1, wake=None, hard=False):
        if _B.get('port') == 'esp8266' and self._id == 16:
            raise ValueError('GPIO16 has no interrupts')
        _rt.set_irq(self._id, handler, trigger, self)
        return _IRQ(self)

    def mode(self, m=None):
        if m is None:
            return _hw.pin_mode_get(self._id)
        _hw.pin_mode(self._id, m, _hw.pin_pull_get(self._id))

    def pull(self, p=None):
        if p is None:
            return _hw.pin_pull_get(self._id)
        _hw.pin_mode(self._id, _hw.pin_mode_get(self._id) or Pin.IN, p or 0)

    def __repr__(self):
        return 'Pin(%d)' % self._id


class _IRQ:
    def __init__(self, pin):
        self._p = pin

    def flags(self):
        return self._p._last_irq

    def trigger(self):
        h = _rt._irq.get(self._p._id)
        return h[2] if h else 0


class Signal:
    def __init__(self, pin, *args, invert=False, **kw):
        self._pin = pin if isinstance(pin, Pin) else Pin(pin, *args, **kw)
        self._inv = 1 if invert else 0

    def value(self, v=None):
        if v is None:
            return self._pin.value() ^ self._inv
        self._pin.value((1 if v else 0) ^ self._inv)

    def __call__(self, v=None):
        return self.value(v)

    def on(self):
        self.value(1)

    def off(self):
        self.value(0)


class PWM:
    def __init__(self, dest, *, freq=None, duty=None, duty_u16=None, duty_ns=None, invert=False):
        self._pin = dest if isinstance(dest, Pin) else Pin(dest)
        self._f = _B.get('pwmdef', 5000)
        self._d = 0.5
        self._inv = invert
        self.init(freq=freq, duty=duty, duty_u16=duty_u16, duty_ns=duty_ns)

    def init(self, *, freq=None, duty=None, duty_u16=None, duty_ns=None, invert=None):
        if _B.get('port') == 'esp8266' and self._pin._id == 16:
            raise ValueError('GPIO16 has no PWM')
        if freq is not None:
            if freq <= 0 or freq > _B.get('pwmmax', 40000000):
                raise ValueError('freq must be from 1Hz to %dHz' % _B.get('pwmmax', 40000000))
            self._f = freq
        if invert is not None:
            self._inv = invert
        if duty is not None:
            self._d = max(0, min(1023, duty)) / 1023
        if duty_u16 is not None:
            self._d = max(0, min(65535, duty_u16)) / 65535
        if duty_ns is not None:
            self._d = max(0, min(1, duty_ns * self._f / 1e9))
        self._apply()

    def _apply(self):
        d = 1 - self._d if self._inv else self._d
        _hw.pwm(self._pin._id, self._f, d)

    def freq(self, f=None):
        if f is None:
            return self._f
        if f <= 0 or f > _B.get('pwmmax', 40000000):
            raise ValueError('freq must be from 1Hz to %dHz' % _B.get('pwmmax', 40000000))
        self._f = f
        self._apply()

    def duty(self, d=None):
        if d is None:
            return int(round(self._d * 1023))
        self._d = max(0, min(1023, d)) / 1023
        self._apply()

    def duty_u16(self, d=None):
        if d is None:
            return int(round(self._d * 65535))
        self._d = max(0, min(65535, d)) / 65535
        self._apply()

    def duty_ns(self, ns=None):
        if ns is None:
            return int(self._d / self._f * 1e9)
        self._d = max(0, min(1, ns * self._f / 1e9))
        self._apply()

    def deinit(self):
        _hw.pwm(self._pin._id, 0, 0)


class ADC:
    ATTN_0DB = 0
    ATTN_2_5DB = 1
    ATTN_6DB = 2
    ATTN_11DB = 3
    WIDTH_9BIT = 9
    WIDTH_10BIT = 10
    WIDTH_11BIT = 11
    WIDTH_12BIT = 12
    _FULL = (1100, 1500, 2200, 3300)

    def __init__(self, pin, *, atten=None):
        if isinstance(pin, int) and str(pin) in _B.get('adcid', {}):
            g = _B['adcid'][str(pin)]
        else:
            g = _pid(pin)
        if g not in _B.get('adc', []):
            raise ValueError('invalid Pin for ADC')
        self._id = g
        self._at = 3 if atten is None else atten
        self._bits = 12
        self._e8 = _B.get('port') == 'esp8266'
        _hw.pin_mode(g, 20, 0)

    def init(self, *, atten=None):
        if atten is not None:
            self._at = atten

    def atten(self, a):
        self._at = a

    def width(self, w):
        self._bits = w

    def block(self):
        return None

    def _frac(self):
        mv = _hw.adc(self._id)
        # ESP8266: wejście TOUT ma zakres 0–1 V; NodeMCU ma dzielnik 220k/100k, więc pin A0 mierzy 0–3,2 V
        f = mv / (3200 if self._e8 else ADC._FULL[self._at])
        return 0 if f < 0 else (1 if f > 1 else f)

    def read_u16(self):
        return int(self._frac() * 65535)

    def read(self):
        if self._e8:
            return int(self._frac() * 1024)
        return int(self._frac() * ((1 << self._bits) - 1))

    def read_uv(self):
        return int(min(_hw.adc(self._id), ADC._FULL[self._at]) * 1000)


class I2C:
    def __init__(self, id=0, *, scl=None, sda=None, freq=400000, timeout=50000):
        self._bid = id
        self.init(scl=scl, sda=sda, freq=freq)

    def init(self, *, scl=None, sda=None, freq=400000, timeout=50000):
        d = _dflt('i2c', getattr(self, '_bid', 0), 2)
        self._scl = _pid(scl) if scl is not None else d[0]
        self._sda = _pid(sda) if sda is not None else d[1]
        if self._scl not in _GPIO or self._sda not in _GPIO:
            raise ValueError('invalid pins for I2C')
        self._freq = freq

    def deinit(self):
        pass

    def _do(self, ops):
        return _req({'op': 'i2c', 'scl': self._scl, 'sda': self._sda, 'ops': ops})

    def scan(self):
        return self._do([{'t': 'scan'}])['found']

    def writeto(self, addr, buf, stop=True):
        self._do([{'t': 'w', 'a': addr, 'd': _hexs(buf)}])
        return len(buf)

    def writevto(self, addr, vector, stop=True):
        data = b''.join(bytes(v) for v in vector)
        self._do([{'t': 'w', 'a': addr, 'd': _hexs(data)}])
        return len(data)

    def readfrom(self, addr, nbytes, stop=True):
        return _unhex(self._do([{'t': 'r', 'a': addr, 'n': nbytes}])['r'][0])

    def readfrom_into(self, addr, buf, stop=True):
        d = self.readfrom(addr, len(buf))
        for i in range(len(buf)):
            buf[i] = d[i]

    def _mem(self, memaddr, addrsize):
        if addrsize == 16:
            return bytes(((memaddr >> 8) & 255, memaddr & 255))
        return bytes((memaddr & 255,))

    def writeto_mem(self, addr, memaddr, buf, *, addrsize=8):
        self._do([{'t': 'w', 'a': addr, 'd': _hexs(self._mem(memaddr, addrsize) + bytes(buf))}])

    def readfrom_mem(self, addr, memaddr, nbytes, *, addrsize=8):
        r = self._do([{'t': 'w', 'a': addr, 'd': _hexs(self._mem(memaddr, addrsize)), 's': 0}, {'t': 'r', 'a': addr, 'n': nbytes}])
        return _unhex(r['r'][0])

    def readfrom_mem_into(self, addr, memaddr, buf, *, addrsize=8):
        d = self.readfrom_mem(addr, memaddr, len(buf), addrsize=addrsize)
        for i in range(len(buf)):
            buf[i] = d[i]


class SoftI2C(I2C):
    def __init__(self, scl, sda, *, freq=400000, timeout=50000):
        self._bid = -1
        self.init(scl=scl, sda=sda, freq=freq)


class SPI:
    MSB = 0
    LSB = 1
    CONTROLLER = 0

    def __init__(self, id=1, baudrate=1000000, *, polarity=0, phase=0, bits=8, firstbit=0, sck=None, mosi=None, miso=None):
        self._bid = id
        self.init(baudrate=baudrate, polarity=polarity, phase=phase, bits=bits, firstbit=firstbit, sck=sck, mosi=mosi, miso=miso)

    def init(self, baudrate=1000000, *, polarity=0, phase=0, bits=8, firstbit=0, sck=None, mosi=None, miso=None):
        d = _dflt('spi', getattr(self, '_bid', 1), 3)
        self._sck = _pid(sck) if sck is not None else d[0]
        self._mosi = _pid(mosi) if mosi is not None else d[1]
        self._miso = _pid(miso) if miso is not None else d[2]
        self._lsb = firstbit == SPI.LSB
        self._baud = baudrate

    def deinit(self):
        pass

    def _rev(self, data):
        if not self._lsb:
            return bytes(data)
        out = bytearray(len(data))
        for i, b in enumerate(data):
            r = 0
            for k in range(8):
                r = (r << 1) | ((b >> k) & 1)
            out[i] = r
        return bytes(out)

    def _xfer(self, data):
        r = _req({'op': 'spi', 'sck': self._sck, 'mosi': self._mosi, 'miso': self._miso, 'd': _hexs(self._rev(data))})
        return self._rev(_unhex(r['r']))

    def write(self, buf):
        self._xfer(bytes(buf))

    def read(self, nbytes, write=0):
        return self._xfer(bytes([write & 255]) * nbytes)

    def readinto(self, buf, write=0):
        d = self.read(len(buf), write)
        for i in range(len(buf)):
            buf[i] = d[i]

    def write_readinto(self, wbuf, rbuf):
        d = self._xfer(bytes(wbuf))
        for i in range(len(rbuf)):
            rbuf[i] = d[i]


class SoftSPI(SPI):
    def __init__(self, baudrate=500000, *, polarity=0, phase=0, bits=8, firstbit=0, sck=None, mosi=None, miso=None):
        self._bid = -1
        self.init(baudrate=baudrate, polarity=polarity, phase=phase, bits=bits, firstbit=firstbit, sck=sck, mosi=mosi, miso=miso)


class UART:
    def __init__(self, id, baudrate=115200, bits=8, parity=None, stop=1, *, tx=None, rx=None, timeout=0, **kw):
        d = _dflt('uart', id, 2)
        self._tx = _pid(tx) if tx is not None else d[0]
        self._rx = _pid(rx) if rx is not None else d[1]
        self._baud = baudrate
        self._timeout = timeout
        self._buf = b''

    def init(self, baudrate=115200, bits=8, parity=None, stop=1, *, tx=None, rx=None, timeout=0, **kw):
        self.__init__(1, baudrate, tx=tx, rx=rx, timeout=timeout)

    def deinit(self):
        pass

    def write(self, buf):
        if isinstance(buf, str):
            buf = buf.encode()
        _req({'op': 'uart_w', 'tx': self._tx, 'd': _hexs(buf), 'baud': self._baud})
        return len(buf)

    def _fill(self):
        r = _req({'op': 'uart_r', 'rx': self._rx})
        if r.get('d'):
            self._buf += _unhex(r['d'])

    def any(self):
        self._fill()
        return len(self._buf)

    def read(self, nbytes=None):
        self._fill()
        if not self._buf and self._timeout:
            _rt.wait(self._timeout / 1000)
            self._fill()
        if not self._buf:
            return None
        if nbytes is None:
            nbytes = len(self._buf)
        out, self._buf = self._buf[:nbytes], self._buf[nbytes:]
        return out

    def readline(self):
        self._fill()
        i = self._buf.find(b'\n')
        if i < 0:
            return self.read()
        out, self._buf = self._buf[:i + 1], self._buf[i + 1:]
        return out

    def readinto(self, buf, nbytes=None):
        d = self.read(nbytes or len(buf))
        if not d:
            return None
        for i in range(len(d)):
            buf[i] = d[i]
        return len(d)

    def flush(self):
        pass

    def txdone(self):
        return True


class Timer:
    ONE_SHOT = 0
    PERIODIC = 1

    def __init__(self, id=-1, *, mode=1, period=-1, freq=-1, callback=None, tick_hz=1000):
        self._cb = None
        if callback is not None:
            self.init(mode=mode, period=period, freq=freq, callback=callback, tick_hz=tick_hz)

    def init(self, *, mode=1, period=-1, freq=-1, callback=None, tick_hz=1000):
        if freq is not None and freq > 0:
            sec = 1 / freq
        elif period is not None and period > 0:
            sec = period / tick_hz
        else:
            sec = 1
        self._cb = callback
        if callback:
            _rt.add_timer(self, sec, callback, mode == Timer.ONE_SHOT)

    def deinit(self):
        _rt.remove_timer(self)

    def value(self):
        return 0


class RTC:
    def __init__(self, id=0):
        pass

    def datetime(self, dt=None):
        if dt is None:
            t = tuple(int(x) for x in _hw.localtime(-1, 1).split(','))
            return (t[0], t[1], t[2], t[6], t[3], t[4], t[5], 0)
        _hw.set_wall(dt[0], dt[1], dt[2], dt[4], dt[5], dt[6])

    def init(self, dt):
        self.datetime(dt)

    def memory(self, data=None):
        return b''


class WDT:
    def __init__(self, id=0, timeout=5000):
        pass

    def feed(self):
        pass


PWRON_RESET = 1
HARD_RESET = 2
WDT_RESET = 3
DEEPSLEEP_RESET = 4
SOFT_RESET = 5


def freq(f=None):
    if f is None:
        return _B.get('freq', 160000000)


def unique_id():
    return bytes(_B.get('uid', [0, 0, 0, 0, 0, 0]))


def reset():
    _req({'op': 'reset'})
    raise SystemExit


def soft_reset():
    reset()


def reset_cause():
    return PWRON_RESET


def idle():
    _rt.wait(0.001)


def lightsleep(ms=None):
    _rt.wait((ms or 1000) / 1000)


def deepsleep(ms=None):
    _req({'op': 'deepsleep', 'ms': ms or 0})
    raise SystemExit


def disable_irq():
    _rt._in_cb = True
    return 1


def enable_irq(state=1):
    _rt._in_cb = False


def time_pulse_us(pin, pulse_level, timeout_us=1000000):
    p = pin if isinstance(pin, Pin) else Pin(pin)
    t0 = _hw.now()
    while p.value() != pulse_level:
        if (_hw.now() - t0) * 1e6 > timeout_us:
            return -2
        _rt.wait(0.00001)
    t1 = _hw.now()
    while p.value() == pulse_level:
        if (_hw.now() - t1) * 1e6 > timeout_us:
            return -1
        _rt.wait(0.00001)
    return int((_hw.now() - t1) * 1e6)


def bitstream(pin, encoding, timing, buf):
    _req({'op': 'np', 'pin': _pid(pin), 'd': _hexs(buf), 'order': 'grb'})
