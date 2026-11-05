'use strict';
/* ================= Układy z własnym emulatorem rdzenia (PIC16F84A, PIC18F4550, STM32F103) =================
   Wspólna obsługa: zasilanie, MCLR/NRST, start oscylatora, sterowanie nóżkami, wejścia, analog, port szeregowy, EEPROM. */
function chipPart(id, o) {
  const pins = o.pins.map(p => { const m = /^R([A-E])(\d)$/.exec(p.fn) || /^P([A-E])(\d+)$/.exec(p.fn); return Object.assign({}, p, m ? { port: m[1], bit: +m[2] } : {}); });
  const idx = f => pins.findIndex(p => p.fn === f);
  const vdd = idx(o.vddFn || 'VDD'), vss = idx(o.vssFn || 'VSS'), mclr = idx(o.rstFn || 'MCLR');
  const gpio = pins.map((p, i) => p.port ? i : -1).filter(i => i >= 0);
  const same = []; for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) if (!pins[i].port && pins[i].fn === pins[j].fn && /^(VDD|VSS|VBAT|3V3|5V|GND)$/.test(pins[i].fn)) { same.push([i, j]); break; }
  def(id, {
    cat: 'mcu', name: o.name, sub: o.sub, kw: o.kw, info: o.info, mcu: o.kind, asm: o.asm, cpp: o.cpp, f: o.fosc, gnd: o.board ? vss : undefined,
    props: Object.assign({ code: o.code, hex: '', fosc: o.fosc }, o.props || {}), ui: o.ui,
    pins, bbox: o.bbox, bridges: () => same, draw: (c, r) => o.draw(c, r, pins),
    sim: {
      supply: [vdd, vss], maxDt: () => 1e-4,
      lin(d, S) {
        if (o.board) o.board(d, S, idx);
        const m = d.mcu; if (m && m.core && m.on) { const I = o.idd || 0.002; S.I(vdd, -I); S.I(vss, I); }
        if (o.mclrPull && mclr >= 0) S.G(mclr, vdd, 1 / o.mclrPull);
        if (m && m.pulls) for (const i in m.pulls) { const pl = m.pulls[i]; if (pl) S.G(+i, pl === 'up' ? vdd : vss, 1 / 40000); }
      },
      init(d) { chipInit(d, o, pins, gpio, vdd, vss); },
      mcuRun(d, dt) { chipRun(d, dt, o, pins, gpio, vdd, vss, mclr); },
      onIn(d, p, lvl) { const m = d.mcu; if (!m || !m.core) return; const pp = pins[p]; if (!pp.port) return; const b = 1 << pp.bit; if (lvl) m.inp[pp.port] |= b; else m.inp[pp.port] &= ~b; m.core.setInputs(m.inp); },
      commit(d) {
        const m = d.mcu; d.s.run = !!(m && m.core && m.on && !m.inReset); d.s.noprog = !d.c.props.hex; d.s.mcuRef = d.mcu;
        if (m && m.core && m.core.eeDirty) { m.core.eeDirty = false; let s = ''; for (const v of m.core.ee) s += String.fromCharCode(v); d.c.props.eep = btoa(s); }
        const vs = dVp(d, vdd, vss);
        d.s.warn = d.s.noprog ? 'noProgram' : vs < (o.vmin || 2) ? 'mcuNoPower' : vs > (o.vmax || 5.5) + 0.3 ? 'chipOverV' : m && m.inReset && mclr >= 0 ? (o.rstWarn || 'picMclr') : null;
        if (o.commit) o.commit(d, m);
      },
    },
    readings: (c, r) => [[{ pl: 'Program', en: 'Program' }, c.props.hex ? { pl: 'wgrany', en: 'loaded' } : { pl: 'brak – kliknij „Kod”', en: 'none – click “Code”' }],
      [{ pl: 'Stan', en: 'State' }, r.run ? (r.mcuRef && r.mcuRef.core && r.mcuRef.core.sleeping ? { pl: 'uśpiony (SLEEP)', en: 'sleeping (SLEEP)' } : { pl: 'działa', en: 'running' }) : r.mcuRef && r.mcuRef.inReset ? { pl: 'reset (MCLR)', en: 'reset (MCLR)' } : { pl: 'zatrzymany', en: 'stopped' }],
      [{ pl: 'Zegar', en: 'Clock' }, si(c.props.fosc, 'Hz')], ...(o.readings ? o.readings(c, r) : [])],
  });
}
function chipInit(d, o, pins, gpio, vdd, vss) {
  for (const i of gpio) eListen(d, i);
  const prev = d.mcu; d.mcu = { run: false, serial: prev && prev.serial || '', rxq: [], lastTx: 0, drv: {}, inp: {}, on: false, pulls: {} };
  for (const i of gpio) eDrive(d, i, null, o.pinR || 25, vdd, vss, false);
  const hex = d.c.props.hex; if (!hex) return;
  let bytes; try { bytes = parseIntelHex(hex); } catch (e) { return; }
  const m = d.mcu; const ee = new Uint8Array(o.eeSize || 0).fill(0xff);
  if (d.c.props.eep) try { const b = atob(d.c.props.eep); for (let i = 0; i < b.length && i < ee.length; i++) ee[i] = b.charCodeAt(i); } catch (e) { }
  else if (o.eeFromHex) o.eeFromHex(bytes, ee);
  const core = m.core = o.makeCore(bytes, ee, d, pins);
  if (!o.ownClock) core.f = (d.c.props.fosc || o.fosc) / (o.clkDiv || 4);
  for (const p of pins) if (p.port && m.inp[p.port] === undefined) m.inp[p.port] = 0;
  core.onPins = () => chipPins(d, o, pins, gpio, vdd, vss);
  core.onTx = b => { m.serial += String.fromCharCode(b); if (m.serial.length > 40000) m.serial = m.serial.slice(-30000); m.lastTx = performance.now(); SERIAL.dirty = true; UART_BRIDGE.tx(d, b); };
  core.analog = i => clamp(dV(d, i) - dV(d, vss), 0, 6);
  core.dev = d;
}
function chipPins(d, o, pins, gpio, vdd, vss) {
  const m = d.mcu; if (!m || !m.core) return;
  for (const i of gpio) {
    const p = pins[i]; let [lv, pu, R] = m.on && !m.inReset ? m.core.pinState(p.port, p.bit) : [null, false];
    let pull = null; if (typeof R === 'string') { pull = R; R = undefined; } if ((m.pulls[i] || null) !== pull) { m.pulls[i] = pull; E.dirty = true; }
    const key = lv + '|' + pu + '|' + (R || ''); if (m.drv[i] === key) continue; m.drv[i] = key;
    eDrive(d, i, lv, R || o.pinR || 25, vdd, vss, pu);
  }
}
function chipRun(d, dt, o, pins, gpio, vdd, vss, mclr) {
  const m = d.mcu; if (!m || !m.core) return;
  const vs = dVp(d, vdd, vss), core = m.core;
  if (vs < (o.vmin || 2)) { if (m.on) { m.on = false; m.pwrT = undefined; chipPins(d, o, pins, gpio, vdd, vss); } return; }
  // MCLR/NRST aktywny stanem niskim
  const rst = mclr >= 0 && dV(d, mclr) - dV(d, vss) < vs * 0.5 && !(o.mclrOff && o.mclrOff(core));
  if (rst) { if (!m.inReset) { m.inReset = true; chipPins(d, o, pins, gpio, vdd, vss); } return; }
  if (!m.on) { if (m.pwrT === undefined) m.pwrT = E.t; if (E.t - m.pwrT < (o.startup ? o.startup(core) : 0.002)) return; m.on = true; m.inReset = false; core.reset(true); for (const p of pins) if (p.port) { const i = pins.indexOf(p); const l = pinLevel(d, i); if (l) m.inp[p.port] |= 1 << p.bit; else m.inp[p.port] &= ~(1 << p.bit); } core.setInputs(m.inp); chipPins(d, o, pins, gpio, vdd, vss); }
  if (m.inReset) { m.inReset = false; core.reset(false); chipPins(d, o, pins, gpio, vdd, vss); }
  if (m.resetReq) { m.resetReq = false; core.reset(false); }
  if (core.vdd !== undefined) core.vdd = vs;
  if (m.rxq.length && core.rx && core.rx(m.rxq[0])) m.rxq.shift();
  const target = core.cycles + Math.round(dt * core.f);
  E.mcuStart = core.cycles; E.mcuF = core.f; E.mcuCpu = core;
  core.run(target);
  E.mcuCpu = null;
}
/* ---------- PIC16F84A ---------- */
(function () {
  const N = [['RA2', 'RA2'], ['RA3', 'RA3'], ['RA4', 'RA4/T0CKI (otwarty dren)'], ['MCLR', 'MCLR̅ (reset, aktywny niskim)'], ['VSS', 'VSS (masa)'], ['RB0', 'RB0/INT'], ['RB1', 'RB1'], ['RB2', 'RB2'], ['RB3', 'RB3'],
    ['RB4', 'RB4'], ['RB5', 'RB5'], ['RB6', 'RB6'], ['RB7', 'RB7'], ['VDD', 'VDD (+5 V)'], ['OSC2', 'OSC2/CLKOUT'], ['OSC1', 'OSC1/CLKIN'], ['RA0', 'RA0'], ['RA1', 'RA1']];
  const pk = pkgDIP(18, N);
  const pins = pk.pins.map((p, i) => ({ ...p, fn: /^OSC/.test(N[i][0]) ? 'NC' : N[i][0] }));
  chipPart('mcu_pic16f84a', {
    kind: 'pic16', asm: 'p16', fosc: 4e6, name: 'PIC16F84A (DIP-18)', sub: { pl: 'Klasyczny 8-bitowy PIC, asembler', en: 'Classic 8-bit PIC, assembler' }, kw: 'pic pic16f84a pic16f84 microchip asembler assembler mpasm mikrokontroler',
    info: { pl: 'Klasyczny mikrokontroler Microchip: 1024 słowa programu, 68 B RAM, 64 B EEPROM, 13 nóżek wejścia/wyjścia (RA0–RA4, RB0–RB7), TMR0 i przerwania. Programujesz go w asemblerze (składnia MPASM) w zakładce Kod – możesz też wczytać plik HEX z MPLAB. Zasilanie 5 V na VDD (14) i VSS (5). MCLR (4) musi być podciągnięty do VDD rezystorem 10 kΩ – inaczej układ stoi w resecie. Kwarc (OSC1/OSC2) jest symulowany – częstotliwość ustawiasz we właściwościach. RA4 ma wyjście z otwartym drenem (potrzebuje rezystora podciągającego).', en: 'A classic Microchip microcontroller: 1024 program words, 68 B RAM, 64 B EEPROM, 13 I/O pins (RA0–RA4, RB0–RB7), TMR0 and interrupts. Program it in assembly (MPASM syntax) in the Code tab – you can also load a HEX file from MPLAB. 5 V supply on VDD (14) and VSS (5). MCLR (4) must be pulled up to VDD with a 10 kΩ resistor – otherwise the chip stays in reset. The crystal (OSC1/OSC2) is simulated – set its frequency in the properties. RA4 is an open-drain output (it needs a pull-up resistor).' },
    pins, bbox: pk.bbox, eeSize: 64, vmin: 2.0, vmax: 5.5, idd: 0.002,
    ui: [{ k: 'fosc', type: 'seg', l: { pl: 'Kwarc', en: 'Crystal' }, opts: [[32768, '32,768 kHz'], [1e6, '1 MHz'], [4e6, '4 MHz'], [10e6, '10 MHz'], [20e6, '20 MHz']] }],
    makeCore: (b, ee) => { const prog = new Uint16Array(1024).fill(0x3fff); for (let i = 0; i < 1024; i++) if (b.has(i * 2)) prog[i] = (b.get(i * 2) | (b.get(i * 2 + 1) << 8)) & 0x3fff; const cfg = b.has(0x400E) ? (b.get(0x400E) | (b.get(0x400F) << 8)) : 0x3fff; return new Pic16(prog, cfg, ee); },
    eeFromHex: (b, ee) => { for (let i = 0; i < 64; i++) if (b.has(0x4200 + i * 2)) ee[i] = b.get(0x4200 + i * 2); },
    startup: core => (core.cfg & 0x08 ? 0 : 0.072) + 1024 / core.f / 4 + 0.001, // PWRT 72 ms + OST 1024 taktów
    draw: (c, r) => pk.body('PIC16F84A', '', '#24262a') + (!c.props.hex ? tx(80, -70, t('noProgramTag'), { s: 7, c: '#ff8a80' }) : ''),
    readings: (c, r) => { const k = r.mcuRef && r.mcuRef.core; return k ? [['W', '0x' + k.w.toString(16).padStart(2, '0').toUpperCase()], ['PC', '0x' + k.pc.toString(16).padStart(3, '0').toUpperCase()], ['PORTB', k.latB.toString(2).padStart(8, '0')]] : []; },
    code: `; PIC16F84A – miganie diodą LED na RB0 (nóżka 6), kwarc 4 MHz
; Dioda: RB0 → rezystor 330 Ω → LED → masa.  MCLR (nóżka 4) przez 10 kΩ do +5 V.
        LIST    p=16F84A
        #include <p16f84a.inc>
        __CONFIG _XT_OSC & _WDT_OFF & _PWRTE_ON & _CP_OFF

        CBLOCK  0x0C            ; zmienne w RAM (od adresu 0x0C)
        licznik1
        licznik2
        ENDC

        ORG     0x000           ; wektor resetu
        goto    start

start   bsf     STATUS, RP0     ; bank 1 (rejestry TRIS)
        movlw   b'11111110'     ; RB0 = wyjście, reszta = wejścia
        movwf   TRISB
        bcf     STATUS, RP0     ; z powrotem bank 0

petla   bsf     PORTB, 0        ; LED włączona
        call    czekaj
        bcf     PORTB, 0        ; LED wyłączona
        call    czekaj
        goto    petla

; opóźnienie ok. 250 ms (1 cykl rozkazowy = 1 µs przy 4 MHz)
czekaj  movlw   d'250'
        movwf   licznik1
zew     movlw   d'249'
        movwf   licznik2
wew     nop
        decfsz  licznik2, f     ; 4 cykle na obrót pętli wewnętrznej
        goto    wew
        decfsz  licznik1, f
        goto    zew
        return

        END
`,
  });
})();
/* ---------- PIC18F4550 ---------- */
(function () {
  const N = [['MCLR', 'MCLR̅/VPP/RE3'], ['RA0', 'RA0/AN0'], ['RA1', 'RA1/AN1'], ['RA2', 'RA2/AN2/VREF−'], ['RA3', 'RA3/AN3/VREF+'], ['RA4', 'RA4/T0CKI'], ['RA5', 'RA5/AN4/SS'], ['RE0', 'RE0/AN5'], ['RE1', 'RE1/AN6'], ['RE2', 'RE2/AN7'],
    ['VDD', 'VDD (+5 V)'], ['VSS', 'VSS (masa)'], ['OSC1', 'OSC1/CLKI'], ['OSC2', 'OSC2/CLKO/RA6'], ['RC0', 'RC0/T1OSO/T13CKI'], ['RC1', 'RC1/T1OSI/CCP2'], ['RC2', 'RC2/CCP1 (PWM)'], ['VUSB', 'VUSB'], ['RD0', 'RD0'], ['RD1', 'RD1'],
    ['RD2', 'RD2'], ['RD3', 'RD3'], ['RC4', 'RC4/D− (tylko wejście)'], ['RC5', 'RC5/D+ (tylko wejście)'], ['RC6', 'RC6/TX'], ['RC7', 'RC7/RX/SDO'], ['RD4', 'RD4'], ['RD5', 'RD5'], ['RD6', 'RD6'], ['RD7', 'RD7'],
    ['VSS', 'VSS (masa)'], ['VDD', 'VDD (+5 V)'], ['RB0', 'RB0/AN12/INT0/SDA/SDI'], ['RB1', 'RB1/AN10/INT1/SCL/SCK'], ['RB2', 'RB2/AN8/INT2'], ['RB3', 'RB3/AN9/CCP2'], ['RB4', 'RB4/AN11/KBI0'], ['RB5', 'RB5/KBI1/PGM'], ['RB6', 'RB6/KBI2/PGC'], ['RB7', 'RB7/KBI3/PGD']];
  const pk = pkgDIP(40, N, { wide: true });
  const pins = pk.pins.map((p, i) => ({ ...p, fn: /^(OSC|VUSB)/.test(N[i][0]) ? 'NC' : N[i][0] }));
  chipPart('mcu_pic18f4550', {
    kind: 'pic18', asm: 'p18', fosc: 20e6, name: 'PIC18F4550 (DIP-40)', sub: { pl: '8-bitowy PIC z ADC, PWM, UART, I2C/SPI', en: '8-bit PIC with ADC, PWM, UART, I2C/SPI' }, kw: 'pic pic18f4550 pic18 microchip asembler assembler mpasm usb mikrokontroler',
    info: { pl: 'Mikrokontroler Microchip z rodziny PIC18: 32 KB programu, 2 KB RAM, 256 B EEPROM, 35 nóżek I/O (porty A–E), 13-kanałowy ADC 10-bit, Timer0–3, dwa moduły CCP (PWM), EUSART (port szeregowy – widoczny w monitorze w zakładce Kod), MSSP (I2C master na RB0/RB1, SPI master: SDI RB0, SCK RB1, SDO RC7). Programujesz go w asemblerze (MPASM) albo wczytujesz HEX z MPLAB X / XC8. Zasilanie 5 V: oba VDD (11, 32) i oba VSS (12, 31). MCLR̅ (1) przez 10 kΩ do VDD. Uwaga: po resecie nóżki analogowe (AN0–AN12) są wejściami analogowymi – ustaw ADCON1 = 0x0F albo CONFIG PBADEN = OFF. USB nie jest symulowane.', en: 'A Microchip PIC18 microcontroller: 32 KB program, 2 KB RAM, 256 B EEPROM, 35 I/O pins (ports A–E), 13-channel 10-bit ADC, Timer0–3, two CCP modules (PWM), EUSART (serial port – shown in the monitor in the Code tab), MSSP (I2C master on RB0/RB1, SPI master: SDI RB0, SCK RB1, SDO RC7). Program it in assembly (MPASM) or load a HEX from MPLAB X / XC8. 5 V supply: both VDD (11, 32) and both VSS (12, 31). MCLR̅ (1) through 10 kΩ to VDD. Note: after reset the analog pins (AN0–AN12) are analog inputs – set ADCON1 = 0x0F or CONFIG PBADEN = OFF. USB is not simulated.' },
    pins, bbox: pk.bbox, eeSize: 256, vmin: 2.0, vmax: 5.5, idd: 0.012,
    ui: [{ k: 'fosc', type: 'seg', l: { pl: 'Zegar (Fosc)', en: 'Clock (Fosc)' }, opts: [[4e6, '4 MHz'], [8e6, '8 MHz'], [20e6, '20 MHz'], [48e6, '48 MHz (PLL)']] }],
    makeCore: (b, ee, d, pins) => {
      const prog = new Uint8Array(32768).fill(0xFF); for (let i = 0; i < 32768; i++) if (b.has(i)) prog[i] = b.get(i);
      const cfg = P18CFG_DEF.slice(); for (let i = 0; i < 14; i++) if (b.has(0x300000 + i)) cfg[i] = b.get(0x300000 + i);
      const core = new Pic18(prog, cfg, ee); const idx = (p, bit) => pins.findIndex(q => q.port === p && q.bit === bit);
      core.pinVolt = (p, bit) => core.analog ? core.analog(idx(p, bit)) : 0; core.bus = pic18Bus(d, idx); return core;
    },
    eeFromHex: (b, ee) => { for (let i = 0; i < 256; i++) if (b.has(0xF00000 + i)) ee[i] = b.get(0xF00000 + i); },
    mclrOff: core => !(core.cfg[5] & 0x80),
    startup: core => ((core.cfg[2] & 1) ? 0 : 0.066) + 1024 / (core.f * 4) + 0.001,
    draw: (c, r) => pk.body('PIC18F4550', '', '#24262a') + (!c.props.hex ? tx(190, -70, t('noProgramTag'), { s: 7, c: '#ff8a80' }) : ''),
    readings: (c, r) => { const k = r.mcuRef && r.mcuRef.core; return k ? [['W', '0x' + k.w.toString(16).padStart(2, '0').toUpperCase()], ['PC', '0x' + k.pc.toString(16).padStart(4, '0').toUpperCase()], ['LATD', k.m[0xF8C].toString(2).padStart(8, '0')]] : []; },
    code: `; PIC18F4550 – miganie diodą na RD0 (nóżka 19) i powitanie przez port szeregowy (RC6/TX, 9600 bodów)
; Kwarc 20 MHz (HS) → 5 milionów rozkazów na sekundę.  MCLR̅ (nóżka 1) przez 10 kΩ do +5 V.
        LIST    p=18F4550
        #include <p18f4550.inc>
        CONFIG  FOSC = HS, WDT = OFF, LVP = OFF, PBADEN = OFF, MCLRE = ON, PWRT = ON

        ORG     0x0000
        goto    start

        ORG     0x0100
tekst   DB      "Witaj z PIC18F4550!", 0x0D, 0x0A, 0

start   movlw   0x0F
        movwf   ADCON1          ; wszystkie nóżki cyfrowe
        clrf    LATD
        clrf    TRISD           ; port D = wyjścia
        ; EUSART: 9600 bodów przy 20 MHz, BRGH = 1 → SPBRG = 129
        movlw   d'129'
        movwf   SPBRG
        movlw   b'00100100'     ; TXEN, BRGH
        movwf   TXSTA
        movlw   b'10010000'     ; SPEN, CREN
        movwf   RCSTA
        ; wysłanie napisu z pamięci programu (TBLRD)
        movlw   UPPER tekst
        movwf   TBLPTRU
        movlw   HIGH tekst
        movwf   TBLPTRH
        movlw   LOW tekst
        movwf   TBLPTRL
znak    tblrd*+
        movf    TABLAT, W
        bz      timer
czekaj  btfss   PIR1, TXIF      ; czekaj na wolny bufor nadajnika
        bra     czekaj
        movwf   TXREG
        bra     znak
        ; Timer0: 16 bit, preskaler 1:32 → 250 ms = 39062 zliczeń
timer   movlw   b'10000100'
        movwf   T0CON
petla   movlw   HIGH (d'65536' - d'39062')
        movwf   TMR0H
        movlw   LOW (d'65536' - d'39062')
        movwf   TMR0L
        bcf     INTCON, TMR0IF
koniec  btfss   INTCON, TMR0IF
        bra     koniec
        btg     LATD, 0         ; zmiana stanu diody
        bra     petla

        END
`,
  });
})();
/* ---------- STM32F103C8T6 Blue Pill ---------- */
(function () {
  const top = ['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', '5V', 'GND', '3V3'];
  const bot = ['VBAT', 'PC13', 'PC14', 'PC15', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB10', 'PB11', 'RST', '3V3', 'GND', 'GND'];
  const long = { PA0: 'PA0 (A0, WKUP)', PA1: 'PA1 (A1)', PA2: 'PA2 (A2, TX2)', PA3: 'PA3 (A3, RX2)', PA4: 'PA4 (A4, SS)', PA5: 'PA5 (A5, SCK)', PA6: 'PA6 (A6, MISO)', PA7: 'PA7 (A7, MOSI)', PB0: 'PB0 (A8)', PB1: 'PB1 (A9)',
    PA9: 'PA9 (TX1 – Serial)', PA10: 'PA10 (RX1 – Serial)', PA11: 'PA11 (USB D−)', PA12: 'PA12 (USB D+)', PB6: 'PB6 (SCL – Wire)', PB7: 'PB7 (SDA – Wire)', PB10: 'PB10 (SCL2, TX3)', PB11: 'PB11 (SDA2, RX3)',
    PC13: 'PC13 (wbudowana LED, świeci przy LOW)', PB3: 'PB3', PB4: 'PB4', PA15: 'PA15', RST: 'NRST (reset, aktywny niskim)', VBAT: 'VBAT', '5V': '5V (z USB)', '3V3': '3,3 V', GND: 'GND' };
  const pins = [];
  top.forEach((fn, i) => pins.push({ x: i * 20, y: 0, fn: fn === 'VBAT' ? 'NC' : fn, s: fn.replace(/^P/, ''), n: long[fn] || fn }));
  bot.forEach((fn, i) => pins.push({ x: i * 20, y: 120, fn: fn === 'VBAT' ? 'NC' : fn, s: fn.replace(/^P/, ''), n: long[fn] || fn }));
  const draw0 = pyBoardDraw({ rect: [-14, -14, 394, 134], col: '#1d4fa8', edge: '#0f2c66', radius: 4, usb: [-44, 40, 40, 40], chip: [150, 34, 52, 52], chipLabel: 'STM32F103', led: [262, 92, '#3ddc63'], pwr: [262, 28],
    buttons: [[330, 60, 'RESET']], title: [96, 66], titleText: 'Blue Pill', titleSize: 11, sub: 'STM32F103C8T6', labelSide: p => p.y === 0 ? [0, 17] : [0, -11] });
  chipPart('mcu_bluepill', {
    kind: 'stm32', cpp: 'stm', ownClock: true, fosc: 72e6, name: 'STM32F103C8T6 (Blue Pill)', sub: { pl: '32-bit ARM Cortex-M3, 72 MHz', en: '32-bit ARM Cortex-M3, 72 MHz' }, kw: 'stm32 stm32f103 blue pill bluepill arm cortex m3 mikrokontroler microcontroller stm32duino',
    info: { pl: 'Popularna płytka z 32-bitowym mikrokontrolerem STM32F103C8T6 (ARM Cortex-M3, 72 MHz, 64 KB Flash, 20 KB RAM). Logika 3,3 V (większość nóżek toleruje 5 V). Programujesz ją w Arduino (C++, API jak STM32duino): piny nazywasz PA0…PC15, wbudowana dioda to PC13 (świeci przy stanie niskim). Serial = USART1 (PA9/PA10, widoczny w monitorze), Wire = I2C1 (SCL PB6, SDA PB7), SPI = SPI1 (PA5/PA6/PA7), analogRead na PA0–PA7, PB0, PB1 (10 bit, analogReadResolution(12) daje 12 bit), analogWrite na nóżkach timerów (PA0–PA3, PA6–PA11, PB0, PB1, PB6–PB9). Emulowany jest cały rdzeń ARM i rejestry układu – działa też kod pisany bezpośrednio na rejestrach (RCC, GPIO, TIM, USART…).', en: 'A popular board with the 32-bit STM32F103C8T6 microcontroller (ARM Cortex-M3, 72 MHz, 64 KB Flash, 20 KB RAM). 3.3 V logic (most pins are 5 V tolerant). Program it in Arduino (C++, STM32duino-style API): pins are named PA0…PC15, the built-in LED is PC13 (on when LOW). Serial = USART1 (PA9/PA10, shown in the monitor), Wire = I2C1 (SCL PB6, SDA PB7), SPI = SPI1 (PA5/PA6/PA7), analogRead on PA0–PA7, PB0, PB1 (10 bit, analogReadResolution(12) gives 12 bit), analogWrite on timer pins (PA0–PA3, PA6–PA11, PB0, PB1, PB6–PB9). The whole ARM core and chip registers are emulated – code written directly on registers (RCC, GPIO, TIM, USART…) works too.' },
    pins, bbox: [-48, -16, 396, 136], vddFn: '3V3', vssFn: 'GND', rstFn: 'RST', mclrPull: 40000, rstWarn: 'stmRst', vmin: 2.0, vmax: 3.6, idd: 0.03, pinR: 40,
    board: (d, S, idx) => { S.V(idx('5V'), idx('GND'), 5, 0.05); S.V(idx('3V3'), idx('GND'), 3.3, 0.25); },
    makeCore: (b, ee, d, pins) => {
      const fl = new Uint8Array(128 * 1024).fill(0xFF); for (const [a, v] of b) if (a >= 0x08000000 && a < 0x08020000) fl[a - 0x08000000] = v;
      const core = new Stm32(fl); const idx = (p, bit) => pins.findIndex(q => q.port === p && q.bit === bit);
      core.pinVolt = (p, bit) => { const i = idx(p, bit); return i >= 0 && core.analog ? core.analog(i) : 0; };
      core.bus = stm32Bus(d, idx);
      core.onUart = (k, v) => { if (k === 1 && core.onTx) core.onTx(v); };
      core.rx = v => core.uartRx(1, v);
      core.onFault = msg => { const m = d.mcu; if (m) { m.serial += '\n[CappyTronic] HardFault: ' + msg + '\n'; SERIAL.dirty = true; m.fault = msg; } };
      return core;
    },
    startup: () => 0.001,
    commit: (d, m) => { d.s.L = !!(m && m.core && m.on && !m.inReset && (() => { const st = m.core.pinState('C', 13); return st[0] === 0; })()); if (m && m.fault && !d.s.warn) d.s.warn = 'stmFault'; },
    draw: (c, r, pins) => draw0(c, r, pins) + (!c.props.hex ? tx(190, 108, t('noProgramTag'), { s: 7, c: '#ff8a80' }) : ''),
    readings: (c, r) => { const k = r.mcuRef && r.mcuRef.core; return k ? [['PC', '0x' + (k.pc >>> 0).toString(16).toUpperCase()], [{ pl: 'Zegar rdzenia', en: 'Core clock' }, si(k.f, 'Hz')]] : []; },
    code: `// STM32F103C8T6 (Blue Pill) – miganie wbudowaną diodą PC13 i komunikaty w monitorze portu szeregowego
void setup() {
  Serial.begin(115200);              // USART1: PA9 (TX), PA10 (RX)
  pinMode(LED_BUILTIN, OUTPUT);      // LED_BUILTIN = PC13
  Serial.println("Witaj z STM32F103!");
}

void loop() {
  digitalWrite(LED_BUILTIN, LOW);    // dioda na Blue Pill świeci przy stanie niskim
  delay(500);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  Serial.print("Czas pracy: ");
  Serial.print(millis() / 1000);
  Serial.println(" s");
}
`,
  });
  PARTS.mcu_bluepill.cppLabel = 'Arduino C++ (STM32)'; PARTS.mcu_bluepill.libsHint = 'stmLibsHint';
})();
