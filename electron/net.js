// CappyTronic – sieć: wbudowany serwer MQTT (aedes), klienci MQTT i HTTP dla symulowanych płytek.
// Domyślnie: serwer słucha tylko na tym komputerze; połączenia płytek dozwolone tylko w sieci lokalnej.
const net = require('net');
const os = require('os');
const dns = require('dns');
const http = require('http');
const https = require('https');
let Aedes = null; // aedes 1.x jest modułem ES – ładowany przez import()
const mqtt = require('mqtt');

const state = { port: 1883, share: false, internet: false, running: false, error: null, server: null, broker: null, clients: new Map(), log: [], win: null };
const conns = new Map(); let nextH = 1;

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
  return out;
}
function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}
const ownIPs = () => new Set(['127.0.0.1', '::1', 'localhost', ...lanAddresses().map(a => a.address)]);
// rozwiązuje nazwę i sprawdza zasady: tylko sieć lokalna, chyba że włączono internet
async function resolveHost(host) {
  host = String(host || '').trim();
  if (!host) return { errno: 22, msg: 'empty host' };
  let ip = host;
  if (!net.isIP(host)) {
    if (host === 'localhost') ip = '127.0.0.1';
    else { try { ip = (await dns.promises.lookup(host)).address; } catch (e) { return { errno: 113, msg: 'host not found: ' + host }; } }
  }
  const own = ownIPs().has(ip);
  if (!state.internet && !isPrivate(ip) && !own) return { errno: 13, msg: 'internet blocked', blocked: true };
  return { ip, own };
}

/* ---------- serwer MQTT ---------- */
function push(type, data) { if (state.win && !state.win.isDestroyed()) state.win.webContents.send('net:event', { type, data }); }
let logBuf = [], logTimer = null;
function logMsg(e) { logBuf.push(e); if (!logTimer) logTimer = setTimeout(() => { logTimer = null; const b = logBuf; logBuf = []; push('log', b); }, 150); }
function brokerStatus() {
  return { running: state.running, port: state.port, share: state.share, internet: state.internet, error: state.error, addresses: lanAddresses(),
    clients: [...state.clients.values()].map(c => Object.assign({}, c, { sim: c.sim || [...conns.values()].some(x => x.clientId === c.id && x.local) })) };
}
async function startBroker() {
  if (!state.broker) {
    if (!Aedes) Aedes = (await import('aedes')).Aedes;
    state.broker = await Aedes.createBroker({ heartbeatInterval: 60000 });
    const b = state.broker;
    b.on('client', c => { const s = c.conn && c.conn.remoteAddress ? String(c.conn.remoteAddress).replace('::ffff:', '') : ''; state.clients.set(c.id, { id: c.id, ip: s, sim: !!c._cappySim || [...conns.values()].some(x => x.clientId === c.id && x.local) }); push('status', brokerStatus()); });
    b.on('clientDisconnect', c => { state.clients.delete(c.id); push('status', brokerStatus()); });
    b.on('publish', (p, c) => { if (!p.topic.startsWith('$SYS')) logMsg({ t: Date.now(), topic: p.topic, payload: p.payload ? Buffer.from(p.payload).toString('base64') : '', retain: !!p.retain, from: c ? c.id : '(panel)' }); });
  }
  await new Promise(res => { if (!state.server) return res(); state.server.close(() => res()); state.server = null; });
  state.running = false; state.error = null;
  const srv = net.createServer(state.broker.handle);
  await new Promise(res => {
    srv.once('error', e => { state.error = e.code === 'EADDRINUSE' ? 'EADDRINUSE' : String(e.code || e.message); res(); });
    srv.listen(state.port, state.share ? '0.0.0.0' : '127.0.0.1', () => { state.running = true; state.server = srv; res(); });
  });
  push('status', brokerStatus());
  return brokerStatus();
}

/* ---------- klienci MQTT symulowanych płytek ---------- */
const ERRNO = { ECONNREFUSED: 111, ETIMEDOUT: 110, EHOSTUNREACH: 113, ENOTFOUND: 113, ECONNRESET: 104, EACCES: 13 };
async function mqttConnect(o) {
  const r = await resolveHost(o.host); if (r.errno) return { ok: false, errno: r.errno, msg: r.blocked ? 'blocked' : r.msg };
  let host = r.ip, port = o.port || 1883, local = false;
  if (r.own && port === state.port) { host = '127.0.0.1'; local = true; if (!state.running) return { ok: false, errno: 111, msg: 'broker off' }; }
  const opts = { clientId: o.clientId || ('cappy_' + Math.random().toString(16).slice(2, 8)), username: o.user || undefined, password: o.pw || undefined,
    keepalive: o.keepalive || 60, clean: o.clean !== false, reconnectPeriod: 0, connectTimeout: 5000, protocolVersion: 4 };
  if (o.lw && o.lw.t) opts.will = { topic: o.lw.t, payload: Buffer.from(o.lw.m || '', 'hex'), qos: o.lw.q || 0, retain: !!o.lw.r };
  const url = (o.ssl ? 'mqtts://' : 'mqtt://') + (net.isIPv6(host) ? '[' + host + ']' : host) + ':' + port;
  return new Promise(res => {
    let done = false; const c = mqtt.connect(url, Object.assign(opts, { rejectUnauthorized: false }));
    const fin = v => { if (!done) { done = true; res(v); } };
    c.on('connect', () => { const h = nextH++; conns.set(h, { c, clientId: opts.clientId, local }); push('status', brokerStatus()); c.on('message', (topic, payload) => push('mqtt', { h, topic, payload: payload.toString('hex') })); fin({ ok: true, h }); });
    c.on('error', e => { fin({ ok: false, errno: ERRNO[e.code] || (e.code === 5 || /Not authorized|Bad user/i.test(e.message) ? 5 : 111), msg: e.message }); try { c.end(true); } catch (x) { } });
    c.on('close', () => { if (!done) fin({ ok: false, errno: 111, msg: 'connection closed' }); });
    setTimeout(() => { if (!done) { fin({ ok: false, errno: 110, msg: 'timeout' }); try { c.end(true); } catch (x) { } } }, 6000);
  });
}
const withConn = (h, f) => { const x = conns.get(h); if (!x || !x.c.connected) return Promise.resolve({ ok: false, errno: 128, msg: 'not connected' }); return f(x.c); };
const cbP = fn => new Promise(res => fn(err => res(err ? { ok: false, errno: 104, msg: String(err.message || err) } : { ok: true })));
const mqttPublish = o => withConn(o.h, c => cbP(cb => c.publish(o.topic, Buffer.from(o.payload || '', 'hex'), { retain: !!o.retain, qos: o.qos || 0 }, cb)));
const mqttSubscribe = o => withConn(o.h, c => cbP(cb => c.subscribe(o.topic, { qos: o.qos || 0 }, cb)));
const mqttUnsubscribe = o => withConn(o.h, c => cbP(cb => c.unsubscribe(o.topic, cb)));
const mqttPing = o => withConn(o.h, c => Promise.resolve({ ok: true }));
function mqttEnd(h) { const x = conns.get(h); conns.delete(h); if (x) return new Promise(res => x.c.end(false, {}, () => res({ ok: true }))); return Promise.resolve({ ok: true }); }
function endAll() { for (const h of [...conns.keys()]) mqttEnd(h); try { closeAllSocks(); } catch (e) { } }

/* ---------- HTTP dla urequests ---------- */
async function httpReq(o) {
  let u; try { u = new URL(o.url); } catch (e) { return { ok: false, errno: 22, msg: 'bad url' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, errno: 22, msg: 'only http/https' };
  const r = await resolveHost(u.hostname); if (r.errno) return { ok: false, errno: r.errno, msg: r.blocked ? 'blocked' : r.msg };
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise(res => {
    const body = o.body ? Buffer.from(o.body, 'hex') : null;
    const rq = lib.request({ hostname: r.ip, servername: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: o.method || 'GET',
      headers: Object.assign({ Host: u.host, 'User-Agent': 'CappyTronic-MicroPython' }, o.headers || {}, body ? { 'Content-Length': body.length } : {}), timeout: Math.min(30000, (o.timeout || 10) * 1000) }, resp => {
      const chunks = []; let size = 0;
      resp.on('data', d => { size += d.length; if (size <= 200000) chunks.push(d); });
      resp.on('end', () => res({ ok: true, status: resp.statusCode, reason: resp.statusMessage || '', headers: resp.headers, body: Buffer.concat(chunks).toString('hex') }));
    });
    rq.on('timeout', () => { rq.destroy(); res({ ok: false, errno: 110, msg: 'timeout' }); });
    rq.on('error', e => res({ ok: false, errno: ERRNO[e.code] || 111, msg: e.message }));
    if (body) rq.write(body); rq.end();
  });
}

/* ---------- TCP (WiFiClient w programach C++) ---------- */
const socks = new Map(); let nextS = 1;
async function dnsLookup(o) { const r = await resolveHost(o.host); if (r.errno) return { ok: false, errno: r.errno, msg: r.blocked ? 'blocked' : r.msg }; return { ok: true, ip: r.ip }; }
async function tcpOpen(o) {
  const r = await resolveHost(o.host); if (r.errno) return { ok: false, errno: r.errno, msg: r.blocked ? 'blocked' : r.msg };
  let host = r.ip; const port = o.port | 0;
  if (port < 1 || port > 65535) return { ok: false, errno: 22, msg: 'bad port' };
  if (r.own) { host = '127.0.0.1'; if (port === state.port && !state.running) return { ok: false, errno: 111, msg: 'broker off' }; }
  return new Promise(res => {
    let done = false; const s = net.connect({ host, port }); const h = nextS++;
    const fin = v => { if (!done) { done = true; res(v); } };
    s.setNoDelay(true);
    s.on('connect', () => { socks.set(h, s); fin({ ok: true, h }); });
    s.on('data', b => push('tcp', { h, d: b.toString('hex') }));
    s.on('close', () => { socks.delete(h); push('tcp', { h, closed: true }); fin({ ok: false, errno: 111, msg: 'closed' }); });
    s.on('error', e => fin({ ok: false, errno: ERRNO[e.code] || 111, msg: e.message }));
    s.setTimeout(6000, () => { if (!done) { s.destroy(); fin({ ok: false, errno: 110, msg: 'timeout' }); } });
    s.once('connect', () => s.setTimeout(0));
  });
}
const lsrv = new Map(); let nextL = 1;
async function tcpListen(o) {
  const lid = nextL++;
  for (let port = o.port | 0; port < (o.port | 0) + 30; port++) {
    const srv = net.createServer(s => { const h = nextS++; socks.set(h, s); s.setNoDelay(true); push('tcp', { lid, h, accept: true });
      s.on('data', b => push('tcp', { h, d: b.toString('hex') })); s.on('close', () => { socks.delete(h); push('tcp', { h, closed: true }); }); s.on('error', () => { }); });
    const ok = await new Promise(res => { srv.once('error', () => res(false)); srv.listen(port, state.share ? '0.0.0.0' : '127.0.0.1', () => res(true)); });
    if (ok) { lsrv.set(lid, srv); return { ok: true, lid, port }; }
  }
  return { ok: false, errno: 98 };
}
function tcpUnlisten(lid) { const s = lsrv.get(lid); lsrv.delete(lid); if (s) s.close(); return { ok: true }; }
function tcpWrite(o) { const s = socks.get(o.h); if (!s || s.destroyed) return { ok: false, errno: 128 }; s.write(Buffer.from(o.d || '', 'hex')); return { ok: true }; }
function tcpClose(h) { const s = socks.get(h); socks.delete(h); if (s) s.end(); return { ok: true }; }

/* ---------- serwer WWW płytki (WebServer w C++) – przekierowanie portu na ten komputer ---------- */
const webs = new Map(); let nextW = 1, nextReq = 1; const pending = new Map();
async function webListen(o) {
  const want = (o.port | 0) >= 1024 ? o.port | 0 : 8080; const sid = nextW++;
  for (let port = want; port < want + 40; port++) {
    const srv = http.createServer((rq, rs) => {
      const chunks = []; let size = 0;
      rq.on('data', d => { size += d.length; if (size <= 8000) chunks.push(d); });
      rq.on('end', () => {
        const id = nextReq++; const t = setTimeout(() => { if (pending.delete(id)) { rs.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' }); rs.end('CappyTronic: płytka nie odpowiedziała (czy program wywołuje server.handleClient() i czy symulacja działa?)'); } }, 10000);
        pending.set(id, { rs, t });
        push('web', { sid, id, method: rq.method, uri: rq.url, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    const ok = await new Promise(res => { srv.once('error', () => res(false)); srv.listen(port, state.share ? '0.0.0.0' : '127.0.0.1', () => res(true)); });
    if (ok) { webs.set(sid, srv); return { ok: true, sid, port, addresses: state.share ? lanAddresses().map(a => a.address) : [] }; }
  }
  return { ok: false, errno: 98, msg: 'no free port' };
}
function webResp(o) {
  const p = pending.get(o.id); if (!p) return { ok: false }; pending.delete(o.id); clearTimeout(p.t);
  const hd = Object.assign({}, o.headers || {}, { 'Content-Type': (o.type || 'text/html') + (/charset/i.test(o.type || '') ? '' : '; charset=utf-8'), 'Cache-Control': 'no-store' });
  try { p.rs.writeHead(o.code || 200, hd); p.rs.end(Buffer.from(o.body || '', 'hex')); } catch (e) { }
  return { ok: true };
}
function webClose(sid) { const s = webs.get(sid); webs.delete(sid); if (s) s.close(); return { ok: true }; }
function closeAllSocks() { for (const h of [...socks.keys()]) tcpClose(h); for (const sid of [...webs.keys()]) webClose(sid); for (const lid of [...lsrv.keys()]) tcpUnlisten(lid); }

function setup(ipcMain, getWin) {
  state.winGetter = getWin;
  Object.defineProperty(state, 'win', { get: () => getWin(), configurable: true });
  ipcMain.handle('net:status', () => brokerStatus());
  ipcMain.handle('net:config', async (e, c) => { if (c.port) state.port = Math.max(1, Math.min(65535, c.port | 0)); if (c.share !== undefined) state.share = !!c.share; if (c.internet !== undefined) state.internet = !!c.internet; if (c.restart !== false) await startBroker(); push('status', brokerStatus()); return brokerStatus(); });
  ipcMain.handle('net:publish', (e, o) => new Promise(res => { if (!state.broker) return res({ ok: false }); state.broker.publish({ cmd: 'publish', topic: String(o.topic), payload: Buffer.from(String(o.payload || ''), 'utf8'), qos: 0, retain: !!o.retain, dup: false }, err => res({ ok: !err })); }));
  ipcMain.handle('mqtt:connect', (e, o) => mqttConnect(o));
  ipcMain.handle('mqtt:publish', (e, o) => mqttPublish(o));
  ipcMain.handle('mqtt:subscribe', (e, o) => mqttSubscribe(o));
  ipcMain.handle('mqtt:unsubscribe', (e, o) => mqttUnsubscribe(o));
  ipcMain.handle('mqtt:ping', (e, o) => mqttPing(o));
  ipcMain.handle('mqtt:end', (e, h) => mqttEnd(h));
  ipcMain.handle('http:request', (e, o) => httpReq(o));
  ipcMain.handle('net:dns', (e, o) => dnsLookup(o));
  ipcMain.handle('tcp:open', (e, o) => tcpOpen(o));
  ipcMain.handle('tcp:write', (e, o) => tcpWrite(o));
  ipcMain.handle('tcp:close', (e, h) => tcpClose(h));
  ipcMain.handle('tcp:listen', (e, o) => tcpListen(o));
  ipcMain.handle('tcp:unlisten', (e, lid) => tcpUnlisten(lid));
  ipcMain.handle('web:listen', (e, o) => webListen(o));
  ipcMain.handle('web:resp', (e, o) => webResp(o));
  ipcMain.handle('web:close', (e, sid) => webClose(sid));
}
module.exports = { setup, startBroker, endAll, state, isPrivate };
