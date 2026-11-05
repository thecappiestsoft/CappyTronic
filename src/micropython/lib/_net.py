# CappyTronic – wspólne narzędzia: zapytania do symulatora, kodowanie bajtów, Wi-Fi
import _hw, json, binascii

BOARD = json.loads(_hw.board())


def req(obj):
    r = json.loads(_hw.req(json.dumps(obj)))
    if r.get('e'):
        if r.get('m'):
            print('[CappyTronic] ' + r['m'])
        raise OSError(r['e'])
    return r


def hexs(buf):
    if buf is None:
        return ''
    if isinstance(buf, str):
        buf = buf.encode()
    elif isinstance(buf, int):
        buf = bytes((buf & 255,))
    return binascii.hexlify(bytes(buf)).decode()


def unhex(s):
    return binascii.unhexlify(s) if s else b''


def text(v):
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray, memoryview)):
        return bytes(v).decode()
    return str(v)


# stan Wi-Fi współdzielony przez network, umqtt i urequests
wifi = {'active': False, 'ssid': None, 'ready_at': None, 'ap': False}


def wifi_connected():
    return wifi['ready_at'] is not None and _hw.now() >= wifi['ready_at']


def need_wifi():
    if not BOARD.get('wifi'):
        print('[CappyTronic] ' + BOARD.get('msg_nowifi', 'This board has no Wi-Fi.'))
        raise OSError(113)
    if not wifi_connected():
        print('[CappyTronic] ' + BOARD.get('msg_wifi', 'Connect to Wi-Fi first: network.WLAN(network.STA_IF).connect(ssid, password)'))
        raise OSError(113)
