# CappyTronic – środowisko uruchomieniowe płytki (przerwania, timery, czas symulacji)
import _hw

_timers = []      # [termin, okres, callback, jednorazowy, obiekt]
_irq = {}         # gpio -> [handler, pin, maska]
_in_cb = False
next_due = 1e30


def _recalc():
    global next_due
    n = 1e30
    for tm in _timers:
        if tm[0] < n:
            n = tm[0]
    next_due = n


def add_timer(obj, period, callback, oneshot):
    remove_timer(obj)
    _timers.append([_hw.now() + period, period, callback, oneshot, obj])
    _recalc()


def remove_timer(obj):
    for tm in list(_timers):
        if tm[4] is obj:
            _timers.remove(tm)
    _recalc()


def set_irq(g, handler, trigger, pin):
    if handler is None:
        _irq.pop(g, None)
        _hw.pin_irq(g, 0)
    else:
        _irq[g] = [handler, pin, trigger]
        _hw.pin_irq(g, trigger)


def dispatch():
    global _in_cb
    if _in_cb:
        return
    _in_cb = True
    try:
        ev = _hw.events()
        if ev:
            for item in ev.split(','):
                g, e = item.split(':')
                h = _irq.get(int(g))
                if h and (h[2] & int(e)):
                    h[1]._last_irq = int(e)
                    h[0](h[1])
        if _timers:
            t = _hw.now()
            for tm in list(_timers):
                if tm[0] <= t + 1e-9:
                    if tm[3]:
                        _timers.remove(tm)
                    else:
                        tm[0] += tm[1]
                        if tm[0] < t:
                            tm[0] = t + tm[1]
                    tm[2](tm[4])
            _recalc()
    finally:
        _in_cb = False


def poll():
    # szybkie sprawdzenie, czy są oczekujące przerwania lub timery (np. w pętli bez sleep)
    if _hw.evpending() or next_due <= _hw.now():
        dispatch()


def wait(sec):
    if sec < 0:
        sec = 0
    target = _hw.now() + sec
    while True:
        dispatch()
        if _hw.now() >= target - 1e-9:
            return
        nxt = target
        if not _in_cb and next_due < nxt:
            nxt = next_due
        _hw.sleep_until(nxt)
