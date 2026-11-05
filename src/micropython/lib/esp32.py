# CappyTronic – minimalny moduł esp32
import _hw


def mcu_temperature():
    return 34


def raw_temperature():
    return 93


def wake_on_ext0(pin, level):
    pass


def wake_on_ext1(pins, level):
    pass


def idf_heap_info(cap):
    return [(327680, 250000, 200000, 240000)]


HEAP_DATA = 4
HEAP_EXEC = 1
