'use strict';
/* ================= PERYFERIA: wyświetlacze, I2C, SPI, komunikacja ================= */
function modPart(id, o) {
  const pk = pkgModule(o.pins.map(p => Array.isArray(p) ? p[0] : p), o.w, o.h);
  pk.pins.forEach((p, i) => { const q = o.pins[i]; if (Array.isArray(q)) p.n = q[1]; });
  const P = def(id, Object.assign({
    cat: o.cat, name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: o.props || {}, ui: o.ui,
    pins: pk.pins, bbox: o.bbox || pk.bbox, draw: (c, r) => pk.body(o.title, o.col, o.inner ? o.inner(c, r, pk) : ''),
  }, o.extra || {}));
  P.pk = pk; return P;
}
const pidx = (o, name) => o.pins.findIndex(p => (Array.isArray(p) ? p[0] : p) === name);
// SPI po pinach (programowe SPI, shiftOut itp.)
function spiPinIn(d, b, p, lvl, old) {
  const key = '_sp' + (b.key || ''), st = d[key] || (d[key] = { n: 0, v: 0, r: 0xff, sel: false });
  const sp = d.P.sim.supply;
  if (p === b.cs) {
    const sel = lvl === (b.csHigh ? 1 : 0);
    if (sel !== st.sel) { st.n = 0; st.v = 0; if (b.select) b.select(d, sel); if (!sel && b.miso != null) eDrive(d, b.miso, null, 50, sp[0], sp[1]); }
    st.sel = sel; return;
  }
  if (p !== b.sck || !st.sel || !(lvl === 1 && old === 0) || !d.pw) return;
  const mosi = pinLevel(d, b.mosi);
  if (b.bit) { const m = b.bit(d, mosi); if (b.miso != null) eDrive(d, b.miso, m ? 1 : 0, 50, sp[0], sp[1]); return; }
  if (st.n === 0) st.r = b.pre ? b.pre(d) : 0xff;
  if (b.miso != null) eDrive(d, b.miso, (st.r >> (7 - st.n)) & 1, 50, sp[0], sp[1]);
  st.v = ((st.v << 1) | mosi) & 255; st.n++;
  if (st.n === 8) { b.byte(d, st.v); st.n = 0; st.v = 0; }
}
function spiListen(d, b) { eListen(d, b.cs); eListen(d, b.sck); eListen(d, b.mosi); }

/* ---------- HD44780 ---------- */
// HD44780U, ROM znaków A00 (japońska: ¥ zamiast \, katakana w 0xA0–0xDF), czasy wykonania z karty katalogowej (fosc = 270 kHz)
class HD44780 {
  constructor(cols, rows) { this.cols = cols; this.rows = rows; this.dd = new Uint8Array(128).fill(32); this.cg = new Uint8Array(64); this.ac = 0; this.id = 1; this.sh = 0; this.ds = 0; this.disp = 0; this.cur = 0; this.blink = 0; this.dl8 = true; this.nib = null; this.rnib = null; this.cgm = false; this.ver = 0; this.n2 = rows > 1; this.busyTo = 0; this.lost = 0; }
  busy(t) { return t < this.busyTo; }
  bus(rs, byte, t) { if (this.dl8) this.write(rs, byte, t); else if (this.nib === null) this.nib = byte >> 4; else { this.write(rs, (this.nib << 4) | (byte >> 4), t); this.nib = null; } }
  inc() { if (this.cgm) this.ac = (this.ac + (this.id ? 1 : -1)) & 63; else { let a = this.ac + (this.id ? 1 : -1); if (this.n2) { if (a === 0x28) a = 0x40; else if (a === 0x68) a = 0; else if (a === 0x3f) a = 0x27; else if (a < 0) a = 0x67; } else { if (a === 0x50) a = 0; else if (a < 0) a = 0x4f; } this.ac = a & 127; if (this.sh) this.ds += this.id ? 1 : -1; } }
  write(rs, v, t) {
    // w czasie wykonywania poprzedniego rozkazu (flaga BF) układ ignoruje kolejne zapisy
    // (zapisy w tej samej chwili symulacji pochodzą z MicroPythona, którego instrukcje nie zużywają czasu symulacji – wtedy nie sprawdzamy BF)
    if (t !== undefined && t !== this.lastWT && this.busy(t)) { this.lost++; this.lastWT = t; return; }
    if (t !== undefined) this.lastWT = t;
    this.ver++;
    let ex = 37e-6;
    if (rs) { if (this.cgm) this.cg[this.ac & 63] = v; else this.dd[this.ac & 127] = v; this.inc(); ex = 41e-6; }
    else if (v & 0x80) { this.ac = v & 127; this.cgm = false; }
    else if (v & 0x40) { this.ac = v & 63; this.cgm = true; }
    else if (v & 0x20) { const dl = (v >> 4) & 1; if (!dl && this.dl8) this.nib = null; this.dl8 = !!dl; this.n2 = this.rows > 1 ? true : !!(v & 8); }
    else if (v & 0x10) { if (v & 8) this.ds += (v & 4) ? -1 : 1; else { this.ac = (this.ac + ((v & 4) ? 1 : -1)) & 127; } }
    else if (v & 0x08) { this.disp = (v >> 2) & 1; this.cur = (v >> 1) & 1; this.blink = v & 1; }
    else if (v & 0x04) { this.id = (v >> 1) & 1; this.sh = v & 1; }
    else if (v & 0x02) { this.ac = 0; this.ds = 0; this.cgm = false; ex = 1.52e-3; }
    else if (v & 0x01) { this.dd.fill(32); this.ac = 0; this.id = 1; this.ds = 0; this.cgm = false; ex = 1.52e-3; }
    if (t !== undefined) this.busyTo = t + ex;
  }
  // odczyt: RS=0 – flaga zajętości i licznik adresu, RS=1 – dane z DDRAM/CGRAM
  read(rs, t) {
    if (!rs) return (this.busy(t || 0) ? 0x80 : 0) | (this.ac & 0x7f);
    const v = this.cgm ? this.cg[this.ac & 63] : this.dd[this.ac & 127]; this.inc(); if (t !== undefined) this.busyTo = t + 41e-6; return v;
  }
  glyph(code, row) { // 5 bitów wiersza, MSB = lewa kolumna
    if (code < 16) return this.cg[(code & 7) * 8 + row] & 31;
    const v = HD_A00[code * 8 + row] || 0; return ((v & 1) << 4) | ((v & 2) << 2) | (v & 4) | ((v & 8) >> 2) | ((v & 16) >> 4);
  }
}
const LCD_BASE = { 2: [0, 0x40], 4: [0, 0x40, 0x14, 0x54] };
function lcdImage(key, lcd, contrast, theme, bl) {
  const W = lcd.cols * 6 - 1, H = lcd.rows * 9 - 1;
  const blink = (performance.now() % 1000) < 500;
  return fbImage(key, lcd.ver + '|' + Math.round(contrast * 20) + '|' + bl + (lcd.blink || lcd.cur ? '|' + blink : ''), W, H, px => {
    const on = theme === 'blue' ? [240, 248, 255] : [20, 40, 10], off = theme === 'blue' ? [24, 66, 196] : [150, 196, 40];
    const bgk = bl ? 1 : 0.55, bg = off.map(v => v * bgk);
    for (let i = 0; i < W * H; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
    if (!lcd.disp) return;
    const base = LCD_BASE[lcd.rows];
    for (let r = 0; r < lcd.rows; r++) for (let c = 0; c < lcd.cols; c++) {
      const a = base[r] + (((c + lcd.ds) % 40) + 40) % 40, code = lcd.dd[a];
      const isCur = !lcd.cgm && a === lcd.ac;
      for (let y = 0; y < 8; y++) {
        let bits = lcd.glyph(code, y); if (isCur && lcd.cur && y === 7) bits = 31; if (isCur && lcd.blink && blink) bits = 31;
        for (let x = 0; x < 5; x++) {
          const lit = (bits >> (4 - x)) & 1, k = ((r * 9 + y) * W + c * 6 + x) * 4, a2 = lit ? contrast : 0.07 * contrast;
          for (let ch = 0; ch < 3; ch++) px[k + ch] = bg[ch] * (1 - a2) + on[ch] * a2;
        }
      }
    }
  });
}
function lcdDraw(c, r, cols, rows, x0, y0, W, H) {
  const blue = c.props.color === 'blue'; const lcd = r.lcd;
  let s = `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" rx="3" fill="#121416"/>`;
  const sx = x0 + 10, sy = y0 + 10, sw = W - 20, sh = H - 20;
  if (lcd && r.pw) s += `<image href="${lcdImage('lcd' + c.id, lcd, r.contrast == null ? 1 : r.contrast, blue ? 'blue' : 'green', r.bl ? 1 : 0)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
  else s += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${blue ? '#1c3d8a' : '#7d9a2a'}"/>`;
  return s;
}
const lcdInfo = (pl, en) => ({ pl, en });
function lcdParallel(id, cols, rows) {
  const names = ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'];
  const W = cols === 16 ? 380 : 440, H = rows === 2 ? 150 : 200;
  modPart(id, {
    cat: 'lcd', name: { pl: `LCD ${cols}×${rows} (HD44780, równoległy)`, en: `LCD ${cols}×${rows} (HD44780, parallel)` }, sub: { pl: 'Wyświetlacz tekstowy, 16 pinów', en: 'Character display, 16 pins' }, kw: `lcd ${cols}x${rows} hd44780 liquidcrystal tekstowy character display 16${cols === 16 ? '02' : '04'}`,
    pins: names.map(n => [n, { VSS: 'VSS (GND)', VDD: 'VDD (+5 V)', V0: { pl: 'V0 (kontrast)', en: 'V0 (contrast)' }, RS: 'RS', RW: 'RW', E: 'E', A: { pl: 'A (podświetlenie +)', en: 'A (backlight +)' }, K: { pl: 'K (podświetlenie −)', en: 'K (backlight −)' } }[n] || n]),
    w: W, h: H, title: '', col: '#1d6b3a', props: { color: 'green' },
    ui: [{ k: 'color', type: 'seg', l: { pl: 'Kolor', en: 'Colour' }, opts: [['green', { pl: 'Zielony', en: 'Green' }], ['blue', { pl: 'Niebieski', en: 'Blue' }]] }],
    info: { pl: `Wyświetla ${rows} linie po ${cols} znaków. W Arduino: biblioteka LiquidCrystal, zwykle w trybie 4-bitowym (RS, E, D4–D7). V0 ustala kontrast – podłącz do masy lub do suwaka potencjometru 10 kΩ. RW do masy. Podświetlenie: A przez rezystor 220 Ω do +5 V, K do masy.`, en: `Shows ${rows} lines of ${cols} characters. In Arduino: the LiquidCrystal library, usually in 4-bit mode (RS, E, D4–D7). V0 sets the contrast – connect it to ground or to a 10 kΩ potentiometer wiper. RW to ground. Backlight: A through a 220 Ω resistor to +5 V, K to ground.` },
    inner: (c, r, pk) => lcdDraw(c, r, cols, rows, pk.x0 + 20, -H + 22, pk.W - 40, H - 62),
    extra: {
      sim: {
        supply: [1, 0], int: 1,
        init(d) { d.s.lcd = new HD44780(cols, rows); d.s.lcd.busyTo = 0.015; for (let p = 3; p <= 13; p++) eListen(d, p); },
        lin(d, S) { S.G(14, 16, 1 / 30); },
        nl(d, v) { const o = new Array(v.length).fill(0); const i = diodeI(v[16] - v[15], ledIs(3.0), 2); o[16] += i; o[15] -= i; return o; },
        onIn(d, p, lvl, old) {
          if (!d.pw) return; const L = d.s.lcd, rw = d.inl[4] === 1, rs = d.inl[3] === 1 ? 1 : 0;
          // odczyt (RW = 1): przy E = 1 układ wystawia dane na D7–D0 (w trybie 4-bitowym kolejno starsza i młodsza połówka)
          if (p === 5 && lvl === 1 && rw) {
            let b; if (L.dl8) b = L.read(rs, eNow()); else { if (L.rnib === null) { L.rbyte = L.read(rs, eNow()); L.rnib = 1; b = L.rbyte; } else { b = (L.rbyte << 4) & 0xf0; L.rnib = null; } }
            for (let k = L.dl8 ? 0 : 4; k < 8; k++) eDrive(d, 6 + k, (b >> k) & 1, 200, 1, 0); d.s.rd = true; return;
          }
          if ((p === 5 && lvl === 0) || (p === 4 && lvl === 0)) { if (d.s.rd) { d.s.rd = false; for (let k = 0; k < 8; k++) eDrive(d, 6 + k, null, 200, 1, 0); } }
          if (p === 5 && lvl === 0 && old === 1 && !rw) { let b = 0; for (let k = 0; k < 8; k++) b |= (d.inl[6 + k] === 1 ? 1 : 0) << k; L.bus(rs, b, eNow()); }
        },
        commit(d) { const vdd = dVp(d, 1, 0); d.s.pw = vdd > 4; d.s.contrast = clamp(1 - (dVp(d, 2, 0) - 0.4) / 3.2, 0, 1); d.s.bl = (dV(d, 14) - dV(d, 16)) / 30 > 0.002; d.s.warn = d.s.pw && d.s.contrast < 0.15 ? 'lcdContrast' : d.s.lcd && d.s.lcd.lost ? 'lcdBusy' : null; },
        power(d, on) { if (on) { d.s.lcd = new HD44780(cols, rows); d.s.lcd.busyTo = E.t + 0.015; } },
      },
    },
  });
}
lcdParallel('lcd1602', 16, 2); lcdParallel('lcd2004', 20, 4);
function lcdI2C(id, cols, rows) {
  const W = cols === 16 ? 380 : 440, H = rows === 2 ? 150 : 200;
  modPart(id, {
    cat: 'lcd', name: { pl: `LCD ${cols}×${rows} z konwerterem I2C`, en: `LCD ${cols}×${rows} with I2C backpack` }, sub: { pl: 'HD44780 + PCF8574, tylko 4 przewody', en: 'HD44780 + PCF8574, only 4 wires' }, kw: `lcd i2c ${cols}x${rows} pcf8574 liquidcrystal_i2c hd44780 tekstowy character`,
    pins: ['GND', 'VCC', 'SDA', 'SCL'], w: W, h: H, title: '', col: '#1d6b3a', props: { color: 'blue', addr: 0x27 },
    ui: [{ k: 'color', type: 'seg', l: { pl: 'Kolor', en: 'Colour' }, opts: [['green', { pl: 'Zielony', en: 'Green' }], ['blue', { pl: 'Niebieski', en: 'Blue' }]] },
      { k: 'addr', type: 'seg', l: { pl: 'Adres I2C', en: 'I2C address' }, opts: [[0x27, '0x27'], [0x3f, '0x3F']] }],
    info: { pl: 'Ten sam wyświetlacz tekstowy, ale z przylutowanym układem PCF8574 – sterujesz nim tylko dwoma liniami SDA i SCL (w Uno: A4 i A5). Biblioteka LiquidCrystal_I2C, adres zwykle 0x27.', en: 'The same character display with a PCF8574 soldered on – you drive it with just two lines, SDA and SCL (on the Uno: A4 and A5). LiquidCrystal_I2C library, address usually 0x27.' },
    inner: (c, r, pk) => lcdDraw(c, r, cols, rows, pk.x0 + 20, -H + 22, pk.W - 40, H - 62) + `<rect x="-10" y="-40" width="80" height="14" rx="2" fill="#1f4f9e"/>` + tx(30, -30, 'PCF8574 ' + '0x' + c.props.addr.toString(16).toUpperCase(), { s: 6, c: '#e7ecf2', f: FONT_M }),
    extra: {
      i2c: { sda: 2, scl: 3, addr: x => x.c.props.addr, write(x, v) { const p = x.s.last || 0; x.s.last = v; x.s.bl = (v >> 3) & 1; if ((p & 4) && !(v & 4) && !(v & 2)) x.s.lcd.bus(v & 1, v & 0xf0); if (!(p & 4) && (v & 4) && (v & 2)) { const L = x.s.lcd; if (L.rnib === null) { L.rbyte = L.read(v & 1); L.rnib = 1; x.s.rd = L.rbyte & 0xf0; } else { x.s.rd = (L.rbyte << 4) & 0xf0; L.rnib = null; } } }, read: x => ((x.s.last || 0) & 0x0f) | ((x.s.last & 2) ? (x.s.rd || 0) : ((x.s.last || 0) & 0xf0)) },
      sim: { supply: [1, 0], init(d) { d.s.lcd = new HD44780(cols, rows); d.s.contrast = 1; }, lin(d, S) { if (dVp(d, 1, 0) > 3) S.G(1, 0, 1 / 250); }, commit(d) { d.s.pw = dVp(d, 1, 0) > 4; } },
    },
  });
}
lcdI2C('lcd1602i2c', 16, 2); lcdI2C('lcd2004i2c', 20, 4);

/* ---------- wyświetlacze graficzne monochromatyczne ---------- */
function monoImage(key, ver, W, H, get, col, invert) {
  return fbImage(key, ver, W, H, px => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let on = get(x, y); if (invert) on = !on; const c = on ? (typeof col === 'function' ? col(x, y) : col) : [8, 10, 14]; const k = (y * W + x) * 4; px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255;
    }
  });
}
const OLED_COL = { white: [235, 245, 255], blue: [80, 190, 255], yb: (x, y) => y < 16 ? [255, 214, 60] : [80, 190, 255] };
const SSD_ARGS = { 0x81: 1, 0x20: 1, 0x21: 2, 0x22: 2, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1, 0x8d: 1, 0x26: 6, 0x27: 6, 0x29: 5, 0x2a: 5, 0xa3: 2 };
class SSD1306 {
  constructor(W, H, sh1106) { this.W = W; this.H = H; this.sh = sh1106; this.ram = new Uint8Array((sh1106 ? 132 : 128) * 8); this.mode = 2; this.c0 = 0; this.c1 = 127; this.p0 = 0; this.p1 = 7; this.col = 0; this.page = 0; this.on = 0; this.inv = 0; this.segRemap = 0; this.comRev = 0; this.ver = 0; this.args = []; this.need = 0; this.cmd = 0; this.ctl = 0; this.contrast = 0xcf; }
  command(v) {
    if (this.need) { this.args.push(v); if (--this.need === 0) this.exec(this.cmd, this.args); return; }
    const n = SSD_ARGS[v]; if (n && !(this.sh && (v === 0x20 || v === 0x21 || v === 0x22))) { this.cmd = v; this.args = []; this.need = n; return; }
    this.exec(v, []);
  }
  exec(v, a) {
    if (v === 0xae) this.on = 0; else if (v === 0xaf) this.on = 1; else if (v === 0xa6) this.inv = 0; else if (v === 0xa7) this.inv = 1;
    else if (v === 0xa0) this.segRemap = 0; else if (v === 0xa1) this.segRemap = 1; else if (v === 0xc0) this.comRev = 0; else if (v === 0xc8) this.comRev = 1;
    else if (v === 0x81) this.contrast = a[0];
    else if (v === 0x20) this.mode = a[0] & 3; else if (v === 0x21) { this.c0 = a[0] & 127; this.c1 = a[1] & 127; this.col = this.c0; } else if (v === 0x22) { this.p0 = a[0] & 7; this.p1 = a[1] & 7; this.page = this.p0; }
    else if (v >= 0xb0 && v <= 0xb7) this.page = v & 7; else if (v <= 0x0f) this.col = (this.col & 0xf0) | v; else if (v >= 0x10 && v <= 0x1f) this.col = (this.col & 0x0f) | ((v & 15) << 4);
    this.ver++;
  }
  data(v) {
    const cw = this.sh ? 132 : 128; this.ram[this.page * cw + (this.col % cw)] = v; this.ver++;
    if (this.sh || this.mode === 2) { this.col = (this.col + 1) % cw; return; }
    if (this.mode === 0) { this.col++; if (this.col > this.c1) { this.col = this.c0; this.page++; if (this.page > this.p1) this.page = this.p0; } }
    else { this.page++; if (this.page > this.p1) { this.page = this.p0; this.col++; if (this.col > this.c1) this.col = this.c0; } }
  }
  px(x, y) { const cw = this.sh ? 132 : 128; let cx = this.segRemap ? x : 127 - x; if (this.sh) cx = this.segRemap ? x + 2 : 129 - x; let cy = this.comRev ? y : this.H - 1 - y; return (this.ram[(cy >> 3) * cw + cx] >> (cy & 7)) & 1; }
}
function oledPart(id, o) {
  modPart(id, {
    cat: 'glcd', name: o.name, sub: o.sub, kw: o.kw, info: o.info, pins: ['GND', 'VCC', 'SCL', 'SDA'], w: 170, h: o.H === 32 ? 110 : 160, title: '', col: '#1b2a4a', props: { color: 'white', addr: 0x3c },
    ui: [{ k: 'color', type: 'seg', l: { pl: 'Kolor', en: 'Colour' }, opts: [['white', { pl: 'Biały', en: 'White' }], ['blue', { pl: 'Niebieski', en: 'Blue' }], ['yb', { pl: 'Żółto-niebieski', en: 'Yellow-blue' }]] },
      { k: 'addr', type: 'seg', l: { pl: 'Adres I2C', en: 'I2C address' }, opts: [[0x3c, '0x3C'], [0x3d, '0x3D']] }],
    inner: (c, r, pk) => { const sw = 150, sh = sw * o.H / 128, sx = 30 - sw / 2, sy = -(o.H === 32 ? 110 : 160) + 20; let s = `<rect x="${sx - 4}" y="${sy - 4}" width="${sw + 8}" height="${sh + 8}" fill="#0a0c10"/>`;
      if (r.oled && r.oled.on && r.pw) s += `<image href="${monoImage('ol' + c.id, r.oled.ver + c.props.color, 128, o.H, (x, y) => r.oled.px(x, y), OLED_COL[c.props.color] || OLED_COL.white, r.oled.inv)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" style="image-rendering:pixelated"/>`; return s; },
    extra: {
      i2c: { sda: 3, scl: 2, addr: x => x.c.props.addr, start(x) { x.s.ctl = null; }, write(x, v) { const o2 = x.s.oled; if (x.s.ctl === null) { x.s.ctl = v; return; } if (x.s.ctl & 0x40) o2.data(v); else o2.command(v); if (x.s.ctl & 0x80) x.s.ctl = null; }, read: () => 0 },
      sim: { supply: [1, 0], init(d) { d.s.oled = new SSD1306(128, o.H, o.sh); }, lin(d, S) { if (dVp(d, 1, 0) > 2.5) S.G(1, 0, 1 / 300); }, commit(d) { d.s.pw = dVp(d, 1, 0) > 2.8; } },
    },
  });
}
const oledInfo = { pl: 'Mały ekran OLED – każdy z pikseli świeci sam, bez podświetlenia. Sterowany przez I2C (SDA, SCL). Biblioteki: Adafruit_SSD1306 + Adafruit_GFX albo U8g2. Pozwala rysować tekst, linie, wykresy i animacje.', en: 'A small OLED screen – each pixel emits its own light, no backlight. Driven over I2C (SDA, SCL). Libraries: Adafruit_SSD1306 + Adafruit_GFX or U8g2. Draw text, lines, charts and animations.' };
oledPart('oled_128x64', { name: { pl: 'OLED SSD1306 128×64', en: 'OLED SSD1306 128×64' }, sub: { pl: '0,96", I2C', en: '0.96", I2C' }, kw: 'oled ssd1306 128x64 i2c wyswietlacz graficzny display', H: 64, info: oledInfo });
oledPart('oled_128x32', { name: { pl: 'OLED SSD1306 128×32', en: 'OLED SSD1306 128×32' }, sub: { pl: '0,91", I2C', en: '0.91", I2C' }, kw: 'oled ssd1306 128x32 i2c wyswietlacz graficzny display', H: 32, info: oledInfo });
oledPart('oled_sh1106', { name: { pl: 'OLED SH1106 128×64', en: 'OLED SH1106 128×64' }, sub: { pl: '1,3", I2C', en: '1.3", I2C' }, kw: 'oled sh1106 1.3 128x64 i2c sh110x', H: 64, sh: true, info: { pl: 'Większy (1,3") ekran OLED ze sterownikiem SH1106 – podobny do SSD1306, ale ma pamięć 132 kolumn i tylko adresowanie stronami. Biblioteki: Adafruit_SH110X (SH1106G) albo U8g2.', en: 'A larger (1.3") OLED with the SH1106 controller – similar to SSD1306 but with 132-column memory and page addressing only. Libraries: Adafruit_SH110X (SH1106G) or U8g2.' } });

/* ---------- Nokia 5110 (PCD8544) ---------- */
class PCD8544 { constructor() { this.ram = new Uint8Array(84 * 6); this.x = 0; this.y = 0; this.H = 0; this.V = 0; this.mode = 0; this.vop = 0; this.ver = 0; this.pd = 1; }
  cmd(v) { if (v & 0x20 && v < 0x40) { this.pd = (v >> 2) & 1; this.V = (v >> 1) & 1; this.H = v & 1; return; } if (this.H) { if (v & 0x80) this.vop = v & 127; return; } if (v & 0x80) this.x = (v & 127) % 84; else if (v & 0x40) this.y = (v & 7) % 6; else if (v & 0x08) this.mode = ((v >> 1) & 2) | (v & 1); this.ver++; }
  data(v) { this.ram[this.y * 84 + this.x] = v; this.ver++; if (this.V) { this.y++; if (this.y > 5) { this.y = 0; this.x = (this.x + 1) % 84; } } else { this.x++; if (this.x > 83) { this.x = 0; this.y = (this.y + 1) % 6; } } }
  px(x, y) { const b = (this.ram[(y >> 3) * 84 + x] >> (y & 7)) & 1; return this.mode === 3 ? !b : this.mode === 2 ? b : this.mode === 1 ? 1 : 0; }
}
(function () {
  const o = { pins: ['RST', 'CE', 'DC', 'DIN', 'CLK', 'VCC', 'BL', 'GND'] };
  const sp = { cs: 1, sck: 4, mosi: 3, byte(x, v) { if (!x.s.lcd) return; if (pinLevel(x, 2)) x.s.lcd.data(v); else x.s.lcd.cmd(v); } };
  modPart('nokia5110', {
    cat: 'glcd', name: { pl: 'Nokia 5110 (PCD8544)', en: 'Nokia 5110 (PCD8544)' }, sub: { pl: '84×48, SPI', en: '84×48, SPI' }, kw: 'nokia 5110 pcd8544 84x48 lcd graficzny spi', pins: o.pins, w: 200, h: 190, title: '', col: '#1f4f9e',
    info: { pl: 'Kultowy wyświetlacz z telefonu Nokia: 84×48 pikseli, bardzo mały pobór prądu. Sterowany przez SPI (DIN, CLK) plus DC (dane/komendy), CE (wybór) i RST. Biblioteka Adafruit_PCD8544 – działa też programowe SPI na dowolnych pinach. Zasilanie 3,3 V (moduły zwykle tolerują 5 V).', en: 'The cult Nokia phone display: 84×48 pixels, very low power. Driven over SPI (DIN, CLK) plus DC (data/command), CE (select) and RST. Adafruit_PCD8544 library – software SPI on any pins works too. 3.3 V supply (modules usually tolerate 5 V).' },
    inner: (c, r, pk) => { const sx = pk.x0 + 16, sy = -172, sw = pk.W - 32, sh = sw * 48 / 84; let s = `<rect x="${sx - 6}" y="${sy - 6}" width="${sw + 12}" height="${sh + 12}" rx="3" fill="#9aa392"/>`;
      if (r.lcd && r.pw) s += `<image href="${monoImage('nk' + c.id, r.lcd.ver, 84, 48, (x, y) => r.lcd.px(x, y), [30, 38, 30], false)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" style="image-rendering:pixelated;opacity:${r.lcd.pd ? 0.15 : 1}"/>`.replace('[30,38,30]', ''); return s; },
    extra: {
      spi: sp,
      sim: { supply: [5, 7], init(d) { d.s.lcd = new PCD8544(); spiListen(d, sp); eListen(d, 0); }, lin(d, S) { S.G(0, 5, 1 / 10000); if (dVp(d, 5, 7) > 2.5) S.G(5, 7, 1 / 2000); },
        onIn(d, p, lvl, old) { if (p === 0 && lvl === 0) d.s.lcd = new PCD8544(); else spiPinIn(d, sp, p, lvl, old); }, commit(d) { d.s.pw = dVp(d, 5, 7) > 2.6; } },
    },
  });
})();
/* ---------- ST7920 128×64 (tryb szeregowy) ---------- */
// ST7920 (Sitronix): tryb tekstowy (DDRAM 4×8 słów, znaki 8×16 z HCGROM, CGRAM 4×16×16) i graficzny (GDRAM 128×64),
// interfejs równoległy 8/4-bitowy (PSB = 1) albo szeregowy (PSB = 0, RS = CS, R/W = SID, E = SCLK), czasy wykonania 72 µs / 1,6 ms
class ST7920 {
  constructor() { this.g = new Uint16Array(32 * 16); this.dd = new Uint16Array(64).fill(0x2020); this.cg = new Uint16Array(64); this.re = 0; this.gon = 0; this.disp = 0; this.cur = 0; this.blink = 0; this.id = 1;
    this.ac = 0; this.cgm = false; this.ya = 0; this.xa = 0; this.addrStep = 0; this.ver = 0; this.st = 0; this.rs = 0; this.hi = 0; this.wb = 0; this.dl8 = true; this.nib = null; this.rnib = null; this.busyTo = 0; this.lastWT = -1; this.lost = 0; }
  busy(t) { return t < this.busyTo; }
  // szeregowo: bajt synchronizacji 11111 RW RS 0, potem każdy bajt jako dwie połówki (bity 7–4)
  byte(b) { if ((b & 0xf8) === 0xf8 && this.st !== 2) { this.rs = (b >> 1) & 1; this.st = 1; return; } if (this.st === 1) { this.hi = b & 0xf0; this.st = 2; return; } if (this.st === 2) { this.exec(this.rs, this.hi | (b >> 4)); this.st = 1; } }
  bus(rs, byte, t) { if (this.dl8) this.exec(rs, byte, t); else if (this.nib === null) this.nib = byte >> 4; else { this.exec(rs, (this.nib << 4) | (byte >> 4), t); this.nib = null; } }
  exec(rs, v, t) {
    if (t !== undefined && t !== this.lastWT && this.busy(t)) { this.lost++; this.lastWT = t; return; }
    if (t !== undefined) this.lastWT = t;
    this.ver++; let ex = 72e-6;
    if (!rs) {
      if ((v & 0xe0) === 0x20) { this.dl8 = !!(v & 0x10); if (!this.dl8) this.nib = null; this.re = (v >> 2) & 1; if (this.re) this.gon = (v >> 1) & 1; }
      else if (this.re) {
        if (v & 0x80) { if (this.addrStep === 0) { this.ya = v & 63; this.addrStep = 1; } else { this.xa = v & 15; this.addrStep = 0; this.wb = 0; } }
      } else {
        if (v & 0x80) { this.ac = v & 0x3f; this.cgm = false; this.wb = 0; }
        else if (v & 0x40) { this.ac = v & 0x3f; this.cgm = true; this.wb = 0; }
        else if (v & 0x10) { if (!(v & 8)) this.ac = (this.ac + ((v & 4) ? 1 : -1)) & 0x3f; }
        else if (v & 0x08) { this.disp = (v >> 2) & 1; this.cur = (v >> 1) & 1; this.blink = v & 1; }
        else if (v & 0x04) { this.id = (v >> 1) & 1; }
        else if (v & 0x02) { this.ac = 0; this.wb = 0; }
        else if (v === 0x01) { this.dd.fill(0x2020); this.ac = 0; this.wb = 0; ex = 1.6e-3; }
      }
    } else if (this.re) {
      const i = (this.ya & 31) * 16 + (this.xa & 15);
      if (!this.wb) { this.g[i] = (this.g[i] & 0xff) | (v << 8); this.wb = 1; } else { this.g[i] = (this.g[i] & 0xff00) | v; this.wb = 0; this.xa = (this.xa + 1) & 15; }
    } else {
      const arr = this.cgm ? this.cg : this.dd, i = this.ac & 0x3f;
      if (!this.wb) { arr[i] = (arr[i] & 0xff) | (v << 8); this.wb = 1; } else { arr[i] = (arr[i] & 0xff00) | v; this.wb = 0; this.ac = (this.ac + (this.id ? 1 : -1)) & 0x3f; }
    }
    if (t !== undefined) this.busyTo = t + ex;
  }
  read(rs, t) { if (!rs) return (this.busy(t || 0) ? 0x80 : 0) | (this.ac & 0x7f); const w = this.dd[this.ac & 0x3f]; const v = this.wb ? w & 0xff : w >> 8; if (this.wb) this.ac = (this.ac + 1) & 0x3f; this.wb ^= 1; return v; }
  // piksel znaku 8×16 z HCGROM: rozciągnięty krój 5×7 (2× w pionie)
  hc(code, x, y) { if (code < 0x20 || code > 0x7e || x < 1 || x > 5 || y < 1 || y > 14) return 0; return (FONT5[code * 5 + x - 1] >> ((y - 1) >> 1)) & 1; }
  textPx(x, y) {
    if (!this.disp) return 0;
    const row = y >> 4, base = [0, 16, 8, 24][row], w = this.dd[base + (x >> 4)], xx = x & 15, yy = y & 15;
    if (w < 0x0100 && (w & 0xfff9) === 0 && (w >> 8) === 0 && w !== 0x2020 && w <= 6) { return (this.cg[(w >> 1) * 16 + yy] >> (15 - xx)) & 1; } // znak z CGRAM (0000, 0002, 0004, 0006)
    const hi = w >> 8, lo = w & 255;
    if (hi >= 0xa1) return (xx === 0 || xx === 15 || yy === 0 || yy === 15) ? 1 : 0; // znak chiński (GB2312) – brak kroju, ramka
    return xx < 8 ? this.hc(hi, xx, yy) : this.hc(lo, xx - 8, yy);
  }
  gpx(x, y) { if (!this.gon) return 0; const yy = y & 31, xx = (x >> 4) + (y >= 32 ? 8 : 0); return (this.g[yy * 16 + xx] >> (15 - (x & 15))) & 1; }
  px(x, y) { return this.gpx(x, y) | this.textPx(x, y); }
}
(function () {
  const names = ['GND', 'VCC', 'V0', 'RS', 'R/W', 'E', 'DB0', 'DB1', 'DB2', 'DB3', 'DB4', 'DB5', 'DB6', 'DB7', 'PSB', 'NC', 'RST', 'VOUT', 'BLA', 'BLK'];
  const sp = { cs: 3, sck: 5, mosi: 4, csHigh: true, byte(x, v) { if (x.s.lcd && !x.s.par) x.s.lcd.byte(v); } };
  modPart('st7920', {
    cat: 'glcd', name: { pl: 'LCD 128×64 ST7920', en: 'LCD 128×64 ST7920' }, sub: { pl: 'graficzny i tekstowy, równoległy lub szeregowy', en: 'graphic and text, parallel or serial' }, kw: 'st7920 12864 lcd graficzny 128x64 u8g2 ender tekstowy',
    pins: names.map(n => [n, { 'RS': { pl: 'RS (CS w trybie szeregowym)', en: 'RS (CS in serial mode)' }, 'R/W': { pl: 'R/W (SID – dane szeregowe)', en: 'R/W (SID – serial data)' }, 'E': { pl: 'E (SCLK – zegar szeregowy)', en: 'E (SCLK – serial clock)' }, 'PSB': { pl: 'PSB (plus = równoległy, masa = szeregowy)', en: 'PSB (plus = parallel, ground = serial)' }, 'BLA': { pl: 'BLA (podświetlenie +)', en: 'BLA (backlight +)' }, 'BLK': { pl: 'BLK (podświetlenie −)', en: 'BLK (backlight −)' } }[n] || n]), w: 460, h: 260, title: '', col: '#1f4f9e',
    info: { pl: 'Duży wyświetlacz 128×64 (znany z drukarek 3D) ze sterownikiem ST7920: tryb tekstowy (4 linie po 16 znaków 8×16, adresy linii 0x80, 0x90, 0x88, 0x98) i graficzny (GDRAM). PSB do plusa – interfejs równoległy 8- lub 4-bitowy (RS, R/W, E, DB0–DB7); PSB do masy – szeregowy (RS = CS, R/W = dane, E = zegar). Biblioteka U8g2 (np. U8G2_ST7920_128X64_F_SW_SPI). Chińskie znaki z wbudowanej pamięci są pokazywane jako ramki.', en: 'A large 128×64 display (known from 3D printers) with the ST7920 controller: text mode (4 lines of 16 characters 8×16, line addresses 0x80, 0x90, 0x88, 0x98) and graphics (GDRAM). PSB to plus – 8- or 4-bit parallel interface (RS, R/W, E, DB0–DB7); PSB to ground – serial (RS = CS, R/W = data, E = clock). U8g2 library (e.g. U8G2_ST7920_128X64_F_SW_SPI). Built-in Chinese characters are shown as boxes.' },
    inner: (c, r, pk) => { const sw = 360, sh = 180, sx = 190 - sw / 2, sy = -242; let s = `<rect x="${sx - 6}" y="${sy - 6}" width="${sw + 12}" height="${sh + 12}" fill="#0b0c0e"/>`; if (r.lcd && r.pw) s += `<image href="${monoImage('st' + c.id, r.lcd.ver + '|' + (r.bl ? 1 : 0), 128, 64, (x, y) => r.lcd.px(x, y), [235, 245, 255], false)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" style="image-rendering:pixelated;opacity:${r.bl ? 1 : 0.55}"/>`; else s += `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#1c3d8a"/>`; return s; },
    extra: { spi: sp, sim: { supply: [1, 0],
      init(d) { d.s.lcd = new ST7920(); d.s.lcd.busyTo = 0.04; spiListen(d, sp); for (let p = 6; p <= 16; p++) eListen(d, p); },
      lin(d, S) { S.G(16, 1, 1 / 10000); S.G(14, 1, 1 / 10000); S.G(18, 19, 1 / 30); },
      onIn(d, p, lvl, old) {
        if (p === 16) { if (lvl === 0) d.s.lcd = new ST7920(); return; }
        d.s.par = d.inl[14] !== 0; // PSB (podciągnięty do plusa)
        if (!d.s.par) { spiPinIn(d, sp, p, lvl, old); return; }
        const L = d.s.lcd, rw = d.inl[4] === 1, rs = d.inl[3] === 1 ? 1 : 0;
        if (p === 5 && lvl === 1 && rw) { let b; if (L.dl8) b = L.read(rs, eNow()); else { if (L.rnib === null) { L.rbyte = L.read(rs, eNow()); L.rnib = 1; b = L.rbyte; } else { b = (L.rbyte << 4) & 0xf0; L.rnib = null; } } for (let k = L.dl8 ? 0 : 4; k < 8; k++) eDrive(d, 6 + k, (b >> k) & 1, 200, 1, 0); d.s.rd = true; return; }
        if ((p === 5 || p === 4) && lvl === 0 && d.s.rd) { d.s.rd = false; for (let k = 0; k < 8; k++) eDrive(d, 6 + k, null, 200, 1, 0); }
        if (p === 5 && lvl === 0 && old === 1 && !rw) { let b = 0; for (let k = 0; k < 8; k++) b |= (d.inl[6 + k] === 1 ? 1 : 0) << k; L.bus(rs, b, eNow()); }
      },
      commit(d) { d.s.pw = dVp(d, 1, 0) > 4; d.s.bl = (dV(d, 18) - dV(d, 19)) > 2; d.s.warn = d.s.lcd && d.s.lcd.lost ? 'lcdBusy' : null; } } },
  });
})();

/* ---------- kolorowe TFT ---------- */
// sterowniki ST7735 / ILI9163 / ILI9341: okno adresowe, MADCTL (MX, MY, MV, BGR), COLMOD 16/18 bitów, przewijanie w pionie,
// uśpienie (SLPIN/SLPOUT), tryb bezczynny (8 kolorów), odczyt rejestrów (RDDID, RDDPM, RDDMADCTL…, ID4 przez 0xD9)
class TFT {
  constructor(W, H, kind, o) { o = o || {}; this.RW = o.ramW || W; this.RH = o.ramH || H; this.win = o.win || [0, 0]; this.W = W; this.H = H; this.k = kind; this.pbgr = !!o.panelBGR;
    this.fb = new Uint16Array(this.RW * this.RH); this.cmd = 0; this.args = []; this.x0 = 0; this.x1 = this.RW - 1; this.y0 = 0; this.y1 = this.RH - 1; this.cx = 0; this.cy = 0; this.mad = 0; this.wr = false; this.pb = []; this.ver = 0; this.inv = 0; this.on = 0; this.sleep = 1; this.idle = 0; this.bpp = 18;
    this.tfa = 0; this.vsa = this.RH; this.bfa = 0; this.vsp = 0; this.rq = []; this.rdi = 0; this.ids = o.ids || [0x5c, 0x89, 0xf0]; }
  command(v) {
    const prev = this.cmd; this.cmd = v; this.args = []; this.pb = []; this.wr = v === 0x2c || v === 0x3c;
    if (v === 0x2c) { this.cx = this.x0; this.cy = this.y0; }
    else if (v === 0x29) this.on = 1; else if (v === 0x28) this.on = 0; else if (v === 0x21) this.inv = 1; else if (v === 0x20) this.inv = 0;
    else if (v === 0x11) this.sleep = 0; else if (v === 0x10) this.sleep = 1; else if (v === 0x39) this.idle = 1; else if (v === 0x38) this.idle = 0;
    else if (v === 0x13) { this.tfa = 0; this.vsa = this.RH; this.bfa = 0; this.vsp = 0; }
    else if (v === 0x01) { this.mad = 0; this.on = 0; this.sleep = 1; this.inv = 0; this.idle = 0; this.bpp = 18; this.vsp = 0; this.tfa = 0; this.vsa = this.RH; }
    // odczyty: pierwszy bajt jest „pusty” (dummy); przez 0xD9 można wybrać indeks bajtu (ILI9341, Adafruit readcommand8)
    const st = (this.on ? 4 : 0) | (this.sleep ? 0 : 0x10) | (this.idle ? 0x40 : 0) | 0x08 | 0x80;
    const R = { 0x04: [0, ...this.ids], 0x09: [0, 0x80 | (this.mad & 0x7c) >> 1, this.bpp === 16 ? 0x50 : 0x60, this.inv ? 0x20 : 0, 0], 0x0a: [0, st], 0x0b: [0, this.mad], 0x0c: [0, this.bpp === 16 ? 0x05 : 0x06], 0x0d: [0, this.inv ? 0x20 : 0], 0x0e: [0, 0], 0x0f: [0, 0xc0], 0xd3: [0, 0x00, 0x93, 0x41], 0xda: [0, this.ids[0]], 0xdb: [0, this.ids[1]], 0xdc: [0, this.ids[2]] };
    if (R[v]) { this.rq = R[v].slice(); if (prev === 0xd9 && this.rdi) { this.rq = [this.rq[this.rdi] ?? 0]; this.rdi = 0; } }
    else this.rq = [];
  }
  readByte() { return this.rq.length ? this.rq.shift() : 0; }
  data(v) {
    if (this.wr) {
      this.pb.push(v);
      if (this.bpp === 16 && this.pb.length === 2) { this.pix((this.pb[0] << 8) | this.pb[1]); this.pb = []; }
      else if (this.bpp !== 16 && this.pb.length === 3) { const [r, g, b] = this.pb; this.pix(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)); this.pb = []; }
      return;
    }
    this.args.push(v); const a = this.args;
    if (this.cmd === 0x2a && a.length === 4) { this.x0 = (a[0] << 8) | a[1]; this.x1 = (a[2] << 8) | a[3]; }
    else if (this.cmd === 0x2b && a.length === 4) { this.y0 = (a[0] << 8) | a[1]; this.y1 = (a[2] << 8) | a[3]; }
    else if (this.cmd === 0x36 && a.length === 1) this.mad = a[0];
    else if (this.cmd === 0x3a && a.length === 1) this.bpp = (a[0] & 7) === 5 ? 16 : 18;
    else if (this.cmd === 0x33 && a.length === 6) { this.tfa = (a[0] << 8) | a[1]; this.vsa = (a[2] << 8) | a[3]; this.bfa = (a[4] << 8) | a[5]; }
    else if (this.cmd === 0x37 && a.length === 2) this.vsp = (a[0] << 8) | a[1];
    else if (this.cmd === 0xd9 && a.length === 1) this.rdi = a[0] & 15;
    if (this.cmd === 0x36 || this.cmd === 0x3a || this.cmd === 0x37 || this.cmd === 0x33) this.ver++;
  }
  pix(c) {
    const mx = this.mad & 0x40, my = this.mad & 0x80, mv = this.mad & 0x20;
    let a = this.cx, b = this.cy; if (mv) { const t2 = a; a = b; b = t2; }
    const px = mx ? a : this.RW - 1 - a;
    const py = this.k === 'ili' ? (my ? this.RH - 1 - b : b) : (my ? b : this.RH - 1 - b);
    // kolejność RGB/BGR: bit 3 MADCTL względem sposobu połączenia matrycy
    if (!!(this.mad & 8) !== this.pbgr) c = ((c & 31) << 11) | (c & 0x7e0) | (c >> 11);
    if (px >= 0 && px < this.RW && py >= 0 && py < this.RH) this.fb[py * this.RW + px] = c;
    this.ver++;
    this.cx++; if (this.cx > this.x1) { this.cx = this.x0; this.cy++; if (this.cy > this.y1) this.cy = this.y0; }
  }
  // wiersz pamięci pokazywany w danym wierszu ekranu (przewijanie w pionie)
  srcRow(r) { if (this.vsa > 0 && r >= this.tfa && r < this.tfa + this.vsa && this.vsp >= this.tfa) return this.tfa + ((r - this.tfa) + (this.vsp - this.tfa)) % this.vsa; return r; }
}
function tftImage(key, t2) {
  return fbImage(key, t2.ver + '|' + (t2.on && !t2.sleep), t2.W, t2.H, px => {
    const fb = t2.fb, [ox, oy] = t2.win, vis = t2.on && !t2.sleep;
    for (let y = 0; y < t2.H; y++) { const sy = t2.k === 'ili' ? t2.srcRow(y + oy) : y + oy; for (let x = 0; x < t2.W; x++) {
      let v = vis ? fb[sy * t2.RW + x + ox] : 0; if (t2.inv && vis) v ^= 0xffff; const k = (y * t2.W + x) * 4;
      let r = ((v >> 11) & 31) * 255 / 31, g = ((v >> 5) & 63) * 255 / 63, b = (v & 31) * 255 / 31;
      if (t2.idle) { r = r >= 128 ? 255 : 0; g = g >= 128 ? 255 : 0; b = b >= 128 ? 255 : 0; }
      px[k] = r; px[k + 1] = g; px[k + 2] = b; px[k + 3] = 255; } }
  });
}
function tftPart(id, o) {
  const names = o.pins;
  const ix = n => names.indexOf(n);
  const sp = { cs: ix('CS'), sck: ix('SCK'), mosi: ix(o.mosi || 'SDA'), miso: o.miso ? ix(o.miso) : null, key: 'd', pre: x => x.s.tft ? x.s.tft.readByte() : 0, byte(x, v) { if (!x.s.tft) return; if (pinLevel(x, ix(o.dc))) x.s.tft.data(v); else x.s.tft.command(v); } };
  const specs = [sp];
  if (o.touch) specs.push({ key: 't', cs: ix('T_CS'), sck: ix('T_CLK'), mosi: ix('T_DIN'), miso: ix('T_DO'), pre: x => { const q = x.s.tq; return q && q.length ? q[0] : 0; }, byte(x, v) { const q = x.s.tq || (x.s.tq = []); if (q.length) q.shift(); if (v & 0x80) { const ch = (v >> 4) & 7, T = x.s.touch; let val = 0; if (T) val = ch === 5 ? T.x : ch === 1 ? T.y : ch === 3 ? 900 : ch === 4 ? 1500 : 0; else val = ch === 4 ? 4095 : 0; q.length = 0; q.push((val >> 5) & 0x7f, (val << 3) & 0xf8); } } });
  const sw = o.sw, sh = sw * o.H / o.W;
  modPart(id, {
    cat: 'tft', name: o.name, sub: o.sub, kw: o.kw, info: o.info, pins: names.map(n => [n, { A0: 'A0 (DC)', DC: 'DC (A0)', SDA: 'SDA (MOSI)', LED: { pl: 'LED (podświetlenie)', en: 'LED (backlight)' } }[n] || n]), w: Math.max(sw + 40, (names.length - 1) * 20 + 30), h: sh + 60, title: '', col: '#b8262c',
    inner: (c, r, pk) => { const sx = (names.length - 1) * 10 - sw / 2, sy = -sh - 46; let s = `<rect x="${sx - 5}" y="${sy - 5}" width="${sw + 10}" height="${sh + 10}" fill="#050607"/>`; if (r.tft && r.pw) s += `<image href="${tftImage('tf' + c.id, r.tft)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" style="image-rendering:pixelated" data-touch="1"/>`; return s; },
    extra: {
      spi: specs.length > 1 ? specs : sp, touch: o.touch ? { area: () => ({ sx: (names.length - 1) * 10 - sw / 2, sy: -sh - 46, sw, sh }) } : null,
      sim: {
        supply: [ix('VCC'), ix('GND')],
        init(d) { d.s.tft = new TFT(o.W, o.H, o.kind, o.opt); for (const b of specs) spiListen(d, b); if (o.touch) eDrive(d, ix('T_IRQ'), null, 100, ix('VCC'), ix('GND')); },
        lin(d, S) { S.G(ix('RESET'), ix('VCC'), 1 / 10000); if (dVp(d, ix('VCC'), ix('GND')) > 2.5) S.G(ix('VCC'), ix('GND'), 1 / 100); },
        onIn(d, p, lvl, old) { if (p === ix('RESET')) { if (lvl === 0) d.s.tft = new TFT(o.W, o.H, o.kind, o.opt); return; } for (const b of specs) spiPinIn(d, b, p, lvl, old); },
        commit(d) { d.s.pw = dVp(d, ix('VCC'), ix('GND')) > 2.6; if (o.touch) { const want = d.s.touch ? 0 : null; if (d.s._irq !== want) { d.s._irq = want; eDrive(d, ix('T_IRQ'), want, 100, ix('VCC'), ix('GND')); } } },
      },
    },
  });
  if (o.touch) eListen;
}
const tftInfo = (pl, en) => ({ pl: pl + ' Sterowany przez SPI: MOSI (SDA), SCK, CS oraz DC (dane/komendy) i RESET. Biblioteka Adafruit_GFX z odpowiednim sterownikiem.', en: en + ' Driven over SPI: MOSI (SDA), SCK, CS plus DC (data/command) and RESET. Adafruit_GFX with the matching driver library.' });
tftPart('tft_st7735', { name: { pl: 'TFT 1,8" ST7735 (160×128)', en: 'TFT 1.8" ST7735 (160×128)' }, sub: { pl: 'kolorowy, SPI', en: 'colour, SPI' }, kw: 'tft st7735 1.8 160x128 kolorowy color spi', pins: ['VCC', 'GND', 'CS', 'RESET', 'A0', 'SDA', 'SCK', 'LED'], dc: 'A0', W: 128, H: 160, kind: 'st', sw: 128,
  info: tftInfo('Mały kolorowy ekran 128×160 pikseli (65 tys. kolorów).', 'A small 128×160 colour screen (65k colours).') });
tftPart('tft_ili9163', { name: { pl: 'TFT 1,44" ILI9163 / ST7735 (128×128)', en: 'TFT 1.44" ILI9163 / ST7735 (128×128)' }, sub: { pl: 'kolorowy, SPI', en: 'colour, SPI' }, kw: 'tft ili9163 st7735 1.44 128x128 kolorowy color spi', pins: ['VCC', 'GND', 'CS', 'RESET', 'A0', 'SDA', 'SCK', 'LED'], dc: 'A0', W: 128, H: 128, kind: 'st', sw: 128, opt: { ramW: 132, ramH: 162, win: [2, 3], panelBGR: true, ids: [0x5c, 0x89, 0xf0] },
  info: tftInfo('Kwadratowy kolorowy ekran 128×128 pikseli. W Adafruit_ST7735 użyj initR(INITR_144GREENTAB).', 'A square 128×128 colour screen. In Adafruit_ST7735 use initR(INITR_144GREENTAB).') });
tftPart('tft_ili9341', { name: { pl: 'TFT 2,8" ILI9341 (320×240) z dotykiem', en: 'TFT 2.8" ILI9341 (320×240) with touch' }, sub: { pl: 'kolorowy, SPI, panel XPT2046', en: 'colour, SPI, XPT2046 panel' }, kw: 'tft ili9341 2.8 2.4 320x240 dotyk touch xpt2046 kolorowy color spi',
  pins: ['VCC', 'GND', 'CS', 'RESET', 'DC', 'SDI', 'SCK', 'LED', 'SDO', 'T_CLK', 'T_CS', 'T_DIN', 'T_DO', 'T_IRQ'], mosi: 'SDI', miso: 'SDO', dc: 'DC', W: 240, H: 320, kind: 'ili', sw: 180, touch: true, opt: { panelBGR: true, ids: [0x00, 0x93, 0x41] },
  info: tftInfo('Większy ekran 240×320 z rezystancyjnym panelem dotykowym XPT2046 (osobne SPI: T_CLK, T_DIN, T_DO, T_CS). W symulacji dotykasz ekranu myszką. Biblioteki: Adafruit_ILI9341 i XPT2046_Touchscreen.', 'A larger 240×320 screen with an XPT2046 resistive touch panel (separate SPI: T_CLK, T_DIN, T_DO, T_CS). In the simulation you touch it with the mouse. Libraries: Adafruit_ILI9341 and XPT2046_Touchscreen.') });

/* ---------- układy I2C: wspólne ---------- */
const addrPins = (x, list, base) => { let a = base; list.forEach((p, i) => { if (dV(x, p) - dV(x, x.P.sim.supply[1]) > 1.5) a |= 1 << i; }); return a; };
function regDev() { return { ptr: 0, first: true }; }
// --- PCF8574 (NXP): porty quasi-dwukierunkowe, INT̅ (otwarty dren) przy zmianie stanu wejścia od ostatniego odczytu/zapisu ---
logicExpander('io_pcf8574', {
  name: 'PCF8574', sub: { pl: 'Ekspander 8 pinów, I2C', en: '8-pin I/O expander, I2C' }, kw: 'pcf8574 ekspander expander i2c io pinow',
  names: ['A0', 'A1', 'A2', 'P0', 'P1', 'P2', 'P3', 'GND', 'P4', 'P5', 'P6', 'P7', 'INT̅', 'SCL', 'SDA', 'VCC'], io: [3, 4, 5, 6, 8, 9, 10, 11], sda: 14, scl: 13, vcc: 15, gnd: 7,
  info: { pl: 'Dodaje 8 pinów wejścia/wyjścia przez I2C (adres 0x20–0x27 ustalany pinami A0–A2). Zapis 0 ustawia pin w stan niski, 1 – słabe podciągnięcie ok. 100 µA (pin może być wejściem). Gdy stan wejścia zmieni się od ostatniego odczytu lub zapisu, wyjście INT̅ (otwarty dren, potrzebny rezystor do plusa) przechodzi w stan niski. W Arduino: Wire.beginTransmission(0x20); Wire.write(bajt).', en: 'Adds 8 I/O pins over I2C (address 0x20–0x27 set by pins A0–A2). Writing 0 drives a pin low, 1 gives a weak pull-up of about 100 µA (the pin can be an input). When an input changes since the last read or write, the INT̅ output (open drain, needs a pull-up resistor) goes low. In Arduino: Wire.beginTransmission(0x20); Wire.write(byte).' },
  addr: x => addrPins(x, [0, 1, 2], 0x20),
  dev: {
    write(x, v) { x.s.out = v; x.s.apply(); pcfSnap(x); },
    read(x) { let v = 0; x.s.io.forEach((p, i) => v |= pinLevel(x, p) << i); pcfSnap(x); return v; },
  },
  onIn(d, p) { if (!d.s.io.includes(p)) return; let v = 0; d.s.io.forEach((q, i) => v |= pinLevel(d, q) << i); if (v !== d.s.snap && !d.s.intOn) { d.s.intOn = true; eDrive(d, 12, 0, 60, 15, 7); } },
  init: s => { s.snap = 0xff; },
});
function pcfSnap(x) { let v = 0; x.s.io.forEach((p, i) => v |= pinLevel(x, p) << i); x.s.snap = v; if (x.s.intOn) { x.s.intOn = false; eDrive(x, 12, null, 60, 15, 7); } }
// --- MCP23017 (Microchip DS20001952): pełna mapa rejestrów (IOCON.BANK = 0 i 1), przerwania INTA/INTB, INTCAP/INTF ---
const MCPR = ['IODIR', 'IPOL', 'GPINTEN', 'DEFVAL', 'INTCON', 'IOCON', 'GPPU', 'INTF', 'INTCAP', 'GPIO', 'OLAT'];
const mcpDecode = (s, a) => { const bank = (s.iocon >> 7) & 1; if (bank) { const port = (a >> 4) & 1, k = a & 15; return k < 11 ? [MCPR[k], port] : null; } return a < 22 ? [MCPR[a >> 1], a & 1] : null; };
function mcpReset(s) { s.r = {}; for (const k of MCPR) s.r[k] = [0, 0]; s.r.IODIR = [0xff, 0xff]; s.iocon = 0; s.ptr = 0; s.first = true; }
function mcpPort(x, port) { let v = 0; for (let i = 0; i < 8; i++) v |= pinLevel(x, x.s.io[port * 8 + i]) << i; return v; }
function mcpInt(x) {
  const s = x.s, odr = (s.iocon >> 2) & 1, pol = (s.iocon >> 1) & 1, mir = (s.iocon >> 6) & 1;
  const act = [s.r.INTF[0] !== 0, s.r.INTF[1] !== 0]; if (mir) act[0] = act[1] = act[0] || act[1];
  [[19, act[0]], [18, act[1]]].forEach(([pin, on]) => { const lvl = odr ? (on ? 0 : null) : (on ? pol : 1 - pol); const key = String(lvl); if (s['_i' + pin] !== key) { s['_i' + pin] = key; eDrive(x, pin, lvl, 60, 8, 9); } });
}
function mcpCheck(x) {
  const s = x.s;
  for (let port = 0; port < 2; port++) {
    const cur = mcpPort(x, port), en = s.r.GPINTEN[port] & s.r.IODIR[port], con = s.r.INTCON[port];
    // INTCON = 1: porównanie z DEFVAL (przerwanie trwa, dopóki stan się różni), INTCON = 0: każda zmiana stanu
    const diff = ((cur ^ s.r.DEFVAL[port]) & con) | ((cur ^ s.prev[port]) & ~con);
    const hit = diff & en & 0xff;
    if (hit && !s.r.INTF[port]) { s.r.INTF[port] = hit; s.r.INTCAP[port] = cur; }
    s.prev[port] = cur;
  }
  mcpInt(x);
}
logicExpander('io_mcp23017', {
  name: 'MCP23017', sub: { pl: 'Ekspander 16 pinów, I2C', en: '16-pin I/O expander, I2C' }, kw: 'mcp23017 ekspander expander i2c io 16', n: 28,
  names: ['GPB0', 'GPB1', 'GPB2', 'GPB3', 'GPB4', 'GPB5', 'GPB6', 'GPB7', 'VDD', 'VSS', 'NC', 'SCL', 'SDA', 'NC', 'A0', 'A1', 'A2', 'RESET̅', 'INTB', 'INTA', 'GPA0', 'GPA1', 'GPA2', 'GPA3', 'GPA4', 'GPA5', 'GPA6', 'GPA7'],
  io: [20, 21, 22, 23, 24, 25, 26, 27, 0, 1, 2, 3, 4, 5, 6, 7], sda: 12, scl: 11, vcc: 8, gnd: 9, listen: [17],
  info: { pl: 'Dodaje 16 pinów (porty A i B) przez I2C, adres 0x20–0x27. Każdy pin może być wejściem (z podciąganiem 100 kΩ) lub wyjściem – rejestry IODIR, GPPU, GPIO/OLAT, odwracanie IPOL. Przerwania: GPINTEN, INTCON, DEFVAL; wyjścia INTA/INTB (polaryzacja, otwarty dren i łączenie ustawiasz w IOCON), stan zapamiętuje INTCAP. Biblioteka Adafruit_MCP23X17. RESET̅ (18) połącz z plusem.', en: 'Adds 16 pins (ports A and B) over I2C, address 0x20–0x27. Each pin can be an input (with a 100 kΩ pull-up) or an output – registers IODIR, GPPU, GPIO/OLAT, inversion IPOL. Interrupts: GPINTEN, INTCON, DEFVAL; outputs INTA/INTB (polarity, open drain and mirroring set in IOCON), the state is captured in INTCAP. Adafruit_MCP23X17 library. Tie RESET̅ (18) to plus.' },
  addr: x => addrPins(x, [14, 15, 16], 0x20),
  init: s => { mcpReset(s); s.prev = [0xff, 0xff]; },
  dev: {
    start(x, w) { x.s.first = w; },
    write(x, v) {
      const s = x.s; if (s.first) { s.ptr = v; s.first = false; return; }
      const r = mcpDecode(s, s.ptr);
      if (r) { const [k, port] = r;
        if (k === 'IOCON') s.iocon = v & 0xfe;
        else if (k === 'GPIO' || k === 'OLAT') s.r.OLAT[port] = v;
        else if (k !== 'INTF' && k !== 'INTCAP') s.r[k][port] = v;
        s.apply(); mcpCheck(x); }
      mcpNext(s);
    },
    read(x) {
      const s = x.s, r = mcpDecode(s, s.ptr); let v = 0;
      if (r) { const [k, port] = r;
        if (k === 'IOCON') v = s.iocon;
        else if (k === 'GPIO') { v = mcpPort(x, port) ^ s.r.IPOL[port]; s.r.INTF[port] = 0; }
        else if (k === 'INTCAP') { v = s.r.INTCAP[port]; s.r.INTF[port] = 0; }
        else v = s.r[k][port];
        if (k === 'GPIO' || k === 'INTCAP') { mcpCheck(x); } }
      mcpNext(s); return v;
    },
  },
  onIn(d, p, lvl) { if (p === 17) { if (lvl === 0) { mcpReset(d.s); d.s.apply(); mcpInt(d); } return; } mcpCheck(d); },
  out: s => { const res = []; for (let i = 0; i < 16; i++) { const a = i < 8 ? 0 : 1, b = i & 7; const isIn = (s.r.IODIR[a] >> b) & 1; res.push(isIn ? [null, (s.r.GPPU[a] >> b) & 1] : [(s.r.OLAT[a] >> b) & 1, 0]); } return res; },
});
// automatyczne zwiększanie adresu (SEQOP = 0); przy SEQOP = 1 w BANK 0 adres przełącza się w parze A/B
function mcpNext(s) { const seqop = (s.iocon >> 5) & 1, bank = (s.iocon >> 7) & 1; if (!seqop) s.ptr = bank ? ((s.ptr & 0x10) | (((s.ptr & 15) + 1) % 11)) : (s.ptr + 1) % 22; else if (!bank) s.ptr ^= 1; }
function logicExpander(id, o) {
  const n = o.n || 16; const pk = pkgDIP(n, o.names);
  def(id, {
    cat: 'com', name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: {}, pins: pk.pins, bbox: pk.bbox, draw: () => pk.body(o.name, ''),
    i2c: Object.assign({ sda: o.sda, scl: o.scl, addr: o.addr }, o.dev),
    sim: {
      supply: [o.vcc, o.gnd],
      init(d) { const s = d.s; s.io = o.io; s.out = 0xff; if (o.init) o.init(s); s.apply = () => { const st = o.out ? o.out(s) : o.io.map((p, i) => (s.out >> i) & 1 ? [null, 1] : [0, 0]); o.io.forEach((p, i) => eDrive(d, p, st[i][0], 60, o.vcc, o.gnd, !!st[i][1])); }; for (const p of o.io) eListen(d, p); for (const p of o.listen || []) eListen(d, p); },
      lin: o.listen ? (d, S) => { for (const p of o.listen) S.G(p, o.vcc, 1 / 20000); } : undefined,
      power(d, on) { if (on) d.s.apply(); else o.io.forEach(p => eDrive(d, p, null, 60, o.vcc, o.gnd, false)); },
      onIn(d, p, lvl, old) { if (o.onIn && d.pw) o.onIn(d, p, lvl, old); },
      commit(d) { },
    },
  });
}
// --- RTC (DS1307 / DS3231): czas liczony w czasie symulacji, start od zegara komputera (moduł z baterią) ---
const bcd = v => ((v / 10) | 0) << 4 | (v % 10), unbcd = v => (v >> 4) * 10 + (v & 15);
const wallLocal = () => Date.now() / 1000 - new Date().getTimezoneOffset() * 60;
function rtcInit(x) {
  const s = x.s, p = x.c.props;
  s.ram = new Uint8Array(x.P.rtc.nreg); if (p.ram) try { const b = atob(p.ram); for (let i = 0; i < b.length && i < s.ram.length; i++) s.ram[i] = b.charCodeAt(i); } catch (e) { }
  if (p.state === 'new' && p.off === undefined) { s.base = Date.UTC(2000, 0, 1) / 1000; s.halt = x.P.rtc.ds1307; s.osf = 1; s.dowOff = 0; }
  else { s.halt = !!p.halt; s.base = s.halt && p.haltSec ? p.haltSec : wallLocal() + (p.off || 0); s.osf = p.osf ?? (x.P.rtc.ds1307 ? 0 : 1); s.dowOff = p.dowOff ?? null; }
  s.t0 = E.t; s.haltAt = E.t; s.h12 = !!p.h12; s.lastSec = null;
  if (!x.P.rtc.ds1307 && p.ram === undefined) { s.ram[0x0e] = 0x1c; s.ram[0x0f] = 0x08; }
}
const rtcNow = s => s.base + ((s.halt ? s.haltAt : E.t) - s.t0);
function rtcFields(s) {
  const sec = Math.floor(rtcNow(s)), d = new Date(sec * 1000), days = Math.floor(sec / 86400);
  const dow = s.dowOff === null ? (d.getUTCDay() || 7) : (((days + s.dowOff) % 7) + 7) % 7 + 1;
  return { s: d.getUTCSeconds(), m: d.getUTCMinutes(), h: d.getUTCHours(), dow, D: d.getUTCDate(), M: d.getUTCMonth() + 1, Y: d.getUTCFullYear() % 100, days };
}
const rtcHour = (s, h) => s.h12 ? (0x40 | (h >= 12 ? 0x20 : 0) | bcd(h % 12 || 12)) : bcd(h);
const rtcUnHour = v => (v & 0x40) ? (unbcd(v & 0x1f) % 12) + ((v & 0x20) ? 12 : 0) : unbcd(v & 0x3f);
function rtcTimeReg(x, r) {
  const s = x.s, f = rtcFields(s);
  return [bcd(f.s) | (x.P.rtc.ds1307 && s.halt ? 0x80 : 0), bcd(f.m), rtcHour(s, f.h), f.dow, bcd(f.D), bcd(f.M), bcd(f.Y)][r];
}
function rtcSetTime(x, r, v) {
  const s = x.s, f = rtcFields(s), frac = 0;
  if (r === 0) { f.s = unbcd(v & 0x7f); if (x.P.rtc.ds1307) { const h = !!(v & 0x80); if (h && !s.halt) { s.haltAt = E.t; } s.halt = h; } }
  else if (r === 1) f.m = unbcd(v & 0x7f);
  else if (r === 2) { s.h12 = !!(v & 0x40); f.h = rtcUnHour(v); }
  else if (r === 3) { s.dowOff = ((v & 7) - 1 - f.days % 7 + 14) % 7; x.c.props.dowOff = s.dowOff; return; }
  else if (r === 4) f.D = unbcd(v & 0x3f); else if (r === 5) f.M = unbcd(v & 0x1f); else if (r === 6) f.Y = unbcd(v);
  const sec = Date.UTC(2000 + f.Y, f.M - 1, f.D, f.h, f.m, f.s) / 1000 + frac;
  const keepDow = s.dowOff; s.base = sec; s.t0 = s.halt ? s.haltAt : E.t; if (keepDow !== null) { const nd = Math.floor(sec / 86400); s.dowOff = ((f.dow - 1 - nd % 7) % 7 + 7) % 7; }
  rtcPersist(x); x.c.props.h12 = s.h12; x.c.props.dowOff = s.dowOff; x.c.props.state = 'set';
}
// bateria podtrzymuje pracę zegara między uruchomieniami: zapamiętujemy przesunięcie względem zegara komputera
function rtcPersist(x) { const s = x.s, p = x.c.props; p.halt = s.halt; if (s.halt) p.haltSec = rtcNow(s); else p.off = rtcNow(s) - wallLocal(); }
function rtcSave(x) { let b = ''; for (const v of x.s.ram) b += String.fromCharCode(v); x.c.props.ram = btoa(b); }
const rtcI2C = (nreg, sda, scl) => ({
  sda, scl, addr: () => 0x68,
  start(x, w) { x.s.first = w; },
  write(x, v) {
    const s = x.s; if (s.first) { s.ptr = v % nreg; s.first = false; return; }
    const r = s.ptr; s.ptr = (r + 1) % nreg;
    if (r < 7) return rtcSetTime(x, r, v);
    if (x.P.rtc.ds1307) { s.ram[r] = r === 7 ? v & 0x93 : v; rtcSave(x); return; }
    if (r === 0x0f) { s.osf = s.osf && (v & 0x80) ? 1 : 0; s.ram[0x0f] = (s.ram[0x0f] & ~0x0b) | (v & 0x08) | (s.ram[0x0f] & v & 0x03); x.c.props.osf = s.osf; }
    else if (r === 0x0e) s.ram[0x0e] = v & 0xdf; // CONV kończy się od razu
    else if (r <= 0x10) s.ram[r] = v;
    rtcSave(x); rtcPins(x);
  },
  read(x) {
    const s = x.s, r = s.ptr; s.ptr = (r + 1) % nreg;
    if (r < 7) return rtcTimeReg(x, r);
    if (x.P.rtc.ds1307) return s.ram[r];
    if (r === 0x0f) return (s.osf ? 0x80 : 0) | (s.ram[0x0f] & 0x0b);
    if (r === 0x11 || r === 0x12) { const q = Math.round(clamp(x.c.props.temp ?? 25, -40, 85) * 4); return r === 0x11 ? (q >> 2) & 0xff : (q & 3) << 6; }
    return s.ram[r];
  },
});
// alarmy DS3231 sprawdzane co sekundę (maski A1M1–A1M4, A2M2–A2M4, DY/DT̅)
function rtcAlarms(x, f) {
  const R = x.s.ram, h = v => rtcUnHour(v & 0x7f);
  const dd = (v, f) => (v & 0x40) ? (v & 7) === f.dow : unbcd(v & 0x3f) === f.D;
  const m1 = [7, 8, 9, 10].map(i => R[i] >> 7);
  if ((m1[0] || unbcd(R[7] & 0x7f) === f.s) && (m1[1] || unbcd(R[8] & 0x7f) === f.m) && (m1[2] || h(R[9]) === f.h) && (m1[3] || dd(R[10], f))) R[0x0f] |= 1;
  const m2 = [11, 12, 13].map(i => R[i] >> 7);
  if (f.s === 0 && (m2[0] || unbcd(R[11] & 0x7f) === f.m) && (m2[1] || h(R[12]) === f.h) && (m2[2] || dd(R[13], f))) R[0x0f] |= 2;
}
// wyjście SQW/INT̅ (otwarty dren)
function rtcPins(x) {
  const s = x.s, P = x.P.rtc; let lvl = null;
  if (P.ds1307) { const c = s.ram[7]; if (c & 0x10) { const f = [1, 4096, 8192, 32768][c & 3]; lvl = ((rtcNow(s) * f) % 1) < 0.5 ? null : 0; } else lvl = (c & 0x80) ? null : 0; }
  else { const c = s.ram[0x0e], st = s.ram[0x0f]; if (c & 4) lvl = (st & c & 3) ? 0 : null; else { const f = [1, 1024, 4096, 8192][(c >> 3) & 3]; lvl = ((rtcNow(s) * f) % 1) < 0.5 ? null : 0; } }
  if (s._sq !== lvl) { s._sq = lvl; eDrive(x, P.sqw, lvl, 60, P.vcc, P.gnd); }
}
function rtcTick(x) {
  const s = x.s, f = rtcFields(s); if (f.s !== s.lastSec) { const first = s.lastSec === null; s.lastSec = f.s; if (!x.P.rtc.ds1307 && !first) rtcAlarms(x, f); if (!first && f.s % 5 === 0) rtcPersist(x); }
  rtcPins(x);
}
(function () {
  const pk = pkgDIP(8, ['X1', 'X2', 'VBAT', 'GND', 'SDA', 'SCL', 'SQW/OUT', 'VCC']);
  def('rtc_ds1307', {
    cat: 'com', name: 'DS1307', sub: { pl: 'Zegar czasu rzeczywistego, I2C', en: 'Real-time clock, I2C' }, kw: 'ds1307 rtc zegar czasu rzeczywistego real time clock i2c', props: { state: 'set' }, pins: pk.pins, bbox: pk.bbox,
    ui: [{ k: 'state', type: 'seg', l: { pl: 'Stan początkowy', en: 'Initial state' }, opts: [['set', { pl: 'Ustawiony (z baterią)', en: 'Set (with battery)' }], ['new', { pl: 'Nowy (zatrzymany)', en: 'New (halted)' }]] }],
    info: { pl: 'Odmierza czas (sekundy, minuty, godziny 12/24 h, dzień tygodnia, datę) i ma 56 bajtów RAM podtrzymywanego baterią (VBAT). Adres I2C 0x68. Nowy układ po pierwszym włączeniu ma ustawiony bit CH (zegar zatrzymany) – w RTClib: if (!rtc.isrunning()) rtc.adjust(…). Wyjście SQW/OUT (otwarty dren): 1 Hz, 4/8/32 kHz albo stały poziom (rejestr 0x07).', en: 'Keeps time (seconds, minutes, 12/24 h hours, weekday, date) and has 56 bytes of battery-backed RAM (VBAT). I2C address 0x68. A new chip powers up with the CH bit set (clock halted) – in RTClib: if (!rtc.isrunning()) rtc.adjust(…). SQW/OUT output (open drain): 1 Hz, 4/8/32 kHz or a fixed level (register 0x07).' },
    draw: () => pk.body('DS1307', ''), i2c: rtcI2C(64, 4, 5), rtc: { nreg: 64, ds1307: true, sqw: 6, vcc: 7, gnd: 3 },
    sim: { supply: [7, 3], init(d) { rtcInit(d); }, commit(d) { rtcTick(d); } },
  });
})();
modPart('rtc_ds3231', {
  cat: 'com', name: { pl: 'DS3231 (moduł)', en: 'DS3231 (module)' }, sub: { pl: 'Precyzyjny zegar RTC, I2C', en: 'Precise RTC, I2C' }, kw: 'ds3231 rtc zegar czasu rzeczywistego real time clock i2c modul alarm temperatura', pins: ['32K', 'SQW', 'SCL', 'SDA', 'VCC', 'GND'], w: 150, h: 110, title: 'DS3231', col: '#1f4f9e',
  props: { state: 'set', temp: 22 },
  ui: [{ k: 'temp', type: 'range', live: true, l: { pl: 'Temperatura otoczenia', en: 'Ambient temperature' }, min: -20, max: 60, step: 0.25, fmt: v => dec(v, 2) + ' °C' },
    { k: 'state', type: 'seg', l: { pl: 'Stan początkowy', en: 'Initial state' }, opts: [['set', { pl: 'Ustawiony (z baterią)', en: 'Set (with battery)' }], ['new', { pl: 'Nowy', en: 'New' }]] }],
  info: { pl: 'Bardzo dokładny zegar RTC z kompensacją temperatury i baterią CR2032 na module. Adres I2C 0x68. Ma dwa alarmy (rejestry 0x07–0x0D) sygnalizowane na wyjściu SQW/INT̅ (otwarty dren, na module jest rezystor podciągający), wyjście fali prostokątnej 1 Hz–8 kHz i czujnik temperatury z rozdzielczością 0,25 °C. Flaga OSF zgłasza utratę zasilania. Biblioteka RTClib (RTC_DS3231). Wyjście 32K nie jest symulowane.', en: 'A very accurate temperature-compensated RTC with a CR2032 battery on the module. I2C address 0x68. Two alarms (registers 0x07–0x0D) signalled on the SQW/INT̅ output (open drain, the module has a pull-up), a 1 Hz–8 kHz square-wave output and a temperature sensor with 0.25 °C resolution. The OSF flag reports power loss. RTClib library (RTC_DS3231). The 32K output is not simulated.' },
  inner: () => `<circle cx="50" cy="-60" r="22" fill="#c9cfd5" stroke="#7d858d"/>` + tx(50, -57, 'CR2032', { s: 6, c: '#333' }),
  extra: { i2c: rtcI2C(19, 3, 2), rtc: { nreg: 19, ds1307: false, sqw: 1, vcc: 4, gnd: 5 },
    sim: { supply: [4, 5], init(d) { rtcInit(d); }, lin(d, S) { S.G(1, 4, 1 / 10000); S.G(0, 4, 1 / 10000); }, commit(d) { rtcTick(d); } } },
});
// --- EEPROM 24Cxx (Microchip 24LC02B / 24LC256): zapis stronami, cykl zapisu t_WR = 5 ms (bez potwierdzenia adresu – „ACK polling”) ---
function eepromPart(id, name, size, page, a16) {
  const pk = pkgDIP(8, ['A0', 'A1', 'A2', 'GND', 'SDA', 'SCL', 'WP', 'VCC']);
  def(id, {
    cat: 'mem', name, sub: { pl: `EEPROM I2C, ${size >= 1024 ? size / 1024 + ' KB' : size + ' B'}`, en: `I2C EEPROM, ${size >= 1024 ? size / 1024 + ' KB' : size + ' B'}` }, kw: `${name.toLowerCase()} eeprom pamiec memory i2c 24c`, props: {}, pins: pk.pins, bbox: pk.bbox,
    info: { pl: `Pamięć nieulotna ${size} bajtów – zapisane dane zostają po wyłączeniu zasilania (w symulacji: między uruchomieniami). Adres I2C 0x50–0x57 (piny A0–A2), zapis stronami po ${page} B – po przekroczeniu końca strony adres zawija się na jej początek. Zapis rozpoczyna się po sygnale STOP i trwa do 5 ms; w tym czasie układ nie odpowiada na swój adres. WP połączony z plusem blokuje zapis.`, en: `Non-volatile ${size}-byte memory – data stays after power-off (in the simulation: between runs). I2C address 0x50–0x57 (pins A0–A2), page writes of ${page} B – past the end of a page the address wraps to its start. Writing starts at the STOP condition and takes up to 5 ms, during which the chip does not answer its address. WP tied to plus blocks writing.` },
    draw: () => pk.body(name, ''),
    i2c: {
      sda: 4, scl: 5, addr: x => eNow() < (x.s.busyTo || 0) ? -1 : addrPins(x, [0, 1, 2], 0x50),
      start(x, w) { x.s.st = w ? 0 : 3; x.s.pend = []; },
      write(x, v) { const s = x.s; if (s.st === 0) { s.ptr = a16 ? ((v << 8) & (size - 1)) : v & (size - 1); s.st = a16 ? 1 : 2; return; } if (s.st === 1) { s.ptr = (s.ptr | v) & (size - 1); s.st = 2; return; }
        const pg = s.ptr & ~(page - 1); s.pend.push([s.ptr, v]); s.ptr = pg | ((s.ptr + 1) & (page - 1)); },
      read(x) { const s = x.s; const v = s.mem[s.ptr % size]; s.ptr = (s.ptr + 1) % size; return v; },
      stop(x) { const s = x.s; if (s.pend && s.pend.length) { if (dV(x, 6) - dV(x, 3) < 1.5) { for (const [a, v] of s.pend.slice(-page)) s.mem[a] = v; s.dirty = true; } s.busyTo = eNow() + 0.005; s.pend = []; } },
    },
    sim: {
      supply: [7, 3],
      init(d) { d.s.mem = new Uint8Array(size).fill(0xff); d.s.ptr = 0; d.s.pend = []; if (d.c.props.mem) try { const b = atob(d.c.props.mem); for (let i = 0; i < Math.min(size, b.length); i++) d.s.mem[i] = b.charCodeAt(i); } catch (e) { } },
      commit(d) { if (d.s.dirty) { d.s.dirty = false; let s = ''; for (let i = 0; i < size; i++) s += String.fromCharCode(d.s.mem[i]); d.c.props.mem = btoa(s); } },
    },
  });
}
eepromPart('ee_24c02', '24C02', 256, 8, false); eepromPart('ee_24c256', '24C256', 32768, 64, true);
// --- W25Q32JV (Winbond): rejestr stanu (BUSY, WEL), programowanie/kasowanie po podniesieniu CS̅, czasy z karty katalogowej ---
(function () {
  const pk = pkgDIP(8, ['CS̅', 'DO', 'WP̅', 'GND', 'DI', 'CLK', 'HOLD̅', 'VCC']);
  const SIZE = 4 * 1024 * 1024;
  const T = { pp: 0.4e-3, se: 45e-3, be32: 120e-3, be64: 150e-3, ce: 10, wrsr: 10e-3 };
  const busy = s => eNow() < (s.busyTo || 0);
  const sr1 = s => (busy(s) ? 1 : 0) | (s.wel ? 2 : 0) | (s.bp << 2);
  const sp = { cs: 0, sck: 5, mosi: 4, miso: 1,
    select(x, on) { const s = x.s;
      if (!on && s.cmd !== null) wqFinish(x);
      s.cmd = null; s.n = 0; s.addr = 0; s.data = []; },
    pre(x) { const s = x.s, c = s.cmd;
      if (s.pd && c !== 0xab) return 0xff;
      if (c === 0x05) return sr1(s); if (c === 0x35) return s.sr2; if (c === 0x15) return 0x60;
      if (busy(s)) return 0xff;
      if (c === 0x9f) return [0xef, 0x40, 0x16][s.n - 1] ?? 0xff;
      if (c === 0x90 && s.n >= 4) return (s.n % 2 === 0) ? 0xef : 0x15;
      if (c === 0xab && s.n >= 4) return 0x15;
      if (c === 0x4b && s.n >= 5) return s.uid[(s.n - 5) % 8];
      if ((c === 0x03 && s.n >= 4) || (c === 0x0b && s.n >= 5)) return s.mem[s.addr % SIZE];
      return 0xff; },
    byte(x, v) {
      const s = x.s;
      if (s.cmd === null) { s.cmd = v; s.n = 1;
        if (s.pd) { if (v !== 0xab) s.cmd = 0; return; }
        if (busy(s) && v !== 0x05 && v !== 0x35 && v !== 0x15) { s.cmd = 0; return; }
        return; }
      const c = s.cmd; s.n++;
      if ([0x03, 0x0b, 0x02, 0x20, 0x52, 0xd8].includes(c) && s.n <= 4) { s.addr = ((s.addr << 8) | v) & (SIZE - 1); return; }
      if ((c === 0x03 && s.n >= 5) || (c === 0x0b && s.n >= 6)) { s.addr = (s.addr + 1) % SIZE; return; }
      if (c === 0x02) s.data.push(v);
      if (c === 0x01) s.data.push(v);
    } };
  function wqFinish(x) {
    const s = x.s, c = s.cmd; if (c === null || c === 0) return;
    const prot = s.bp !== 0; // ochrona bloków (BP0–BP2) – upraszczając: dowolne BP ≠ 0 blokuje zapis
    if (c === 0x06) s.wel = 1; else if (c === 0x04) s.wel = 0;
    else if (c === 0xb9) s.pd = true; else if (c === 0xab) s.pd = false;
    else if (c === 0x01 && s.wel && s.data.length) { s.bp = (s.data[0] >> 2) & 7; if (s.data.length > 1) s.sr2 = s.data[1] & 0x7f; s.wel = 0; s.busyTo = eNow() + T.wrsr; }
    else if (c === 0x02 && s.wel && s.n >= 5) { if (!prot) { const pg = s.addr & ~255, d = s.data.slice(-256); let a = s.addr; for (const v of d) { s.mem[a] &= v; a = pg | ((a + 1) & 255); } s.dirty = true; } s.wel = 0; s.busyTo = eNow() + T.pp; }
    else if ([0x20, 0x52, 0xd8].includes(c) && s.wel && s.n >= 4) { const er = c === 0x20 ? 4096 : c === 0x52 ? 32768 : 65536; if (!prot) { const b0 = s.addr & ~(er - 1); s.mem.fill(0xff, b0, b0 + er); } s.wel = 0; s.busyTo = eNow() + (c === 0x20 ? T.se : c === 0x52 ? T.be32 : T.be64); }
    else if ((c === 0xc7 || c === 0x60) && s.wel) { if (!prot) s.mem.fill(0xff); s.wel = 0; s.busyTo = eNow() + T.ce; }
  }
  def('fl_w25q32', {
    cat: 'mem', name: 'W25Q32', sub: { pl: 'Pamięć Flash SPI, 4 MB', en: 'SPI Flash, 4 MB' }, kw: 'w25q32 flash spi pamiec memory winbond', props: {}, pins: pk.pins, bbox: pk.bbox, spi: sp,
    info: { pl: 'Duża pamięć Flash (32 Mbit = 4 MB) na SPI – na grafiki, dźwięki albo logi. Programowanie zmienia bity tylko z 1 na 0, więc najpierw kasujesz sektor (4 KB, ok. 45 ms) – przed każdym zapisem i kasowaniem wyślij „Write Enable” (0x06). Rozkaz wykonuje się po podniesieniu CS̅, a bit BUSY w rejestrze stanu (0x05) pokazuje, że trwa. ID JEDEC: EF 40 16. Uśpienie: 0xB9, wybudzenie: 0xAB.', en: 'A large Flash memory (32 Mbit = 4 MB) on SPI – for graphics, sounds or logs. Programming only changes bits from 1 to 0, so you first erase a sector (4 KB, about 45 ms) – send “Write Enable” (0x06) before every write and erase. A command executes when CS̅ goes high, and the BUSY bit in the status register (0x05) shows it is running. JEDEC ID: EF 40 16. Power-down: 0xB9, release: 0xAB.' },
    draw: () => pk.body('W25Q32', ''),
    sim: { supply: [7, 3], init(d) { const s = d.s; s.mem = (FLASH_MEM[d.c.id] = FLASH_MEM[d.c.id] || new Uint8Array(SIZE).fill(0xff)); s.cmd = null; s.wel = 0; s.bp = 0; s.sr2 = 0; s.pd = false; s.busyTo = 0; s.uid = [0xd2, 0x63, 0x48, 0x4c, 0x2f, (d.c.id >> 8) & 255, d.c.id & 255, 0x17]; spiListen(d, sp); }, onIn(d, p, lvl, old) { spiPinIn(d, sp, p, lvl, old); } },
  });
})();
const FLASH_MEM = {};
// --- ADC MCP3008 / MCP3201 ---
function mcpAdcBit(nbits, chans) {
  return (x, mosi) => {
    const s = x.s; s.c = (s.c || 0);
    if (chans) {
      if (!s.started) { if (mosi) { s.started = true; s.c = 0; s.cfg = 0; } return 0; }
      s.c++; if (s.c <= 4) { s.cfg = (s.cfg << 1) | mosi; if (s.c === 4) s.val = mcpRead(x, s.cfg, nbits); return 0; }
      if (s.c <= 6) return 0; const k = s.c - 7; return k < nbits ? (s.val >> (nbits - 1 - k)) & 1 : 0;
    }
    s.c++; if (s.c === 1) s.val = mcpRead(x, -1, nbits); if (s.c <= 3) return 0; const k = s.c - 4; return k < nbits ? (s.val >> (nbits - 1 - k)) & 1 : 0;
  };
}
function mcpRead(x, cfg, nbits) {
  const vref = x.P.adc.vref(x), gnd = dV(x, x.P.adc.agnd); let v;
  if (cfg < 0) v = dV(x, 1) - dV(x, 2); else { const sgl = cfg >> 3, ch = cfg & 7; if (sgl) v = dV(x, ch) - gnd; else { const a = ch & 6, b = a + 1; v = (ch & 1) ? dV(x, b) - dV(x, a) : dV(x, a) - dV(x, b); } }
  return clamp(Math.round(v / Math.max(0.1, vref) * (1 << nbits)), 0, (1 << nbits) - 1);
}
(function () {
  const pk = pkgDIP(16, ['CH0', 'CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'DGND', 'CS̅/SHDN', 'DIN', 'DOUT', 'CLK', 'AGND', 'VREF', 'VDD']);
  const sp = { cs: 9, sck: 12, mosi: 10, miso: 11, select(x, on) { x.s.started = false; x.s.c = 0; }, bit: mcpAdcBit(10, true) };
  def('adc_mcp3008', {
    cat: 'adc', name: 'MCP3008', sub: { pl: '8 kanałów, 10 bitów, SPI', en: '8 channels, 10-bit, SPI' }, kw: 'mcp3008 adc przetwornik analogowo cyfrowy analog digital spi raspberry', props: {}, pins: pk.pins, bbox: pk.bbox, spi: sp, adc: { vref: x => dVp(x, 14, 13), agnd: 13 },
    info: { pl: 'Przetwornik analogowo-cyfrowy: zamienia napięcie na liczbę 0–1023 (wartość = U / U_REF · 1024). 8 wejść, komunikacja SPI. Często dodawany do Raspberry Pi, które nie ma własnych wejść analogowych.', en: 'An analog-to-digital converter: turns a voltage into a number 0–1023 (value = U / U_REF · 1024). 8 inputs, SPI interface. Often added to the Raspberry Pi, which has no analog inputs of its own.' },
    draw: () => pk.body('MCP3008', ''),
    sim: { supply: [15, 8], init(d) { spiListen(d, sp); }, onIn(d, p, lvl, old) { spiPinIn(d, sp, p, lvl, old); } },
  });
})();
(function () {
  const pk = pkgDIP(8, ['VREF', 'IN+', 'IN−', 'VSS', 'CS̅/SHDN', 'DOUT', 'CLK', 'VDD']);
  const sp = { cs: 4, sck: 6, mosi: 5, miso: 5, select(x) { x.s.c = 0; }, bit: mcpAdcBit(12, false) };
  def('adc_mcp3201', {
    cat: 'adc', name: 'MCP3201', sub: { pl: '1 kanał różnicowy, 12 bitów, SPI', en: '1 differential channel, 12-bit, SPI' }, kw: 'mcp3201 adc przetwornik 12 bit spi', props: {}, pins: pk.pins, bbox: pk.bbox, spi: Object.assign({}, sp, { mosi: 5 }), adc: { vref: x => dVp(x, 0, 3), agnd: 3 },
    info: { pl: 'Precyzyjny 12-bitowy przetwornik (0–4095) mierzący różnicę IN+ − IN−. Tylko odczyt: po opuszczeniu CS̅ wysyła wynik na DOUT – w Arduino odczytaj 2 bajty przez SPI.transfer().', en: 'A precise 12-bit converter (0–4095) measuring IN+ − IN−. Read-only: after CS̅ goes low it sends the result on DOUT – in Arduino read 2 bytes with SPI.transfer().' },
    draw: () => pk.body('MCP3201', ''),
    sim: { supply: [7, 3], init(d) { eListen(d, 4); eListen(d, 6); }, onIn(d, p, lvl, old) { spiPinIn(d, sp, p, lvl, old); } },
  });
  PARTS.adc_mcp3201.spi.mosi = 5; // brak DIN – linia danych niesprawdzana
})();
// --- ADS1115 (TI SBAS444): czas konwersji wg DR, tryb pojedynczy/ciągły, komparator ALERT/RDY ---
const ADS_DR = [8, 16, 32, 64, 128, 250, 475, 860], ADS_FS = [6.144, 4.096, 2.048, 1.024, 0.512, 0.256, 0.256, 0.256];
modPart('adc_ads1115', {
  cat: 'adc', name: { pl: 'ADS1115 (moduł)', en: 'ADS1115 (module)' }, sub: { pl: '4 kanały, 16 bitów, I2C', en: '4 channels, 16-bit, I2C' }, kw: 'ads1115 adc przetwornik 16 bit i2c precyzyjny', pins: ['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'], w: 220, h: 100, title: 'ADS1115', col: '#1f4f9e',
  info: { pl: 'Dokładny 16-bitowy przetwornik z programowalnym wzmocnieniem (zakres od ±0,256 V do ±6,144 V) i szybkością 8–860 próbek/s – konwersja trwa 1/DR (przy 128 SPS ok. 7,8 ms). 4 wejścia pojedyncze lub 2 różnicowe; napięcie wejść nie może wyjść poza zasilanie. Wyjście ALRT (otwarty dren): komparator progów lub sygnał „gotowe”. Adres I2C 0x48 (ADDR do masy), 0x49 (VDD), 0x4A (SDA), 0x4B (SCL). Biblioteka Adafruit_ADS1X15.', en: 'An accurate 16-bit converter with programmable gain (range ±0.256 V to ±6.144 V) at 8–860 samples/s – a conversion takes 1/DR (about 7.8 ms at 128 SPS). 4 single-ended or 2 differential inputs; input voltages must stay within the supply. ALRT output (open drain): threshold comparator or “conversion ready”. I2C address 0x48 (ADDR to ground), 0x49 (VDD), 0x4A (SDA), 0x4B (SCL). Adafruit_ADS1X15 library.' },
  extra: {
    i2c: {
      sda: 3, scl: 2, addr: x => { const a = x.n[4]; if (a === x.n[0]) return 0x49; if (a === x.n[3]) return 0x4a; if (a === x.n[2]) return 0x4b; return 0x48; },
      start(x, w) { x.s.first = w; x.s.rb = 0; },
      write(x, v) { const s = x.s; if (s.first) { s.ptr = v & 3; s.first = false; s.wn = 0; return; } s.wb = ((s.wb || 0) << 8 | v) & 0xffff; s.wn++;
        if (s.wn === 2) { s.reg[s.ptr] = s.ptr === 1 ? (s.wb & 0x7fff) | (s.busy ? 0 : 0x8000) : s.wb; if (s.ptr === 1) { const md = (s.wb >> 8) & 1; if (!md) { if (s.wb & 0x8000) adsStart(x); } else adsStart(x); } } },
      read(x) { const s = x.s; let v = s.reg[s.ptr]; if (s.ptr === 1) v = (v & 0x7fff) | (s.busy ? 0 : 0x8000);
        const b = s.rb ? v & 255 : (v >> 8) & 255; s.rb ^= 1; if (s.ptr === 0 && s.rb === 0 && s.latched) { s.latched = false; adsAlert(x, false); } return b; },
    },
    sim: { supply: [0, 1], init(d) { d.s.reg = [0, 0x8583, 0x8000, 0x7fff]; d.s.ptr = 0; d.s.busy = false; d.s.cnt = 0; eDrive(d, 5, null, 60, 0, 1); }, commit(d) { adsTick(d); } },
    readings: (c, r) => [[{ pl: 'Ostatni wynik', en: 'Last result' }, String(r.reg ? (r.reg[0] << 16 >> 16) : 0)]],
  },
});
function adsStart(x) { const s = x.s, dr = ADS_DR[(s.reg[1] >> 5) & 7]; s.busy = true; s.tEnd = eNow() + 1 / dr; }
function adsTick(x) {
  const s = x.s; if (!s.busy || E.t + E.dt < s.tEnd) return;
  const cfg = s.reg[1], mux = (cfg >> 12) & 7, fs = ADS_FS[(cfg >> 9) & 7], vdd = dVp(x, 0, 1);
  const A = i => clamp(dV(x, 6 + i) - dV(x, 1), -0.3, vdd + 0.3);
  const v = [A(0) - A(1), A(0) - A(3), A(1) - A(3), A(2) - A(3), A(0), A(1), A(2), A(3)][mux];
  const code = clamp(Math.round(v / fs * 32768), -32768, 32767); s.reg[0] = code & 0xffff;
  const cont = !((cfg >> 8) & 1); s.busy = cont; if (cont) s.tEnd += 1 / ADS_DR[(cfg >> 5) & 7];
  // komparator: COMP_QUE = 11 wyłącza; Hi_thresh[15] = 1 i Lo_thresh[15] = 0 → tryb „konwersja gotowa”
  const que = cfg & 3, hi = s.reg[3] << 16 >> 16, lo = s.reg[2] << 16 >> 16;
  if (que === 3) { adsAlert(x, false); return; }
  if ((s.reg[3] & 0x8000) && !(s.reg[2] & 0x8000)) { adsAlert(x, true); s.rdyPulse = E.t + 8e-6; return; }
  const win = (cfg >> 4) & 1, over = code > hi, under = code < lo;
  if (over || (win && under)) { s.cnt++; if (s.cnt >= [1, 2, 4][que]) { adsAlert(x, true); if ((cfg >> 2) & 1) s.latched = true; } }
  else { s.cnt = 0; if (!s.latched && (win || under)) adsAlert(x, false); }
}
function adsAlert(x, on) { const pol = (x.s.reg[1] >> 3) & 1, lvl = on ? (pol ? null : 0) : (pol ? 0 : null); if (x.s._al !== lvl) { x.s._al = lvl; eDrive(x, 5, lvl, 60, 0, 1); } }
// --- MCP4725 (Microchip DS22039): rejestr DAC + EEPROM, tryby wyłączenia (1 kΩ / 100 kΩ / 500 kΩ do masy) ---
modPart('dac_mcp4725', {
  cat: 'adc', name: { pl: 'MCP4725 (moduł DAC)', en: 'MCP4725 (DAC module)' }, sub: { pl: '12 bitów, I2C', en: '12-bit, I2C' }, kw: 'mcp4725 dac przetwornik cyfrowo analogowy digital analog i2c', pins: ['VCC', 'GND', 'SCL', 'SDA', 'A0', 'VOUT'], w: 150, h: 90, title: 'MCP4725', col: '#1f4f9e', props: { ee: 2048, eepd: 0 },
  info: { pl: 'Przetwornik cyfrowo-analogowy: z liczby 0–4095 robi napięcie U = liczba / 4096 · VCC na pinie VOUT – prawdziwe napięcie analogowe, a nie PWM. Wartość zapisana w EEPROM (zapis trwa ok. 25 ms) wraca po włączeniu zasilania. Tryby uśpienia odłączają wyjście i dołączają je do masy przez 1 kΩ, 100 kΩ lub 500 kΩ. Adres I2C 0x60 (A0 do masy) lub 0x61. Biblioteka Adafruit_MCP4725.', en: 'A digital-to-analog converter: turns a number 0–4095 into a voltage U = number / 4096 · VCC on VOUT – a true analog voltage, not PWM. A value stored in EEPROM (writing takes about 25 ms) comes back at power-up. Power-down modes disconnect the output and tie it to ground through 1 kΩ, 100 kΩ or 500 kΩ. I2C address 0x60 (A0 to ground) or 0x61. Adafruit_MCP4725 library.' },
  extra: {
    i2c: { sda: 3, scl: 2, addr: x => dV(x, 4) - dV(x, 1) > 1.5 ? 0x61 : 0x60, start(x) { x.s.buf = []; x.s.rdn = 0; },
      write(x, v) { const s = x.s, b = s.buf; b.push(v);
        if ((b[0] & 0xc0) === 0 && b.length === 2) { s.pd = (b[0] >> 4) & 3; s.code = ((b[0] & 15) << 8) | b[1]; s.buf = []; E.dirty = true; } // tryb szybki (można wysyłać kolejne pary)
        else if ((b[0] & 0xc0) === 0x40 && b.length === 3) { s.pd = (b[0] >> 1) & 3; s.code = (b[1] << 4) | (b[2] >> 4); if ((b[0] & 0xe0) === 0x60 && !(eNow() < (s.eeBusy || 0))) { s.eeBusy = eNow() + 0.025; x.c.props.ee = s.code; x.c.props.eepd = s.pd; } s.buf = []; E.dirty = true; } },
      read: x => { const s = x.s, rdy = eNow() >= (s.eeBusy || 0) ? 0x80 : 0, p = x.c.props; const bytes = [rdy | 0x40 | (s.pd << 1), s.code >> 4, (s.code & 15) << 4, ((p.eepd & 3) << 5) | ((p.ee >> 8) & 15), p.ee & 255]; const v = bytes[s.rdn % 5]; s.rdn++; return v; } },
    sim: { supply: [0, 1], init(d) { d.s.code = d.c.props.ee ?? 2048; d.s.pd = d.c.props.eepd || 0; },
      lin(d, S) { const vcc = dVp(d, 0, 1); if (vcc < 2.7) { S.G(5, 1, 1e-6); return; } if (d.s.pd) S.G(5, 1, 1 / [0, 1e3, 1e5, 5e5][d.s.pd]); else S.V(5, 1, Math.max(0, vcc) * (d.s.code || 0) / 4096, 1); },
      power(d, on) { if (on) { d.s.code = d.c.props.ee ?? 2048; d.s.pd = d.c.props.eepd || 0; } },
      commit(d) { d.s.U = dVp(d, 5, 1); } },
    readings: (c, r) => [['VOUT', si(r.U || 0, 'V')], [{ pl: 'Kod', en: 'Code' }, String(r.code || 0)], [{ pl: 'Tryb', en: 'Mode' }, r.pd ? ['', '1 kΩ', '100 kΩ', '500 kΩ'][r.pd] + ' ⏚' : { pl: 'aktywny', en: 'active' }]],
  },
});

/* ---------- USB-UART ---------- */
function usbUart(id, name, col) {
  modPart(id, {
    cat: 'com', name: { pl: `${name} (USB-UART)`, en: `${name} (USB-UART)` }, sub: { pl: 'Port szeregowy komputera', en: 'Computer serial port' }, kw: `${name.toLowerCase()} usb uart serial monitor ttl konwerter converter`, pins: ['GND', 'CTS', 'VCC', 'TXD', 'RXD', 'DTR'], w: 150, h: 90, title: name, col, props: { baud: 9600 },
    ui: [{ k: 'baud', type: 'select', l: { pl: 'Prędkość (dla programowego portu)', en: 'Baud (for software serial)' }, opts: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(v => [v, String(v)]) }, { type: 'serial' }],
    info: { pl: `Przejściówka USB ↔ UART: łączy wirtualny port szeregowy komputera z pinami RX/TX mikrokontrolera. Połącz RXD modułu z TX mikrokontrolera, a TXD z RX (na krzyż) i wspólną masę. Tekst zobaczysz w monitorze portu szeregowego poniżej.`, en: `A USB ↔ UART adapter: connects the computer’s virtual serial port to the microcontroller RX/TX pins. Wire the module RXD to the microcontroller TX and TXD to RX (crossed) plus a common ground. See the text in the serial monitor below.` },
    inner: (c, r) => `<rect x="-14" y="-82" width="38" height="28" rx="2" fill="#c9cfd5" stroke="#7d858d"/>` + `<rect x="70" y="-74" width="8" height="5" fill="${performance.now() - (r.lastRx || 0) < 80 ? '#ffb020' : '#5a4620'}"/>` + tx(74, -78, 'RX', { s: 5, c: '#eee' }),
    extra: {
      uart: { rxd: 4, txd: 3, recv(x, b) { x.s.text = (x.s.text || '') + String.fromCharCode(b); x.s.lastRx = performance.now(); SERIAL.dirty = true; } },
      sim: {
        supply: [2, 0],
        init(d) { d.s.text = d.s.text || ''; eListen(d, 4); eDrive(d, 3, 1, 100, 2, 0); },
        onIn(d, p, lvl, old) { if (p !== 4 || d._hwLinked) return; const now = eNow(), s = d.s, bt = 1 / d.c.props.baud; // programowy UART: dekodowanie po czasie zboczy
          if (!s.fr && lvl === 0 && old === 1) { s.fr = { t0: now, ed: [] }; return; } if (s.fr) s.fr.ed.push([now, lvl]); uartDecode(d, now); },
        commit(d) { uartDecode(d, eNow()); },
      },
    },
  });
}
function uartDecode(d, now) {
  const s = d.s, f = s.fr; if (!f) return; const bt = 1 / d.c.props.baud; if (now < f.t0 + 9.6 * bt) return;
  let lvl = 0, k = 0, v = 0; for (let b = 0; b < 8; b++) { const ts = f.t0 + (1.5 + b) * bt; while (k < f.ed.length && f.ed[k][0] <= ts) { lvl = f.ed[k][1]; k++; } v |= lvl << b; }
  s.text = (s.text || '') + String.fromCharCode(v); s.lastRx = performance.now(); SERIAL.dirty = true;
  // kolejna ramka mogła już wystartować w zapisanych zboczach
  const rest = f.ed.filter(e => e[0] > f.t0 + 9.5 * bt); s.fr = null;
  let last = 1; for (let i = 0; i < rest.length; i++) { if (rest[i][1] === 0 && last === 1) { s.fr = { t0: rest[i][0], ed: rest.slice(i + 1) }; break; } last = rest[i][1]; }
}
usbUart('usb_ft232', 'FT232RL', '#b8262c'); usbUart('usb_ch340', 'CH340', '#1f4f9e');

/* ---------- MCP2515 (CAN) – z prawdziwym przesyłaniem ramek między modułami ---------- */
modPart('can_mcp2515', {
  cat: 'com', name: { pl: 'MCP2515 (moduł CAN)', en: 'MCP2515 (CAN module)' }, sub: { pl: 'Magistrala CAN, SPI', en: 'CAN bus, SPI' }, kw: 'mcp2515 can bus magistrala motoryzacja automotive spi tja1050', pins: ['INT', 'SCK', 'SI', 'SO', 'CS', 'GND', 'VCC', 'CANH', 'CANL'], w: 220, h: 120, title: 'MCP2515 CAN', col: '#1f4f9e',
  info: { pl: 'Kontroler magistrali CAN (motoryzacja, przemysł). Połącz CANH z CANH i CANL z CANL kilku modułów – każdy z własnym Arduino – a wysłane ramki dotrą do pozostałych. Wszystkie węzły muszą mieć tę samą prędkość (rejestry CNF1–3), a ramkę musi potwierdzić co najmniej jeden węzeł w trybie normalnym – inaczej nadajnik zgłasza błąd (TXERR). Działają filtry i maski odbioru (RXF0–5, RXM0–1) oraz przenoszenie do drugiego bufora (BUKT). Tryb loopback działa na jednym module. Biblioteka CAN (arduino-CAN): przy kwarcu 8 MHz wywołaj CAN.setClockFrequency(8E6).', en: 'A CAN bus controller (automotive, industry). Connect CANH to CANH and CANL to CANL of several modules – each with its own Arduino – and sent frames reach the others. All nodes must use the same bit rate (registers CNF1–3), and at least one node in normal mode must acknowledge a frame – otherwise the transmitter reports an error (TXERR). Receive filters and masks (RXF0–5, RXM0–1) and rollover to the second buffer (BUKT) work. Loopback mode works on a single module. CAN library (arduino-CAN): with an 8 MHz crystal call CAN.setClockFrequency(8E6).' }, props: { osc: 8 }, ui: [{ k: 'osc', type: 'seg', l: { pl: 'Kwarc', en: 'Crystal' }, opts: [[8, '8 MHz'], [16, '16 MHz']] }],
  extra: {
    spi: { key: 'c', cs: 4, sck: 1, mosi: 2, miso: 3, select(x, on) { x.s.op = null; x.s.n = 0; },
      pre(x) { const s = x.s; if (s.op === 0x03 && s.n >= 2) return s.reg[s.addr & 127]; if ((s.op & 0xf9) === 0x90 && s.n >= 1) return s.reg[s.addr & 127]; if (s.op === 0xa0) { const r = s.reg; return ((r[0x2c] & 1) ? 1 : 0) | ((r[0x2c] & 2) ? 2 : 0) | ((r[0x30] & 8) ? 4 : 0) | ((r[0x2c] & 4) ? 8 : 0) | ((r[0x40] & 8) ? 16 : 0) | ((r[0x2c] & 8) ? 32 : 0) | ((r[0x50] & 8) ? 64 : 0) | ((r[0x2c] & 16) ? 128 : 0); } return 0xff; },
      byte(x, v) { const s = x.s; if (s.op === null) { s.op = v; s.n = 1; if (v === 0xc0) canReset(s); else if ((v & 0xf8) === 0x80) { if (v & 1) canTx(x, 0x30); if (v & 2) canTx(x, 0x40); if (v & 4) canTx(x, 0x50); } else if ((v & 0xf9) === 0x90) { s.addr = v & 4 ? 0x66 : 0x61; if (v & 2) s.addr += 0x10; if (v & 2 ? false : false) { } s.rxRead = v; s.addr = [0x61, 0x66, 0x71, 0x76][(v >> 1) & 3]; } else if ((v & 0xf8) === 0x40) { s.addr = [0x31, 0x36, 0x41, 0x46, 0x51, 0x56][v & 7]; } return; }
        s.n++;
        if (s.op === 0x03) { if (s.n === 2) s.addr = v; else s.addr++; return; }
        if ((s.op & 0xf9) === 0x90) { s.addr++; return; }
        if (s.op === 0x02) { if (s.n === 2) s.addr = v; else { canWrite(x, s.addr & 127, v); s.addr++; } return; }
        if ((s.op & 0xf8) === 0x40) { s.reg[s.addr & 127] = v; s.addr++; return; }
        if (s.op === 0x05) { if (s.n === 2) s.addr = v; else if (s.n === 3) s.mask = v; else if (s.n === 4) canWrite(x, s.addr, (s.reg[s.addr] & ~s.mask) | (v & s.mask)); } },
      },
    sim: { supply: [6, 5], init(d) { d.s.reg = new Uint8Array(128); canReset(d.s); spiListen(d, PARTS.can_mcp2515.spi); eDrive(d, 0, null, 60, 6, 5); }, lin(d, S) { S.G(7, 8, 1 / 60); }, onIn(d, p, lvl, old) { spiPinIn(d, PARTS.can_mcp2515.spi, p, lvl, old); if (p === 4 && lvl === 1 && d.s.rxRead !== undefined) { const v = d.s.rxRead; d.s.reg[0x2c] &= ~((v & 4) ? 2 : 1); d.s.rxRead = undefined; canInt(d); } }, commit(d) { canInt(d); } },
    readings: (c, r) => [[{ pl: 'Tryb', en: 'Mode' }, ['Normal', 'Sleep', 'Loopback', 'Listen-only', 'Config'][(r.reg ? r.reg[0x0e] >> 5 : 4)] || '—'], [{ pl: 'Wysłane / odebrane', en: 'Sent / received' }, (r.txc || 0) + ' / ' + (r.rxc || 0)]],
  },
});
function canReset(s) { s.reg.fill(0); s.reg[0x0f] = 0x87; s.reg[0x0e] = 0x80; }
function canWrite(x, a, v) {
  const s = x.s; s.reg[a] = v;
  if (a === 0x0f) { s.reg[0x0e] = (s.reg[0x0e] & 0x1f) | (v & 0xe0); if (v & 0x10) canAbort(x); }
  if ((a === 0x30 || a === 0x40 || a === 0x50) && (v & 8)) canTx(x, a);
  if (a === 0x2c) canInt(x);
}
// szybkość transmisji z rejestrów CNF1–CNF3: bit = (SyncSeg + PropSeg + PS1 + PS2)·TQ, TQ = 2·(BRP+1)/Fosc
function canBitrate(x) { const r = x.s.reg, brp = r[0x2a] & 63, ps1 = (r[0x29] >> 3) & 7, prs = r[0x29] & 7, ps2 = r[0x28] & 7; const tq = 2 * (brp + 1) / ((x.c.props.osc || 8) * 1e6); return 1 / ((1 + prs + 1 + ps1 + 1 + ps2 + 1) * tq); }
const canMode = x => x.s.reg[0x0e] >> 5; // 0 normal, 1 sleep, 2 loopback, 3 listen-only, 4 config
// identyfikator ramki / filtra z rejestrów SIDH, SIDL, EID8, EID0
function canId(r, i) { const sidh = r[i], sidl = r[i + 1], ext = (sidl >> 3) & 1; const sid = (sidh << 3) | (sidl >> 5); return { ext, id: ext ? (sid << 18) | ((sidl & 3) << 16) | (r[i + 2] << 8) | r[i + 3] : sid }; }
function canAccept(r, fr, filt, mask) { if (((r[0x60] >> 5) & 3) === 3 && filt < 3) return true; const f = canId(r, filt), m = canId(r, mask); if (f.ext !== fr.ext) return false; return ((fr.id ^ f.id) & m.id) === 0; }
function canDeliver(y, frame, fr) {
  const r = y.s.reg, F = [0x00, 0x04, 0x08, 0x10, 0x14, 0x18], any0 = ((r[0x60] >> 5) & 3) === 3, any1 = ((r[0x70] >> 5) & 3) === 3;
  let hit0 = any0 ? 0 : [0, 1].find(k => canAccept(r, fr, F[k], 0x20)), hit1 = any1 ? 2 : [2, 3, 4, 5].find(k => canAccept(r, fr, F[k], 0x24));
  if (any0) hit0 = 0;
  let slot = 0, filhit = 0;
  if (hit0 !== undefined && !(r[0x2c] & 1)) { slot = 0x60; filhit = hit0; }
  else if (hit0 !== undefined && (r[0x60] & 4) && !(r[0x2c] & 2)) { slot = 0x70; filhit = hit0; } // BUKT: przejście do RXB1
  else if (hit1 !== undefined && hit0 === undefined && !(r[0x2c] & 2)) { slot = 0x70; filhit = hit1; }
  else if (hit0 !== undefined || hit1 !== undefined) { r[0x2d] |= (hit0 !== undefined && !(r[0x60] & 4)) ? 0x40 : 0x80; r[0x2c] |= 0x20; canInt(y); return; } // przepełnienie
  else return;
  r.set(frame, slot + 1);
  // RXBnSIDL: SRR (bit 4) dla ramki standardowej RTR, IDE (bit 3); RXBnDLC: RTR (bit 6) dla rozszerzonej
  const rtr = (frame[4] >> 6) & 1; r[slot + 2] = (r[slot + 2] & ~0x18) | (fr.ext ? 8 : 0) | (!fr.ext && rtr ? 0x10 : 0); r[slot + 5] = (frame[4] & 15) | (fr.ext && rtr ? 0x40 : 0);
  r[slot] = (r[slot] & 0xf8) | (slot === 0x60 ? (filhit & 1) | (rtr && !fr.ext ? 8 : 0) : (filhit & 7) | (rtr && !fr.ext ? 8 : 0));
  r[0x2c] |= slot === 0x60 ? 1 : 2; y.s.rxc = (y.s.rxc || 0) + 1; canInt(y);
}
function canTx(x, base) {
  const s = x.s, mode = canMode(x), r = s.reg; const frame = r.slice(base + 1, base + 14), fr = canId(r, base + 1);
  if (mode === 4 || mode === 1 || mode === 3) return; // konfiguracja, uśpienie, nasłuch – bez nadawania
  let acked = false;
  if (mode === 2) { canDeliver(x, frame, fr); acked = true; }
  else {
    const br = canBitrate(x);
    for (const y of CIR.devs) {
      if (y === x || y.P !== x.P || y.n[7] !== x.n[7] || y.n[8] !== x.n[8] || !devPowered(y)) continue;
      const m = canMode(y); if (m === 4 || m === 1 || m === 2) continue;
      if (Math.abs(canBitrate(y) - br) / br > 0.01) { y.s.reg[0x1d] = Math.min(255, y.s.reg[0x1d] + 1); y.s.reg[0x2d] |= 1; continue; } // inna prędkość – błędy odbioru
      canDeliver(y, frame, fr); if (m === 0) acked = true; // tryb nasłuchu nie potwierdza (brak ACK)
    }
  }
  if (acked) { r[base] &= ~0x18; r[0x2c] |= base === 0x30 ? 4 : base === 0x40 ? 8 : 16; s.txc = (s.txc || 0) + 1; if (r[0x1c]) r[0x1c]--; }
  else { r[base] |= 0x10; r[0x1c] = Math.min(255, r[0x1c] + 8); r[0x2d] |= r[0x1c] >= 128 ? 0x10 : 0x04; r[0x2c] |= 0x20; } // brak ACK: TXERR, licznik błędów TEC
  canInt(x);
}
// ABAT: przerwanie wszystkich oczekujących transmisji (ABTF)
function canAbort(x) { const r = x.s.reg; for (const b of [0x30, 0x40, 0x50]) if (r[b] & 8) { r[b] = (r[b] & ~8) | 0x40; } }
function canInt(x) { const s = x.s; const want = (s.reg[0x2b] & s.reg[0x2c]) ? 0 : null; if (s._int !== want) { s._int = want; eDrive(x, 0, want, 60, 6, 5); } }
