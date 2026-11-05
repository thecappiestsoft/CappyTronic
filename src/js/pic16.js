'use strict';
/* ================= PIC16F84A – emulacja rdzenia i peryferiów (karta katalogowa DS35007C) =================
   35 rozkazów 14-bitowych, cykl rozkazowy = 4 takty zegara, stos 8 poziomów, banki RP0, adresowanie pośrednie (FSR/INDF),
   TMR0 z preskalerem (zegar wewnętrzny albo T0CKI), przerwania (T0IF, INTF na RB0, RBIF dla RB4–RB7, EEIF), EEPROM 64 B
   z sekwencją 55h/AAh i czasem zapisu, WDT (~18 ms), SLEEP, MCLR, rezystory podciągające PORTB (RBPU), RA4 z otwartym drenem. */
class Pic16 {
  constructor(prog, cfg, ee) { this.prog = prog; this.cfg = cfg; this.ee = ee; this.ram = new Uint8Array(0x50); this.cycles = 0; this.inA = 0x1f; this.inB = 0xff; this.onPins = null; this.reset(true); }
  reset(por) {
    const r = this.ram;
    this.pc = 0; this.w = por ? 0 : this.w; this.stack = new Uint16Array(8); this.sp = 0;
    this.status = (this.status & 0x07) | 0x18; if (por) this.status = 0x18; this.fsr = por ? 0 : this.fsr; this.pclath = 0; this.intcon = por ? 0 : this.intcon & 1;
    this.option = 0xff; this.trisA = 0x1f; this.trisB = 0xff; if (por) { this.latA = 0; this.latB = 0; }
    this.tmr0 = por ? 0 : this.tmr0; this.pre = 0; this.inhibit = 0; this.eecon1 = this.eecon1 & 0x08; this.eeadr = por ? 0 : this.eeadr; this.eedata = por ? 0 : this.eedata; this.eeSeq = 0; this.eeWriteAt = null;
    this.sleeping = false; this.wdt = this.cycles; this.skip = false; this.lastRB = this.inB; this.lastT0 = (this.inA >> 4) & 1; this.lastINT = this.inB & 1;
    this.pins();
  }
  get fsrBank() { return 0; }
  pins() { if (this.onPins) this.onPins(); }
  readPortA() { return (this.inA & 0x1f); }
  readPortB() { return this.inB & 0xff; }
  addr(f) { return f === 0 ? this.fsr : ((this.status & 0x20) << 2) | f; }
  rd(f) {
    const a = this.addr(f) & 0xff;
    switch (a) {
      case 0x00: case 0x80: return 0; // INDF przez INDF
      case 0x01: return this.tmr0; case 0x81: return this.option;
      case 0x02: case 0x82: return this.pc & 255;
      case 0x03: case 0x83: return this.status;
      case 0x04: case 0x84: return this.fsr;
      case 0x05: return this.readPortA(); case 0x85: return this.trisA | 0xe0 & 0;
      case 0x06: return this.readPortB(); case 0x86: return this.trisB;
      case 0x08: return this.eedata; case 0x88: return this.eecon1;
      case 0x09: return this.eeadr; case 0x89: return 0;
      case 0x0a: case 0x8a: return this.pclath;
      case 0x0b: case 0x8b: return this.intcon;
    }
    const g = a & 0x7f; if (g >= 0x0c && g < 0x50) return this.ram[g];
    return 0;
  }
  wr(f, v) {
    v &= 255; const a = this.addr(f) & 0xff;
    switch (a) {
      case 0x00: case 0x80: return;
      case 0x01: this.tmr0 = v; this.inhibit = 2; if (!(this.option & 0x08)) this.pre = 0; return;
      case 0x81: this.option = v; this.pins(); return;
      case 0x02: case 0x82: this.pc = ((this.pclath & 0x1f) << 8) | v; this.jumped = true; return;
      case 0x03: case 0x83: this.status = (this.status & 0x18) | (v & 0xe7); return;
      case 0x04: case 0x84: this.fsr = v; return;
      case 0x05: this.latA = v & 0x1f; this.pins(); return; case 0x85: this.trisA = v & 0x1f; this.pins(); return;
      case 0x06: this.latB = v; this.pins(); return; case 0x86: this.trisB = v; this.pins(); return;
      case 0x08: this.eedata = v; return; case 0x09: this.eeadr = v; return;
      case 0x88: { const old = this.eecon1; this.eecon1 = (old & 0x03) | (v & 0x1c); if (v & 1) { this.eedata = this.ee[this.eeadr & 63]; }
        if ((v & 2) && !(old & 2)) { if ((v & 4) && this.eeSeq === 2) { this.eecon1 |= 2; this.eeWriteAt = this.cycles + Math.round(this.f * 0.004); } }
        this.eeSeq = 0; return; }
      case 0x89: this.eeSeq = v === 0x55 ? 1 : (v === 0xaa && this.eeSeq === 1 ? 2 : 0); return;
      case 0x0a: case 0x8a: this.pclath = v & 0x1f; return;
      case 0x0b: case 0x8b: this.intcon = v; return;
    }
    const g = a & 0x7f; if (g >= 0x0c && g < 0x50) this.ram[g] = v;
  }
  push(v) { this.stack[this.sp] = v; this.sp = (this.sp + 1) & 7; }
  pop() { this.sp = (this.sp + 7) & 7; return this.stack[this.sp]; }
  flagsZ(v) { if (v & 255) this.status &= ~4; else this.status |= 4; }
  // wejścia (wywoływane przy zmianie stanu nóżek)
  setInputs(I) {
    const a = I.A, b = I.B;
    const ob = this.inB; this.inA = a; this.inB = b;
    const t0 = (a >> 4) & 1; if (t0 !== this.lastT0) { const rising = t0 === 1; this.lastT0 = t0; if ((this.option & 0x20) && rising === !(this.option & 0x10)) this.t0tick(); }
    const i0 = b & 1; if (i0 !== this.lastINT) { this.lastINT = i0; if ((this.trisB & 1) && (i0 === 1) === !!(this.option & 0x40)) this.intcon |= 0x02; }
    if (((ob ^ b) & 0xf0 & this.trisB)) this.intcon |= 0x01;
  }
  t0tick() {
    if (this.inhibit > 0) return;
    if (!(this.option & 0x08)) { this.pre++; if (this.pre < (2 << (this.option & 7))) return; this.pre = 0; }
    this.tmr0 = (this.tmr0 + 1) & 255; if (this.tmr0 === 0) this.intcon |= 0x04;
  }
  wdtPeriod() { return 0.018 * ((this.option & 0x08) ? (1 << (this.option & 7)) : 1); }
  clrwdt() { this.wdt = this.cycles; if (this.option & 0x08) this.pre = 0; }
  irqPending() { return (this.intcon & 0x80) && ((this.intcon >> 3) & this.intcon & 0x0f) || ((this.intcon & 0x80) && (this.intcon & 0x40) && (this.eecon1 & 0x10)); }
  wake() { return ((this.intcon >> 3) & this.intcon & 0x0f) || ((this.intcon & 0x40) && (this.eecon1 & 0x10)); }
  // wykonuje rozkazy do zadanej liczby cykli rozkazowych
  run(target) {
    const wdtOn = this.cfg & 0x04, wdtCyc = Math.round(this.wdtPeriod() * this.f);
    while (this.cycles < target) {
      if (this.eeWriteAt !== null && this.cycles >= this.eeWriteAt) { this.ee[this.eeadr & 63] = this.eedata; this.eecon1 = (this.eecon1 & ~2) | 0x10; this.eeWriteAt = null; this.eeDirty = true; }
      if (wdtOn) { if (this.cycles - this.wdt >= wdtCyc) { this.wdt = this.cycles; if (this.sleeping) { this.sleeping = false; this.status &= ~0x18; this.status |= 0x08; this.status &= ~0x10; } else { this.reset(false); this.status &= ~0x10; this.status |= 0x08; this.wdtResets = (this.wdtResets || 0) + 1; } } }
      if (this.sleeping) { if (this.wake()) { this.sleeping = false; this.cycles++; if (!(this.intcon & 0x80)) continue; } else { this.cycles++; continue; } }
      if (this.irqPending()) { this.push(this.pc); this.pc = 4; this.intcon &= ~0x80; this.cycles += 2; this.tick(2); continue; }
      const n = this.step(); this.tick(n);
    }
  }
  tick(n) { for (let i = 0; i < n; i++) { if (this.inhibit > 0) { this.inhibit--; continue; } if (!(this.option & 0x20)) this.t0tick(); } }
  step() {
    const op = this.prog[this.pc & 0x3ff]; this.pc = (this.pc + 1) & 0x1fff; this.jumped = false;
    const f = op & 0x7f, d = (op >> 7) & 1; let cyc = 1;
    const hi = op >> 12;
    if (hi === 0) {
      const sub = (op >> 8) & 15;
      if (sub === 0) {
        if (op & 0x80) this.wr(f, this.w);
        else switch (op) {
          case 0x0008: this.pc = this.pop(); cyc = 2; break;
          case 0x0009: this.pc = this.pop(); this.intcon |= 0x80; cyc = 2; break;
          case 0x0063: this.clrwdt(); this.status = (this.status | 0x10) & ~0x08; this.sleeping = true; break;
          case 0x0064: this.clrwdt(); this.status |= 0x18; break;
          case 0x0062: this.option = this.w; this.pins(); break;
          case 0x0065: this.trisA = this.w & 0x1f; this.pins(); break; case 0x0066: this.trisB = this.w; this.pins(); break;
          default: break; // NOP
        }
      } else if (sub === 1) { if (op & 0x80) this.wr(f, 0); else this.w = 0; this.status |= 4; }
      else {
        const x = this.rd(f); let r, w = this.w;
        const store = v => { if (d) this.wr(f, v); else this.w = v & 255; };
        switch (sub) {
          case 2: { r = x - w; const c = r >= 0, dc = (x & 15) - (w & 15) >= 0; this.status = (this.status & ~3) | (c ? 1 : 0) | (dc ? 2 : 0); this.flagsZ(r); store(r); break; }
          case 3: r = x - 1; this.flagsZ(r); store(r); break;
          case 4: r = x | w; this.flagsZ(r); store(r); break;
          case 5: r = x & w; this.flagsZ(r); store(r); break;
          case 6: r = x ^ w; this.flagsZ(r); store(r); break;
          case 7: { r = x + w; this.status = (this.status & ~3) | (r > 255 ? 1 : 0) | ((x & 15) + (w & 15) > 15 ? 2 : 0); this.flagsZ(r); store(r); break; }
          case 8: this.flagsZ(x); store(x); break;
          case 9: r = ~x & 255; this.flagsZ(r); store(r); break;
          case 10: r = x + 1; this.flagsZ(r); store(r); break;
          case 11: r = (x - 1) & 255; store(r); if (!r) { this.pc = (this.pc + 1) & 0x1fff; cyc = 2; } break;
          case 12: r = (x >> 1) | ((this.status & 1) << 7); this.status = (this.status & ~1) | (x & 1); store(r); break;
          case 13: r = ((x << 1) | (this.status & 1)) & 255; this.status = (this.status & ~1) | (x >> 7); store(r); break;
          case 14: r = ((x << 4) | (x >> 4)) & 255; store(r); break;
          case 15: r = (x + 1) & 255; store(r); if (!r) { this.pc = (this.pc + 1) & 0x1fff; cyc = 2; } break;
        }
      }
    } else if (hi === 1) {
      const b = (op >> 7) & 7, k = (op >> 10) & 3;
      if (k === 0) this.wr(f, this.rd(f) & ~(1 << b));
      else if (k === 1) this.wr(f, this.rd(f) | (1 << b));
      else { const set = (this.rd(f) >> b) & 1; if ((k === 2 && !set) || (k === 3 && set)) { this.pc = (this.pc + 1) & 0x1fff; cyc = 2; } }
    } else if (hi === 2) {
      const a = ((this.pclath & 0x18) << 8) | (op & 0x7ff);
      if (!(op & 0x800)) this.push(this.pc);
      this.pc = a; cyc = 2;
    } else {
      const k = op & 255, w = this.w;
      switch ((op >> 8) & 15) {
        case 0: case 1: case 2: case 3: this.w = k; break;
        case 4: case 5: case 6: case 7: this.w = k; this.pc = this.pop(); cyc = 2; break;
        case 8: this.w = w | k; this.flagsZ(this.w); break;
        case 9: this.w = w & k; this.flagsZ(this.w); break;
        case 10: this.w = w ^ k; this.flagsZ(this.w); break;
        case 12: case 13: { const r = k - w; this.status = (this.status & ~3) | (r >= 0 ? 1 : 0) | ((k & 15) - (w & 15) >= 0 ? 2 : 0); this.w = r & 255; this.flagsZ(this.w); break; }
        case 14: case 15: { const r = k + w; this.status = (this.status & ~3) | (r > 255 ? 1 : 0) | ((k & 15) + (w & 15) > 15 ? 2 : 0); this.w = r & 255; this.flagsZ(this.w); break; }
        default: break;
      }
    }
    if (this.jumped) cyc = 2;
    this.cycles += cyc; return cyc;
  }
  // stan nóżki do sterowania obwodem: 1, 0, null (wejście) + podciąganie
  pinState(port, bit) {
    if (port === 'A') { if ((this.trisA >> bit) & 1) return [null, false]; const v = (this.latA >> bit) & 1; if (bit === 4) return [v ? null : 0, false]; return [v, false]; }
    if ((this.trisB >> bit) & 1) return [null, !(this.option & 0x80)];
    return [(this.latB >> bit) & 1, false];
  }
}
