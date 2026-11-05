# CappyTronic – moduł network (symulowane Wi-Fi; połączenia idą przez sieć komputera)
import _hw
from _net import wifi as _w, BOARD as _B, wifi_connected as _ok, req as _req

if not _B.get('wifi'):
    raise ImportError("no module named 'network'")

STA_IF = 0
AP_IF = 1
STAT_IDLE = 1000
STAT_CONNECTING = 1001
STAT_GOT_IP = 1010
STAT_NO_AP_FOUND = 201
STAT_WRONG_PASSWORD = 202
STAT_BEACON_TIMEOUT = 200
STAT_ASSOC_FAIL = 203
STAT_HANDSHAKE_TIMEOUT = 204
AUTH_OPEN = 0
AUTH_WEP = 1
AUTH_WPA_PSK = 2
AUTH_WPA2_PSK = 3
AUTH_WPA_WPA2_PSK = 4

_NETS = [(b'CappyNet', b'\x24\x0a\xc4\x00\x00\x01', 6, -42, 3, False),
         (b'Infotech-Lab', b'\x24\x0a\xc4\x00\x00\x02', 11, -58, 3, False),
         (b'Goscie', b'\x24\x0a\xc4\x00\x00\x03', 1, -71, 0, False)]
_host = ['cappy-' + _B.get('short', 'board')]


class _WLAN:
    def __init__(self, iface):
        self._if = iface
        self._active = False

    def active(self, is_active=None):
        if is_active is None:
            return self._active
        self._active = bool(is_active)
        if self._if == STA_IF:
            _w['active'] = self._active
            if not self._active:
                _w['ready_at'] = None
        else:
            _w['ap'] = self._active

    def connect(self, ssid=None, key=None, *, bssid=None):
        if self._if != STA_IF:
            raise OSError('AP interface cannot connect')
        if not self._active:
            raise OSError('Wifi Internal Error')
        if isinstance(ssid, (bytes, bytearray)):
            ssid = ssid.decode()
        _w['ssid'] = ssid or 'CappyNet'
        _w['ready_at'] = _hw.now() + 1.2
        _req({'op': 'wifi', 'on': 1})

    def disconnect(self):
        _w['ready_at'] = None
        _req({'op': 'wifi', 'on': 0})

    def isconnected(self):
        if self._if == AP_IF:
            return self._active
        return _ok()

    def status(self, param=None):
        if param == 'rssi':
            return -48
        if param is not None:
            return None
        if self._if == AP_IF:
            return STAT_GOT_IP if self._active else STAT_IDLE
        if _ok():
            return STAT_GOT_IP
        if _w['ready_at'] is not None:
            return STAT_CONNECTING
        return STAT_IDLE

    def scan(self):
        if not self._active:
            raise OSError('Wifi Not Started')
        return list(_NETS)

    def ifconfig(self, cfg=None):
        if cfg is not None:
            return None
        if self._if == AP_IF:
            return ('192.168.4.1', '255.255.255.0', '192.168.4.1', '0.0.0.0')
        if not _ok():
            return ('0.0.0.0', '0.0.0.0', '0.0.0.0', '0.0.0.0')
        return (_B.get('ip', '192.168.50.10'), '255.255.255.0', '192.168.50.1', '192.168.50.1')

    def ipconfig(self, *args, **kw):
        if args and args[0] == 'addr4':
            c = self.ifconfig()
            return (c[0], c[1])
        return None

    def config(self, *args, **kw):
        if args:
            k = args[0]
            if k == 'mac':
                return bytes(_B.get('uid', [0x24, 0x0a, 0xc4, 0, 0, 1]))
            if k in ('essid', 'ssid'):
                return _w['ssid'] or ('CappyTronic-AP' if self._if == AP_IF else '')
            if k == 'hostname':
                return _host[0]
            if k == 'channel':
                return 6
            if k == 'txpower':
                return 20
            return None
        if 'hostname' in kw:
            _host[0] = kw['hostname']
        return None


_ifs = {}


def WLAN(interface_id=STA_IF):
    if interface_id not in _ifs:
        _ifs[interface_id] = _WLAN(interface_id)
    return _ifs[interface_id]


def hostname(name=None):
    if name is None:
        return _host[0]
    _host[0] = name


def country(code=None):
    return 'PL' if code is None else None


def phy_mode(mode=None):
    return 3
