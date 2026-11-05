# CappyTronic – umqtt.simple (zgodny z micropython-lib); połączenie realizuje program CappyTronic
import _rt
from _net import req as _req, hexs as _hexs, unhex as _unhex, text as _text, need_wifi as _need


class MQTTException(Exception):
    pass


class MQTTClient:
    def __init__(self, client_id, server, port=0, user=None, password=None, keepalive=0, ssl=None, ssl_params={}):
        if port == 0:
            port = 8883 if ssl else 1883
        self.client_id = client_id
        self.server = server
        self.port = port
        self.user = user
        self.pswd = password
        self.keepalive = keepalive
        self.ssl = ssl
        self.cb = None
        self.lw_topic = None
        self.lw_msg = None
        self.lw_qos = 0
        self.lw_retain = False
        self._h = None

    def set_callback(self, f):
        self.cb = f

    def set_last_will(self, topic, msg, retain=False, qos=0):
        self.lw_topic = topic
        self.lw_msg = msg
        self.lw_qos = qos
        self.lw_retain = retain

    def connect(self, clean_session=True, timeout=None):
        _need()
        lw = None
        if self.lw_topic:
            lw = {'t': _text(self.lw_topic), 'm': _hexs(self.lw_msg), 'q': self.lw_qos, 'r': self.lw_retain}
        r = _req({'op': 'mqtt_connect', 'host': _text(self.server), 'port': self.port, 'cid': _text(self.client_id),
                  'user': _text(self.user), 'pw': _text(self.pswd), 'ka': self.keepalive, 'clean': clean_session, 'lw': lw, 'ssl': bool(self.ssl)})
        self._h = r['h']
        return False

    def _need(self):
        if self._h is None:
            raise OSError(128)

    def disconnect(self):
        if self._h is not None:
            _req({'op': 'mqtt_end', 'h': self._h})
            self._h = None

    def ping(self):
        self._need()
        _req({'op': 'mqtt_ping', 'h': self._h})

    def publish(self, topic, msg, retain=False, qos=0):
        self._need()
        _req({'op': 'mqtt_pub', 'h': self._h, 't': _text(topic), 'm': _hexs(msg), 'r': bool(retain), 'q': qos})

    def subscribe(self, topic, qos=0):
        assert self.cb is not None, 'Subscribe callback is not set'
        self._need()
        _req({'op': 'mqtt_sub', 'h': self._h, 't': _text(topic), 'q': qos})

    def unsubscribe(self, topic):
        self._need()
        _req({'op': 'mqtt_unsub', 'h': self._h, 't': _text(topic)})

    def _poll(self):
        self._need()
        r = _req({'op': 'mqtt_poll', 'h': self._h})
        if r.get('t') is None:
            return False
        if self.cb:
            self.cb(r['t'].encode(), _unhex(r['m']))
        return True

    def wait_msg(self):
        while not self._poll():
            _rt.wait(0.01)
        return None

    def check_msg(self, attempts=2):
        self._poll()
        return None
