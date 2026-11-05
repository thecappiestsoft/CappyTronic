'use strict';
/* ================= MIKROKONTROLERY AVR (emulacja avr8js) ================= */
const A8 = window.AVR8;
const tinyPorts = { B: { PIN: 0x36, DDR: 0x37, PORT: 0x38, pinChange: { PCIE: 5, PCICR: 0x5b, PCIFR: 0x5a, PCMSK: 0x35, pinChangeInterrupt: 0x02, mask: 0x3f, offset: 0 }, externalInterrupts: [null, null, { EICR: 0x55, EIMSK: 0x5b, EIFR: 0x5a, index: 6, iscOffset: 0, interrupt: 0x01 }] } };
function megaPorts() {
  const P = {}; for (const k of 'ABCDEFGHJKL') P[k] = Object.assign({}, A8['port' + k + 'Config'], { pinChange: undefined, externalInterrupts: [] });
  const ext = (i, eicr, off, adr) => ({ EICR: eicr, EIMSK: 0x3d, EIFR: 0x3c, index: i, iscOffset: off, interrupt: adr });
  P.D.externalInterrupts = [ext(0, 0x69, 0, 2), ext(1, 0x69, 2, 4), ext(2, 0x69, 4, 6), ext(3, 0x69, 6, 8)];
  P.E.externalInterrupts = [null, null, null, null, ext(4, 0x6a, 0, 10), ext(5, 0x6a, 2, 12)];
  P.B.pinChange = { PCIE: 0, PCICR: 0x68, PCIFR: 0x3b, PCMSK: 0x6b, pinChangeInterrupt: 0x12, mask: 0xff, offset: 0 };
  P.K.pinChange = { PCIE: 2, PCICR: 0x68, PCIFR: 0x3b, PCMSK: 0x6d, pinChangeInterrupt: 0x16, mask: 0xff, offset: 0 };
  return P;
}
const tm16 = (base, timsk, tifr, cap, pA, pinA, pB, pinB, pC, pinC) => Object.assign({}, A8.timer1Config, {
  TCCRA: base, TCCRB: base + 1, TCCRC: base + 2, TCNT: base + 4, ICR: base + 6, OCRA: base + 8, OCRB: base + 10, OCRC: base + 12, TIMSK: timsk, TIFR: tifr,
  captureInterrupt: cap, compAInterrupt: cap + 2, compBInterrupt: cap + 4, compCInterrupt: cap + 6, ovfInterrupt: cap + 8, OCFC: 8, OCIEC: 8,
  compPortA: pA, compPinA: pinA, compPortB: pB, compPinB: pinB, compPortC: pC, compPinC: pinC, externalClockPort: 0, externalClockPin: 0,
});
const MCUK = {
  m328: { flash: 0x8000, target: 'uno', label: 'ATmega328P',
    ports: () => ({ B: A8.portBConfig, C: A8.portCConfig, D: A8.portDConfig }),
    periph(cpu, f) {
      return { timers: [new A8.AVRTimer(cpu, A8.timer0Config), new A8.AVRTimer(cpu, A8.timer1Config), new A8.AVRTimer(cpu, A8.timer2Config)],
        usart: new A8.AVRUSART(cpu, A8.usart0Config, f), twi: new A8.AVRTWI(cpu, A8.twiConfig, f), spi: new A8.AVRSPI(cpu, A8.spiConfig, f),
        adc: new A8.AVRADC(cpu, A8.adcConfig), eeprom: new A8.AVREEPROM(cpu, new A8.EEPROMMemoryBackend(1024)), clock: new A8.AVRClock(cpu, f, A8.clockConfig) };
    },
    sda: ['C', 4], scl: ['C', 5], mosi: ['B', 3], miso: ['B', 4], sck: ['B', 5], rx: ['D', 0], tx: ['D', 1],
    adcCh: { C0: 0, C1: 1, C2: 2, C3: 3, C4: 4, C5: 5 },
  },
  m2560: { flash: 0x40000, target: 'mega', label: 'ATmega2560',
    ports: megaPorts,
    periph(cpu, f, P) {
      const t0 = Object.assign({}, A8.timer0Config, { compAInterrupt: 0x2a, compBInterrupt: 0x2c, ovfInterrupt: 0x2e, compPortA: P.B.PORT, compPinA: 7, compPortB: P.G.PORT, compPinB: 5, externalClockPort: 0 });
      const t1 = tm16(0x80, 0x6f, 0x36, 0x20, P.B.PORT, 5, P.B.PORT, 6, P.B.PORT, 7);
      const t2 = Object.assign({}, A8.timer2Config, { compAInterrupt: 0x1a, compBInterrupt: 0x1c, ovfInterrupt: 0x1e, compPortA: P.B.PORT, compPinA: 4, compPortB: P.H.PORT, compPinB: 6 });
      const t3 = tm16(0x90, 0x71, 0x38, 0x3e, P.E.PORT, 3, P.E.PORT, 4, P.E.PORT, 5);
      const t4 = tm16(0xa0, 0x72, 0x39, 0x52, P.H.PORT, 3, P.H.PORT, 4, P.H.PORT, 5);
      const t5 = tm16(0x120, 0x73, 0x3a, 0x5c, P.L.PORT, 3, P.L.PORT, 4, P.L.PORT, 5);
      return { timers: [t0, t1, t2, t3, t4, t5].map(c => new A8.AVRTimer(cpu, c)),
        usart: new A8.AVRUSART(cpu, Object.assign({}, A8.usart0Config, { rxCompleteInterrupt: 0x32, dataRegisterEmptyInterrupt: 0x34, txCompleteInterrupt: 0x36 }), f),
        twi: new A8.AVRTWI(cpu, Object.assign({}, A8.twiConfig, { twiInterrupt: 0x4e }), f), spi: new A8.AVRSPI(cpu, Object.assign({}, A8.spiConfig, { spiInterrupt: 0x30 }), f),
        adc: new A8.AVRADC(cpu, Object.assign({}, A8.adcConfig, { adcInterrupt: 0x3a })), eeprom: new A8.AVREEPROM(cpu, new A8.EEPROMMemoryBackend(4096), Object.assign({}, A8.eepromConfig, { eepromReadyInterrupt: 0x3c })),
        clock: new A8.AVRClock(cpu, f, A8.clockConfig) };
    },
    sda: ['D', 1], scl: ['D', 0], mosi: ['B', 2], miso: ['B', 3], sck: ['B', 1], rx: ['E', 0], tx: ['E', 1],
    adcCh: { F0: 0, F1: 1, F2: 2, F3: 3, F4: 4, F5: 5, F6: 6, F7: 7 },
  },
  t85: { flash: 0x2000, target: 'tiny85', label: 'ATtiny85',
    ports: () => tinyPorts,
    periph(cpu, f) {
      const t0 = Object.assign({}, A8.timer0Config, { compAInterrupt: 0x0a, compBInterrupt: 0x0b, ovfInterrupt: 0x05, TIFR: 0x58, OCRA: 0x49, OCRB: 0x48, TCNT: 0x52, TCCRA: 0x4a, TCCRB: 0x53, TIMSK: 0x59,
        compPortA: 0x38, compPinA: 0, compPortB: 0x38, compPinB: 1, externalClockPort: 0x38, externalClockPin: 2, TOV: 2, OCFA: 0x10, OCFB: 0x08, TOIE: 2, OCIEA: 0x10, OCIEB: 0x08 });
      const adcc = Object.assign({}, A8.adcConfig, { ADMUX: 0x27, ADCSRA: 0x26, ADCSRB: 0x23, ADCL: 0x24, ADCH: 0x25, DIDR0: 0x34, adcInterrupt: 0x08, numChannels: 4, adcReferences: [A8.ADCReference.AVCC, A8.ADCReference.AREF, A8.ADCReference.Internal1V1, A8.ADCReference.Reserved] });
      return { timers: [new A8.AVRTimer(cpu, t0), new A8.ATtinyTimer1(cpu, A8.attinyTimer1Config)], adc: new A8.AVRADC(cpu, adcc),
        eeprom: new A8.AVREEPROM(cpu, new A8.EEPROMMemoryBackend(512), { eepromReadyInterrupt: 0x06, EECR: 0x3c, EEDR: 0x3d, EEARL: 0x3e, EEARH: 0x3f, eraseCycles: 14400, writeCycles: 14400 }),
        clock: new A8.AVRClock(cpu, f, { CLKPR: 0x46 }) };
    },
    adcCh: { B5: 0, B2: 1, B4: 2, B3: 3 },
  },
};
function parseHex(src, bytes) { for (const l of src.split(/\r?\n/)) { if (l[0] !== ':') continue; const n = parseInt(l.substr(1, 2), 16), a = parseInt(l.substr(3, 4), 16), ty = parseInt(l.substr(7, 2), 16); if (ty === 0) for (let i = 0; i < n; i++) bytes[(parseHex.base || 0) + a + i] = parseInt(l.substr(9 + i * 2, 2), 16); else if (ty === 2) parseHex.base = parseInt(l.substr(9, 4), 16) * 16; else if (ty === 4) parseHex.base = parseInt(l.substr(9, 4), 16) * 65536; } parseHex.base = 0; }

/* ---------- definicja części z mikrokontrolerem ---------- */
// pin: { x, y, n (nazwa), fn: 'D'+numer | 'P'+port+bit | 'A6' | '5V' | '3V3' | 'GND' | 'VIN' | 'RESET' | 'AREF' | 'IOREF' | 'NC' | 'VCC' }
function mcuPart(id, o) {
  const K = MCUK[o.kind];
  const pinmap = o.kind === 't85' ? [['B', 0], ['B', 1], ['B', 2], ['B', 3], ['B', 4], ['B', 5]] : PINMAP[K.target];
  const pins = o.pins.map(p => {
    let port = null, bit = null, an = null;
    const m = /^D(\d+)$/.exec(p.fn), mp = /^P([A-L])(\d)$/.exec(p.fn), ma = /^A(\d+)$/.exec(p.fn);
    if (m && pinmap[+m[1]]) [port, bit] = pinmap[+m[1]];
    else if (mp) { port = mp[1]; bit = +mp[2]; }
    else if (ma) { const off = o.kind === 'm2560' ? 54 : 14; const dn = off + +ma[1]; if (pinmap[dn] && pinmap[dn][0]) [port, bit] = pinmap[dn]; else an = +ma[1]; }
    if (port && K.adcCh[port + bit] !== undefined) an = K.adcCh[port + bit];
    return { x: p.x, y: p.y, n: p.n, s: p.s, num: p.num, fn: p.fn, port, bit, an };
  });
  const idx = f => pins.findIndex(p => p.fn === f);
  const gpio = pins.map((p, i) => p.port ? i : -1).filter(i => i >= 0);
  const vcc = o.chip ? idx('VCC') : idx('5V'), gnd = idx('GND'); o.rst = idx('RESET');
  const same = []; // piny zwarte wewnętrznie (te same porty / zasilanie)
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
    const a = pins[i], b = pins[j];
    if ((a.port && a.port === b.port && a.bit === b.bit) || (!a.port && a.fn === b.fn && ['GND', '5V', 'VCC', 'AVCC'].includes(a.fn))) { same.push([i, j]); break; }
  }
  if (o.chip) { const av = idx('AVCC'); if (av >= 0) same.push([vcc, av]); }
  def(id, {
    cat: 'mcu', name: o.name, sub: o.sub, kw: o.kw, info: o.info, mcu: o.kind, target: K.target, f: o.f, gnd: o.chip ? undefined : gnd,
    props: { code: o.code || DEFAULT_SKETCH(o), hex: '' },
    pins, bbox: o.bbox, bridges: () => same, draw: (c, r) => o.draw(c, r, pins),
    sim: {
      supply: [vcc, gnd], maxDt: () => 1e-4,
      lin(d, S) {
        if (!o.chip) { S.V(vcc, gnd, 5, 0.05); const v3 = idx('3V3'); if (v3 >= 0) S.V(v3, gnd, 3.3, 1); }
        if (o.chip && o.rst >= 0) S.G(o.rst, vcc, 1 / 40000);
        if (d.mcu && d.mcu.run) { S.I(vcc, -0.02); S.I(gnd, 0.02); }
      },
      init(d) { mcuInit(d, K, o, pins, gpio, vcc, gnd); },
      mcuRun(d, dt) { mcuRun(d, dt, K, o, pins, vcc, gnd); },
      onIn(d, p, lvl) { const m = d.mcu; if (!m || !m.cpu) return; const pp = pins[p]; if (pp.port) m.ports[pp.port].setPin(pp.bit, lvl === 1); },
      commit(d) {
        const m = d.mcu; d.s.run = !!(m && m.run); d.s.noprog = !d.c.props.hex;
        d.s.L = m && m.cpu && o.ledL ? m.ports[o.ledL[0]].pinState(o.ledL[1]) === A8.PinState.High : false;
        d.s.mcuRef = d.mcu; d.s.pwr = true;
        d.s.warn = d.s.noprog ? 'noProgram' : o.chip && dVp(d, vcc, gnd) < 2.7 ? 'mcuNoPower' : null;
      },
    },
    readings: (c, r) => [[{ pl: 'Program', en: 'Program' }, c.props.hex ? { pl: 'wgrany', en: 'loaded' } : { pl: 'brak – kliknij „Kod”', en: 'none – click “Code”' }], [{ pl: 'Stan', en: 'State' }, r.run ? { pl: 'działa', en: 'running' } : { pl: 'zatrzymany', en: 'stopped' }]],
  });
}
function mcuInit(d, K, o, pins, gpio, vcc, gnd) {
  for (const i of gpio) eListen(d, i);
  const hex = d.c.props.hex; d.mcu = { run: false, serial: d.mcu && d.mcu.serial || '' };
  SERIAL.attach(d);
  if (!hex) return;
  const bytes = new Uint8Array(K.flash); bytes.fill(0xff); parseHex(hex, bytes);
  const prog = new Uint16Array(bytes.buffer);
  const cpu = new A8.CPU(prog, o.kind === 't85' ? 512 : o.kind === 'm2560' ? 8448 : 8192);
  const portsCfg = K.ports(); const ports = {};
  for (const k in portsCfg) ports[k] = new A8.AVRIOPort(cpu, portsCfg[k]);
  const f = o.f; const per = K.periph(cpu, f, portsCfg);
  const m = d.mcu = { cpu, ports, per, f, run: false, serial: d.mcu.serial, rxq: [], pinDrv: {} , lastTx: 0, lastRx: 0 };
  // EEPROM zachowane między uruchomieniami
  if (per.eeprom && d.c.props.eep) try { const b = atob(d.c.props.eep); for (let i = 0; i < b.length; i++) per.eeprom.backend.memory[i] = b.charCodeAt(i); } catch (e) { }
  const byPort = {}; pins.forEach((p, i) => { if (p.port) (byPort[p.port] = byPort[p.port] || []).push(i); });
  for (const k in ports) {
    const port = ports[k], list = byPort[k] || [];
    port.addListener(() => {
      for (const i of list) {
        const st = port.pinState(pins[i].bit);
        const key = st; if (m.pinDrv[i] === key) continue; m.pinDrv[i] = key;
        if (st === A8.PinState.High) eDrive(d, i, 1, 25, vcc, gnd); else if (st === A8.PinState.Low) eDrive(d, i, 0, 25, vcc, gnd);
        else eDrive(d, i, null, 25, vcc, gnd, st === A8.PinState.InputPullUp);
      }
    });
  }
  // port szeregowy
  if (per.usart) {
    per.usart.onByteTransmit = b => { m.serial += String.fromCharCode(b); if (m.serial.length > 40000) m.serial = m.serial.slice(-30000); m.lastTx = performance.now(); SERIAL.dirty = true; UART_BRIDGE.tx(d, b); };
  }
  if (per.twi) per.twi.eventHandler = new I2CBus(d, per.twi, pins, K);
  if (per.spi) per.spi.onTransfer = v => { const r = spiHwTransfer(d, v, pins, K); cpu.addClockEvent(() => per.spi.completeTransfer(r), per.spi.transferCycles || 16); return r; };
  for (const i of gpio) m.pinDrv[i] = undefined;
  // początkowy stan pinów (wejścia bez podciągania)
  for (const i of gpio) eDrive(d, i, null, 25, vcc, gnd, false);
}
function mcuRun(d, dt, K, o, pins, vcc, gnd) {
  const m = d.mcu; if (!m || !m.cpu) return;
  const vs = CIR.V[d.n[vcc]] - CIR.V[d.n[gnd]];
  const powered = vs > 2.7;
  if (o.chip && o.rst >= 0 && dV(d, o.rst) - dV(d, gnd) < 0.9 * Math.min(1, vs / 5) * 1 && powered) { if (!m.inReset) { m.inReset = true; } cpu_hold(m); return; } else if (m.inReset) { m.inReset = false; m.cpu.reset(); }
  if (!powered) { m.pwrT = undefined; if (m.run) { m.run = false; for (const i in m.pinDrv) { m.pinDrv[i] = undefined; eDrive(d, +i, null, 25, vcc, gnd, false); } } return; }
  // czas startu po włączeniu zasilania (bezpieczniki Arduino: SUT = 14 CK + 65 ms) – dopiero potem rusza program
  if (!m.run) { if (m.pwrT === undefined) m.pwrT = E.t; if (E.t - m.pwrT < (o.startup ?? 0.065)) return; m.run = true; m.cpu.reset(); }
  if (m.resetReq) { m.resetReq = false; m.cpu.reset(); m.serial += '\n'; }
  // ADC
  if (m.per.adc) { m.per.adc.avcc = Math.max(0.1, vs); for (const p of pins) if (p.an != null) { const i = pins.indexOf(p); m.per.adc.channelValues[p.an] = clamp(dV(d, i) - dV(d, gnd), 0, vs); } }
  // wejście szeregowe
  if (m.rxq.length && m.per.usart) { if (m.per.usart.writeByte(m.rxq[0])) m.rxq.shift(); }
  const cpu = m.cpu, start = cpu.cycles, target = start + Math.round(dt * m.f);
  E.mcuStart = start; E.mcuF = m.f; E.mcuCpu = cpu;
  while (cpu.cycles < target) { A8.avrInstruction(cpu); cpu.tick(); }
  E.mcuCpu = null;
}
function cpu_hold(m) { for (const k in m.ports) { } }
function eNow() { return E.evT != null ? E.evT : E.mcuCpu ? E.t + (E.mcuCpu.cycles - E.mcuStart) / E.mcuF : E.t; }
const DEFAULT_SKETCH = o => o.kind === 't85' ? `// ATtiny85: pin 0 = PB0 (nóżka 5)
void setup() {
  pinMode(0, OUTPUT);
}

void loop() {
  digitalWrite(0, HIGH);
  delay(500);
  digitalWrite(0, LOW);
  delay(500);
}
` : `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Hello from CappyTronic!");
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
`;

/* ---------- szyny I2C i SPI ---------- */
const portNode = (d, pins, pb) => { if (!pb) return -1; const i = pins.findIndex(p => p.port === pb[0] && p.bit === pb[1]); return i < 0 ? -1 : d.n[i]; };
function busDevices(d, pins, K, kind) {
  const key = '_bus_' + kind; if (d[key] && d[key].cir === CIR) return d[key].list;
  const list = [];
  if (kind === 'i2c') { const sda = portNode(d, pins, K.sda), scl = portNode(d, pins, K.scl); for (const x of CIR.devs) { const b = x.P.i2c; if (b && x.n[b.sda] === sda && x.n[b.scl] === scl) list.push(x); } }
  else { const mosi = portNode(d, pins, K.mosi), sck = portNode(d, pins, K.sck); for (const x of CIR.devs) { const bs = x.P.spi ? [].concat(x.P.spi) : []; for (const b of bs) if (x.n[b.mosi] === mosi && x.n[b.sck] === sck) list.push([x, b]); } }
  d[key] = { cir: CIR, list }; return list;
}
const devPowered = x => { const sp = x.P.sim && x.P.sim.supply; if (!sp) return true; return dVp(x, sp[0], sp[1]) > 2.4; };
const pinLevel = (x, p) => { const l = netLevel(x.n[p]); if (l !== undefined) return l; const sp = x.P.sim && x.P.sim.supply; const g = sp ? dV(x, sp[1]) : 0, vcc = sp ? dV(x, sp[0]) - g : 5; return dV(x, p) - g > vcc * 0.5 ? 1 : 0; };
class I2CBus {
  constructor(d, twi, pins, K) { this.d = d; this.twi = twi; this.pins = pins; this.K = K; this.cur = null; }
  start() { this.twi.completeStart(); }
  stop() { if (this.cur && this.cur.P.i2c.stop) this.cur.P.i2c.stop(this.cur); this.cur = null; this.twi.completeStop(); }
  connectToSlave(addr, write) {
    this.cur = null;
    for (const x of busDevices(this.d, this.pins, this.K, 'i2c')) { if (!devPowered(x)) continue; const a = x.P.i2c.addr(x); if ((Array.isArray(a) ? a.includes(addr) : a === addr)) { this.cur = x; x.s.i2cAddr = addr; break; } }
    if (this.cur && this.cur.P.i2c.start) this.cur.P.i2c.start(this.cur, write, addr);
    this.twi.completeConnect(!!this.cur);
  }
  writeByte(v) { const ack = this.cur ? this.cur.P.i2c.write(this.cur, v) !== false : false; this.twi.completeWrite(ack); }
  readByte(ack) { const v = this.cur ? this.cur.P.i2c.read(this.cur, ack) & 255 : 0xff; this.twi.completeRead(v); }
}
function spiHwTransfer(d, v, pins, K) {
  let resp = 0xff;
  for (const [x, b] of busDevices(d, pins, K, 'spi')) {
    if (!devPowered(x)) continue;
    const sel = pinLevel(x, b.cs) === (b.csHigh ? 1 : 0); if (!sel) continue;
    const r = spiByteTo(x, b, v); if (r !== undefined && r !== null) resp = r;
  }
  return resp & 255;
}
// wysłanie bajtu do urządzenia SPI (bajtowo albo bit po bicie)
function spiByteTo(x, b, v) {
  if (b.byte) { const r = b.pre ? b.pre(x) : 0xff; b.byte(x, v); return r; }
  let r = 0; for (let i = 7; i >= 0; i--) r = (r << 1) | (b.bit(x, (v >> i) & 1) & 1); return r;
}

/* ---------- monitor portu szeregowego: pomost z modułami USB-UART ---------- */
const SERIAL = { dirty: false, attach(d) { } };
const UART_BRIDGE = {
  links(d) { if (d._uart && d._uart.cir === CIR) return d._uart.list; const list = []; const K = MCUK[d.P.mcu]; if (K && K.tx) { const pins = pinsOf(d.c); const tx = portNode(d, pins, K.tx); for (const x of CIR.devs) if (x.P.uart && x.n[x.P.uart.rxd] === tx) list.push(x); } d._uart = { cir: CIR, list }; return list; },
  tx(d, b) { for (const x of this.links(d)) if (devPowered(x)) x.P.uart.recv(x, b); },
  // moduł -> mikrokontroler: szukamy MCU, którego pin RX jest połączony z TXD modułu
  send(x, bytes) { let ok = false; for (const d of CIR.mcus) { if (d.py && !d.py.dead) { const node = x.n[x.P.uart.txd]; for (const gs in d.py.g2i) if (d.n[d.py.g2i[gs]] === node) { (d.py.uartq[gs] = d.py.uartq[gs] || []).push(...bytes); ok = true; } continue; } const K = MCUK[d.P.mcu]; if (!K || !K.rx || !d.mcu || !d.mcu.cpu) continue; if (portNode(d, pinsOf(d.c), K.rx) === x.n[x.P.uart.txd]) { d.mcu.rxq.push(...bytes); ok = true; } } return ok; },
};
