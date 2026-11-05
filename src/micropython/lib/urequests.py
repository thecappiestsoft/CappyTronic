# CappyTronic – urequests / requests (HTTP przez program CappyTronic)
import json as _json
from _net import req as _req, hexs as _hexs, unhex as _unhex, need_wifi as _need


class Response:
    def __init__(self, status, reason, headers, content):
        self.status_code = status
        self.reason = reason.encode() if isinstance(reason, str) else reason
        self.headers = headers
        self.content = content
        self.encoding = 'utf-8'

    def close(self):
        pass

    @property
    def text(self):
        return str(self.content, self.encoding)

    def json(self):
        return _json.loads(self.content)


def request(method, url, data=None, json=None, headers=None, stream=None, auth=None, timeout=None, parse_headers=True):
    _need()
    h = dict(headers or {})
    body = None
    if json is not None:
        body = _json.dumps(json)
        if 'Content-Type' not in h:
            h['Content-Type'] = 'application/json'
    elif data is not None:
        body = data
    if auth:
        import binascii
        h['Authorization'] = 'Basic ' + binascii.b2a_base64(('%s:%s' % auth).encode())[:-1].decode()
    r = _req({'op': 'http', 'method': method, 'url': url, 'headers': h, 'body': _hexs(body) if body is not None else None, 'timeout': timeout})
    return Response(r['status'], r.get('reason', ''), r.get('headers', {}), _unhex(r.get('body', '')))


def head(url, **kw):
    return request('HEAD', url, **kw)


def get(url, **kw):
    return request('GET', url, **kw)


def post(url, **kw):
    return request('POST', url, **kw)


def put(url, **kw):
    return request('PUT', url, **kw)


def patch(url, **kw):
    return request('PATCH', url, **kw)


def delete(url, **kw):
    return request('DELETE', url, **kw)
