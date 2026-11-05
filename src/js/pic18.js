'use strict';
/* ================= PIC18F4550 – emulacja rdzenia i peryferiów (karta katalogowa DS39632E) =================
   75 rozkazów (bez trybu rozszerzonego XINST), 2 KB RAM w 16 bankach + Access Bank, stos 31 poziomów, szybki stos (FAST),
   FSR0–2 z POSTINC/POSTDEC/PREINC/PLUSW, odczyt i zapis pamięci programu (TBLRD/TBLWT), mnożenie sprzętowe,
   przerwania z priorytetami (IPEN), porty A–E z LAT/TRIS, ADC 10 bit (13 kanałów, PCFG), Timer0/1/2/3, CCP1/CCP2 (PWM, compare,
   capture), EUSART (port szeregowy), MSSP w trybie I2C master i SPI master, EEPROM 256 B, WDT, SLEEP, bity konfiguracji.
   USB nie jest emulowane. */
const P18 = { PORTA: 0xF80, LATA: 0xF89, TRISA: 0xF92, PIE1: 0xF9D, PIR1: 0xF9E, IPR1: 0xF9F, PIE2: 0xFA0, PIR2: 0xFA1, IPR2: 0xFA2, EECON1: 0xFA6, EECON2: 0xFA7, EEDATA: 0xFA8, EEADR: 0xFA9,
  RCSTA: 0xFAB, TXSTA: 0xFAC, TXREG: 0xFAD, RCREG: 0xFAE, SPBRG: 0xFAF, SPBRGH: 0xFB0, T3CON: 0xFB1, TMR3L: 0xFB2, TMR3H: 0xFB3, BAUDCON: 0xFB8, CCP2CON: 0xFBA, CCPR2L: 0xFBB, CCPR2H: 0xFBC,
  CCP1CON: 0xFBD, CCPR1L: 0xFBE, CCPR1H: 0xFBF, ADCON2: 0xFC0, ADCON1: 0xFC1, ADCON0: 0xFC2, ADRESL: 0xFC3, ADRESH: 0xFC4, SSPCON2: 0xFC5, SSPCON1: 0xFC6, SSPSTAT: 0xFC7, SSPADD: 0xFC8, SSPBUF: 0xFC9,
  T2CON: 0xFCA, PR2: 0xFCB, TMR2: 0xFCC, T1CON: 0xFCD, TMR1L: 0xFCE, TMR1H: 0xFCF, RCON: 0xFD0, WDTCON: 0xFD1, OSCCON: 0xFD3, T0CON: 0xFD5, TMR0L: 0xFD6, TMR0H: 0xFD7, STATUS: 0xFD8,
  FSR2L: 0xFD9, FSR2H: 0xFDA, PLUSW2: 0xFDB, PREINC2: 0xFDC, POSTDEC2: 0xFDD, POSTINC2: 0xFDE, INDF2: 0xFDF, BSR: 0xFE0, FSR1L: 0xFE1, FSR1H: 0xFE2, WREG: 0xFE8, FSR0L: 0xFE9, FSR0H: 0xFEA,
  INTCON3: 0xFF0, INTCON2: 0xFF1, INTCON: 0xFF2, PRODL: 0xFF3, PRODH: 0xFF4, TABLAT: 0xFF5, TBLPTRL: 0xFF6, TBLPTRH: 0xFF7, TBLPTRU: 0xFF8, PCL: 0xFF9, PCLATH: 0xFFA, PCLATU: 0xFFB, STKPTR: 0xFFC, TOSL: 0xFFD, TOSH: 0xFFE, TOSU: 0xFFF };
const P18_AN = [['A', 0], ['A', 1], ['A', 2], ['A', 3], ['A', 5], ['E', 0], ['E', 1], ['E', 2], ['B', 2], ['B', 3], ['B', 1], ['B', 4], ['B', 0]];
class Pic18 {
  constructor(prog, cfg, ee) {
    this.prog = prog; this.cfg = cfg; this.ee = ee; this.m = new Uint8Array(4096); this.stack = new Uint32Array(32); this.cycles = 0; this.inp = { A: 0, B: 0, C: 0, D: 0, E: 0 }; this.onPins = null;
    this.hold = new Uint8Array(32).fill(0xff); this.vdd = 5; this.reset(true);
  }
  reset(por) {
    const m = this.m; const keep = por ? null : m.slice(0, 0x800);
    if (por) m.fill(0); else m.fill(0, 0xF60);
    if (keep) m.set(keep);
    this.pc = 0; this.sp = 0; this.stkful = 0; this.stkunf = 0;
    m[0xFD5] = 0xFF; m[0xFF1] = 0xF5; m[0xFF0] = 0xC0; m[0xFD0] = por ? 0x1C : (m[0xFD0] & 0x1F) | 0x1C; m[0xFD0] &= por ? 0x1C : 0xFF;
    for (let i = 0; i < 5; i++) m[0xF92 + i] = 0xFF; m[0xF96] = 0x07;
    m[0xFC1] = (this.cfg[5] & 2) ? 0x00 : 0x07; m[0xFAC] = 0x02; m[0xFCB] = 0xFF; m[0xF9F] = 0xFF; m[0xFA2] = 0xFF; m[0xFB4] = 0x07; m[0xFD3] = 0x40;
    this.tmr0 = 0; this.t0h = 0; this.pre0 = 0; this.inh0 = 0; this.tmr1 = 0; this.t1h = 0; this.pre1 = 0; this.tmr3 = 0; this.t3h = 0; this.pre3 = 0; this.tmr2 = 0; this.pre2 = 0; this.post2 = 0;
    this.ws = 0; this.statuss = 0; this.bsrs = 0; this.isrLvl = []; this.sleeping = false; this.wdt = this.cycles; this.eeSeq = 0; this.eeWriteAt = null; this.adcAt = null; this.txBusy = null; this.txq = []; this.rxf = []; this.rxAt = 0;
    this.pwm = { 1: 0, 2: 0 }; this.pwmCnt = 0; this.i2c = { busy: null, dev: null, first: false }; this.spiAt = null; this.lastB = this.inp.B; this.lastRBr = this.inp.B; this.t0ck = 0; this.skipNext = false;
    this.pins();
  }
  pins() { if (this.onPins) this.onPins(); }
  get w() { return this.m[0xFE8]; } set w(v) { this.m[0xFE8] = v & 255; }
  get st() { return this.m[0xFD8]; } set st(v) { this.m[0xFD8] = v & 0x1F; }
  get bsr() { return this.m[0xFE0] & 15; }
  fsr(n) { const b = [0xFE9, 0xFE1, 0xFD9][n]; return (this.m[b] | (this.m[b + 1] << 8)) & 0xFFF; }
  setFsr(n, v) { const b = [0xFE9, 0xFE1, 0xFD9][n]; v &= 0xFFF; this.m[b] = v & 255; this.m[b + 1] = v >> 8; }
  ea(f, a) { return a ? (this.bsr << 8) | f : (f >= 0x60 ? 0xF00 | f : f); }
  analogCount() { const v = this.m[0xFC1] & 15; return v <= 2 ? 13 : 15 - v; }
  isAnalog(port, bit) { const n = this.analogCount(); for (let i = 0; i < n; i++) if (P18_AN[i][0] === port && P18_AN[i][1] === bit) return true; return false; }
  readPort(k) { const p = 'ABCDE'[k]; let v = this.inp[p] & 0xFF; for (let b = 0; b < 8; b++) if (this.isAnalog(p, b)) v &= ~(1 << b); if (p === 'E') v &= 0x0F; if (p === 'A') v &= 0x7F; if (p === 'C') v &= 0xF7; return v; }
  indirect(a) { // a: adres INDFx/POSTINCx/... -> efektywny adres
    const n = a >= 0xFE7 ? (a >= 0xFEB ? 0 : 1) : 2, base = [0xFEB, 0xFE3, 0xFDB][n], k = a - base; // 0 PLUSW,1 PREINC,2 POSTDEC,3 POSTINC,4 INDF
    let f = this.fsr(n), ad;
    if (k === 0) ad = (f + ((this.w << 24) >> 24)) & 0xFFF; else if (k === 1) { f = (f + 1) & 0xFFF; this.setFsr(n, f); ad = f; } else { ad = f; if (k === 2) this.setFsr(n, f - 1); else if (k === 3) this.setFsr(n, f + 1); }
    return ad;
  }
  isInd(a) { return (a >= 0xFDB && a <= 0xFDF) || (a >= 0xFE3 && a <= 0xFE7) || (a >= 0xFEB && a <= 0xFEF); }
  rd(a) {
    if (a < 0xF60) return a < 0x800 ? this.m[a] : 0;
    if (this.isInd(a)) { const t = this.indirect(a); return this.isInd(t) ? 0 : this.rd(t); }
    const m = this.m;
    switch (a) {
      case 0xF80: case 0xF81: case 0xF82: case 0xF83: case 0xF84: { const k = a - 0xF80; if (k === 1) this.lastRBr = this.inp.B; return this.readPort(k); }
      case 0xFF9: m[0xFFA] = (this.pc >> 8) & 255; m[0xFFB] = (this.pc >> 16) & 31; return this.pc & 0xFE;
      case 0xFFD: case 0xFFE: case 0xFFF: { const t = this.sp ? this.stack[this.sp] : 0; return a === 0xFFD ? t & 255 : a === 0xFFE ? (t >> 8) & 255 : (t >> 16) & 31; }
      case 0xFFC: return (this.stkful << 7) | (this.stkunf << 6) | this.sp;
      case 0xFD6: if (!(m[0xFD5] & 0x40)) m[0xFD7] = (this.tmr0 >> 8) & 255; return this.tmr0 & 255;
      case 0xFD7: return m[0xFD7];
      case 0xFCE: if (m[0xFCD] & 0x80) m[0xFCF] = (this.tmr1 >> 8) & 255; return this.tmr1 & 255;
      case 0xFCF: return m[0xFCD] & 0x80 ? m[0xFCF] : (this.tmr1 >> 8) & 255;
      case 0xFB2: if (m[0xFB1] & 0x80) m[0xFB3] = (this.tmr3 >> 8) & 255; return this.tmr3 & 255;
      case 0xFB3: return m[0xFB1] & 0x80 ? m[0xFB3] : (this.tmr3 >> 8) & 255;
      case 0xFCC: return this.tmr2;
      case 0xFAE: { const v = this.rxf.length ? this.rxf.shift() : m[0xFAE]; m[0xFAE] = v; if (!this.rxf.length) m[0xF9E] &= ~0x20; return v; }
      case 0xFA7: return 0;
      case 0xFAC: return (m[0xFAC] & ~2) | (this.txBusy === null ? 2 : 0);
    }
    return m[a];
  }
  wr(a, v) {
    v &= 255;
    if (a < 0xF60) { if (a < 0x800) this.m[a] = v; return; }
    if (this.isInd(a)) { const t = this.indirect(a); if (!this.isInd(t)) this.wr(t, v); return; }
    const m = this.m;
    switch (a) {
      case 0xF80: case 0xF81: case 0xF82: case 0xF83: case 0xF84: m[a + 9] = v; this.pins(); return;
      case 0xF89: case 0xF8A: case 0xF8B: case 0xF8C: case 0xF8D: m[a] = v; this.pins(); return;
      case 0xF92: case 0xF93: case 0xF94: case 0xF95: m[a] = v; this.pins(); return;
      case 0xF96: m[a] = v & 0x07 | (m[a] & 0xF0) ; this.pins(); return;
      case 0xFF9: this.pc = ((m[0xFFB] & 31) << 16) | (m[0xFFA] << 8) | (v & 0xFE); this.jumped = true; return;
      case 0xFFD: case 0xFFE: case 0xFFF: if (this.sp) { const sh = (a - 0xFFD) * 8; this.stack[this.sp] = (this.stack[this.sp] & ~(255 << sh)) | (v << sh); } return;
      case 0xFFC: this.sp = v & 31; if (!(v & 0x80)) this.stkful = 0; if (!(v & 0x40)) this.stkunf = 0; return;
      case 0xFD6: this.tmr0 = (m[0xFD5] & 0x40) ? (this.tmr0 & 0xFF00) | v : (m[0xFD7] << 8) | v; this.inh0 = 2; this.pre0 = 0; return;
      case 0xFD5: m[a] = v; return;
      case 0xFCE: this.tmr1 = (m[0xFCD] & 0x80) ? (m[0xFCF] << 8) | v : (this.tmr1 & 0xFF00) | v; return;
      case 0xFCF: if (m[0xFCD] & 0x80) m[0xFCF] = v; else this.tmr1 = (this.tmr1 & 255) | (v << 8); return;
      case 0xFB2: this.tmr3 = (m[0xFB1] & 0x80) ? (m[0xFB3] << 8) | v : (this.tmr3 & 0xFF00) | v; return;
      case 0xFB3: if (m[0xFB1] & 0x80) m[0xFB3] = v; else this.tmr3 = (this.tmr3 & 255) | (v << 8); return;
      case 0xFCC: this.tmr2 = v; return;
      case 0xFCA: m[a] = v & 0x7F; if (!(v & 4)) { } return;
      case 0xFC2: { const old = m[a]; m[a] = v & 0x3F; if ((v & 3) === 3 && !(old & 2)) this.adcStart(); return; }
      case 0xFBD: case 0xFBA: m[a] = v & 0x3F; this.pins(); return;
      case 0xFA6: { const old = m[a]; m[a] = (v & 0xD4) | (old & 0x08 & v) | (old & 2); if (v & 1) this.eeRead(); if ((v & 2) && !(old & 2) && (v & 4) && this.eeSeq === 2) { m[a] |= 2; this.eeStart(); } this.eeSeq = 0; return; }
      case 0xFA7: this.eeSeq = v === 0x55 ? 1 : (v === 0xAA && this.eeSeq === 1 ? 2 : 0); return;
      case 0xFAD: m[a] = v; this.txPush(v); return;
      case 0xFAC: m[a] = (v & ~2) | (m[a] & 2); if ((v & 0x20) && this.txq.length === 0) m[0xF9E] |= 0x10; else if (!(v & 0x20)) m[0xF9E] &= ~0x10; return;
      case 0xFAB: m[a] = (v & 0xF9) | (m[a] & 6); if (!(v & 0x10)) m[a] &= ~2; return;
      case 0xFC9: this.sspWrite(v); return;
      case 0xFC5: m[a] = v; this.i2cCmd(); return;
      case 0xFC6: m[a] = v; this.pins(); return;
      case 0xFD8: this.st = v; return;
      case 0xFE0: m[a] = v & 15; return;
      case 0xFD0: m[a] = (m[a] & 0x0C) | (v & 0xF3) ; return;
      case 0xFC7: m[a] = (m[a] & 0x3F) | (v & 0xC0); return;
    }
    m[a] = v;
  }
  // ---- stos ----
  push(v) { if (this.sp >= 31) { this.stkful = 1; if (this.cfg[6] & 1) { this.reset(false); this.stkful = 1; return false; } return true; } this.sp++; this.stack[this.sp] = v; if (this.sp === 31) this.stkful = 1; return true; }
  pop() { if (this.sp === 0) { this.stkunf = 1; if (this.cfg[6] & 1) { this.reset(false); this.stkunf = 1; } return 0; } return this.stack[this.sp--]; }
  // ---- arytmetyka ----
  nz(r) { this.st = (this.st & ~0x14) | ((r & 255) ? 0 : 4) | (r & 0x80 ? 0x10 : 0); }
  add(a, b, c) { const r = a + b + c; const ov = ((a ^ r) & (b ^ r) & 0x80) ? 8 : 0; this.st = (r > 255 ? 1 : 0) | (((a & 15) + (b & 15) + c) > 15 ? 2 : 0) | ((r & 255) ? 0 : 4) | ov | (r & 0x80 ? 0x10 : 0); return r & 255; }
  sub(a, b, c) { return this.add(a, (~b) & 255, c); }
  fetch() { const p = this.pc & 0x7FFF; const v = this.prog[p] | (this.prog[p + 1] << 8); this.pc = (this.pc + 2) & 0x1FFFFF; return v; }
  tblRead(ad) { if (ad < 0x8000) return this.prog[ad]; if (ad >= 0x300000 && ad < 0x30000E) return this.cfg[ad - 0x300000]; if (ad === 0x3FFFFE) return 0x00; if (ad === 0x3FFFFF) return 0x12; if (ad >= 0x200000 && ad < 0x200008) return 0xFF; return 0; }
  tblptr() { return this.m[0xFF6] | (this.m[0xFF7] << 8) | ((this.m[0xFF8] & 0x3F) << 16); }
  setTblptr(v) { v &= 0x3FFFFF; this.m[0xFF6] = v & 255; this.m[0xFF7] = (v >> 8) & 255; this.m[0xFF8] = (v >> 16) & 0x3F; }
  // ---- przerwania ----
  pending() {
    const m = this.m, ic = m[0xFF2], ic3 = m[0xFF0], ic2 = m[0xFF1];
    const src = []; // [aktywne, wysoki priorytet]
    if ((ic & 0x20) && (ic & 0x04)) src.push(!!(ic2 & 0x04)); if ((ic & 0x10) && (ic & 0x02)) src.push(true); if ((ic & 0x08) && (ic & 0x01)) src.push(!!(ic2 & 0x01));
    if ((ic3 & 0x08) && (ic3 & 0x01)) src.push(!!(ic3 & 0x40)); if ((ic3 & 0x10) && (ic3 & 0x02)) src.push(!!(ic3 & 0x80));
    const p1 = m[0xF9D] & m[0xF9E], p2 = m[0xFA0] & m[0xFA1]; const per = [];
    for (let b = 0; b < 8; b++) { if (p1 & (1 << b)) per.push(!!(m[0xF9F] & (1 << b))); if (p2 & (1 << b)) per.push(!!(m[0xFA2] & (1 << b))); }
    return { src, per };
  }
  irq() {
    const m = this.m, ic = m[0xFF2], ipen = m[0xFD0] & 0x80; const { src, per } = this.pending();
    if (!src.length && !per.length) return 0;
    if (!ipen) { if (!(ic & 0x80)) return 0; if (src.length || ((ic & 0x40) && per.length)) return 0x08; return 0; }
    const hi = src.some(x => x) || per.some(x => x), lo = src.some(x => !x) || per.some(x => !x);
    if (hi && (ic & 0x80)) return 0x08;
    if (lo && (ic & 0x80) && (ic & 0x40)) return 0x18;
    return 0;
  }
  anyWake() { const { src, per } = this.pending(); return src.length > 0 || per.length > 0; }
  // ---- wejścia ----
  setInputs(I) {
    const ob = this.inp.B, oa = this.inp.A; this.inp = Object.assign({}, I); const b = I.B, m = this.m;
    const ic2 = m[0xFF1];
    const edge = (bit, edgeBit, flagReg, flagMask) => { const o = (ob >> bit) & 1, n = (b >> bit) & 1; if (o !== n && (m[0xF93] >> bit) & 1) { if ((n === 1) === !!(ic2 & edgeBit)) m[flagReg] |= flagMask; } };
    edge(0, 0x40, 0xFF2, 0x02); edge(1, 0x20, 0xFF0, 0x01); edge(2, 0x10, 0xFF0, 0x02);
    if ((ob ^ b) & 0xF0 & m[0xF93]) m[0xFF2] |= 0x01;
    // T0CKI (RA4)
    const t0 = (I.A >> 4) & 1, o0 = (oa >> 4) & 1; if (t0 !== o0 && (m[0xFD5] & 0x20) && (m[0xFD5] & 0x80) && (t0 === 1) === !(m[0xFD5] & 0x10)) this.t0inc();
  }
  // ---- timery ----
  t0inc() {
    const m = this.m, c = m[0xFD5]; if (this.inh0 > 0) return;
    if (!(c & 0x08)) { this.pre0++; if (this.pre0 < (2 << (c & 7))) return; this.pre0 = 0; }
    if (c & 0x40) { const l = ((this.tmr0 & 255) + 1) & 255; this.tmr0 = (this.tmr0 & 0xFF00) | l; if (!l) m[0xFF2] |= 0x04; }
    else { this.tmr0 = (this.tmr0 + 1) & 0xFFFF; if (!this.tmr0) m[0xFF2] |= 0x04; }
  }
  tick(n) {
    const m = this.m;
    for (let i = 0; i < n; i++) {
      if (this.inh0 > 0) this.inh0--; else if ((m[0xFD5] & 0xA0) === 0x80) this.t0inc();
      const t1 = m[0xFCD]; if ((t1 & 3) === 1) { if (++this.pre1 >= (1 << ((t1 >> 4) & 3))) { this.pre1 = 0; this.tmr1 = (this.tmr1 + 1) & 0xFFFF; if (!this.tmr1) m[0xF9E] |= 1; } }
      const t3 = m[0xFB1]; if ((t3 & 3) === 1) { if (++this.pre3 >= (1 << ((t3 >> 4) & 3))) { this.pre3 = 0; this.tmr3 = (this.tmr3 + 1) & 0xFFFF; if (!this.tmr3) m[0xFA1] |= 2; } }
      const t2 = m[0xFCA];
      if (t2 & 4) { const ps = [1, 4, 16, 16][t2 & 3]; if (++this.pre2 >= ps) { this.pre2 = 0; this.t2step(); } this.pwmEdge(); }
    }
    if (this.t1osc) { } // zarezerwowane
  }
  t2step() {
    const m = this.m;
    if (this.tmr2 === m[0xFCB]) { this.tmr2 = 0; if (++this.post2 > ((m[0xFCA] >> 3) & 15)) { this.post2 = 0; m[0xF9E] |= 2; } this.pwmPeriod(); }
    else this.tmr2 = (this.tmr2 + 1) & 255;
  }
  pwmMode(k) { const c = this.m[k === 1 ? 0xFBD : 0xFBA]; return (c & 0x0C) === 0x0C; }
  pwmDuty(k) { const m = this.m; return k === 1 ? (m[0xFBF] << 2) | ((m[0xFBD] >> 4) & 3) : (m[0xFBC] << 2) | ((m[0xFBA] >> 4) & 3); }
  pwmPeriod() { const m = this.m; let ch = false; for (const k of [1, 2]) { if (!this.pwmMode(k)) continue; if (k === 1) m[0xFBF] = m[0xFBE]; else m[0xFBC] = m[0xFBB]; const nv = this.pwmDuty(k) > 0 ? 1 : 0; if (this.pwm[k] !== nv) { this.pwm[k] = nv; ch = true; } } if (ch) this.pins(); }
  pwmEdge() { let ch = false; const ps = [1, 4, 16, 16][this.m[0xFCA] & 3], cnt = (this.tmr2 << 2) | Math.min(3, Math.floor(this.pre2 * 4 / ps)); for (const k of [1, 2]) { if (!this.pwmMode(k) || !this.pwm[k]) continue; if (cnt >= this.pwmDuty(k)) { this.pwm[k] = 0; ch = true; } } if (ch) this.pins(); }
  // ---- ADC ----
  adcStart() {
    const m = this.m, tadT = [2, 8, 32, 0, 4, 16, 64, 0][m[0xFC0] & 7], fosc = this.f * 4;
    const tad = tadT ? tadT / fosc : 2.5e-6, acq = [0, 2, 4, 6, 8, 12, 16, 20][(m[0xFC0] >> 3) & 7];
    this.adcAt = this.cycles + Math.max(1, Math.round((acq + 11) * tad * this.f));
    const ch = (m[0xFC2] >> 2) & 15; const pin = P18_AN[ch]; let vin = 0;
    if (pin && this.pinVolt) vin = this.pinVolt(pin[0], pin[1]);
    const vrp = (m[0xFC1] & 0x10) && this.pinVolt ? this.pinVolt('A', 3) : this.vdd, vrn = (m[0xFC1] & 0x20) && this.pinVolt ? this.pinVolt('A', 2) : 0;
    this.adcVal = Math.max(0, Math.min(1023, Math.round((vin - vrn) / Math.max(0.01, vrp - vrn) * 1023)));
    if (ch > 12) this.adcVal = 0;
  }
  adcDone() { const m = this.m, v = this.adcVal; if (m[0xFC0] & 0x80) { m[0xFC4] = v >> 8; m[0xFC3] = v & 255; } else { m[0xFC4] = v >> 2; m[0xFC3] = (v & 3) << 6; } m[0xFC2] &= ~2; m[0xF9E] |= 0x40; this.adcAt = null; }
  // ---- EEPROM i pamięć programu ----
  eeRead() { const m = this.m; if (m[0xFA6] & 0x80) { } else m[0xFA8] = this.ee[m[0xFA9]]; m[0xFA6] &= ~1; }
  eeStart() { const m = this.m; if (m[0xFA6] & 0x80) { const t2 = this.tblptr(); if (t2 < 0x8000) { if (m[0xFA6] & 0x10) { const b = t2 & ~63; for (let i = 0; i < 64; i++) this.prog[b + i] = 0xFF; } else { const b = t2 & ~31; for (let i = 0; i < 32; i++) this.prog[b + i] &= this.hold[i]; this.hold.fill(0xFF); } } this.stall = Math.round(0.002 * this.f); m[0xFA6] &= ~2; m[0xFA1] |= 0x10; return; } this.eeWriteAt = this.cycles + Math.round(0.004 * this.f); }
  // ---- EUSART ----
  baud() { const m = this.m, b16 = m[0xFB8] & 8, brgh = m[0xFAC] & 4, n = b16 ? (m[0xFB0] << 8) | m[0xFAF] : m[0xFAF]; const div = b16 ? (brgh ? 4 : 16) : (brgh ? 16 : 64); return this.f * 4 / (div * (n + 1)); }
  txPush(v) { const m = this.m; if (!(m[0xFAB] & 0x80) || !(m[0xFAC] & 0x20)) return; this.txq.push(v); if (this.txBusy === null) this.txNext(); else m[0xF9E] &= ~0x10; }
  txNext() { const m = this.m; if (!this.txq.length) { this.txBusy = null; return; } const v = this.txq.shift(); this.txBusy = { v, at: this.cycles + Math.round(10 / this.baud() * this.f) }; m[0xF9E] |= 0x10; if (this.txq.length) m[0xF9E] &= ~0x10; }
  rx(b) { const m = this.m; if (!(m[0xFAB] & 0x80) || !(m[0xFAB] & 0x10)) return true; if (this.cycles < this.rxAt) return false; if (this.rxf.length >= 2) { m[0xFAB] |= 2; return true; } this.rxf.push(b); m[0xF9E] |= 0x20; this.rxAt = this.cycles + Math.round(10 / this.baud() * this.f); return true; }
  // ---- MSSP ----
  sspMode() { const c = this.m[0xFC6]; return (c & 0x20) ? (c & 15) : -1; }
  sspWrite(v) {
    const m = this.m, md = this.sspMode(); m[0xFC9] = v;
    if (md >= 0 && md <= 3) { if (m[0xFC7] & 1) { m[0xFC6] |= 0x80; return; } const div = [4, 16, 64, 0][md] || 2 * ([1, 4, 16, 16][m[0xFCA] & 3]) * (m[0xFCB] + 1); this.spiAt = this.cycles + Math.max(1, Math.round(8 * div / 4)); this.spiOut = v; return; }
    if (md === 8) { const i = this.i2c; if (i.busy) { m[0xFC6] |= 0x80; return; } const x = this.bus ? this.bus.i2cByte(v, i) : null; m[0xFC5] = (m[0xFC5] & ~0x40) | (x ? 0 : 0x40); m[0xFC7] |= 1; m[0xFC7] = (m[0xFC7] & ~4) | (i.first && (v & 1) ? 4 : 0); i.busy = { at: this.cycles + this.i2cBit() * 9, done: () => { m[0xFC7] &= ~1; } }; i.first = false; }
  }
  i2cBit() { return Math.max(1, (this.m[0xFC8] + 1)); }
  i2cCmd() {
    const m = this.m, c = m[0xFC5], i = this.i2c; if (this.sspMode() !== 8 || i.busy) return;
    const fin = (bit, fn) => { i.busy = { at: this.cycles + this.i2cBit() * (bit === 8 ? 9 : 1), done: () => { m[0xFC5] &= ~(bit === 8 ? 8 : bit); if (fn) fn(); } }; };
    if (c & 1) { i.first = true; if (this.bus) this.bus.i2cStart(i); fin(1, () => { m[0xFC7] |= 8; m[0xFC7] &= ~0x10; }); }
    else if (c & 2) { i.first = true; if (this.bus) this.bus.i2cStart(i); fin(2); }
    else if (c & 4) { if (this.bus) this.bus.i2cStop(i); fin(4, () => { m[0xFC7] |= 0x10; m[0xFC7] &= ~8; }); }
    else if (c & 8) { const v = this.bus ? this.bus.i2cRead(i) : 0xFF; fin(8, () => { m[0xFC9] = v; m[0xFC7] |= 1; }); }
    else if (c & 0x10) { if (this.bus) this.bus.i2cAck(i, !(c & 0x20)); fin(0x10); }
  }
  // ---- wykonanie ----
  run(target) {
    const m = this.m;
    while (this.cycles < target) {
      // zdarzenia peryferiów
      if (this.eeWriteAt !== null && this.cycles >= this.eeWriteAt) { this.ee[m[0xFA9]] = m[0xFA8]; m[0xFA6] &= ~2; m[0xFA1] |= 0x10; this.eeWriteAt = null; this.eeDirty = true; }
      if (this.adcAt !== null && this.cycles >= this.adcAt) this.adcDone();
      if (this.txBusy && this.cycles >= this.txBusy.at) { const v = this.txBusy.v; this.txBusy = null; if (this.onTx) this.onTx(v); this.txNext(); }
      if (this.spiAt !== null && this.cycles >= this.spiAt) { this.spiAt = null; const r = this.bus ? this.bus.spiByte(this.spiOut) : 0xFF; if (m[0xFC7] & 1) m[0xFC6] |= 0x40; m[0xFC9] = r; m[0xFC7] |= 1; m[0xF9E] |= 8; }
      if (this.i2c.busy && this.cycles >= this.i2c.busy.at) { const b = this.i2c.busy; this.i2c.busy = null; b.done(); m[0xF9E] |= 8; }
      const wdtOn = (this.cfg[3] & 1) || (m[0xFD1] & 1);
      if (wdtOn && this.cycles - this.wdt >= Math.round(0.004 * (1 << ((this.cfg[3] >> 1) & 15)) * this.f)) { this.wdt = this.cycles; if (this.sleeping) { this.sleeping = false; m[0xFD0] &= ~0x08; } else { this.reset(false); m[0xFD0] &= ~0x08; this.wdtResets = (this.wdtResets || 0) + 1; continue; } }
      if (this.stall) { const k = Math.min(this.stall, target - this.cycles); this.stall -= k; this.cycles += k; continue; }
      if (this.sleeping) { if (this.anyWake()) { this.sleeping = false; } else { const nx = Math.min(target, this.nextEvent()); this.cycles = Math.max(this.cycles + 1, nx); continue; } }
      const vec = this.irq();
      if (vec) {
        if (!this.push(this.pc)) continue;
        this.ws = this.w; this.statuss = this.st; this.bsrs = this.m[0xFE0];
        if (vec === 0x18) { m[0xFF2] &= ~0x40; this.isrLvl.push(0x40); } else { m[0xFF2] &= ~0x80; this.isrLvl.push(0x80); }
        this.pc = vec; this.cycles += 3; this.tick(3); continue;
      }
      const n = this.step(); this.tick(n);
    }
  }
  nextEvent() { let t = Infinity; for (const v of [this.eeWriteAt, this.adcAt, this.txBusy && this.txBusy.at, this.spiAt, this.i2c.busy && this.i2c.busy.at]) if (v != null && v < t) t = v; return t; }
  step() {
    const m = this.m; const op = this.fetch(); this.jumped = false; let cyc = 1;
    const f = op & 255, a = (op >> 8) & 1, d = (op >> 9) & 1;
    const ad = () => this.ea(f, a);
    const store = (r) => { if (d) this.wr(ad(), r); else this.w = r; };
    const skip = () => { this.pc = (this.pc + 2) & 0x1FFFFF; cyc = 2; };
    const hi = op >> 12;
    switch (hi) {
      case 0x0: {
        if (op < 0x100) {
          switch (op) {
            case 0x0000: break;
            case 0x0003: this.wdt = this.cycles; m[0xFD0] = (m[0xFD0] | 0x08) & ~0x04; this.sleeping = true; break;
            case 0x0004: this.wdt = this.cycles; m[0xFD0] |= 0x0C; break;
            case 0x0005: this.push(this.pc); break;
            case 0x0006: this.pop(); break;
            case 0x0007: { let w = this.w, c = this.st & 1; if ((w & 15) > 9 || (this.st & 2)) w += 6; if (w > 0x99 || c || (w >> 4) > 9) { w += 0x60; c = 1; } this.st = (this.st & ~1) | (w > 255 || c ? 1 : 0); this.w = w; break; }
            case 0x0008: case 0x0009: case 0x000A: case 0x000B: { let t2 = this.tblptr(); if (op === 0x000B) t2++; m[0xFF5] = this.tblRead(t2 & 0x3FFFFF); if (op === 0x0009) t2++; if (op === 0x000A) t2--; this.setTblptr(t2); cyc = 2; break; }
            case 0x000C: case 0x000D: case 0x000E: case 0x000F: { let t2 = this.tblptr(); if (op === 0x000F) t2++; this.hold[t2 & 31] = m[0xFF5]; if (op === 0x000D) t2++; if (op === 0x000E) t2--; this.setTblptr(t2); cyc = 2; break; }
            case 0x0010: case 0x0011: { this.pc = this.pop(); const l = this.isrLvl.pop() || 0x80; m[0xFF2] |= (m[0xFD0] & 0x80) ? l : 0x80; if (op & 1) { this.w = this.ws; this.st = this.statuss; m[0xFE0] = this.bsrs; } cyc = 2; break; }
            case 0x0012: case 0x0013: this.pc = this.pop(); if (op & 1) { this.w = this.ws; this.st = this.statuss; m[0xFE0] = this.bsrs; } cyc = 2; break;
            case 0x00FF: this.reset(false); m[0xFD0] &= ~0x10; return 1;
            default: break;
          }
        } else if ((op >> 8) === 0x01) m[0xFE0] = op & 15;
        else if ((op >> 9) === 0x01) { const p = this.rd(ad()) * this.w; m[0xFF3] = p & 255; m[0xFF4] = (p >> 8) & 255; }
        else if ((op >> 10) === 0x01) store(this.sub(this.rd(ad()), 1, 1));
        else {
          const k = op & 255;
          switch (op >> 8) {
            case 0x08: this.w = this.sub(k, this.w, 1); break;
            case 0x09: this.w = this.w | k; this.nz(this.w); break;
            case 0x0A: this.w = this.w ^ k; this.nz(this.w); break;
            case 0x0B: this.w = this.w & k; this.nz(this.w); break;
            case 0x0C: this.w = k; this.pc = this.pop(); cyc = 2; break;
            case 0x0D: { const p = k * this.w; m[0xFF3] = p & 255; m[0xFF4] = p >> 8; break; }
            case 0x0E: this.w = k; break;
            case 0x0F: this.w = this.add(this.w, k, 0); break;
          }
        }
        break;
      }
      case 0x1: { const x = this.rd(ad()), s = (op >> 10) & 3; const r = s === 0 ? x | this.w : s === 1 ? x & this.w : s === 2 ? x ^ this.w : ~x & 255; this.nz(r); store(r); break; }
      case 0x2: { const x = this.rd(ad()), s = (op >> 10) & 3;
        if (s === 0) store(this.add(x, this.w, this.st & 1)); else if (s === 1) store(this.add(x, this.w, 0)); else if (s === 2) store(this.add(x, 1, 0)); else { const r = (x - 1) & 255; store(r); if (!r) skip(); } break; }
      case 0x3: { const x = this.rd(ad()), s = (op >> 10) & 3;
        if (s === 0) { const r = (x >> 1) | ((this.st & 1) << 7); this.st = (this.st & ~1) | (x & 1); this.nz(r); store(r); }
        else if (s === 1) { const r = ((x << 1) | (this.st & 1)) & 255; this.st = (this.st & ~1) | (x >> 7); this.nz(r); store(r); }
        else if (s === 2) store(((x << 4) | (x >> 4)) & 255);
        else { const r = (x + 1) & 255; store(r); if (!r) skip(); } break; }
      case 0x4: { const x = this.rd(ad()), s = (op >> 10) & 3;
        if (s === 0) { const r = (x >> 1) | ((x & 1) << 7); this.nz(r); store(r); }
        else if (s === 1) { const r = ((x << 1) | (x >> 7)) & 255; this.nz(r); store(r); }
        else if (s === 2) { const r = (x + 1) & 255; store(r); if (r) skip(); }
        else { const r = (x - 1) & 255; store(r); if (r) skip(); } break; }
      case 0x5: { const x = this.rd(ad()), s = (op >> 10) & 3;
        if (s === 0) { this.nz(x); store(x); } else if (s === 1) store(this.sub(this.w, x, this.st & 1)); else if (s === 2) store(this.sub(x, this.w, this.st & 1)); else store(this.sub(x, this.w, 1)); break; }
      case 0x6: { const s = (op >> 9) & 7, A = ad();
        switch (s) {
          case 0: if (this.rd(A) < this.w) skip(); break;
          case 1: if (this.rd(A) === this.w) skip(); break;
          case 2: if (this.rd(A) > this.w) skip(); break;
          case 3: if (this.rd(A) === 0) skip(); break;
          case 4: this.wr(A, 0xFF); break;
          case 5: this.wr(A, 0); this.st |= 4; break;
          case 6: this.wr(A, this.sub(0, this.rd(A), 1)); break;
          case 7: this.wr(A, this.w); break;
        } break; }
      case 0x7: case 0x8: case 0x9: case 0xA: case 0xB: { const b = (op >> 9) & 7, A = ad();
        if (hi === 0x7) this.wr(A, this.rd(A) ^ (1 << b)); else if (hi === 0x8) this.wr(A, this.rd(A) | (1 << b)); else if (hi === 0x9) this.wr(A, this.rd(A) & ~(1 << b));
        else { const v = (this.rd(A) >> b) & 1; if ((hi === 0xA && v) || (hi === 0xB && !v)) skip(); } break; }
      case 0xC: { const src = op & 0xFFF, w2 = this.fetch(); const dst = w2 & 0xFFF; const v = this.rd(src); if (dst !== 0xFF9 && dst !== 0xFFD && dst !== 0xFFE && dst !== 0xFFF) this.wr(dst, v); cyc = 2; break; }
      case 0xD: { let n = op & 0x7FF; if (n & 0x400) n -= 0x800; if (op & 0x800) { if (!this.push(this.pc)) return 2; } this.pc = (this.pc + 2 * n) & 0x1FFFFF; cyc = 2; break; }
      case 0xE: { const s = (op >> 8) & 15;
        if (s < 8) { const st = this.st; const cond = [st & 4, !(st & 4), st & 1, !(st & 1), st & 8, !(st & 8), st & 16, !(st & 16)][s]; if (cond) { let n = op & 255; if (n & 0x80) n -= 256; this.pc = (this.pc + 2 * n) & 0x1FFFFF; cyc = 2; } }
        else if (s === 0xC || s === 0xD) { const w2 = this.fetch(); const k = ((w2 & 0xFFF) << 8) | (op & 255); if (!this.push(this.pc)) return 2; if (s === 0xD) { this.ws = this.w; this.statuss = this.st; this.bsrs = m[0xFE0]; } this.pc = k * 2; cyc = 2; }
        else if (s === 0xE) { const w2 = this.fetch(); const n = (op >> 4) & 3; this.setFsr(n, ((op & 15) << 8) | (w2 & 255)); cyc = 2; }
        else if (s === 0xF) { const w2 = this.fetch(); this.pc = (((w2 & 0xFFF) << 8) | (op & 255)) * 2; cyc = 2; }
        break; }
      case 0xF: break; // druga część rozkazu dwusłowowego = NOP
    }
    if (this.jumped) cyc = Math.max(cyc, 2);
    this.cycles += cyc; return cyc;
  }
  // ---- nóżki ----
  pinState(port, bit) {
    const m = this.m, k = 'ABCDE'.indexOf(port), tris = (m[0xF92 + k] >> bit) & 1, lat = (m[0xF89 + k] >> bit) & 1;
    if (port === 'E' && bit === 3) return [null, false];
    if (port === 'C' && (bit === 4 || bit === 5)) return [null, false]; // RC4/RC5 – tylko wejścia, gdy USB wyłączone
    const md = this.sspMode();
    if (md === 8 && port === 'B' && (bit === 0 || bit === 1)) return [null, false]; // I2C – linie z otwartym drenem (podciągnięcie w module)
    if (md >= 0 && md <= 3 && ((port === 'B' && bit === 1) || (port === 'C' && bit === 7)) && !tris) return [port === 'B' ? ((m[0xFC6] >> 4) & 1) : 0, false];
    if ((m[0xFAB] & 0x80) && port === 'C' && bit === 6 && (m[0xFAC] & 0x20)) return [1, false]; // TX w spoczynku
    if (tris) return [null, port === 'B' && !(m[0xFF1] & 0x80)];
    if (port === 'C' && bit === 2 && this.pwmMode(1)) return [this.pwm[1], false];
    const ccp2pin = (this.cfg[5] & 1) ? ['C', 1] : ['B', 3];
    if (port === ccp2pin[0] && bit === ccp2pin[1] && this.pwmMode(2)) return [this.pwm[2], false];
    return [lat, false];
  }
}
// magistrale MSSP: urządzenia I2C/SPI podłączone do nóżek PIC18
function pic18Bus(d, pinIdx) {
  const node = (port, bit) => d.n[pinIdx(port, bit)];
  return {
    devsI2C() { const sda = node('B', 0), scl = node('B', 1); return CIR.devs.filter(x => x.P.i2c && x.n[x.P.i2c.sda] === sda && x.n[x.P.i2c.scl] === scl && devPowered(x)); },
    i2cStart(i) { if (i.dev && i.dev.P.i2c.stop && i.restart) { } i.dev = null; i.restart = true; },
    i2cByte(v, i) {
      if (i.first) { const a = v >> 1, rw = v & 1; i.dev = this.devsI2C().find(x => { const ad = x.P.i2c.addr(x); return Array.isArray(ad) ? ad.includes(a) : ad === a; }) || null; if (i.dev) { i.dev.s.i2cAddr = a; if (i.dev.P.i2c.start) i.dev.P.i2c.start(i.dev, !rw, a); } E.dirty = true; return i.dev; }
      if (!i.dev) return null; const r = i.dev.P.i2c.write(i.dev, v); E.dirty = true; return r === false ? null : i.dev;
    },
    i2cRead(i) { if (!i.dev) return 0xFF; E.dirty = true; return i.dev.P.i2c.read(i.dev, true) & 255; },
    i2cAck(i, ack) { },
    i2cStop(i) { if (i.dev && i.dev.P.i2c.stop) i.dev.P.i2c.stop(i.dev); i.dev = null; E.dirty = true; },
    spiByte(v) {
      const mosi = node('C', 7), sck = node('B', 1); let resp = 0xFF;
      for (const x of CIR.devs) { const bs = x.P.spi ? [].concat(x.P.spi) : []; for (const b of bs) { if (x.n[b.mosi] !== mosi || x.n[b.sck] !== sck || !devPowered(x)) continue; if (pinLevel(x, b.cs) !== (b.csHigh ? 1 : 0)) continue; const r = spiByteTo(x, b, v); if (r !== undefined && r !== null) resp = r; } }
      E.dirty = true; return resp & 255;
    },
  };
}
