# CappyTronic – moduł time (zgodny z MicroPythonem), liczony w czasie symulacji
import _hw, _rt

_PERIOD = 0x40000000
_HALF = 0x20000000


def sleep(s):
    _rt.wait(s)


def sleep_ms(ms):
    _rt.wait(ms / 1000)


def sleep_us(us):
    _rt.wait(us / 1000000)


def ticks_ms():
    return int(_hw.now() * 1000) % _PERIOD


def ticks_us():
    return int(_hw.now() * 1000000) % _PERIOD


def ticks_cpu():
    return ticks_us()


def ticks_add(t, delta):
    return (t + delta) % _PERIOD


def ticks_diff(a, b):
    d = (a - b) % _PERIOD
    if d >= _HALF:
        d -= _PERIOD
    return d


def time():
    return int(_hw.wall())


def time_ns():
    return int(_hw.wall() * 1000) * 1000000


def _tuple(s):
    return tuple(int(x) for x in s.split(','))


def localtime(secs=None):
    return _tuple(_hw.localtime(-1 if secs is None else secs, 1))


def gmtime(secs=None):
    return _tuple(_hw.localtime(-1 if secs is None else secs, 0))


def mktime(t):
    return int(_hw.mktime(t[0], t[1], t[2], t[3], t[4], t[5]))
