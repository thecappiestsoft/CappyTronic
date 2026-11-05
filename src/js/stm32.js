'use strict';
/* ================= STM32F103C8 (Blue Pill) – emulacja ARM Cortex-M3 i peryferiów =================
   Rdzeń: zestaw rozkazów Thumb/Thumb-2 (ARMv7-M, bez FPU), wyjątki i przerwania (NVIC, priorytety, wywłaszczanie, tail-chaining
   uproszczony), SysTick, SCB (VTOR, AIRCR reset), DWT CYCCNT, bit-banding, WFI. Peryferia wg RM0008: RCC (HSE, PLL, preskalery,
   bramkowanie zegarów), FLASH ACR, GPIOA–C (CRL/CRH/IDR/ODR/BSRR/BRR), AFIO, EXTI, USART1–3, TIM1–4 (licznik, przerwania, PWM),
   ADC1 (12 bit, kalibracja, czujnik temperatury, VREFINT), I2C1/I2C2 (master), SPI1/SPI2 (master), IWDG. */
class Stm32 {
  constructor(flash) {
    this.flash = flash; this.fdv = new DataView(flash.buffer); this.fh = new Uint16Array(flash.buffer);
    this.ram = new Uint8Array(20 * 1024); this.rdv = new DataView(this.ram.buffer);
    this.r = new Int32Array(16); this.cycles = 0; this.inp = { A: 0, B: 0, C: 0 }; this.onPins = null; this.vdd = 3.3; this.f = 8e6; this.tempC = 25;
    this.reset(true);
  }
  reset(por) {
    this.r.fill(0); this.N = this.Z = this.C = this.V = 0; this.it = 0; this.primask = 0; this.faultmask = 0; this.basepri = 0; this.control = 0;
    this.msp = this.rd32(0) & ~3; this.psp = 0; this.r[13] = this.msp; this.r[14] = -1; this.pc = this.rd32(4) & ~1; this.handler = 0; this.active = []; this.pend = new Uint8Array(80); this.ena = new Uint8Array(80); this.prio = new Uint8Array(80);
    this.sleeping = false; this.pdirty = true; this.hk = 0; this.events = []; this.vtor = 0; this.aircr = 0xFA050000; this.scr = 0; this.shpr = [0, 0, 0];
    this.st = { ctrl: 0, load: 0, start: 0, next: Infinity, flag: 0 }; this.dwt = { ctrl: 0, base: this.cycles }; this.demcr = 0;
    // RCC
    this.rcc = { cr: 0x83, cfgr: 0, cir: 0, apb2rstr: 0, apb1rstr: 0, ahbenr: 0x14, apb2enr: 0, apb1enr: 0, bdcr: 0, csr: 0x0C000000 }; this.flashAcr = 0x30;
    this.gpio = {}; for (const p of 'ABCD') this.gpio[p] = { crl: 0x44444444, crh: 0x44444444, odr: 0, lck: 0 };
    this.afio = { evcr: 0, mapr: 0, exticr: [0, 0, 0, 0] }; this.exti = { imr: 0, emr: 0, rtsr: 0, ftsr: 0, pr: 0 };
    this.usart = {}; for (const k of [1, 2, 3]) this.usart[k] = { sr: 0xC0, dr: 0, brr: 0, cr1: 0, cr2: 0, cr3: 0, gtpr: 0, tx: null, txq: [], rx: [], rxAt: 0 };
    this.tim = {}; for (const k of [1, 2, 3, 4]) this.tim[k] = { cr1: 0, cr2: 0, smcr: 0, dier: 0, sr: 0, ccmr1: 0, ccmr2: 0, ccer: 0, psc: 0, arr: 0xFFFF, rcr: 0, ccr: [0, 0, 0, 0], bdtr: 0, cnt0: 0, base: 0, out: [0, 0, 0, 0], next: Infinity, egr: 0 };
    this.adc = { sr: 0, cr1: 0, cr2: 0, smpr1: 0, smpr2: 0, sqr: [0, 0, 0], dr: 0, at: null, jofr: [0, 0, 0, 0], htr: 0xFFF, ltr: 0 };
    this.i2c = {}; for (const k of [1, 2]) this.i2c[k] = { cr1: 0, cr2: 0, oar1: 0, oar2: 0, dr: 0, sr1: 0, sr2: 0, ccr: 0, trise: 2, st: 'idle', dev: null, rd: false, srRead: false, nack: false };
    this.spi = {}; for (const k of [1, 2]) this.spi[k] = { cr1: 0, cr2: 0, sr: 2, dr: 0, at: null, out: 0 };
    this.iwdg = { on: false, pr: 0, rlr: 0xFFF, last: this.cycles, unlock: false };
    this.clk(); this.pins();
  }
  pins() { if (this.onPins) this.onPins(); }
  setPend(n) { this.pend[n] = 1; this.pdirty = true; }
  clrPend(n) { this.pend[n] = 0; this.pdirty = true; }
  // ---- zegary ----
  clk() {
    const c = this.rcc.cfgr, sws = (c >> 2) & 3; const hse = 8e6, hsi = 8e6;
    let sys = hsi; if (sws === 1) sys = hse; else if (sws === 2) { const src = (c & 0x10000) ? (c & 0x20000 ? hse / 2 : hse) : hsi / 2; let mul = ((c >> 18) & 15) + 2; if (mul > 16) mul = 16; sys = src * mul; }
    const hp = (c >> 4) & 15, hdiv = hp < 8 ? 1 : [2, 4, 8, 16, 64, 128, 256, 512][hp - 8];
    this.hclk = sys / hdiv; const p1 = (c >> 8) & 7, p2 = (c >> 11) & 7; const d1 = p1 < 4 ? 1 : 1 << (p1 - 3), d2 = p2 < 4 ? 1 : 1 << (p2 - 3);
    this.pclk1 = this.hclk / d1; this.pclk2 = this.hclk / d2; this.timclk1 = d1 === 1 ? this.pclk1 : this.pclk1 * 2; this.timclk2 = d2 === 1 ? this.pclk2 : this.pclk2 * 2;
    this.adcclk = this.pclk2 / [2, 4, 6, 8][(c >> 14) & 3];
    if (this.hclk !== this.f) { const old = this.f; this.f = this.hclk; this.clkChanged = old; }
  }
  // ---- pamięć ----
  bb(a) { return a >= 0x22000000 && a < 0x24000000 ? [0x20000000 + ((a - 0x22000000) >> 5), ((a - 0x22000000) >> 2) & 7] : a >= 0x42000000 && a < 0x44000000 ? [0x40000000 + ((a - 0x42000000) >> 5), ((a - 0x42000000) >> 2) & 7] : null; }
  rd32(a) {
    a >>>= 0;
    if (a < 0x00020000) return this.fdv.getInt32(a, true);
    if (a >= 0x08000000 && a < 0x08020000) return this.fdv.getInt32(a - 0x08000000, true);
    if (a >= 0x20000000 && a < 0x20005000) return this.rdv.getInt32(a - 0x20000000, true);
    return this.io(a, 4, null);
  }
  rd16(a) {
    a >>>= 0;
    if (a < 0x00020000) return this.fdv.getUint16(a, true);
    if (a >= 0x08000000 && a < 0x08020000) return this.fdv.getUint16(a - 0x08000000, true);
    if (a >= 0x20000000 && a < 0x20005000) return this.rdv.getUint16(a - 0x20000000, true);
    return (this.io((a & ~3) >>> 0, 2, null) >>> ((a & 2) * 8)) & 0xFFFF;
  }
  rd8(a) {
    a >>>= 0;
    if (a < 0x00020000) return this.flash[a];
    if (a >= 0x08000000 && a < 0x08020000) return this.flash[a - 0x08000000];
    if (a >= 0x20000000 && a < 0x20005000) return this.ram[a - 0x20000000];
    return (this.io((a & ~3) >>> 0, 1, null) >>> ((a & 3) * 8)) & 255;
  }
  wr32(a, v) { a >>>= 0; if (a >= 0x20000000 && a < 0x20005000) { this.rdv.setInt32(a - 0x20000000, v, true); return; } this.io(a, 4, v | 0); }
  wr16(a, v) { a >>>= 0; if (a >= 0x20000000 && a < 0x20005000) { this.rdv.setUint16(a - 0x20000000, v, true); return; } this.io((a & ~3) >>> 0, 2, (v & 0xFFFF) << ((a & 2) * 8), a & 2); }
  wr8(a, v) { a >>>= 0; if (a >= 0x20000000 && a < 0x20005000) { this.ram[a - 0x20000000] = v; return; } this.io((a & ~3) >>> 0, 1, (v & 255) << ((a & 3) * 8), a & 3); }
  fault(msg) { throw new StmFault(msg); }
  io(a, size, v, sub) {
    a >>>= 0; this.hk = 0;
    const b = this.bb(a);
    if (b) { const w = b[0] & ~3, bit = ((b[0] & 3) << 3) + b[1]; if (v === null) return (this.rd32(w) >>> bit) & 1; const old = this.rd32(w); this.wr32(w, (v & 1) ? old | (1 << bit) : old & ~(1 << bit)); return; }
    if (a >= 0x40000000 && a < 0x40030000) { const r = this.periph(a, v === null ? null : (size === 4 ? v : sub ? this.mergeIO(a, size, v, sub) : v & (size === 2 ? 0xFFFF : 0xFF))); return v === null ? r | 0 : undefined; }
    if (a >= 0xE0000000 && a < 0xE0100000) { this.pdirty = true; if (v !== null && size < 4) { this.ppb(a + (sub || 0), (v >>> ((sub || 0) * 8)) & (size === 2 ? 0xFFFF : 0xFF), size); return; } const r = this.ppb(a, v === null ? null : v, 4); return v === null ? r | 0 : undefined; }
    if (a >= 0x1FFFF000 && a < 0x1FFFF900) { if (a === 0x1FFFF7E8) return 0x12345678; if (a === 0x1FFFF7E0) return 64; return 0; } // ID, rozmiar flash
    if (a >= 0x08000000 && a < 0x08020000) { if (v !== null) this.fault('zapis do pamięci Flash 0x' + (a >>> 0).toString(16)); return 0; }
    this.fault((v === null ? 'odczyt' : 'zapis') + ' spod nieistniejącego adresu 0x' + (a >>> 0).toString(16).padStart(8, '0'));
  }
  mergeIO(a, size, v, sub) { const old = this.periph(a, null) | 0; const mask = (size === 2 ? 0xFFFF : 0xFF) << (sub * 8); return (old & ~mask) | (v & mask); }
  // ---- rejestry rdzenia (PPB) ----
  ppb(a, v, size) {
    const W = v !== null;
    switch (a) {
      case 0xE000E010: if (W) { const st = this.st, old = st.ctrl; st.ctrl = v & 7; if ((v & 1) && !(old & 1)) this.stStart(); if (!(v & 1)) st.next = Infinity; return; } { const f = this.st.flag; this.st.flag = 0; return this.st.ctrl | (f << 16); }
      case 0xE000E014: if (W) { this.st.load = v & 0xFFFFFF; return; } return this.st.load;
      case 0xE000E018: if (W) { this.st.flag = 0; if (this.st.ctrl & 1) this.stStart(); return; } return this.stVal();
      case 0xE000E01C: return 9000;
      case 0xE000ED00: return 0x411FC231;
      case 0xE000ED04: if (W) { if (v & (1 << 28)) this.setPend(14); if (v & (1 << 27)) this.clrPend(14); if (v & (1 << 26)) this.setPend(15); if (v & (1 << 25)) this.clrPend(15); return; } return (this.pend[14] << 28) | (this.pend[15] << 26) | (this.handler & 0x1FF);
      case 0xE000ED08: if (W) { this.vtor = v & 0x3FFFFF80; return; } return this.vtor;
      case 0xE000ED0C: if (W) { if ((v >>> 16) === 0x05FA) { this.aircr = 0xFA050000 | (v & 0x700); if (v & 4) { this.resetReq = true; } } return; } return this.aircr;
      case 0xE000ED10: if (W) { this.scr = v & 0x16; return; } return this.scr;
      case 0xE000ED14: return 0x200;
      case 0xE000ED18: case 0xE000ED1C: case 0xE000ED20: { const i = (a - 0xE000ED18) >> 2; if (W) { this.shpr[i] = v; for (let k = 0; k < 4; k++) this.prio[4 + i * 4 + k] = (v >>> (k * 8)) & 0xF0; return; } return this.shpr[i]; }
      case 0xE000ED24: case 0xE000ED28: case 0xE000ED2C: case 0xE000ED30: case 0xE000ED34: case 0xE000ED38: return 0;
      case 0xE000EDFC: if (W) { this.demcr = v; return; } return this.demcr;
      case 0xE0001000: if (W) { this.dwt.ctrl = v; if (v & 1) this.dwt.base = this.cycles - (this.dwtCnt || 0); return; } return this.dwt.ctrl | 0x40000000;
      case 0xE0001004: if (W) { this.dwt.base = this.cycles - (v >>> 0); return; } return (this.dwt.ctrl & 1) ? ((this.cycles - this.dwt.base) >>> 0) : 0;
      case 0xE000EF00: if (W) { const n = v & 0x1FF; if (n < 64) this.setPend(16 + n); } return 0;
    }
    if (a >= 0xE000ED18 && a < 0xE000ED24 && size < 4) { if (W) { const n = 4 + (a - 0xE000ED18); for (let k = 0; k < size; k++) this.prio[n + k] = (v >>> (k * 8)) & 0xF0; } return; }
    if (a >= 0xE000E100 && a < 0xE000E108) { const base = (a - 0xE000E100) * 8; if (W) { for (let k = 0; k < 32; k++) if (v & (1 << k)) this.ena[16 + base + k] = 1; return; } let x = 0; for (let k = 0; k < 32; k++) if (this.ena[16 + base + k]) x |= 1 << k; return x; }
    if (a >= 0xE000E180 && a < 0xE000E188) { const base = (a - 0xE000E180) * 8; if (W) { for (let k = 0; k < 32; k++) if (v & (1 << k)) this.ena[16 + base + k] = 0; return; } let x = 0; for (let k = 0; k < 32; k++) if (this.ena[16 + base + k]) x |= 1 << k; return x; }
    if (a >= 0xE000E200 && a < 0xE000E208) { const base = (a - 0xE000E200) * 8; if (W) { for (let k = 0; k < 32; k++) if (v & (1 << k)) this.setPend(16 + base + k); return; } let x = 0; for (let k = 0; k < 32; k++) if (this.pend[16 + base + k]) x |= 1 << k; return x; }
    if (a >= 0xE000E280 && a < 0xE000E288) { const base = (a - 0xE000E280) * 8; if (W) { for (let k = 0; k < 32; k++) if (v & (1 << k)) this.clrPend(16 + base + k); return; } let x = 0; for (let k = 0; k < 32; k++) if (this.pend[16 + base + k]) x |= 1 << k; return x; }
    if (a >= 0xE000E300 && a < 0xE000E308) { const base = (a - 0xE000E300) * 8; let x = 0; for (let k = 0; k < 32; k++) if (this.active.includes(16 + base + k)) x |= 1 << k; return x; }
    if (a >= 0xE000E400 && a < 0xE000E440) { const n = 16 + (a - 0xE000E400); if (W) { for (let k = 0; k < (size || 4); k++) this.prio[n + k] = (v >>> (k * 8)) & 0xF0; return; } let x = 0; for (let k = 0; k < 4; k++) x |= this.prio[n + k] << (k * 8); return x; }
    return 0;
  }
  stStart() { const st = this.st; st.start = this.cycles; st.next = (st.ctrl & 1) ? this.cycles + this.stPeriod() : Infinity; }
  stPeriod() { return (this.st.load + 1) * ((this.st.ctrl & 4) ? 1 : 8); }
  stVal() { const st = this.st; if (!(st.ctrl & 1) || !st.load) return 0; const div = (st.ctrl & 4) ? 1 : 8; const el = Math.floor((this.cycles - st.start) / div) % (st.load + 1); return st.load - el; }
  // ---- peryferia ----
  en2(bit) { return (this.rcc.apb2enr >> bit) & 1; }
  en1(bit) { return (this.rcc.apb1enr >> bit) & 1; }
  periph(a, v) {
    const W = v !== null, off = a & 0x3FF, blk = a & ~0x3FF;
    switch (blk) {
      case 0x40021000: return this.rccReg(off, v);
      case 0x40022000: if (off === 0) { if (W) this.flashAcr = v & 0x3F; return this.flashAcr | 0x20; } return off === 0x0C ? 0 : 0;
      case 0x40010800: case 0x40010C00: case 0x40011000: case 0x40011400: { const p = 'ABCD'[(blk - 0x40010800) >> 10]; if (!this.en2(2 + 'ABCD'.indexOf(p))) return 0; return this.gpioReg(p, off, v); }
      case 0x40010000: if (!this.en2(0)) return 0; return this.afioReg(off, v);
      case 0x40010400: return this.extiReg(off, v);
      case 0x40013800: if (!this.en2(14)) return 0; return this.usartReg(1, off, v);
      case 0x40004400: if (!this.en1(17)) return 0; return this.usartReg(2, off, v);
      case 0x40004800: if (!this.en1(18)) return 0; return this.usartReg(3, off, v);
      case 0x40012C00: if (!this.en2(11)) return 0; return this.timReg(1, off, v);
      case 0x40000000: if (!this.en1(0)) return 0; return this.timReg(2, off, v);
      case 0x40000400: if (!this.en1(1)) return 0; return this.timReg(3, off, v);
      case 0x40000800: if (!this.en1(2)) return 0; return this.timReg(4, off, v);
      case 0x40012400: if (!this.en2(9)) return 0; return this.adcReg(off, v);
      case 0x40005400: if (!this.en1(21)) return 0; return this.i2cReg(1, off, v);
      case 0x40005800: if (!this.en1(22)) return 0; return this.i2cReg(2, off, v);
      case 0x40013000: if (!this.en2(12)) return 0; return this.spiReg(1, off, v);
      case 0x40003800: if (!this.en1(14)) return 0; return this.spiReg(2, off, v);
      case 0x40003000: return this.iwdgReg(off, v);
      case 0x40007000: case 0x40006C00: case 0x40002800: case 0x40002C00: case 0x40020000: case 0x40023000: case 0x40012800: case 0x40005C00: case 0x40006000: case 0x40006400: return 0;
    }
    this.fault((W ? 'zapis' : 'odczyt') + ' – brak układu peryferyjnego pod adresem 0x' + (a >>> 0).toString(16));
  }
  rccReg(off, v) {
    const R = this.rcc, W = v !== null;
    const names = { 0: 'cr', 4: 'cfgr', 8: 'cir', 0x0C: 'apb2rstr', 0x10: 'apb1rstr', 0x14: 'ahbenr', 0x18: 'apb2enr', 0x1C: 'apb1enr', 0x20: 'bdcr', 0x24: 'csr' };
    const k = names[off]; if (!k) return 0;
    if (!W) return R[k];
    if (k === 'cr') { R.cr = (v & 0x010D00F9) | (R.cr & 0x0A020002); const t = this.cycles; if (v & (1 << 16)) this.later(t + 2000, () => { R.cr |= 1 << 17; }); else R.cr &= ~(1 << 17); if (v & (1 << 24)) this.later(t + 200, () => { R.cr |= 1 << 25; }); else R.cr &= ~(1 << 25); if (v & 1) R.cr |= 2; return; }
    if (k === 'cfgr') { const sw = v & 3; R.cfgr = (v & ~0xC) | (R.cfgr & 0xC); const ok = sw === 0 || (sw === 1 && (R.cr & (1 << 17))) || (sw === 2 && (R.cr & (1 << 25))); if (ok) R.cfgr = (R.cfgr & ~0xC) | (sw << 2); this.clk(); return; }
    if (k === 'csr') { R.csr = (v & 0x01000001) | (R.csr & 0xFC000000); if (v & 0x01000000) R.csr &= 0x00FFFFFF; if (v & 1) R.csr |= 2; return; }
    R[k] = v >>> 0; if (k === 'apb2enr' || k === 'apb1enr') this.pins();
  }
  gpioReg(p, off, v) {
    const g = this.gpio[p], W = v !== null;
    switch (off) {
      case 0x00: if (W) { g.crl = v >>> 0; this.pins(); return; } return g.crl;
      case 0x04: if (W) { g.crh = v >>> 0; this.pins(); return; } return g.crh;
      case 0x08: return this.inp[p] & 0xFFFF;
      case 0x0C: if (W) { g.odr = v & 0xFFFF; this.pins(); return; } return g.odr;
      case 0x10: if (W) { g.odr = (g.odr | (v & 0xFFFF)) & ~(v >>> 16); this.pins(); return; } return 0;
      case 0x14: if (W) { g.odr &= ~(v & 0xFFFF); this.pins(); return; } return 0;
      case 0x18: if (W) { g.lck = v; return; } return g.lck;
    }
    return 0;
  }
  afioReg(off, v) { const A = this.afio, W = v !== null; if (off === 0) { if (W) A.evcr = v; return A.evcr; } if (off === 4) { if (W) { A.mapr = v & 0x1FFFFF; A.swj = (v >>> 24) & 7; this.pins(); } return A.mapr & 0x1FFFFF; } if (off >= 8 && off < 0x18) { const i = (off - 8) >> 2; if (W) A.exticr[i] = v & 0xFFFF; return A.exticr[i]; } return 0; }
  extiReg(off, v) {
    const X = this.exti, W = v !== null;
    switch (off) {
      case 0x00: if (W) X.imr = v & 0xFFFFF; return X.imr; case 0x04: if (W) X.emr = v & 0xFFFFF; return X.emr;
      case 0x08: if (W) X.rtsr = v & 0xFFFFF; return X.rtsr; case 0x0C: if (W) X.ftsr = v & 0xFFFFF; return X.ftsr;
      case 0x10: if (W) { X.pr |= v & X.imr; this.extiIrq(); } return 0;
      case 0x14: if (W) { X.pr &= ~v; } return X.pr;
    }
    return 0;
  }
  extiIrq() { const pr = this.exti.pr & this.exti.imr; for (let l = 0; l < 16; l++) if (pr & (1 << l)) this.setPend(16 + (l < 5 ? 6 + l : l < 10 ? 23 : 40)); }
  // ---- USART ----
  usartClk(k) { return k === 1 ? this.pclk2 : this.pclk1; }
  usartReg(k, off, v) {
    const U = this.usart[k], W = v !== null;
    switch (off) {
      case 0x00: if (W) { U.sr &= (v | ~0x360) ; this.usartIrq(k); return; } return U.sr;
      case 0x04: if (W) { if (!(U.cr1 & 0x2000) || !(U.cr1 & 8)) return; U.sr &= ~0x40; if (U.tx === null) this.usartStart(k, v & 0x1FF); else { U.txq = [v & 0x1FF]; U.sr &= ~0x80; } this.usartIrq(k); return; }
        { const d = U.rx.length ? U.rx.shift() : U.dr; U.dr = d; if (!U.rx.length) U.sr &= ~0x20; U.sr &= ~0x0F; this.usartIrq(k); return d; }
      case 0x08: if (W) { U.brr = v & 0xFFFF; return; } return U.brr;
      case 0x0C: if (W) { U.cr1 = v & 0x3FFF; this.usartIrq(k); this.pins(); return; } return U.cr1;
      case 0x10: if (W) U.cr2 = v & 0x7FFF; return U.cr2;
      case 0x14: if (W) U.cr3 = v & 0x7FF; return U.cr3;
      case 0x18: if (W) U.gtpr = v & 0xFFFF; return U.gtpr;
    }
    return 0;
  }
  byteCycles(k) { const U = this.usart[k]; const baud = U.brr ? this.usartClk(k) / U.brr : 9600; return Math.max(1, Math.round(10 / baud * this.f)); }
  usartStart(k, v) { const U = this.usart[k]; U.tx = v; U.sr |= 0x80; this.later(this.cycles + this.byteCycles(k), () => this.usartDone(k)); }
  usartDone(k) { const U = this.usart[k]; const v = U.tx; U.tx = null; if (this.onUart) this.onUart(k, v & 255); if (U.txq.length) { this.usartStart(k, U.txq.shift()); } else U.sr |= 0x40; this.usartIrq(k); }
  uartRx(k, b) { const U = this.usart[k]; if (!(U.cr1 & 0x2000) || !(U.cr1 & 4)) return true; if (this.cycles < U.rxAt) return false; if (U.rx.length >= 1 && (U.sr & 0x20)) { U.sr |= 8; return true; } U.rx.push(b); U.sr |= 0x20; U.rxAt = this.cycles + this.byteCycles(k); this.usartIrq(k); return true; }
  usartIrq(k) { const U = this.usart[k]; const on = ((U.cr1 & 0x80) && (U.sr & 0x80)) || ((U.cr1 & 0x40) && (U.sr & 0x40)) || ((U.cr1 & 0x20) && (U.sr & 0x28)); if (on) this.setPend(16 + 36 + k); }
  // ---- timery ----
  timClk(k) { return k === 1 ? this.timclk2 : this.timclk1; }
  timTick(k) { const T = this.tim[k]; return Math.max(1, (this.f / this.timClk(k)) * (T.psc + 1)); } // cykle rdzenia na jedno zliczenie
  timCnt(k) { const T = this.tim[k]; if (!(T.cr1 & 1)) return T.cnt0; const el = Math.floor((this.cycles - T.base) / this.timTick(k)); return (T.cnt0 + el) % (T.arr + 1); }
  timSync(k) { const T = this.tim[k]; T.cnt0 = this.timCnt(k); T.base = this.cycles; T.wraps = 0; T.lastCnt = undefined; T.next = this.cycles; }
  timReg(k, off, v) {
    const T = this.tim[k], W = v !== null; const ccr = off >= 0x34 && off <= 0x40 ? (off - 0x34) >> 2 : -1;
    if (ccr >= 0) { if (W) { this.timSync(k); T.ccr[ccr] = v & 0xFFFF; return; } return T.ccr[ccr]; }
    switch (off) {
      case 0x00: if (W) { this.timSync(k); T.cr1 = v & 0x3FF; this.timSync(k); this.pins(); return; } return T.cr1;
      case 0x04: if (W) T.cr2 = v; return T.cr2; case 0x08: if (W) T.smcr = v; return T.smcr;
      case 0x0C: if (W) { T.dier = v & 0x5F5F; this.timIrq(k); } return T.dier;
      case 0x10: if (W) { T.sr &= v | ~0x1E5F; this.timIrq(k); return; } return T.sr;
      case 0x14: if (W && (v & 1)) { T.cnt0 = 0; T.base = this.cycles; T.wraps = 0; T.psc = T.pscBuf !== undefined ? T.pscBuf : T.psc; T.sr |= 1; this.timIrq(k); T.next = this.cycles; } return 0;
      case 0x18: if (W) { T.ccmr1 = v & 0xFFFF; this.pins(); } return T.ccmr1;
      case 0x1C: if (W) { T.ccmr2 = v & 0xFFFF; this.pins(); } return T.ccmr2;
      case 0x20: if (W) { T.ccer = v & 0xFFFF; this.pins(); } return T.ccer;
      case 0x24: if (W) { T.cnt0 = v & 0xFFFF; T.base = this.cycles; T.wraps = 0; T.next = this.cycles; return; } return this.timCnt(k);
      case 0x28: if (W) { this.timSync(k); T.pscBuf = v & 0xFFFF; if (!(T.cr1 & 1)) T.psc = T.pscBuf; return; } return T.pscBuf !== undefined ? T.pscBuf : T.psc;
      case 0x2C: if (W) { this.timSync(k); T.arr = v & 0xFFFF; return; } return T.arr;
      case 0x30: if (W) T.rcr = v & 255; return T.rcr;
      case 0x44: if (W) { T.bdtr = v & 0xFFFF; this.pins(); } return T.bdtr;
    }
    return 0;
  }
  timIrq(k) { const T = this.tim[k]; if (T.dier & T.sr & 0x5F) { if (k === 1) { if (T.dier & T.sr & 1) this.setPend(16 + 25); if (T.dier & T.sr & 0x1E) this.setPend(16 + 27); } else this.setPend(16 + 26 + k); } }
  timMode(k, ch) { const T = this.tim[k]; const m = ch < 2 ? T.ccmr1 : T.ccmr2; return (m >> ((ch & 1) * 8 + 4)) & 7; }
  timEvent(k) {
    const T = this.tim[k]; if (!(T.cr1 & 1)) { T.next = Infinity; return; }
    const tick = this.timTick(k), per = T.arr + 1, tot = T.cnt0 + Math.floor((this.cycles - T.base) / tick), wraps = Math.floor(tot / per), cnt = tot % per;
    const wrapped = T.wraps !== undefined && wraps > T.wraps; T.wraps = wraps;
    // aktualizacja wyjść PWM i flag porównania
    let ch = false;
    for (let c = 0; c < 4; c++) {
      const md = this.timMode(k, c); const was = T.out[c];
      if (md === 6 || md === 7) { let on = cnt < T.ccr[c]; if (md === 7) on = !on; T.out[c] = on ? 1 : 0; }
      const cc = T.ccr[c], lc = T.lastCnt; if (lc !== undefined && lc !== cnt && ((lc < cc && cnt >= cc) || (cnt < lc && (cc > lc || cc <= cnt)))) T.sr |= 2 << c;
      if (was !== T.out[c]) ch = true;
    }
    if (wrapped) { T.sr |= 1; if (T.pscBuf !== undefined && T.pscBuf !== T.psc) { T.cnt0 = cnt; T.base = this.cycles; T.wraps = 0; T.psc = T.pscBuf; } }
    T.lastCnt = cnt; T.lastCC = 1; this.timIrq(k);
    if (ch) this.pins();
    // następne zdarzenie: najbliższe porównanie albo przepełnienie
    let nxt = T.arr + 1; for (let c = 0; c < 4; c++) { const cc = T.ccr[c]; if (cc > cnt && cc < nxt) nxt = cc; }
    const el = Math.floor((this.cycles - T.base) / this.timTick(k)); T.next = T.base + Math.ceil((el + (nxt - cnt)) * this.timTick(k));
    if (T.next <= this.cycles) T.next = this.cycles + 1;
  }
  // ---- ADC ----
  adcReg(off, v) {
    const A = this.adc, W = v !== null;
    switch (off) {
      case 0x00: if (W) { A.sr &= v | ~0x1F; return; } return A.sr;
      case 0x04: if (W) A.cr1 = v; return A.cr1;
      case 0x08: if (W) { const old = A.cr2; A.cr2 = v & 0xFFFFFFF0 | (v & 0x0F); if ((v & 1) && (old & 1) && !(v & 4)) this.adcStart(); if ((v & 4)) this.later(this.cycles + Math.round(83 / this.adcclk * this.f), () => { A.cr2 &= ~4; }); if (v & 8) A.cr2 &= ~8; if ((v & (1 << 22)) && (v & (1 << 20)) && ((v >> 17) & 7) === 7) { A.cr2 &= ~(1 << 22); this.adcStart(); } return; } return A.cr2;
      case 0x0C: if (W) A.smpr1 = v; return A.smpr1; case 0x10: if (W) A.smpr2 = v; return A.smpr2;
      case 0x24: if (W) A.htr = v; return A.htr; case 0x28: if (W) A.ltr = v; return A.ltr;
      case 0x2C: case 0x30: case 0x34: { const i = (off - 0x2C) >> 2; if (W) A.sqr[i] = v; return A.sqr[i]; }
      case 0x4C: { A.sr &= ~2; return A.dr; }
    }
    return 0;
  }
  adcStart() {
    const A = this.adc, ch = A.sqr[2] & 31; const smp = ch < 10 ? (A.smpr2 >> (ch * 3)) & 7 : (A.smpr1 >> ((ch - 10) * 3)) & 7;
    const t = [1.5, 7.5, 13.5, 28.5, 41.5, 55.5, 71.5, 239.5][smp] + 12.5; A.sr |= 0x10;
    let vin = 0; if (ch < 10) vin = this.pinVolt ? this.pinVolt(ch < 8 ? 'A' : 'B', ch < 8 ? ch : ch - 8) : 0; else if (ch === 16) vin = 1.43 + (this.tempC - 25) * -0.0043; else if (ch === 17) vin = 1.2;
    const val = Math.max(0, Math.min(4095, Math.round(vin / this.vdd * 4095)));
    this.later(this.cycles + Math.max(1, Math.round(t / this.adcclk * this.f)), () => { A.dr = (A.cr2 & 0x800) ? (val << 4) : val; A.sr |= 2; if (A.cr1 & 0x20) this.setPend(16 + 18); if (A.cr2 & 2) this.adcStart(); });
  }
  // ---- I2C (tylko master) ----
  i2cBit(k) { const I = this.i2c[k]; const ccr = I.ccr & 0xFFF || 180; const t = (I.ccr & 0x8000) ? ccr * 3 : ccr * 2; return Math.max(1, Math.round(t / this.pclk1 * this.f)); }
  i2cReg(k, off, v) {
    const I = this.i2c[k], W = v !== null;
    switch (off) {
      case 0x00: if (W) { const old = I.cr1; I.cr1 = v & 0xBFFF; if (v & 0x8000) { I.sr1 = 0; I.sr2 = 0; I.st = 'idle'; } if ((v & 0x100) && !(old & 0x100)) this.later(this.cycles + this.i2cBit(k), () => { I.sr1 |= 1; I.sr2 |= 3; I.cr1 &= ~0x100; I.st = 'addr'; this.i2cIrq(k); }); if ((v & 0x200) && !(old & 0x200)) { if (I.st === 'rx' || I.st === 'rxwait') I.stopAfter = true; else this.i2cStop(k); } return; } return I.cr1;
      case 0x04: if (W) I.cr2 = v & 0x1FFF; return I.cr2;
      case 0x08: if (W) I.oar1 = v; return I.oar1; case 0x0C: if (W) I.oar2 = v; return I.oar2;
      case 0x10: if (W) { this.i2cWrite(k, v & 255); return; } { const d = I.dr; if (I.sr1 & 0x40) { I.sr1 &= ~0x44; this.i2cNextRx(k); } return d; }
      case 0x14: if (W) { I.sr1 &= v | ~0xDF00; return; } I.srRead = true; return I.sr1;
      case 0x18: { if (I.srRead && (I.sr1 & 2)) { I.sr1 &= ~2; I.srRead = false; if (I.rd) { I.st = 'rx'; this.i2cNextRx(k); } else { I.st = 'tx'; I.sr1 |= 0x80; } } return I.sr2; }
      case 0x1C: if (W) I.ccr = v & 0xCFFF; return I.ccr;
      case 0x20: if (W) I.trise = v & 63; return I.trise;
    }
    return 0;
  }
  i2cIrq(k) { const I = this.i2c[k]; if ((I.cr2 & 0x200) && (I.sr1 & 0x1F || ((I.cr2 & 0x400) && I.sr1 & 0xC0))) this.setPend(16 + (k === 1 ? 31 : 33)); }
  i2cWrite(k, v) {
    const I = this.i2c[k]; I.sr1 &= ~1;
    if (I.st === 'addr') { const a = v >> 1; I.rd = !!(v & 1); I.dev = this.bus ? this.bus.i2cFind(k, a, !I.rd) : null; I.sr2 = (I.sr2 & ~4) | (I.rd ? 0 : 4);
      this.later(this.cycles + this.i2cBit(k) * 9, () => { if (I.dev) I.sr1 |= 2; else { I.sr1 |= 0x400; I.st = 'nack'; } this.i2cIrq(k); }); return; }
    if (I.st === 'tx') { I.sr1 &= ~0x84; I.dr = v; this.later(this.cycles + this.i2cBit(k) * 9, () => { const ok = I.dev && this.bus.i2cWrite(I.dev, v); if (!ok) { I.sr1 |= 0x400; } else { I.sr1 |= 0x84; } this.i2cIrq(k); }); }
  }
  i2cNextRx(k) {
    const I = this.i2c[k]; if (I.st !== 'rx') return; if (I.nackDone) return;
    const last = !(I.cr1 & 0x400); I.st = 'rxwait';
    this.later(this.cycles + this.i2cBit(k) * 9, () => { I.dr = I.dev ? this.bus.i2cRead(I.dev, !last) & 255 : 0xFF; I.sr1 |= 0x40; I.st = last ? 'rxdone' : 'rx'; this.i2cIrq(k); if (last || I.stopAfter) { I.stopAfter = false; if (I.cr1 & 0x200) this.i2cStop(k); } });
  }
  i2cStop(k) { const I = this.i2c[k]; this.later(this.cycles + this.i2cBit(k), () => { if (I.dev && this.bus) this.bus.i2cStop(I.dev); I.dev = null; I.cr1 &= ~0x200; I.sr2 &= ~3; I.st = 'idle'; I.sr1 &= ~0x480; }); }
  // ---- SPI (master) ----
  spiReg(k, off, v) {
    const S = this.spi[k], W = v !== null;
    switch (off) {
      case 0x00: if (W) { S.cr1 = v & 0xFFFF; this.pins(); return; } return S.cr1;
      case 0x04: if (W) S.cr2 = v & 0xF7; return S.cr2;
      case 0x08: if (W) { S.sr &= ~(0x10 & ~v); return; } return S.sr;
      case 0x0C: if (W) { if (!(S.cr1 & 0x40)) return; S.sr &= ~2; S.sr |= 0x80; const br = 2 << ((S.cr1 >> 3) & 7); const clk = k === 1 ? this.pclk2 : this.pclk1; const n = (S.cr1 & 0x800) ? 16 : 8;
          const out = v & 0xFFFF; this.later(this.cycles + Math.max(1, Math.round(n * br / clk * this.f)), () => { let r = this.bus ? this.bus.spiByte(k, (S.cr1 & 0x800) ? out >> 8 : out & 255, !!(S.cr1 & 0x80)) : 0xFF; if (S.cr1 & 0x800) r = (r << 8) | (this.bus ? this.bus.spiByte(k, out & 255, false) : 0xFF); if (S.sr & 1) S.sr |= 0x40; S.dr = r; S.sr |= 3; S.sr &= ~0x80; if (S.cr2 & 0xC0) this.setPend(16 + (k === 1 ? 35 : 36)); }); return; }
        S.sr &= ~1; return S.dr;
    }
    return 0;
  }
  iwdgReg(off, v) { const D = this.iwdg, W = v !== null; if (off === 0 && W) { if ((v & 0xFFFF) === 0xCCCC) { D.on = true; D.last = this.cycles; } if ((v & 0xFFFF) === 0xAAAA) D.last = this.cycles; if ((v & 0xFFFF) === 0x5555) D.unlock = true; return; } if (off === 4) { if (W && D.unlock) D.pr = v & 7; return D.pr; } if (off === 8) { if (W && D.unlock) D.rlr = v & 0xFFF; return D.rlr; } return 0; }
  later(at, fn) { if (at < this.hk) this.hk = at; const e = this.events; let i = e.length; while (i > 0 && e[i - 1][0] > at) i--; e.splice(i, 0, [at, fn]); }
  // ---- wejścia ----
  setInputs(I) {
    const X = this.exti, A = this.afio;
    for (const p of 'ABC') { const o = this.inp[p] | 0, n = I[p] | 0; if (o === n) continue; const ch = o ^ n; this.inp[p] = n;
      for (let l = 0; l < 16; l++) { if (!(ch & (1 << l))) continue; const sel = (A.exticr[l >> 2] >> ((l & 3) * 4)) & 15; if ('ABCD'[sel] !== p) continue; const rise = (n >> l) & 1; if ((rise && (X.rtsr & (1 << l))) || (!rise && (X.ftsr & (1 << l)))) { X.pr |= (1 << l) & X.imr; } }
    }
    this.extiIrq();
  }
  // ---- stan nóżek ----
  pinCfg(p, bit) { const g = this.gpio[p]; const r = bit < 8 ? g.crl : g.crh; const c = (r >>> ((bit & 7) * 4)) & 15; return { mode: c & 3, cnf: c >> 2 }; }
  afOut(p, bit) {
    // wyjścia funkcji alternatywnych: PWM timerów, TX USART, SPI, I2C
    const M = this.afio.mapr, tim = [[1, 'A', 8, 0], [1, 'A', 9, 1], [1, 'A', 10, 2], [1, 'A', 11, 3], [2, 'A', 0, 0], [2, 'A', 1, 1], [2, 'A', 2, 2], [2, 'A', 3, 3], [3, 'A', 6, 0], [3, 'A', 7, 1], [3, 'B', 0, 2], [3, 'B', 1, 3], [4, 'B', 6, 0], [4, 'B', 7, 1], [4, 'B', 8, 2], [4, 'B', 9, 3]];
    const u1 = (M & 4) ? ['B', 6] : ['A', 9];
    if (p === u1[0] && bit === u1[1] && (this.usart[1].cr1 & 0x2008) === 0x2008) return 1;
    if (p === 'A' && bit === 2 && (this.usart[2].cr1 & 0x2008) === 0x2008) return 1;
    if (p === 'B' && bit === 10 && (this.usart[3].cr1 & 0x2008) === 0x2008) return 1;
    for (const [k, tp, tb, ch] of tim) if (tp === p && tb === bit) { const T = this.tim[k]; if ((T.ccer >> (ch * 4)) & 1) return T.out[ch]; }
    const s1 = this.spi[1]; if (p === 'A' && (bit === 5 || bit === 7) && (s1.cr1 & 0x44) === 0x44) return bit === 5 ? (s1.cr1 >> 1) & 1 : 0;
    const s2 = this.spi[2]; if (p === 'B' && (bit === 13 || bit === 15) && (s2.cr1 & 0x44) === 0x44) return bit === 13 ? (s2.cr1 >> 1) & 1 : 0;
    return null;
  }
  pinState(p, bit) {
    if (!(this.afio.swj >= 2) && ((p === 'A' && bit === 15) || (p === 'B' && (bit === 3 || bit === 4)))) return [null, false, p === 'B' && bit === 3 ? null : 'up']; // JTAG po resecie
    if (!(this.afio.swj >= 4) && p === 'A' && (bit === 13 || bit === 14)) return [null, false, bit === 13 ? 'up' : 'down']; // SWD
    const { mode, cnf } = this.pinCfg(p, bit), od = (this.gpio[p].odr >> bit) & 1;
    if (mode === 0) return [null, false, cnf === 2 ? (od ? 'up' : 'down') : null];
    let v = od; if (cnf >= 2) { const a = this.afOut(p, bit); v = a === null ? (cnf === 3 ? 1 : od) : a; if (cnf === 3 && (this.i2c[1].cr1 & 1) && p === 'B' && (bit === 6 || bit === 7 || bit === 8 || bit === 9)) v = 1; if (cnf === 3 && (this.i2c[2].cr1 & 1) && p === 'B' && (bit === 10 || bit === 11)) v = 1; }
    if (cnf === 1 || cnf === 3) return [v ? null : 0, false, null];
    return [v, false, null];
  }
  // ---- wyjątki ----
  prioOf(n) { return n === 2 ? -2 : n === 3 ? -1 : this.prio[n]; }
  curPrio() { let p = 256; for (const n of this.active) p = Math.min(p, this.prioOf(n)); if (this.primask) p = Math.min(p, 0); if (this.basepri) p = Math.min(p, this.basepri); return p; }
  pendingExc() {
    let best = 0, bp = 256;
    if (this.pend[2]) return 2;
    for (let n = 11; n < 80; n++) { if (!this.pend[n]) continue; if (n >= 16 && !this.ena[n]) continue; const p = this.prioOf(n); if (p < bp) { bp = p; best = n; } }
    if (!best) return 0; return bp < this.curPrio() ? best : 0;
  }
  anyPend() { if (this.pend[14] || this.pend[15] || this.pend[11]) return true; for (let n = 16; n < 80; n++) if (this.pend[n] && this.ena[n]) return true; return false; }
  excEnter(n) {
    this.clrPend(n);
    let sp = this.r[13] >>> 0; const align = sp & 4; sp = (sp - 32) & ~7;
    const xpsr = this.xpsr() | (align ? 0x200 : 0);
    const fr = [this.r[0], this.r[1], this.r[2], this.r[3], this.r[12], this.r[14], this.pc, xpsr];
    for (let i = 0; i < 8; i++) this.wr32(sp + i * 4, fr[i]);
    const thread = !this.handler, psp = thread && (this.control & 2);
    if (psp) this.psp = sp; else this.msp = sp;
    this.r[14] = this.handler ? 0xFFFFFFF1 | 0 : (psp ? 0xFFFFFFFD | 0 : 0xFFFFFFF9 | 0);
    this.r[13] = this.msp; this.handler = n; this.active.push(n); this.it = 0;
    this.pc = this.rd32(this.vtor + n * 4) & ~1; this.cycles += 12;
  }
  excReturn(ret) {
    ret >>>= 0; const n = this.active.pop();
    const toPsp = (ret & 0xF) === 0xD, toThread = (ret & 0xF) !== 1;
    let sp = toPsp ? this.psp : this.msp;
    const fr = []; for (let i = 0; i < 8; i++) fr.push(this.rd32(sp + i * 4));
    sp += 32; if (fr[7] & 0x200) sp += 4;
    if (toPsp) this.psp = sp; else this.msp = sp;
    [this.r[0], this.r[1], this.r[2], this.r[3], this.r[12], this.r[14]] = fr; this.pc = fr[6] & ~1; this.setXpsr(fr[7]);
    this.handler = toThread ? 0 : (this.active.length ? this.active[this.active.length - 1] : 0);
    if (toThread) { this.control = (this.control & ~2) | (toPsp ? 2 : 0); }
    this.r[13] = toPsp ? this.psp : this.msp; this.cycles += 10; this.pdirty = true;
    if (toThread && (this.scr & 2)) this.sleeping = true;
  }
  xpsr() { return (this.N << 31) | (this.Z << 30) | (this.C << 29) | (this.V << 28) | ((this.it & 3) << 25) | ((this.it >> 2) << 10) | (1 << 24) | (this.handler & 0x1FF); }
  setXpsr(v) { this.N = (v >>> 31) & 1; this.Z = (v >>> 30) & 1; this.C = (v >>> 29) & 1; this.V = (v >>> 28) & 1; this.it = ((v >>> 25) & 3) | (((v >>> 10) & 0x3F) << 2); }
  // skok z możliwym powrotem z wyjątku
  bxw(v) { if (this.handler && (v >>> 0) >= 0xFFFFFFF0) { this.excReturn(v); return; } if (!(v & 1)) { this.fault('skok do kodu ARM (nieparzysty bit 0 = 0) – adres 0x' + (v >>> 0).toString(16)); } this.pc = v & ~1; }
  // ---- wykonanie ----
  run(target) {
    while (this.cycles < target) {
      try { this.runInner(target); }
      catch (err) { if (err instanceof StmFault) { this.faultMsg = err.message + ' (PC = 0x' + (this.lastPc >>> 0).toString(16) + ')'; if (this.onFault) this.onFault(this.faultMsg); this.clrPend(3); this.excEnter(3); this.hardFault = true; this.hk = 0; } else throw err; }
    }
  }
  runInner(target) {
    while (this.cycles < target) {
      if (this.cycles >= this.hk || this.pdirty || this.sleeping || this.resetReq) { if (this.house(target)) continue; }
      this.step();
    }
  }
  // zdarzenia peryferiów, przerwania, uśpienie; zwraca true, gdy nie należy wykonywać rozkazu
  house(target) {
    const e = this.events; while (e.length && e[0][0] <= this.cycles) e.shift()[1]();
    if (this.st.next <= this.cycles) { this.st.flag = 1; if (this.st.ctrl & 2) this.setPend(15); this.st.next += this.stPeriod(); }
    for (let k = 1; k <= 4; k++) if (this.tim[k].next <= this.cycles) this.timEvent(k);
    const D = this.iwdg, wdl = D.on ? D.last + (D.rlr + 1) * (4 << D.pr) / 40000 * this.f : Infinity;
    if (this.cycles > wdl) { this.rcc.csr |= 0x20000000; this.reset(false); this.wdtResets = (this.wdtResets || 0) + 1; this.hk = 0; return true; }
    if (this.resetReq) { this.resetReq = false; this.rcc.csr |= 0x10000000; this.reset(false); this.hk = 0; return true; }
    let nx = Math.min(e.length ? e[0][0] : Infinity, this.st.next, wdl); for (let k = 1; k <= 4; k++) nx = Math.min(nx, this.tim[k].next);
    this.hk = nx;
    if (this.pdirty) { const x = this.pendingExc(); if (x) { this.sleeping = false; this.excEnter(x); return true; } this.pdirty = false; }
    if (this.sleeping) {
      if (this.anyPend() && this.primask) { this.sleeping = false; return true; }
      this.cycles = Math.max(this.cycles + 1, Math.ceil(Math.min(nx, target))); return true;
    }
    return false;
  }
  cond(c) { switch (c) { case 0: return this.Z; case 1: return !this.Z; case 2: return this.C; case 3: return !this.C; case 4: return this.N; case 5: return !this.N; case 6: return this.V; case 7: return !this.V; case 8: return this.C && !this.Z; case 9: return !this.C || this.Z; case 10: return this.N === this.V; case 11: return this.N !== this.V; case 12: return !this.Z && this.N === this.V; case 13: return this.Z || this.N !== this.V; default: return true; } }
  addc(a, b, c, set) { const r = (a >>> 0) + (b >>> 0) + c; const res = r | 0; if (set) { this.N = res < 0 ? 1 : 0; this.Z = res === 0 ? 1 : 0; this.C = r > 0xFFFFFFFF ? 1 : 0; this.V = ((~(a ^ b) & (a ^ res)) >>> 31); } return res; }
  nz(v) { this.N = v < 0 ? 1 : 0; this.Z = v === 0 ? 1 : 0; }
  shiftC(v, type, n, cin) { // zwraca [wynik, carry]
    v |= 0;
    switch (type) {
      case 0: if (n === 0) return [v, cin]; if (n < 32) return [v << n, (v >>> (32 - n)) & 1]; if (n === 32) return [0, v & 1]; return [0, 0];
      case 1: if (n === 0) return [v, cin]; if (n < 32) return [v >>> n, (v >>> (n - 1)) & 1]; if (n === 32) return [0, (v >>> 31) & 1]; return [0, 0];
      case 2: if (n === 0) return [v, cin]; if (n < 32) return [v >> n, (v >>> (n - 1)) & 1]; return [v >> 31, (v >>> 31) & 1];
      case 3: { if (n === 0) return [v, cin]; n &= 31; if (n === 0) return [v, (v >>> 31) & 1]; const r = (v >>> n) | (v << (32 - n)); return [r, (r >>> 31) & 1]; }
      case 4: { const r = (cin << 31) | (v >>> 1); return [r, v & 1]; } // RRX
    }
  }
  immShift(type, imm5) { if (type === 0) return [0, imm5]; if (type === 1 || type === 2) return [type, imm5 === 0 ? 32 : imm5]; return imm5 === 0 ? [4, 1] : [3, imm5]; }
  thumbExpand(i12) { // [wartość, carry lub -1]
    if ((i12 >> 10) === 0) { const b = i12 & 255; switch ((i12 >> 8) & 3) { case 0: return [b, -1]; case 1: return [(b << 16) | b, -1]; case 2: return [(b << 24) | (b << 8), -1]; case 3: return [(b << 24) | (b << 16) | (b << 8) | b, -1]; } }
    const u = 0x80 | (i12 & 0x7F), rot = i12 >> 7; const r = (u >>> rot) | (u << (32 - rot)); return [r, (r >>> 31) & 1];
  }
  inIT() { return this.it & 0xF; }
  itAdvance() { if ((this.it & 7) === 0) this.it = 0; else this.it = (this.it & 0xE0) | ((this.it << 1) & 0x1F); }
  ldm(base, list, upd, pcOk) { let a = this.r[base] >>> 0, n = 0; const wb = upd && !(list & (1 << base)); let newPc = null; for (let i = 0; i < 16; i++) if (list & (1 << i)) { const v = this.rd32(a); a += 4; n++; if (i === 15) newPc = v; else this.r[i] = v; } if (wb || (upd && base === 13)) this.r[base] = a; this.cycles += n; if (newPc !== null) this.bxw(newPc); }
  stm(base, list, upd) { let a = this.r[base] >>> 0, n = 0; for (let i = 0; i < 16; i++) if (list & (1 << i)) { this.wr32(a, i === 15 ? this.pc : this.r[i]); a += 4; n++; } if (upd) this.r[base] = a; this.cycles += n; }
  push(list) { let n = 0; for (let i = 0; i < 16; i++) if (list & (1 << i)) n++; let a = (this.r[13] >>> 0) - 4 * n; this.r[13] = a; for (let i = 0; i < 16; i++) if (list & (1 << i)) { this.wr32(a, this.r[i]); a += 4; } this.cycles += n; }
  sp() { return this.r[13]; }
  step() {
    const pc = this.pc; this.lastPc = pc;
    const op = this.fetch16(pc);
    const inIt = (this.it & 0xF) !== 0, cond = inIt ? this.cond(this.it >> 4) : true;
    if ((op >>> 11) >= 0x1D) { const op2 = this.fetch16(pc + 2); this.pc = pc + 4; this.cycles++; if (cond) this.exec32(op, op2, inIt); if (inIt) this.itAdvance(); return; }
    this.pc = pc + 2; this.cycles++;
    if (cond) this.exec16(op, inIt);
    if (inIt) this.itAdvance();
  }
  fetch16(a) { a >>>= 0; if (a < 0x20000) return this.fh[a >> 1]; if (a >= 0x08000000 && a < 0x08020000) return this.fh[(a - 0x08000000) >> 1]; if (a >= 0x20000000 && a < 0x20005000) return this.rdv.getUint16(a - 0x20000000, true); this.fault('wykonanie spod adresu 0x' + a.toString(16) + ' (to nie jest pamięć programu)'); }
  exec16(op, inIt) {
    const r = this.r, S = !inIt; // w bloku IT rozkazy 16-bit nie ustawiają flag
    const top = op >>> 10;
    if ((op >>> 13) === 0) { // przesunięcia, ADD/SUB
      const o = (op >>> 11) & 3, rd = op & 7, rm = (op >>> 3) & 7;
      if (o < 3) { const imm = (op >>> 6) & 31; const [t, n] = this.immShift(o, imm); const [v, c] = this.shiftC(r[rm], t, n, this.C); r[rd] = v; if (S) { this.nz(v); this.C = c; } return; }
      const i = (op >>> 10) & 1, sub = (op >>> 9) & 1, x = i ? (op >>> 6) & 7 : r[(op >>> 6) & 7];
      r[rd] = sub ? this.addc(r[rm], ~x, 1, S) : this.addc(r[rm], x, 0, S); return;
    }
    if ((op >>> 13) === 1) { const o = (op >>> 11) & 3, rd = (op >>> 8) & 7, imm = op & 255;
      if (o === 0) { r[rd] = imm; if (S) { this.nz(imm); } } else if (o === 1) this.addc(r[rd], ~imm, 1, true); else if (o === 2) r[rd] = this.addc(r[rd], imm, 0, S); else r[rd] = this.addc(r[rd], ~imm, 1, S); return; }
    if (top === 0x10) { // przetwarzanie danych
      const o = (op >>> 6) & 15, rd = op & 7, rm = (op >>> 3) & 7; let a = r[rd], b = r[rm], v;
      switch (o) {
        case 0: v = a & b; r[rd] = v; if (S) this.nz(v); return;
        case 1: v = a ^ b; r[rd] = v; if (S) this.nz(v); return;
        case 2: case 3: case 4: case 7: { const [res, c] = this.shiftC(a, [0, 0, 0, 1, 2, 0, 0, 3][o] , b & 255, this.C); r[rd] = res; if (S) { this.nz(res); this.C = c; } return; }
        case 5: r[rd] = this.addc(a, b, this.C, S); return;
        case 6: r[rd] = this.addc(a, ~b, this.C, S); return;
        case 8: this.nz(a & b); return;
        case 9: r[rd] = this.addc(~b, 0, 1, S); return; // RSB #0
        case 10: this.addc(a, ~b, 1, true); return;
        case 11: this.addc(a, b, 0, true); return;
        case 12: v = a | b; r[rd] = v; if (S) this.nz(v); return;
        case 13: v = Math.imul(a, b); r[rd] = v; if (S) this.nz(v); return;
        case 14: v = a & ~b; r[rd] = v; if (S) this.nz(v); return;
        case 15: v = ~b; r[rd] = v; if (S) this.nz(v); return;
      }
    }
    if (top === 0x11) { // rejestry wysokie, BX/BLX
      const o = (op >>> 8) & 3, rd = (op & 7) | ((op >>> 4) & 8), rm = (op >>> 3) & 15; const rv = i => i === 15 ? this.pc + 2 : r[i];
      if (o === 0) { const v = (rv(rd) + rv(rm)) | 0; if (rd === 15) this.bxw(v | 1); else r[rd] = v; if (rd === 13) r[13] &= ~3; return; }
      if (o === 1) { this.addc(rv(rd), ~rv(rm), 1, true); return; }
      if (o === 2) { const v = rv(rm); if (rd === 15) { this.bxw(v | 1); this.cycles += 2; } else r[rd] = v; return; }
      const v = rv(rm); if (op & 0x80) r[14] = (this.pc) | 1; this.bxw(v); this.cycles += 2; return;
    }
    if ((op >>> 11) === 9) { const a = ((this.pc + 2) & ~3) + (op & 255) * 4; r[(op >>> 8) & 7] = this.rd32(a); this.cycles++; return; }
    if ((op >>> 12) === 5) { const o = (op >>> 9) & 7, rt = op & 7, a = (r[(op >>> 3) & 7] + r[(op >>> 6) & 7]) >>> 0; this.cycles++;
      switch (o) { case 0: this.wr32(a, r[rt]); return; case 1: this.wr16(a, r[rt]); return; case 2: this.wr8(a, r[rt]); return; case 3: r[rt] = (this.rd8(a) << 24) >> 24; return; case 4: r[rt] = this.rd32(a); return; case 5: r[rt] = this.rd16(a); return; case 6: r[rt] = this.rd8(a); return; case 7: r[rt] = (this.rd16(a) << 16) >> 16; return; } }
    if ((op >>> 13) === 3) { const b = (op >>> 12) & 1, l = (op >>> 11) & 1, imm = (op >>> 6) & 31, rt = op & 7, a = (r[(op >>> 3) & 7] + (b ? imm : imm * 4)) >>> 0; this.cycles++;
      if (l) r[rt] = b ? this.rd8(a) : this.rd32(a); else if (b) this.wr8(a, r[rt]); else this.wr32(a, r[rt]); return; }
    if ((op >>> 12) === 8) { const l = (op >>> 11) & 1, imm = ((op >>> 6) & 31) * 2, rt = op & 7, a = (r[(op >>> 3) & 7] + imm) >>> 0; this.cycles++; if (l) r[rt] = this.rd16(a); else this.wr16(a, r[rt]); return; }
    if ((op >>> 12) === 9) { const l = (op >>> 11) & 1, rt = (op >>> 8) & 7, a = (r[13] + (op & 255) * 4) >>> 0; this.cycles++; if (l) r[rt] = this.rd32(a); else this.wr32(a, r[rt]); return; }
    if ((op >>> 12) === 10) { const rd = (op >>> 8) & 7, imm = (op & 255) * 4; r[rd] = (op & 0x800) ? (r[13] + imm) | 0 : (((this.pc + 2) & ~3) + imm) | 0; return; }
    if ((op >>> 12) === 11) { // różne
      const o = (op >>> 8) & 15;
      if (o === 0) { const imm = (op & 127) * 4; r[13] = (op & 0x80) ? r[13] - imm : r[13] + imm; return; }
      if (o === 1 || o === 3 || o === 9 || o === 11) { const rn = op & 7, imm = (((op >>> 9) & 1) << 6) | (((op >>> 3) & 31) << 1); const z = r[rn] === 0; if ((op & 0x800) ? !z : z) { this.pc = (this.pc + 2 + imm) | 0; this.cycles += 2; } return; }
      if (o === 2) { const rd = op & 7, v = r[(op >>> 3) & 7]; switch ((op >>> 6) & 3) { case 0: r[rd] = (v << 16) >> 16; break; case 1: r[rd] = (v << 24) >> 24; break; case 2: r[rd] = v & 0xFFFF; break; case 3: r[rd] = v & 255; break; } return; }
      if (o === 4 || o === 5) { this.push((op & 255) | ((op & 0x100) ? 0x4000 : 0)); return; }
      if (o === 6) { if ((op & 0xFFE8) === 0xB660) { const im = (op >>> 4) & 1; if (op & 2) this.primask = im; if (op & 1) this.faultmask = im; this.pdirty = true; } return; }
      if (o === 10) { const rd = op & 7, v = r[(op >>> 3) & 7]; switch ((op >>> 6) & 3) { case 0: r[rd] = ((v & 255) << 24) | ((v & 0xFF00) << 8) | ((v >>> 8) & 0xFF00) | (v >>> 24); break; case 1: r[rd] = ((v & 0x00FF00FF) << 8) | ((v >>> 8) & 0x00FF00FF); break; case 3: r[rd] = (((v & 255) << 24) >> 16) | ((v >>> 8) & 255); break; default: this.undef(op); } return; }
      if (o === 12 || o === 13) { this.ldm(13, (op & 255) | ((op & 0x100) ? 0x8000 : 0), true); return; }
      if (o === 14) { if (this.onBkpt) this.onBkpt(op & 255); return; }
      if (o === 15) { if (op & 0xF) { this.it = op & 0xFF; return; } const h = (op >>> 4) & 15; if (h === 3) { if (!this.anyPend()) this.sleeping = true; } else if (h === 2) { if (!this.evFlag) this.sleeping = !this.anyPend(); this.evFlag = 0; } else if (h === 4) this.evFlag = 1; return; }
      this.undef(op); return;
    }
    if ((op >>> 12) === 12) { const rn = (op >>> 8) & 7, list = op & 255; if (op & 0x800) this.ldm(rn, list, true); else this.stm(rn, list, true); return; }
    if ((op >>> 12) === 13) { const c = (op >>> 8) & 15; if (c === 15) { if (this.onSvc) this.onSvc(op & 255); this.setPend(11); return; } if (c === 14) { this.undef(op); return; } if (this.cond(c)) { this.pc = (this.pc + 2 + (((op & 255) << 24) >> 23)) | 0; this.cycles += 2; } return; }
    if ((op >>> 11) === 0x1C) { this.pc = (this.pc + 2 + (((op & 0x7FF) << 21) >> 20)) | 0; this.cycles += 2; return; }
    this.undef(op);
  }
  undef(op) { this.fault('nieznany rozkaz 0x' + (op >>> 0).toString(16)); }
  exec32(h, l, inIt) {
    const r = this.r;
    const pcv = () => this.pc; // PC odczytywany w rozkazie = adres + 4 = this.pc
    if ((h >>> 11) === 0x1D) { // 11101
      if ((h & 0xFE40) === 0xE800) { // LDM/STM
        const rn = h & 15, w = (h >>> 5) & 1, ld = (h >>> 4) & 1, db = ((h >>> 7) & 3) === 2;
        if (db) { let n = 0; for (let i = 0; i < 16; i++) if (l & (1 << i)) n++; const start = ((r[rn] >>> 0) - 4 * n) >>> 0;
          if (ld) { let a = start, newPc = null; const vals = []; for (let i = 0; i < 16; i++) if (l & (1 << i)) { vals.push([i, this.rd32(a)]); a += 4; } if (w) r[rn] = start; for (const [i, v] of vals) { if (i === 15) newPc = v; else r[i] = v; } this.cycles += n; if (newPc !== null) this.bxw(newPc); }
          else { let a = start; for (let i = 0; i < 16; i++) if (l & (1 << i)) { this.wr32(a, r[i]); a += 4; } if (w) r[rn] = start; this.cycles += n; } return; }
        if (ld) this.ldm(rn, l, !!w); else this.stm(rn, l, !!w); return;
      }
      if ((h & 0xFE40) === 0xE840) { // LDRD/STRD, LDREX/STREX, TBB/TBH
        const o1 = (h >>> 7) & 3, o2 = (h >>> 4) & 3, rn = h & 15;
        if (o1 === 0 && o2 === 0) { const a = (r[rn] + (l & 255) * 4) >>> 0; this.wr32(a, r[(l >>> 12) & 15]); r[(l >>> 8) & 15] = 0; return; } // STREX (zawsze udany)
        if (o1 === 0 && o2 === 1) { const a = (r[rn] + (l & 255) * 4) >>> 0; r[(l >>> 12) & 15] = this.rd32(a); return; }
        if (o1 === 1 && o2 === 1) { const t = (l >>> 4) & 15, base = rn === 15 ? this.pc : r[rn], idx = r[l & 15];
          if (t === 0) { const v = this.rd8((base + idx) >>> 0); this.pc = (this.pc + v * 2) | 0; this.cycles += 3; return; }
          if (t === 1) { const v = this.rd16((base + idx * 2) >>> 0); this.pc = (this.pc + v * 2) | 0; this.cycles += 3; return; }
          if (t === 4 || t === 5) { const a = (r[rn] >>> 0); if (t === 4) r[(l >>> 12) & 15] = this.rd8(a); else r[(l >>> 12) & 15] = this.rd16(a); return; }
          this.undef(h); return; }
        if (o1 === 1 && o2 === 0) { const t = (l >>> 4) & 15, a = r[rn] >>> 0; if (t === 4) this.wr8(a, r[(l >>> 12) & 15]); else if (t === 5) this.wr16(a, r[(l >>> 12) & 15]); else this.undef(h); r[l & 15] = 0; return; }
        { // LDRD/STRD
          const p = (h >>> 8) & 1, u = (h >>> 7) & 1, w = (h >>> 5) & 1, ld = (h >>> 4) & 1, imm = (l & 255) * 4, rt = (l >>> 12) & 15, rt2 = (l >>> 8) & 15;
          const base = rn === 15 ? (this.pc & ~3) : r[rn] >>> 0; const off = u ? base + imm : base - imm; const a = (p ? off : base) >>> 0;
          if (ld) { const v1 = this.rd32(a), v2 = this.rd32(a + 4); r[rt] = v1; r[rt2] = v2; } else { this.wr32(a, r[rt]); this.wr32(a + 4, r[rt2]); }
          if (w) r[rn] = off; this.cycles += 2; return;
        }
      }
      if ((h & 0xFE00) === 0xEA00) { // przetwarzanie danych – rejestr z przesunięciem
        const o = (h >>> 5) & 15, s = (h >>> 4) & 1, rn = h & 15, rd = (l >>> 8) & 15, rm = l & 15, imm5 = (((l >>> 12) & 7) << 2) | ((l >>> 6) & 3), ty = (l >>> 4) & 3;
        const [t, n] = this.immShift(ty, imm5); const [b, c] = this.shiftC(r[rm], t, n, this.C);
        this.dp(o, s, rn, rd, b, c); return;
      }
      if ((h & 0xEC00) === 0xEC00) { this.fault('rozkaz koprocesora/FPU – STM32F103 nie ma FPU (0x' + h.toString(16) + ')'); }
      this.undef(h); return;
    }
    // 11110 / 11111
    if ((h >>> 11) === 0x1E) {
      if (l & 0x8000) { // skoki i różne
        const o1 = (l >>> 12) & 7;
        if (l & 0x1000) { // B.W (T4) / BL
          const S = (h >>> 10) & 1, J1 = (l >>> 13) & 1, J2 = (l >>> 11) & 1, I1 = 1 ^ (J1 ^ S), I2 = 1 ^ (J2 ^ S);
          let off = (S << 24) | (I1 << 23) | (I2 << 22) | ((h & 0x3FF) << 12) | ((l & 0x7FF) << 1); off = (off << 7) >> 7;
          if (l & 0x4000) r[14] = this.pc | 1;
          this.pc = (this.pc + off) | 0; this.cycles += 2; return;
        }
        if (!(l & 0x4000)) {
          const c = (h >>> 6) & 15;
          if ((c & 14) !== 14) { // B<c>.W
            const S = (h >>> 10) & 1, J1 = (l >>> 13) & 1, J2 = (l >>> 11) & 1; let off = (S << 20) | (J2 << 19) | (J1 << 18) | ((h & 0x3F) << 12) | ((l & 0x7FF) << 1); off = (off << 11) >> 11;
            if (this.cond(c)) { this.pc = (this.pc + off) | 0; this.cycles += 2; } return;
          }
          const o = (h >>> 4) & 0x7F;
          if (o === 0x38 || o === 0x39) { const sysm = l & 255, v = r[h & 15]; this.msr(sysm, v); return; }
          if (o === 0x3A) { const hint = l & 255; if (hint === 3) { if (!this.anyPend()) this.sleeping = true; } return; }
          if (o === 0x3B) return; // DSB, DMB, ISB, CLREX
          if (o === 0x3E || o === 0x3F) { r[(l >>> 8) & 15] = this.mrs(l & 255); return; }
          this.undef(h); return;
        }
        this.undef(h); return;
      }
      if (!(h & 0x200)) { // przetwarzanie danych – zmodyfikowana stała
        const o = (h >>> 5) & 15, s = (h >>> 4) & 1, rn = h & 15, rd = (l >>> 8) & 15, i12 = (((h >>> 10) & 1) << 11) | (((l >>> 12) & 7) << 8) | (l & 255);
        const [v, c] = this.thumbExpand(i12); this.dp(o, s, rn, rd, v, c < 0 ? this.C : c); return;
      }
      // zwykła stała binarna
      const o = (h >>> 4) & 31, rn = h & 15, rd = (l >>> 8) & 15; const i12 = (((h >>> 10) & 1) << 11) | (((l >>> 12) & 7) << 8) | (l & 255);
      switch (o) {
        case 0: r[rd] = ((rn === 15 ? (this.pc & ~3) : r[rn]) + i12) | 0; return; // ADDW / ADR
        case 10: r[rd] = ((rn === 15 ? (this.pc & ~3) : r[rn]) - i12) | 0; return; // SUBW / ADR
        case 4: r[rd] = i12 | (rn << 12); return; // MOVW
        case 12: r[rd] = (r[rd] & 0xFFFF) | ((i12 | (rn << 12)) << 16); return; // MOVT
        case 20: case 28: { const lsb = (((l >>> 12) & 7) << 2) | ((l >>> 6) & 3), w = (l & 31) + 1; const v = r[rn] >>> lsb; r[rd] = o === 20 ? (w === 32 ? v : (v << (32 - w)) >> (32 - w)) : (w === 32 ? v : v & ((1 << w) - 1)); return; } // SBFX/UBFX
        case 22: { const lsb = (((l >>> 12) & 7) << 2) | ((l >>> 6) & 3), msb = l & 31; if (msb < lsb) { this.undef(h); return; } const w = msb - lsb + 1; const mask = (w === 32 ? -1 : ((1 << w) - 1)) << lsb; const src = rn === 15 ? 0 : r[rn] << lsb; r[rd] = (r[rd] & ~mask) | (src & mask); return; } // BFI/BFC
        case 16: case 18: case 24: case 26: { // SSAT/USAT
          const sat = (l & 31) + (o >= 24 ? 0 : 1), sh = (((l >>> 12) & 7) << 2) | ((l >>> 6) & 3); let v = r[rn]; v = (o & 2) ? v >> (sh || 0) : v << sh; if (o & 2 && sh === 0 && false) { }
          if (o >= 24) { const mx = Math.pow(2, sat) - 1; r[rd] = v < 0 ? 0 : v > mx ? mx : v; } else { const mx = Math.pow(2, sat - 1) - 1, mn = -Math.pow(2, sat - 1); r[rd] = v < mn ? mn : v > mx ? mx : v; } return; }
      }
      this.undef(h); return;
    }
    // 11111: load/store, przetwarzanie danych w rejestrach, mnożenie
    const o2 = (h >>> 4) & 0x7F;
    if ((h & 0xFE00) === 0xF800 || (h & 0xFE00) === 0xF900 && !(o2 & 0x1) || (h & 0xFE00) === 0xF900) {
      if ((h & 0xFF00) === 0xF800 || (h & 0xFF00) === 0xF900) { this.ldst(h, l); return; }
    }
    if ((h & 0xFF80) === 0xFA00) { // przesunięcia rejestrem, rozszerzenia
      const rn = h & 15, rd = (l >>> 8) & 15, rm = l & 15, s = (h >>> 4) & 1;
      if ((l & 0xF0F0) === 0xF000) { const ty = (h >>> 5) & 3; const [v, c] = this.shiftC(r[rn], ty, r[rm] & 255, this.C); r[rd] = v; if (s) { this.nz(v); this.C = c; } return; }
      if ((l & 0xF0C0) === 0xF080) { const ty = (h >>> 4) & 7, rot = ((l >>> 4) & 3) * 8; let v = r[rm]; if (rot) v = (v >>> rot) | (v << (32 - rot)); let x; switch (ty) { case 0: x = (v << 16) >> 16; break; case 1: x = v & 0xFFFF; break; case 4: x = (v << 24) >> 24; break; case 5: x = v & 255; break; default: this.undef(h); return; } r[rd] = rn === 15 ? x : (r[rn] + x) | 0; return; }
    }
    if ((h & 0xFF80) === 0xFA80 && (l & 0xF0C0) === 0xF080) { // REV, RBIT, CLZ
      const rm = h & 15, rd = (l >>> 8) & 15, op = ((h >>> 4) & 3) << 2 | ((l >>> 4) & 3), v = r[rm];
      switch (op) {
        case 4: r[rd] = ((v & 255) << 24) | ((v & 0xFF00) << 8) | ((v >>> 8) & 0xFF00) | (v >>> 24); return;
        case 5: r[rd] = ((v & 0x00FF00FF) << 8) | ((v >>> 8) & 0x00FF00FF); return;
        case 6: { let x = 0; for (let i = 0; i < 32; i++) if (v & (1 << i)) x |= 1 << (31 - i); r[rd] = x; return; }
        case 7: r[rd] = (((v & 255) << 24) >> 16) | ((v >>> 8) & 255); return;
        case 12: r[rd] = Math.clz32(v); return;
      }
      this.undef(h); return;
    }
    if ((h & 0xFF80) === 0xFB00) { // MUL, MLA, MLS
      const rn = h & 15, ra = (l >>> 12) & 15, rd = (l >>> 8) & 15, rm = l & 15, o = (h >>> 4) & 7, op = (l >>> 4) & 3;
      if (o === 0) { const p = Math.imul(r[rn], r[rm]); r[rd] = op === 0 ? (ra === 15 ? p : (p + r[ra]) | 0) : (r[ra] - p) | 0; return; }
      this.undef(h); return;
    }
    if ((h & 0xFF80) === 0xFB80) { // mnożenia długie i dzielenie
      const rn = h & 15, rdlo = (l >>> 12) & 15, rdhi = (l >>> 8) & 15, rm = l & 15, o = (h >>> 4) & 7;
      if (o === 1 && ((l >>> 4) & 15) === 15) { const d = r[rm]; r[rdhi] = d === 0 ? 0 : (r[rn] === -0x80000000 && d === -1 ? r[rn] : (r[rn] / d) | 0); this.cycles += 6; return; } // SDIV
      if (o === 3 && ((l >>> 4) & 15) === 15) { const d = r[rm] >>> 0; r[rdhi] = d === 0 ? 0 : Math.floor((r[rn] >>> 0) / d) | 0; this.cycles += 6; return; } // UDIV
      const a = BigInt(o === 0 || o === 4 ? r[rn] : r[rn] >>> 0), b = BigInt(o === 0 || o === 4 ? r[rm] : r[rm] >>> 0);
      let p = a * b; if (o === 4 || o === 6) p += (BigInt(r[rdhi]) << 32n) | BigInt(r[rdlo] >>> 0);
      if (o === 0 || o === 2 || o === 4 || o === 6) { r[rdlo] = Number(BigInt.asIntN(32, p)); r[rdhi] = Number(BigInt.asIntN(32, p >> 32n)); this.cycles += 3; return; }
      this.undef(h); return;
    }
    this.undef(h);
  }
  dp(o, s, rn, rd, b, c) {
    const r = this.r, a = rn === 15 ? 0 : r[rn]; let v;
    switch (o) {
      case 0: v = a & b; if (rd === 15) { this.nz(v); this.C = c; return; } r[rd] = v; if (s) { this.nz(v); this.C = c; } return; // AND/TST
      case 1: v = a & ~b; r[rd] = v; if (s) { this.nz(v); this.C = c; } return;
      case 2: v = rn === 15 ? b : a | b; r[rd] = v; if (s) { this.nz(v); this.C = c; } return; // ORR/MOV
      case 3: v = rn === 15 ? ~b : a | ~b; r[rd] = v; if (s) { this.nz(v); this.C = c; } return; // ORN/MVN
      case 4: v = a ^ b; if (rd === 15) { this.nz(v); this.C = c; return; } r[rd] = v; if (s) { this.nz(v); this.C = c; } return; // EOR/TEQ
      case 8: if (rd === 15) { this.addc(a, b, 0, true); return; } r[rd] = this.addc(a, b, 0, !!s); return; // ADD/CMN
      case 10: r[rd] = this.addc(a, b, this.C, !!s); return;
      case 11: r[rd] = this.addc(a, ~b, this.C, !!s); return;
      case 13: if (rd === 15) { this.addc(a, ~b, 1, true); return; } r[rd] = this.addc(a, ~b, 1, !!s); return; // SUB/CMP
      case 14: r[rd] = this.addc(b, ~a, 1, !!s); return; // RSB
    }
    this.undef(o);
  }
  ldst(h, l) {
    const r = this.r, rn = h & 15, rt = (l >>> 12) & 15, sz = (h >>> 5) & 3, sgn = (h >>> 8) & 1, ld = (h >>> 4) & 1;
    let a, wb = null;
    if (rn === 15) { const u = (h >>> 7) & 1, imm = l & 0xFFF; a = ((this.pc & ~3) + (u ? imm : -imm)) >>> 0; }
    else if (h & 0x80) { a = (r[rn] + (l & 0xFFF)) >>> 0; }
    else if ((l & 0x800) === 0) { if ((l & 0xFC0) !== 0) { this.undef(h); return; } a = (r[rn] + (r[l & 15] << ((l >>> 4) & 3))) >>> 0; }
    else { const p = (l >>> 10) & 1, u = (l >>> 9) & 1, w = (l >>> 8) & 1, imm = l & 255; const off = (r[rn] + (u ? imm : -imm)) >>> 0; a = p ? off : r[rn] >>> 0; if (w) wb = off; }
    this.cycles++;
    if (ld) {
      if (rt === 15 && sz === 2) { const v = this.rd32(a); if (wb !== null) r[rn] = wb; this.bxw(v); return; }
      let v; if (sz === 0) v = sgn ? (this.rd8(a) << 24) >> 24 : this.rd8(a); else if (sz === 1) v = sgn ? (this.rd16(a) << 16) >> 16 : this.rd16(a); else v = this.rd32(a);
      if (rt !== 15) r[rt] = v; // PLD gdy rt == 15
    } else { if (sz === 0) this.wr8(a, r[rt]); else if (sz === 1) this.wr16(a, r[rt]); else this.wr32(a, r[rt]); }
    if (wb !== null) r[rn] = wb;
  }
  mrs(sysm) { switch (sysm) { case 0: case 1: case 2: case 3: return (this.N << 31) | (this.Z << 30) | (this.C << 29) | (this.V << 28) | (sysm & 1 ? this.handler : 0); case 5: case 6: case 7: return this.handler; case 8: return this.handler || !(this.control & 2) ? this.r[13] : this.msp; case 9: return (this.control & 2) && !this.handler ? this.r[13] : this.psp; case 16: return this.primask; case 17: case 18: return this.basepri; case 19: return this.faultmask; case 20: return this.control; } return 0; }
  msr(sysm, v) {
    this.pdirty = true;
    switch (sysm) {
      case 0: case 1: case 2: case 3: this.N = (v >>> 31) & 1; this.Z = (v >>> 30) & 1; this.C = (v >>> 29) & 1; this.V = (v >>> 28) & 1; return;
      case 8: if (this.handler || !(this.control & 2)) this.r[13] = v & ~3; this.msp = v & ~3; return;
      case 9: if (!this.handler && (this.control & 2)) this.r[13] = v & ~3; this.psp = v & ~3; return;
      case 16: this.primask = v & 1; return; case 17: this.basepri = v & 0xF0; return; case 18: if ((v & 0xF0) && (!this.basepri || (v & 0xF0) < this.basepri)) this.basepri = v & 0xF0; return; case 19: this.faultmask = v & 1; return;
      case 20: if (!this.handler) { const old = this.control; this.control = v & 3; if ((old ^ this.control) & 2) { if (this.control & 2) { this.msp = this.r[13]; this.r[13] = this.psp; } else { this.psp = this.r[13]; this.r[13] = this.msp; } } } return;
    }
  }
}
class StmFault extends Error { }
// magistrale STM32: I2C i SPI połączone z modułami w obwodzie
function stm32Bus(d, idx) {
  const node = (p, b) => d.n[idx(p, b)];
  return {
    i2cFind(k, a, write) {
      const core = d.mcu && d.mcu.core; const remap = core && (core.afio.mapr & 2);
      const [sda, scl] = k === 1 ? (remap ? [node('B', 9), node('B', 8)] : [node('B', 7), node('B', 6)]) : [node('B', 11), node('B', 10)];
      const x = CIR.devs.find(x => x.P.i2c && x.n[x.P.i2c.sda] === sda && x.n[x.P.i2c.scl] === scl && devPowered(x) && (() => { const ad = x.P.i2c.addr(x); return Array.isArray(ad) ? ad.includes(a) : ad === a; })());
      if (x) { x.s.i2cAddr = a; if (x.P.i2c.start) x.P.i2c.start(x, write, a); } E.dirty = true; return x || null;
    },
    i2cWrite(x, v) { E.dirty = true; return x.P.i2c.write(x, v) !== false; },
    i2cRead(x, ack) { E.dirty = true; return x.P.i2c.read(x, ack); },
    i2cStop(x) { if (x.P.i2c.stop) x.P.i2c.stop(x); E.dirty = true; },
    spiByte(k, v) {
      const [mosi, sck] = k === 1 ? [node('A', 7), node('A', 5)] : [node('B', 15), node('B', 13)]; let resp = 0xFF;
      for (const x of CIR.devs) { const bs = x.P.spi ? [].concat(x.P.spi) : []; for (const b of bs) { if (x.n[b.mosi] !== mosi || x.n[b.sck] !== sck || !devPowered(x)) continue; if (pinLevel(x, b.cs) !== (b.csHigh ? 1 : 0)) continue; const r = spiByteTo(x, b, v); if (r !== undefined && r !== null) resp = r; } }
      E.dirty = true; return resp & 255;
    },
  };
}
