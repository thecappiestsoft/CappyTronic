# CappyTronic – ntptime: zegar płytki i tak pokazuje czas komputera
from _net import need_wifi as _need
host = 'pool.ntp.org'
timeout = 1


def time():
    import time as _t
    return _t.time()


def settime():
    _need()
