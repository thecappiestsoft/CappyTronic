'use strict';
/* ================= PŁYTKI Z MICROPYTHONEM (ESP32-C3-Zero, ESP32, Pico W) =================
   MicroPython (prawdziwy interpreter, WebAssembly) działa w osobnym wątku. Wymiana danych przez
   pamięć współdzieloną: stany pinów, czas symulacji, zdarzenia przerwań i zapytania (I2C, SPI, MQTT…). */
const PY_NG = 72;
const PYL = NG => { const M = 16; return { WAKE: 0, REQ: 1, SLEEPING: 2, EVH: 3, DIRTY: 4, EVRD: 5, REQLEN: 6, RESPLEN: 7, EXITED: 8,
  MODE: M, PULL: M + NG, OUTV: M + 2 * NG, INV: M + 3 * NG, ADC: M + 4 * NG, IRQ: M + 5 * NG, EVR: M + 6 * NG, EVN: 64,
  T: 0, SLEEPTO: 1, WALL0: 2, PWMF: 8, PWMD: 8 + NG }; };
const PY = { ok: typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined' && typeof Worker !== 'undefined', wasmUrl: null, workerUrl: null, all: new Set(), seq: 0 };
const MODE = { IN: 1, OUT: 3, OD: 7, PWM: 10, ADC: 20 };
function pyAssets() {
  if (PY.workerUrl) return;
  const bin = atob(MP_WASM_B64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  PY.wasmUrl = URL.createObjectURL(new Blob([u8], { type: 'application/wasm' }));
  PY.workerUrl = URL.createObjectURL(new Blob([MP_WORKER_SRC], { type: 'text/javascript' }));
  PY.cppWorkerUrl = URL.createObjectURL(new Blob([CPP_WORKER_SRC], { type: 'text/javascript' }));
}
function cppDefaultCode(o) {
  const nm = L(o.name);
  if (o.led && o.led.np != null) return `// ${nm} – C++ (Arduino). Miganie wbudowaną diodą RGB (WS2812 na GPIO${o.led.np}).
void setup() {
  Serial.begin(115200);
  Serial.println("Witaj z ${nm}!");
}

void loop() {
  rgbLedWrite(RGB_BUILTIN, 0, 40, 0);   // zielony (R, G, B)
  delay(500);
  rgbLedWrite(RGB_BUILTIN, 0, 0, 0);    // zgaszona
  delay(500);
}
`;
  const inv = o.led && o.led.inv;
  return `// ${nm} – C++ (Arduino). Miganie wbudowaną diodą LED.
void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("Witaj z ${nm}!");
}

void loop() {
  digitalWrite(LED_BUILTIN, ${inv ? 'LOW' : 'HIGH'});   // ${inv ? 'dioda świeci przy stanie niskim' : 'dioda świeci'}
  delay(500);
  digitalWrite(LED_BUILTIN, ${inv ? 'HIGH' : 'LOW'});
  delay(500);
}
`;
}
const isCppDev = d => !!(d && d.c && d.c.props.lang === 'cpp');
function pyStop(d) {
  const p = d.py; if (!p || p.dead) return; p.dead = true;
  try { p.w.terminate(); } catch (e) { }
  if (window.cappyNative && cappyNative.mqttEnd) for (const h of p.mqtt) cappyNative.mqttEnd(h).catch(() => { });
  if (window.cappyNative && cappyNative.tcpClose) { for (const h of Object.keys(p.tcp)) { TCP_OWNERS.delete(+h); cappyNative.tcpClose(+h).catch(() => { }); } for (const sid of p.web) { WEB_OWNERS.delete(sid); cappyNative.webClose(sid).catch(() => { }); } }
  PY.all.delete(d);
}
function pyStopAll() { for (const d of [...PY.all]) pyStop(d); }

function pyBoardPart(id, o) {
  const pins = o.pins.map(p => { const m = /^G(\d+)$/.exec(p.fn); return Object.assign({}, p, { g: m ? +m[1] : null }); });
  const idx = f => pins.findIndex(p => p.fn === f);
  const v5 = idx('5V'), v33 = idx('3V3'), gnd = idx('GND');
  const g2i = {}; pins.forEach((p, i) => { if (p.g != null && g2i[p.g] === undefined) g2i[p.g] = i; });
  const gpioPins = pins.map((p, i) => p.g != null ? i : -1).filter(i => i >= 0);
  const same = [];
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) { const a = pins[i], b = pins[j]; if (a.fn === b.fn && (a.g != null || ['GND', '5V', '3V3', 'VBUS', 'VSYS'].includes(a.fn))) { same.push([i, j]); break; } }
  const gpioList = [...new Set(pins.filter(p => p.g != null && !(o.adcOnly || []).includes(p.g)).map(p => p.g).concat(o.hidden || []))].sort((a, b) => a - b);
  def(id, {
    cat: 'mcu', name: o.name, sub: o.sub, kw: o.kw, info: o.info, mcu: 'py', py: true, gnd, props: { code: o.code }, pyBoard: o,
    pins, bbox: o.bbox, bridges: () => same, draw: (c, r) => o.draw(c, r, pins),
    sim: {
      supply: [v33, gnd], maxDt: () => 1e-4,
      lin(d, S) {
        if (v5 >= 0) S.V(v5, gnd, 5, 0.05);
        if (o.adcLoad) for (const [g, r] of o.adcLoad) S.G(g2i[g], gnd, 1 / r);
        S.V(v33, gnd, 3.3, 0.25);
        const p = d.py; if (!p) return;
        for (const i of gpioPins) {
          const g = pins[i].g, mode = p.I[p.L.MODE + g], pull = p.I[p.L.PULL + g];
          if (mode === MODE.OUT || mode === MODE.PWM) continue;
          if (pull === 2) S.G(i, v33, 1 / 45000); else if (pull === 1) S.G(i, gnd, 1 / 45000);
        }
        if (p && !p.dead) { S.I(v33, -0.025); S.I(gnd, 0.025); }
      },
      init(d) { pyInit(d, o, pins, g2i, gpioPins, gpioList, v33, gnd); },
      mcuRun(d, dt) { pyRun(d, dt, pins, g2i, gpioPins, v33, gnd); },
      onIn(d, i, lvl, old) { const p = d.py; if (!p || p.dead) return; const g = pins[i].g; if (g == null) return; Atomics.store(p.I, p.L.INV + g, lvl); pyEdge(d, g, lvl, old); },
      commit(d) {
        const p = d.py; d.s.mcuRef = d.mcu; d.s.run = !!(p && !p.dead && !d.mcu.done);
        d.s.np = p ? p.np : null; d.s.wifi = d.mcu && d.mcu.wifi;
        if (o.led && o.led.pin != null && p) d.s.L = p.I[p.L.OUTV + o.led.pin] === (o.led.inv ? 0 : 1) && (p.I[p.L.MODE + o.led.pin] === MODE.OUT || p.I[p.L.MODE + o.led.pin] === MODE.OD);
        if (o.led && o.led.pin != null && p && p.I[p.L.MODE + o.led.pin] === MODE.PWM) d.s.L = o.led.inv ? p.F[p.L.PWMD + o.led.pin] < 0.95 : p.F[p.L.PWMD + o.led.pin] > 0.05;
        d.s.warn = !PY.ok ? 'pyNoSab' : d.mcu && d.mcu.pyErr ? 'pyErr' : null;
      },
    },
    readings: (c, r) => [[{ pl: 'Język', en: 'Language' }, c.props.lang === 'cpp' ? 'C++ (Arduino)' : 'MicroPython 1.27'], [{ pl: 'Stan', en: 'State' }, r.run ? { pl: 'program działa', en: 'program running' } : { pl: 'zatrzymany', en: 'stopped' }], [{ pl: 'Wi-Fi', en: 'Wi-Fi' }, r.wifi ? { pl: 'połączone (symulacja)', en: 'connected (simulated)' } : '—']],
  });
}
function pyBoardCfg(o, d, gpioList) {
  const n = ++PY.seq;
  return JSON.stringify({ name: L(o.name), short: o.short, gpio: gpioList, adc: o.adc || [], adconly: o.adcOnly || [], adcid: o.adcId || {}, port: o.port || '', pwmmax: o.pwmMax || 40000000, pwmdef: o.pwmDef || 5000, i2c: o.i2c, spi: o.spi, uart: o.uart, names: o.names || {}, wifi: !!o.wifi,
    freq: o.freq || 160000000, uid: [0x24, 0x0a, 0xc4, 0x10, (d.c.id >> 8) & 255, d.c.id & 255], ip: '192.168.50.' + (10 + (d.c.id % 200)),
    msg_wifi: t('pyNeedWifi'), msg_nowifi: t('pyNoWifiBoard') });
}
function pyInit(d, o, pins, g2i, gpioPins, gpioList, v33, gnd) {
  for (const i of gpioPins) { eListen(d, i); eDrive(d, i, null, 30, v33, gnd, false); }
  d.mcu = { py: true, serial: (d.mcu && d.mcu.serial) || '', rxq: [], run: false, lastTx: 0, wifi: false };
  if (!PY.ok) { d.mcu.serial = t('pyNoSab') + '\n'; SERIAL.dirty = true; return; }
  pyAssets();
  const cpp = isCppDev(d);
  if (cpp && (!d.c.props.wasm || d.c.props.wasmCode !== d.c.props.code)) {
    // program C++ nie jest skompilowany (albo zmieniono kod) – kompilujemy i uruchamiamy po zakończeniu
    d.mcu.serial += '[CappyTronic] ' + t(window.cappyNative && cappyNative.compileCpp ? 'cppAutoCompile' : 'cppNeedCompile') + '\n'; SERIAL.dirty = true;
    if (typeof cppAutoCompile === 'function') cppAutoCompile(d);
    return;
  }
  const L2 = PYL(PY_NG), sab = new SharedArrayBuffer(8192 + 262144);
  const I = new Int32Array(sab, 0, 1024), F = new Float64Array(sab, 4096, 512), BUF = new Uint8Array(sab, 8192);
  F[L2.WALL0] = Date.now() / 1000;
  const w = new Worker(cpp ? PY.cppWorkerUrl : PY.workerUrl, { type: 'module' });
  const p = d.py = { w, sab, I, F, BUF, L: L2, o, pins, g2i, v33, gnd, mqtt: new Set(), mq: {}, busy: false, np: null, last: {}, acc: {}, uartq: {}, dead: false, stdinWait: false, cpp, tcp: {}, web: new Set(), webq: [] };
  w.onmessage = ev => pyMsg(d, ev.data);
  w.onerror = e => { d.mcu.serial += '\n[CappyTronic] ' + (e.message || e) + '\n'; SERIAL.dirty = true; };
  if (cpp) w.postMessage({ t: 'start', sab, wasm: d.c.props.wasm, board: pyBoardCfg(o, d, gpioList), ng: PY_NG });
  else w.postMessage({ t: 'start', sab, wasmUrl: PY.wasmUrl, code: d.c.props.code || '', files: PY_FILES, board: pyBoardCfg(o, d, gpioList), ng: PY_NG });
  PY.all.add(d); d.mcu.run = true;
}
function pyMsg(d, m) {
  const p = d.py; if (!p || p.dead) return;
  if (m.t === 'out') { pySerial(d, m.s); }
  else if (m.t === 'exc' && m.cpp) {
    const msg = t('cppTrap_' + m.cpp);
    pySerial(d, '\n[CappyTronic] ' + msg + ' (' + m.s + ')\n');
    d.mcu.pyErr = { line: 0, msg: msg, cpp: true }; E.dirty = true; if (typeof onPyError === 'function') onPyError(d);
  }
  else if (m.t === 'exc') {
    pySerial(d, m.s.endsWith('\n') ? m.s : m.s + '\n');
    const all = [...m.s.matchAll(/File "main\.py", line (\d+)/g)]; const line = all.length ? +all[all.length - 1][1] : 0;
    const last = m.s.trim().split('\n').pop();
    d.mcu.pyErr = { line, msg: last }; E.dirty = true; if (typeof onPyError === 'function') onPyError(d);
  }
  else if (m.t === 'req') pyService(d);
  else if (m.t === 'exit') { d.mcu.done = true; pySerial(d, ''); }
  else if (m.t === 'fatal') pySerial(d, '[CappyTronic] ' + (p.cpp ? 'C++' : 'MicroPython') + ': ' + m.s + '\n');
}
function pySerial(d, s) { d.mcu.serial += s; if (d.mcu.serial.length > 40000) d.mcu.serial = d.mcu.serial.slice(-30000); d.mcu.lastTx = performance.now(); SERIAL.dirty = true; }
function pyEdge(d, g, lvl, old) {
  const p = d.py, I = p.I, L2 = p.L; const trig = I[L2.IRQ + g]; if (!trig || old === undefined) return;
  const e = lvl === 1 ? 1 : 2; if (!(trig & e)) return;
  const h = Atomics.load(I, L2.EVH); I[L2.EVR + (h % L2.EVN)] = (g << 4) | e; Atomics.store(I, L2.EVH, h + 1);
}
function pyApply(d, pins, g2i, v33, gnd) {
  const p = d.py, I = p.I, L2 = p.L; Atomics.store(I, L2.DIRTY, 0);
  for (const gs in g2i) {
    const g = +gs, i = g2i[g], mode = I[L2.MODE + g], v = I[L2.OUTV + g], pull = I[L2.PULL + g];
    const key = mode * 100 + v * 10 + pull; if (p.last[g] === key) continue;
    if (p.last[g] === undefined || ((p.last[g] % 10) !== pull)) E.dirty = true;
    p.last[g] = key;
    if (mode === MODE.OUT) eDrive(d, i, v ? 1 : 0, 30, v33, gnd);
    else if (mode === MODE.OD) eDrive(d, i, v ? null : 0, 30, v33, gnd, false);
    else if (mode === MODE.PWM) { /* sterowane w pyRun */ }
    else eDrive(d, i, null, 30, v33, gnd, false);
    if (mode !== MODE.PWM) delete p.acc[g];
  }
}
function pyRun(d, dt, pins, g2i, gpioPins, v33, gnd) {
  const p = d.py; if (!p || p.dead) return;
  const I = p.I, F = p.F, L2 = p.L;
  F[L2.T] = E.t;
  if (Atomics.load(I, L2.DIRTY)) pyApply(d, pins, g2i, v33, gnd);
  // PWM: dokładne zbocza dla wolnych przebiegów (serwo), modulacja sigma-delta dla szybkich (jasność LED)
  for (const gs in g2i) {
    const g = +gs; if (I[L2.MODE + g] !== MODE.PWM) continue;
    const i = g2i[g], f = F[L2.PWMF + g], du = F[L2.PWMD + g];
    if (du <= 0.0005 || du >= 0.9995) { eDrive(d, i, du >= 0.9995 ? 1 : 0, 30, v33, gnd); continue; }
    if (f * dt <= 0.5) {
      const T = 1 / f, t0 = E.t, t1 = E.t + dt, ed = [];
      for (let k = Math.floor(t0 / T); k <= Math.floor(t1 / T); k++) { const r = k * T, fl = k * T + du * T; if (r > t0 && r <= t1) ed.push([r, 1]); if (fl > t0 && fl <= t1) ed.push([fl, 0]); }
      ed.sort((a, b) => a[0] - b[0]);
      for (const [te, lv] of ed) { E.evT = te; eDrive(d, i, lv, 30, v33, gnd); }
      E.evT = null;
      if (!ed.length && p.acc[g] === undefined) { const ph = (t1 / T) % 1; eDrive(d, i, ph < du ? 1 : 0, 30, v33, gnd); }
      p.acc[g] = 0;
    } else {
      let a = (p.acc[g] || 0) + du; let lv = 0; if (a >= 1) { a -= 1; lv = 1; } p.acc[g] = a; eDrive(d, i, lv, 30, v33, gnd);
    }
  }
  // ADC
  const gv = dV(d, gnd);
  for (const g of p.o.adc || []) { const i = g2i[g]; if (i !== undefined) Atomics.store(I, L2.ADC + g, Math.round(Math.max(0, dV(d, i) - gv) * 1000)); }
  if (Atomics.load(I, L2.REQ) === 1) pyService(d);
  // wybudzenie programu, gdy minął czas uśpienia albo przyszło przerwanie
  if (Atomics.load(I, L2.SLEEPING) === 1 && (F[L2.T] >= F[L2.SLEEPTO] - 1e-12 || Atomics.load(I, L2.EVH) !== Atomics.load(I, L2.EVRD))) {
    Atomics.store(I, L2.SLEEPING, 0); Atomics.notify(I, L2.SLEEPING);
    // praca w lockstepie: czekamy chwilę, aż program wykona swoją pracę i znów zaśnie
    const t0 = performance.now();
    while (performance.now() - t0 < 4) {
      if (Atomics.load(I, L2.SLEEPING) === 1 || Atomics.load(I, L2.EXITED)) break;
      if (Atomics.load(I, L2.REQ) === 1 && !p.busy) pyService(d);
    }
    if (Atomics.load(I, L2.DIRTY)) pyApply(d, pins, g2i, v33, gnd);
  }
}
const PYTD = new TextDecoder(), PYTE = new TextEncoder();
function pyRespond(d, obj) {
  const p = d.py; if (!p || p.dead) return; let b = PYTE.encode(JSON.stringify(obj));
  if (b.length > p.BUF.length) b = PYTE.encode(JSON.stringify({ e: 27, m: 'response too large' }));
  p.BUF.set(b, 0); p.I[p.L.RESPLEN] = b.length; Atomics.store(p.I, p.L.REQ, 2); Atomics.notify(p.I, p.L.REQ);
}
const hexOf = a => Array.from(a, b => (b & 255).toString(16).padStart(2, '0')).join('');
const bytesOf = h => { const o = []; for (let i = 0; i + 1 < (h || '').length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; };
function pyNode(d, g) { const i = d.py.g2i[g]; return i === undefined ? -2 : d.n[i]; }
function pyAsync(d, promise) {
  const p = d.py; p.busy = true;
  promise.then(r => { p.busy = false; pyRespond(d, r); }, e => { p.busy = false; pyRespond(d, { e: 5, m: String(e && e.message || e) }); });
}
function pyService(d) {
  const p = d.py; if (!p || p.dead || p.busy || Atomics.load(p.I, p.L.REQ) !== 1) return;
  let q; try { q = JSON.parse(PYTD.decode(p.BUF.slice(0, p.I[p.L.REQLEN]))); } catch (e) { return pyRespond(d, { e: 22 }); }
  if (Atomics.load(p.I, p.L.DIRTY)) pyApply(d, p.pins, p.g2i, p.v33, p.gnd);
  const net = window.cappyNative;
  switch (q.op) {
    case 'i2c': return pyRespond(d, pyI2C(d, q));
    case 'spi': return pyRespond(d, pySPI(d, q));
    case 'np': return pyRespond(d, pyNeo(d, q));
    case 'uart_w': { const tx = pyNode(d, q.tx); const bytes = bytesOf(q.d); for (const x of CIR.devs) if (x.P.uart && x.n[x.P.uart.rxd] === tx && devPowered(x)) for (const b of bytes) x.P.uart.recv(x, b); return pyRespond(d, {}); }
    case 'uart_r': { const qq = p.uartq[q.rx] || []; const n = p.cpp ? Math.min(1000, qq.length) : qq.length; const out = qq.splice(0, n); return pyRespond(d, { d: hexOf(out) }); }
    case 'rx': { const n = Math.min(1000, d.mcu.rxq.length); return pyRespond(d, { d: hexOf(d.mcu.rxq.splice(0, n)) }); }
    case 'tcp_r': { const s = p.tcp[q.h]; if (!s) return pyRespond(d, { d: '', closed: 1 }); const out = s.buf.splice(0, 2000); return pyRespond(d, { d: hexOf(out), closed: s.closed && !s.buf.length ? 1 : 0 }); }
    case 'tcp_close': { if (p.tcp[q.h]) { delete p.tcp[q.h]; TCP_OWNERS.delete(q.h); if (window.cappyNative) cappyNative.tcpClose(q.h).catch(() => { }); } return pyRespond(d, {}); }
    case 'web_poll': { const r = p.webq.shift(); return pyRespond(d, r ? { id: r.id, method: r.method, uri: r.uri, body: r.body } : {}); }
    case 'web_resp': { if (window.cappyNative && cappyNative.webResp) cappyNative.webResp({ id: q.id, code: q.code, type: q.type, headers: q.headers, body: q.body }).catch(() => { }); return pyRespond(d, {}); }
    case 'stdin': { if (d.mcu.rxq.length) { const s = String.fromCharCode(...d.mcu.rxq.splice(0)); return pyRespond(d, { s }); } p.stdinWait = true; p.busy = true; return; }
    case 'wifi': d.mcu.wifi = !!q.on; return pyRespond(d, {});
    case 'reset': setTimeout(() => pyRestart(d), 0); return pyRespond(d, {});
    case 'deepsleep': pySerial(d, '[CappyTronic] deepsleep ' + (q.ms || 0) + ' ms\n'); setTimeout(() => pyRestart(d), Math.max(10, q.ms || 0)); return pyRespond(d, {});
    case 'mqtt_poll': { const m = (p.mq[q.h] || []).shift(); return pyRespond(d, m ? { t: m.t, m: m.m } : {}); }
  }
  if (!net || !net.mqttConnect) return pyRespond(d, { e: 113, m: t('pyNoNet') });
  switch (q.op) {
    case 'mqtt_connect': return pyAsync(d, net.mqttConnect({ host: q.host, port: q.port, clientId: q.cid, user: q.user, pw: q.pw, keepalive: q.ka, clean: q.clean, lw: q.lw, ssl: q.ssl }).then(r => { if (r.ok) { p.mqtt.add(r.h); p.mq[r.h] = []; MQTT_OWNERS.set(r.h, d); return { h: r.h }; } return { e: r.errno || 111, m: r.msg }; }));
    case 'mqtt_pub': return pyAsync(d, net.mqttPublish({ h: q.h, topic: q.t, payload: q.m, retain: q.r, qos: q.q }).then(r => r.ok ? {} : { e: r.errno || 104, m: r.msg }));
    case 'mqtt_sub': return pyAsync(d, net.mqttSubscribe({ h: q.h, topic: q.t, qos: q.q }).then(r => r.ok ? {} : { e: r.errno || 104, m: r.msg }));
    case 'mqtt_unsub': return pyAsync(d, net.mqttUnsubscribe({ h: q.h, topic: q.t }).then(r => r.ok ? {} : { e: r.errno || 104, m: r.msg }));
    case 'mqtt_ping': return pyAsync(d, net.mqttPing({ h: q.h }).then(r => r.ok ? {} : { e: r.errno || 104, m: r.msg }));
    case 'mqtt_end': p.mqtt.delete(q.h); return pyAsync(d, net.mqttEnd(q.h).then(() => ({})));
    case 'dns': return pyAsync(d, net.dns({ host: q.host }).then(r => r.ok ? { ip: r.ip } : { e: r.errno || 113, m: r.msg }));
    case 'tcp_open': return pyAsync(d, net.tcpOpen({ host: q.host, port: q.port }).then(r => { if (!r.ok) return { e: r.errno || 111, m: r.msg }; if (p.dead) { net.tcpClose(r.h); return { e: 111 }; } p.tcp[r.h] = p.tcp[r.h] || { buf: [], closed: false }; TCP_OWNERS.set(r.h, d); return { h: r.h }; }));
    case 'tcp_w': { const s = p.tcp[q.h]; if (!s || s.closed) return pyRespond(d, { e: 128 }); net.tcpWrite({ h: q.h, d: q.d }).catch(() => { }); return pyRespond(d, {}); }
    case 'web_listen': return pyAsync(d, net.webListen({ port: q.port }).then(r => { if (!r.ok) return { e: r.errno || 98, m: r.msg }; p.web.add(r.sid); WEB_OWNERS.set(r.sid, d);
      pySerial(d, '[CappyTronic] ' + t('cppWebAt', { u: 'http://127.0.0.1:' + r.port + '/' }) + (r.addresses && r.addresses.length ? ' · ' + r.addresses.map(a => 'http://' + a + ':' + r.port + '/').join(' ') : '') + '\n'); return { port: r.port }; }));
    case 'http': return pyAsync(d, net.http({ method: q.method, url: q.url, headers: q.headers, body: q.body, timeout: q.timeout }).then(r => r.ok ? { status: r.status, reason: r.reason, headers: r.headers, body: r.body } : { e: r.errno || 113, m: r.msg }));
  }
  pyRespond(d, { e: 95, m: 'unknown op ' + q.op });
}
const MQTT_OWNERS = new Map(), TCP_OWNERS = new Map(), WEB_OWNERS = new Map();
if (window.cappyNative && window.cappyNative.onTcp) window.cappyNative.onTcp(m => {
  if (typeof encTcpEvent === 'function' && encTcpEvent(m)) return;
  const d = TCP_OWNERS.get(m.h); if (!d || !d.py || d.py.dead) return; const s = d.py.tcp[m.h] || (d.py.tcp[m.h] = { buf: [], closed: false });
  if (m.d) { const b = bytesOf(m.d); if (s.buf.length < 1 << 20) for (const x of b) s.buf.push(x); } if (m.closed) s.closed = true;
});
if (window.cappyNative && window.cappyNative.onWeb) window.cappyNative.onWeb(m => {
  const d = WEB_OWNERS.get(m.sid); if (!d || !d.py || d.py.dead) { if (window.cappyNative.webResp) window.cappyNative.webResp({ id: m.id, code: 503, type: 'text/plain', body: hexOf(PYTE.encode('CappyTronic: symulacja zatrzymana')) }); return; }
  if (d.py.webq.length < 32) d.py.webq.push(m);
});
if (window.cappyNative && window.cappyNative.onMqttMessage) window.cappyNative.onMqttMessage(m => { const d = MQTT_OWNERS.get(m.h); if (!d || !d.py || d.py.dead) return; const q = d.py.mq[m.h]; if (q && q.length < 500) q.push({ t: m.topic, m: m.payload }); });
function pyRestart(d) { if (!d.py || d.py.dead) return; pyStop(d); d.mcu.done = false; d.mcu.pyErr = null; pySerial(d, '\n'); d.py = null; d.P.sim.init(d); }
// wpisywanie tekstu w monitorze portu szeregowego -> input() w programie
function pyStdinPush(d) { const p = d.py; if (p && p.stdinWait && d.mcu.rxq.length) { p.stdinWait = false; p.busy = false; const s = String.fromCharCode(...d.mcu.rxq.splice(0)); pyRespond(d, { s }); } }

/* ---- I2C ---- */
function pyBusI2C(d, q) { const sda = pyNode(d, q.sda), scl = pyNode(d, q.scl); return CIR.devs.filter(x => x.P.i2c && x.n[x.P.i2c.sda] === sda && x.n[x.P.i2c.scl] === scl && devPowered(x)); }
function pyI2C(d, q) {
  const devs = pyBusI2C(d, q); const find = a => devs.find(x => { const ad = x.P.i2c.addr(x); return Array.isArray(ad) ? ad.includes(a) : ad === a; });
  const out = [];
  for (const op of q.ops) {
    if (op.t === 'scan') { const found = []; for (let a = 8; a < 0x78; a++) if (find(a)) found.push(a); return { found }; }
    const x = find(op.a); if (!x) return { e: 19 };
    const b = x.P.i2c; x.s.i2cAddr = op.a;
    if (op.t === 'w') { if (b.start) b.start(x, true, op.a); for (const v of bytesOf(op.d)) b.write(x, v); if (op.s !== 0 && b.stop) b.stop(x); }
    else { if (b.start) b.start(x, false, op.a); const r = []; for (let k = 0; k < op.n; k++) r.push(b.read(x, k < op.n - 1) & 255); if (b.stop) b.stop(x); out.push(hexOf(r)); }
  }
  E.dirty = true; return { r: out };
}
/* ---- SPI ---- */
function pySPI(d, q) {
  const mosi = pyNode(d, q.mosi), sck = pyNode(d, q.sck); const list = [];
  for (const x of CIR.devs) { const bs = x.P.spi ? [].concat(x.P.spi) : []; for (const b of bs) if (x.n[b.mosi] === mosi && x.n[b.sck] === sck) list.push([x, b]); }
  const out = [];
  for (const v of bytesOf(q.d)) {
    let resp = 0xff;
    for (const [x, b] of list) { if (!devPowered(x)) continue; if (pinLevel(x, b.cs) !== (b.csHigh ? 1 : 0)) continue; const r = spiByteTo(x, b, v); if (r !== undefined && r !== null) resp = r; }
    out.push(resp & 255);
  }
  E.dirty = true; return { r: hexOf(out) };
}
/* ---- WS2812 ---- */
function pyNeo(d, q) {
  const bytes = bytesOf(q.d), bpp = q.bpp || 3, grb = q.order === 'grb'; const px = [];
  for (let i = 0; i + bpp - 1 < bytes.length; i += bpp) px.push(grb ? [bytes[i + 1], bytes[i], bytes[i + 2]] : [bytes[i], bytes[i + 1], bytes[i + 2]]);
  const o = d.py.o; if (o.led && o.led.np === q.pin) d.py.np = px[0] || [0, 0, 0];
  const node = pyNode(d, q.pin);
  const wire = []; for (const p of px) wire.push(p[1], p[0], p[2]);
  for (const x of CIR.devs) if (x.P.ws2812 && x.n[x.P.ws2812.din] === node) wsFeedBytes(x, wire);
  E.dirty = true; return {};
}
