'use strict';
/* ================= Asembler PIC (składnia MPASM) – PIC16F84A i PIC18F4550 =================
   Tryb absolutny (ORG), dyrektywy: LIST, PROCESSOR, #include <p16f84a.inc>/<p18f4550.inc>, __CONFIG, CONFIG, EQU, SET, =,
   CONSTANT, VARIABLE, #define, CBLOCK/ENDC, ORG, END, DT, DE, DW, DB, DATA, RES, FILL, BANKSEL, PAGESEL, BANKISEL, ERRORLEVEL, RADIX,
   IF/IFDEF/IFNDEF/ELSE/ENDIF, MACRO/ENDM/LOCAL/EXITM, MESSG, ERROR. Domyślna podstawa liczb: szesnastkowa (jak w MPASM). */
const PIC16_INC = {
  INDF: 0, TMR0: 1, PCL: 2, STATUS: 3, FSR: 4, PORTA: 5, PORTB: 6, EEDATA: 8, EEADR: 9, PCLATH: 10, INTCON: 11, OPTION_REG: 0x81, TRISA: 0x85, TRISB: 0x86, EECON1: 0x88, EECON2: 0x89,
  W: 0, F: 1, IRP: 7, RP1: 6, RP0: 5, NOT_TO: 4, NOT_PD: 3, Z: 2, DC: 1, C: 0, GIE: 7, EEIE: 6, T0IE: 5, TMR0IE: 5, INTE: 4, RBIE: 3, T0IF: 2, TMR0IF: 2, INTF: 1, RBIF: 0,
  NOT_RBPU: 7, INTEDG: 6, T0CS: 5, T0SE: 4, PSA: 3, PS2: 2, PS1: 1, PS0: 0, EEIF: 4, WRERR: 3, WREN: 2, WR: 1, RD: 0,
  RA0: 0, RA1: 1, RA2: 2, RA3: 3, RA4: 4, T0CKI: 4, RB0: 0, RB1: 1, RB2: 2, RB3: 3, RB4: 4, RB5: 5, RB6: 6, RB7: 7, INT: 0,
  _CP_ON: 0x000F, _CP_OFF: 0x3FFF, _PWRTE_ON: 0x3FF7, _PWRTE_OFF: 0x3FFF, _WDT_ON: 0x3FFF, _WDT_OFF: 0x3FFB, _WDTE_ON: 0x3FFF, _WDTE_OFF: 0x3FFB,
  _LP_OSC: 0x3FFC, _XT_OSC: 0x3FFD, _HS_OSC: 0x3FFE, _RC_OSC: 0x3FFF, _FOSC_LP: 0x3FFC, _FOSC_XT: 0x3FFD, _FOSC_HS: 0x3FFE, _FOSC_EXTRC: 0x3FFF,
};
// PIC18F4550: rejestry specjalne (karta katalogowa DS39632E, tabela 5-1) i najczęściej używane bity
const PIC18_SFR = 'TOSU FFF TOSH FFE TOSL FFD STKPTR FFC PCLATU FFB PCLATH FFA PCL FF9 TBLPTRU FF8 TBLPTRH FF7 TBLPTRL FF6 TABLAT FF5 PRODH FF4 PRODL FF3 INTCON FF2 INTCON2 FF1 INTCON3 FF0 ' +
  'INDF0 FEF POSTINC0 FEE POSTDEC0 FED PREINC0 FEC PLUSW0 FEB FSR0H FEA FSR0L FE9 WREG FE8 INDF1 FE7 POSTINC1 FE6 POSTDEC1 FE5 PREINC1 FE4 PLUSW1 FE3 FSR1H FE2 FSR1L FE1 BSR FE0 ' +
  'INDF2 FDF POSTINC2 FDE POSTDEC2 FDD PREINC2 FDC PLUSW2 FDB FSR2H FDA FSR2L FD9 STATUS FD8 TMR0H FD7 TMR0L FD6 T0CON FD5 OSCCON FD3 HLVDCON FD2 WDTCON FD1 RCON FD0 ' +
  'TMR1H FCF TMR1L FCE T1CON FCD TMR2 FCC PR2 FCB T2CON FCA SSPBUF FC9 SSPADD FC8 SSPSTAT FC7 SSPCON1 FC6 SSPCON2 FC5 ADRESH FC4 ADRESL FC3 ADCON0 FC2 ADCON1 FC1 ADCON2 FC0 ' +
  'CCPR1H FBF CCPR1L FBE CCP1CON FBD CCPR2H FBC CCPR2L FBB CCP2CON FBA BAUDCON FB8 ECCP1AS FB6 CVRCON FB5 CMCON FB4 TMR3H FB3 TMR3L FB2 T3CON FB1 SPBRGH FB0 SPBRG FAF RCREG FAE TXREG FAD TXSTA FAC RCSTA FAB ' +
  'EEADR FA9 EEDATA FA8 EECON2 FA7 EECON1 FA6 IPR2 FA2 PIR2 FA1 PIE2 FA0 IPR1 F9F PIR1 F9E PIE1 F9D OSCTUNE F9B TRISE F96 TRISD F95 TRISC F94 TRISB F93 TRISA F92 ' +
  'LATE F8D LATD F8C LATC F8B LATB F8A LATA F89 PORTE F84 PORTD F83 PORTC F82 PORTB F81 PORTA F80 UCON F6D UCFG F6F';
const PIC18_BITS = {
  W: 0, F: 1, A: 0, ACCESS: 0, BANKED: 1, FAST: 1,
  N: 4, OV: 3, Z: 2, DC: 1, C: 0,
  GIE: 7, GIEH: 7, PEIE: 6, GIEL: 6, TMR0IE: 5, T0IE: 5, INT0IE: 4, INT0E: 4, RBIE: 3, TMR0IF: 2, T0IF: 2, INT0IF: 1, INT0F: 1, RBIF: 0,
  NOT_RBPU: 7, RBPU: 7, INTEDG0: 6, INTEDG1: 5, INTEDG2: 4, TMR0IP: 2, RBIP: 0, INT2IP: 7, INT1IP: 6, INT2IE: 4, INT1IE: 3, INT2IF: 1, INT1IF: 0,
  IPEN: 7, NOT_RI: 4, NOT_TO: 3, NOT_PD: 2, NOT_POR: 1, NOT_BOR: 0,
  TMR0ON: 7, T08BIT: 6, T0CS: 5, T0SE: 4, PSA: 3, T0PS2: 2, T0PS1: 1, T0PS0: 0,
  RD16: 7, T1RUN: 6, T1CKPS1: 5, T1CKPS0: 4, T1OSCEN: 3, NOT_T1SYNC: 2, TMR1CS: 1, TMR1ON: 0, TMR2ON: 2, T2CKPS1: 1, T2CKPS0: 0,
  TMR3ON: 0, TMR3CS: 1, T3CKPS1: 5, T3CKPS0: 4,
  SPPIF: 7, ADIF: 6, RCIF: 5, TXIF: 4, SSPIF: 3, CCP1IF: 2, TMR2IF: 1, TMR1IF: 0, SPPIE: 7, ADIE: 6, RCIE: 5, TXIE: 4, SSPIE: 3, CCP1IE: 2, TMR2IE: 1, TMR1IE: 0,
  OSCFIF: 7, CMIF: 6, USBIF: 5, EEIF: 4, BCLIF: 3, HLVDIF: 2, TMR3IF: 1, CCP2IF: 0, EEIE: 4, BCLIE: 3, TMR3IE: 1, CCP2IE: 0,
  GO: 1, GO_DONE: 1, DONE: 1, NOT_DONE: 1, ADON: 0, CHS3: 5, CHS2: 4, CHS1: 3, CHS0: 2, VCFG1: 5, VCFG0: 4, PCFG3: 3, PCFG2: 2, PCFG1: 1, PCFG0: 0, ADFM: 7,
  CSRC: 7, TX9: 6, TXEN: 5, SYNC: 4, SENDB: 3, BRGH: 2, TRMT: 1, TX9D: 0, SPEN: 7, RX9: 6, SREN: 5, CREN: 4, ADDEN: 3, FERR: 2, OERR: 1, RX9D: 0, BRG16: 3,
  EEPGD: 7, CFGS: 6, FREE: 4, WRERR: 3, WREN: 2, WR: 1, RD: 0,
  SMP: 7, CKE: 6, D_A: 5, P: 4, S: 3, R_W: 2, UA: 1, BF: 0, WCOL: 7, SSPOV: 6, SSPEN: 5, CKP: 4, SSPM3: 3, SSPM2: 2, SSPM1: 1, SSPM0: 0,
  SPPIP: 7, ADIP: 6, RCIP: 5, TXIP: 4, SSPIP: 3, CCP1IP: 2, TMR2IP: 1, TMR1IP: 0, OSCFIP: 7, CMIP: 6, USBIP: 5, EEIP: 4, BCLIP: 3, HLVDIP: 2, TMR3IP: 1, CCP2IP: 0,
  DC1B1: 5, DC1B0: 4, CCP1M3: 3, CCP1M2: 2, CCP1M1: 1, CCP1M0: 0, DC2B1: 5, DC2B0: 4, T2OUTPS3: 6, T2OUTPS2: 5, T2OUTPS1: 4, T2OUTPS0: 3,
  GCEN: 7, ACKSTAT: 6, ACKDT: 5, ACKEN: 4, RCEN: 3, PEN: 2, RSEN: 1, SEN: 0, IRCF2: 6, IRCF1: 5, IRCF0: 4, SCS1: 1, SCS0: 0, SWDTEN: 0,
};
for (const p of 'ABCDE') for (let b = 0; b < 8; b++) { PIC18_BITS['R' + p + b] = b; PIC18_BITS['LAT' + p + b] = b; PIC18_BITS['TRIS' + p + b] = b; }
const PIC18_INC = (() => { const o = Object.assign({}, PIC18_BITS); const a = PIC18_SFR.split(' '); for (let i = 0; i < a.length; i += 2) o[a[i]] = parseInt(a[i + 1], 16); return o; })();
// CONFIG dla PIC18F4550 (ustawienia → [adres bajtu konfiguracji, maska, wartość])
const P18CFG = (() => {
  const c = {}; const add = (name, addr, mask, vals) => { for (const [k, v] of Object.entries(vals)) c[name + '=' + k] = [addr, mask, v]; };
  add('PLLDIV', 0, 7, { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 10: 6, 12: 7 }); add('CPUDIV', 0, 0x18, { OSC1_PLL2: 0, OSC2_PLL3: 8, OSC3_PLL4: 16, OSC4_PLL6: 24 }); add('USBDIV', 0, 0x20, { 1: 0, 2: 0x20 });
  add('FOSC', 1, 0x0f, { XT_XT: 0, XTPLL_XT: 2, ECIO_EC: 4, EC_EC: 5, ECPLLIO_EC: 6, ECPLL_EC: 7, INTOSCIO_EC: 8, INTOSC_EC: 9, INTOSC_XT: 10, INTOSC_HS: 11, HS: 12, HSPLL_HS: 14 });
  add('FCMEN', 1, 0x40, { OFF: 0, ON: 0x40 }); add('IESO', 1, 0x80, { OFF: 0, ON: 0x80 });
  add('PWRT', 2, 1, { ON: 0, OFF: 1 }); add('BOR', 2, 6, { OFF: 0, SOFT: 2, ON_ACTIVE: 4, ON: 6 }); add('BORV', 2, 0x18, { 0: 0, 1: 8, 2: 16, 3: 24 }); add('VREGEN', 2, 0x20, { OFF: 0, ON: 0x20 });
  add('WDT', 3, 1, { OFF: 0, ON: 1 }); add('WDTPS', 3, 0x1e, Object.fromEntries([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768].map((v, i) => [v, i << 1])));
  add('CCP2MX', 5, 1, { OFF: 0, ON: 1 }); add('PBADEN', 5, 2, { OFF: 0, ON: 2 }); add('LPT1OSC', 5, 4, { OFF: 0, ON: 4 }); add('MCLRE', 5, 0x80, { OFF: 0, ON: 0x80 });
  add('STVREN', 6, 1, { OFF: 0, ON: 1 }); add('LVP', 6, 4, { OFF: 0, ON: 4 }); add('ICPRT', 6, 0x20, { OFF: 0, ON: 0x20 }); add('XINST', 6, 0x40, { OFF: 0, ON: 0x40 }); add('DEBUG', 6, 0x80, { ON: 0, OFF: 0x80 });
  for (const n of ['CP0', 'CP1', 'CP2', 'CP3']) add(n, 8, 1 << (+n[2]), { ON: 0, OFF: 1 << (+n[2]) }); add('CPB', 9, 0x40, { ON: 0, OFF: 0x40 }); add('CPD', 9, 0x80, { ON: 0, OFF: 0x80 });
  for (const n of ['WRT0', 'WRT1', 'WRT2', 'WRT3']) add(n, 10, 1 << (+n[3]), { ON: 0, OFF: 1 << (+n[3]) }); add('WRTC', 11, 0x20, { ON: 0, OFF: 0x20 }); add('WRTB', 11, 0x40, { ON: 0, OFF: 0x40 }); add('WRTD', 11, 0x80, { ON: 0, OFF: 0x80 });
  for (const n of ['EBTR0', 'EBTR1', 'EBTR2', 'EBTR3']) add(n, 12, 1 << (+n[4]), { ON: 0, OFF: 1 << (+n[4]) }); add('EBTRB', 13, 0x40, { ON: 0, OFF: 0x40 });
  return c;
})();
const P18CFG_DEF = [0x00, 0x05, 0x1f, 0x1f, 0xff, 0x83, 0x85, 0xff, 0x0f, 0xc0, 0x0f, 0xe0, 0x0f, 0x40]; // stan nieprogramowany (0x300000–0x30000D)
for (const [k, v] of Object.entries({ _CONFIG1L: 0x300000, _CONFIG1H: 0x300001, _CONFIG2L: 0x300002, _CONFIG2H: 0x300003, _CONFIG3H: 0x300005, _CONFIG4L: 0x300006, _CONFIG5L: 0x300008, _CONFIG5H: 0x300009, _CONFIG6L: 0x30000A, _CONFIG6H: 0x30000B, _CONFIG7L: 0x30000C, _CONFIG7H: 0x30000D })) PIC18_INC[k] = v;

const P16OPS = {
  ADDWF: ['fd', 0x0700], ANDWF: ['fd', 0x0500], CLRF: ['f', 0x0180], CLRW: ['-', 0x0100], COMF: ['fd', 0x0900], DECF: ['fd', 0x0300], DECFSZ: ['fd', 0x0B00], INCF: ['fd', 0x0A00], INCFSZ: ['fd', 0x0F00],
  IORWF: ['fd', 0x0400], MOVF: ['fd', 0x0800], MOVWF: ['f', 0x0080], NOP: ['-', 0], RLF: ['fd', 0x0D00], RRF: ['fd', 0x0C00], SUBWF: ['fd', 0x0200], SWAPF: ['fd', 0x0E00], XORWF: ['fd', 0x0600],
  BCF: ['fb', 0x1000], BSF: ['fb', 0x1400], BTFSC: ['fb', 0x1800], BTFSS: ['fb', 0x1C00],
  ADDLW: ['k', 0x3E00], ANDLW: ['k', 0x3900], CALL: ['a', 0x2000], CLRWDT: ['-', 0x0064], GOTO: ['a', 0x2800], IORLW: ['k', 0x3800], MOVLW: ['k', 0x3000], RETFIE: ['-', 0x0009], RETLW: ['k', 0x3400],
  RETURN: ['-', 0x0008], SLEEP: ['-', 0x0063], SUBLW: ['k', 0x3C00], XORLW: ['k', 0x3A00], OPTION: ['-', 0x0062], TRIS: ['t', 0x0060],
};
const P18OPS = {
  ADDWF: ['fda', 0x2400], ADDWFC: ['fda', 0x2000], ANDWF: ['fda', 0x1400], COMF: ['fda', 0x1C00], DECF: ['fda', 0x0400], DECFSZ: ['fda', 0x2C00], DCFSNZ: ['fda', 0x4C00], INCF: ['fda', 0x2800], INCFSZ: ['fda', 0x3C00],
  INFSNZ: ['fda', 0x4800], IORWF: ['fda', 0x1000], MOVF: ['fda', 0x5000], RLCF: ['fda', 0x3400], RLNCF: ['fda', 0x4400], RRCF: ['fda', 0x3000], RRNCF: ['fda', 0x4000], SUBFWB: ['fda', 0x5400], SUBWF: ['fda', 0x5C00],
  SUBWFB: ['fda', 0x5800], SWAPF: ['fda', 0x3800], XORWF: ['fda', 0x1800],
  CLRF: ['fa', 0x6A00], CPFSEQ: ['fa', 0x6200], CPFSGT: ['fa', 0x6400], CPFSLT: ['fa', 0x6000], MOVWF: ['fa', 0x6E00], MULWF: ['fa', 0x0200], NEGF: ['fa', 0x6C00], SETF: ['fa', 0x6800], TSTFSZ: ['fa', 0x6600],
  MOVFF: ['ff', 0xC000], BCF: ['fba', 0x9000], BSF: ['fba', 0x8000], BTFSC: ['fba', 0xB000], BTFSS: ['fba', 0xA000], BTG: ['fba', 0x7000],
  BC: ['n8', 0xE200], BN: ['n8', 0xE600], BNC: ['n8', 0xE300], BNN: ['n8', 0xE700], BNOV: ['n8', 0xE500], BNZ: ['n8', 0xE100], BOV: ['n8', 0xE400], BZ: ['n8', 0xE000],
  BRA: ['n11', 0xD000], RCALL: ['n11', 0xD800], CALL: ['call', 0xEC00], GOTO: ['goto', 0xEF00],
  CLRWDT: ['-', 0x0004], DAW: ['-', 0x0007], NOP: ['-', 0x0000], POP: ['-', 0x0006], PUSH: ['-', 0x0005], RESET: ['-', 0x00FF], RETFIE: ['s', 0x0010], RETURN: ['s', 0x0012], SLEEP: ['-', 0x0003],
  ADDLW: ['k', 0x0F00], ANDLW: ['k', 0x0B00], IORLW: ['k', 0x0900], LFSR: ['lfsr', 0xEE00], MOVLB: ['k4', 0x0100], MOVLW: ['k', 0x0E00], MULLW: ['k', 0x0D00], RETLW: ['k', 0x0C00], SUBLW: ['k', 0x0800], XORLW: ['k', 0x0A00],
  'TBLRD*': ['-', 0x0008], 'TBLRD*+': ['-', 0x0009], 'TBLRD*-': ['-', 0x000A], 'TBLRD+*': ['-', 0x000B], 'TBLWT*': ['-', 0x000C], 'TBLWT*+': ['-', 0x000D], 'TBLWT*-': ['-', 0x000E], 'TBLWT+*': ['-', 0x000F],
};
const PICDIR = new Set(['LIST', 'NOLIST', 'PROCESSOR', 'INCLUDE', '#INCLUDE', '__CONFIG', 'CONFIG', 'EQU', 'SET', 'CONSTANT', 'VARIABLE', '#DEFINE', '#UNDEFINE', 'CBLOCK', 'ENDC', 'ORG', 'END', 'DT', 'DE', 'DW', 'DB', 'DATA', 'RES', 'FILL',
  'BANKSEL', 'PAGESEL', 'BANKISEL', 'PAGESELW', 'ERRORLEVEL', 'RADIX', 'IF', 'IFDEF', 'IFNDEF', 'ELSE', 'ENDIF', 'MACRO', 'ENDM', 'LOCAL', 'EXITM', 'MESSG', 'ERROR', 'TITLE', 'SUBTITLE', 'SPACE', 'PAGE', 'EXPAND', 'NOEXPAND', '__MAXRAM', '__BADRAM', 'UDATA', 'UDATA_ACS', 'CODE', 'IDATA', 'GLOBAL', 'EXTERN', '__IDLOCS', 'WHILE', 'ENDW']);

function picAssemble(src, fam) {
  const p18 = fam === 'p18', OPS = p18 ? P18OPS : P16OPS;
  const diags = [], err = (ln, m) => diags.push({ line: ln, col: 1, type: 'error', msg: m }), warn = (ln, m) => diags.push({ line: ln, col: 1, type: 'warning', msg: m });
  const lines0 = src.replace(/\r/g, '').split('\n');
  // podział na linie z rozwinięciem makr robimy w każdym przebiegu
  let sym, defs, radix, code, cfg, ee, pc, cblk, ended, banksel, incl, macros, macroUid, pass;
  const ci = s => s.toUpperCase();
  function lookup(name, ln) {
    if (name in sym) return sym[name]; const u = ci(name); if (u in sym) return sym[u];
    if (incl && u in incl) return incl[u];
    if (pass === 2) err(ln, 'Nieznany symbol „' + name + '” (Symbol not previously defined)');
    return 0;
  }
  function num(tok, ln) {
    let m;
    if ((m = /^0x([0-9a-f]+)$/i.exec(tok)) || (m = /^([0-9a-f]+)h$/i.exec(tok)) && /^[0-9]/.test(tok)) return parseInt(m[1], 16);
    if ((m = /^h'([0-9a-f]+)'$/i.exec(tok))) return parseInt(m[1], 16);
    if ((m = /^d'(\d+)'$/i.exec(tok))) return parseInt(m[1], 10);
    if ((m = /^b'([01]+)'$/i.exec(tok)) || (m = /^0b([01]+)$/i.exec(tok))) return parseInt(m[1], 2);
    if ((m = /^o'([0-7]+)'$/i.exec(tok)) || (m = /^q'([0-7]+)'$/i.exec(tok))) return parseInt(m[1], 8);
    if ((m = /^a'(.)'$/i.exec(tok)) || (m = /^'(.)'$/.exec(tok))) return m[1].charCodeAt(0);
    if ((m = /^\.(\d+)$/.exec(tok))) return parseInt(m[1], 10);
    if ((m = /^([01]+)b$/i.exec(tok))) return parseInt(m[1], 2);
    if (/^[0-9][0-9a-f]*$/i.test(tok)) { const v = parseInt(tok, radix); if (isNaN(v)) { err(ln, 'Zła liczba ' + tok); return 0; } return v; }
    return null;
  }
  // wyrażenia: + - * / % << >> & | ^ ~ ! == != < > <= >= && || ( ) HIGH LOW UPPER $
  function expr(s, ln) {
    const toks = []; const re = /\s*(0x[0-9a-f]+|[hdboqa]'[^']*'|'[^']'|\.\d+|[0-9][0-9a-z]*|[A-Za-z_?@#][\w?@#.]*|<<|>>|==|!=|<=|>=|&&|\|\||[-+*/%&|^~!()<>$])/giy;
    let m, i = 0; s = s.trim(); re.lastIndex = 0;
    while (re.lastIndex < s.length) { const at = re.lastIndex; m = re.exec(s); if (!m) { err(ln, 'Błąd w wyrażeniu: ' + s); return 0; } if (m.index !== at && s.slice(at, m.index).trim()) { err(ln, 'Błąd w wyrażeniu: ' + s); return 0; } toks.push(m[1]); }
    const peek = () => toks[i], next = () => toks[i++];
    const prec = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
    function unary() {
      const t = next(); if (t === undefined) { err(ln, 'Niepełne wyrażenie: ' + s); return 0; }
      if (t === '-') return -unary(); if (t === '+') return unary(); if (t === '~') return ~unary(); if (t === '!') return unary() ? 0 : 1;
      if (t === '(') { const v = bin(0); if (next() !== ')') err(ln, 'Brak nawiasu ) w: ' + s); return v; }
      if (t === '$') return p18 ? pc : pc;
      const u = t.toUpperCase();
      if (u === 'HIGH' || u === 'LOW' || u === 'UPPER') { const v = unary(); return u === 'LOW' ? v & 255 : u === 'HIGH' ? (v >> 8) & 255 : (v >> 16) & 255; }
      const n = num(t, ln); if (n !== null) return n;
      return lookup(t, ln);
    }
    function bin(mp) { let l = unary(); for (; ;) { const o = peek(); const p = prec[o]; if (!p || p <= mp) break; next(); const r = bin(p); l = o === '+' ? l + r : o === '-' ? l - r : o === '*' ? l * r : o === '/' ? (r ? Math.trunc(l / r) : 0) : o === '%' ? (r ? l % r : 0) : o === '<<' ? l << r : o === '>>' ? l >> r : o === '&' ? l & r : o === '|' ? l | r : o === '^' ? l ^ r : o === '==' ? +(l === r) : o === '!=' ? +(l !== r) : o === '<' ? +(l < r) : o === '>' ? +(l > r) : o === '<=' ? +(l <= r) : o === '>=' ? +(l >= r) : o === '&&' ? +(l && r) : +(l || r); } return l; }
    const v = bin(0); if (i < toks.length) err(ln, 'Nadmiarowe znaki w wyrażeniu: ' + s); return v;
  }
  function splitArgs(s) { const out = []; let cur = '', dep = 0, q = null; for (const ch of s) { if (q) { cur += ch; if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; } if (ch === '(') dep++; if (ch === ')') dep--; if (ch === ',' && !dep) { out.push(cur.trim()); cur = ''; continue; } cur += ch; } if (cur.trim() || out.length) out.push(cur.trim()); return out; }
  function stripComment(s) { let q = null; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === q) q = null; continue; } if (ch === '"' || (ch === "'" && !/[a-z]$/i.test(s.slice(0, i)))) { q = ch; continue; } if (ch === "'" ) { q = ch; continue; } if (ch === ';') return s.slice(0, i); } return s; }
  function emit(w, ln) { if (p18) { if (pc & 1) { err(ln, 'Instrukcja pod nieparzystym adresem'); pc++; } if (pc >= 0x8000) err(ln, 'Program przekracza pamięć (32 KB)'); code.set(pc, w & 0xffff); code.lines.set(pc, ln); pc += 2; } else { if (pc >= 0x400 && pc < 0x2000) err(ln, 'Program przekracza pamięć programu (1024 słowa)'); code.set(pc, w & 0x3fff); code.lines.set(pc, ln); pc++; } }
  function regArg(a, ln, d) { let v = expr(a, ln); return v; }
  function dest(a, ln) { if (a === undefined || a === '') { if (pass === 2) warn(ln, 'Brak argumentu d (W/F) – przyjęto F (zapis do rejestru)'); return 1; } const v = expr(a, ln); if (v !== 0 && v !== 1) err(ln, 'Argument d musi być W (0) albo F (1)'); return v & 1; }
  function bank16(f, ln) { if (pass === 2 && (f & ~0x7f) && f < 0x2000) warn(ln, 'Rejestr 0x' + f.toString(16) + ' nie jest w banku 0 – upewnij się, że bity banku (RP0) są ustawione (Message 302)'); return f & 0x7f; }
  function access18(f, a, ln) { if (a !== undefined && a !== '') return expr(a, ln) & 1; const lo = f & 0xfff; return (lo < 0x60 || lo >= 0xf60) ? 0 : 1; }
  function inst(op, args, ln) {
    const d = OPS[op], k = d[0], base = d[1];
    const need = n => { if (args.length < n) err(ln, op + ': za mało argumentów'); };
    if (!p18) {
      if (k === '-') return emit(base, ln);
      if (k === 'f') { need(1); return emit(base | bank16(expr(args[0], ln), ln), ln); }
      if (k === 'fd') { need(1); return emit(base | (dest(args[1], ln) << 7) | bank16(expr(args[0], ln), ln), ln); }
      if (k === 'fb') { need(2); const b = expr(args[1], ln); if (b < 0 || b > 7) err(ln, 'Numer bitu musi być 0–7'); return emit(base | ((b & 7) << 7) | bank16(expr(args[0], ln), ln), ln); }
      if (k === 'k') { need(1); const v = expr(args[0], ln); if (pass === 2 && (v > 255 || v < -128)) warn(ln, 'Wartość ' + v + ' nie mieści się w 8 bitach – obcięto'); return emit(base | (v & 255), ln); }
      if (k === 'a') { need(1); const v = expr(args[0], ln); if (pass === 2 && (v & 0x1800) !== (pc & 0x1800)) warn(ln, 'Skok poza bieżącą stronę pamięci – ustaw PCLATH (PAGESEL)'); return emit(base | (v & 0x7ff), ln); }
      if (k === 't') { need(1); const v = expr(args[0], ln) & 0x7f; return emit(base | v, ln); }
    } else {
      if (k === '-') return emit(base, ln);
      if (k === 's') return emit(base | (args[0] ? expr(args[0], ln) & 1 : 0), ln);
      if (k === 'fda') { need(1); const f = expr(args[0], ln); return emit(base | (dest(args[1], ln) << 9) | (access18(f, args[2], ln) << 8) | (f & 255), ln); }
      if (k === 'fa') { need(1); const f = expr(args[0], ln); return emit(base | (access18(f, args[1], ln) << 8) | (f & 255), ln); }
      if (k === 'fba') { need(2); const f = expr(args[0], ln), b = expr(args[1], ln); if (b < 0 || b > 7) err(ln, 'Numer bitu musi być 0–7'); return emit(base | ((b & 7) << 9) | (access18(f, args[2], ln) << 8) | (f & 255), ln); }
      if (k === 'ff') { need(2); const a = expr(args[0], ln), b = expr(args[1], ln); emit(0xC000 | (a & 0xfff), ln); return emit(0xF000 | (b & 0xfff), ln); }
      if (k === 'k') { need(1); const v = expr(args[0], ln); if (pass === 2 && (v > 255 || v < -128)) warn(ln, 'Wartość ' + v + ' nie mieści się w 8 bitach – obcięto'); return emit(base | (v & 255), ln); }
      if (k === 'k4') { need(1); return emit(base | (expr(args[0], ln) & 15), ln); }
      if (k === 'n8' || k === 'n11') { need(1); const t2 = expr(args[0], ln); const n = (t2 - pc - 2) >> 1; const lim = k === 'n8' ? 128 : 1024; if (pass === 2 && (n < -lim || n >= lim || (t2 & 1))) err(ln, op + ': cel skoku za daleko (zakres ±' + lim * 2 + ' bajtów) – użyj GOTO/CALL'); return emit(base | (n & (k === 'n8' ? 0xff : 0x7ff)), ln); }
      if (k === 'call' || k === 'goto') { need(1); const t2 = expr(args[0], ln); if (pass === 2 && (t2 & 1)) err(ln, 'Adres skoku musi być parzysty'); const w = t2 >> 1; emit(base | (k === 'call' && args[1] ? (expr(args[1], ln) & 1) << 8 : 0) | (w & 0xff), ln); return emit(0xF000 | ((w >> 8) & 0xfff), ln); }
      if (k === 'lfsr') { need(2); const f = expr(args[0], ln), v = expr(args[1], ln); if (f < 0 || f > 2) err(ln, 'LFSR: numer FSR 0–2'); emit(0xEE00 | ((f & 3) << 4) | ((v >> 8) & 15), ln); return emit(0xF000 | (v & 255), ln); }
    }
  }
  function strBytes(a) { const m = /^"((?:[^"\\]|\\.)*)"$/.exec(a); if (!m) return null; return Array.from(m[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\0/g, '\0').replace(/\\(.)/g, '$1'), c => c.charCodeAt(0) & 255); }
  function run(p) {
    pass = p; sym = Object.assign({}, p === 2 ? labels1 : {}); defs = {}; radix = 16; code = new Map(); code.lines = new Map(); cfg = p18 ? P18CFG_DEF.slice() : [0x3fff]; ee = new Map(); pc = 0; cblk = null; ended = false; incl = null; macros = {}; macroUid = 0;
    const cond = [];
    const queue = lines0.map((t2, i) => ({ t: t2, ln: i + 1 }));
    let qi = 0, inMacro = null;
    while (qi < queue.length && !ended) {
      const { t: raw0, ln, mac } = queue[qi++];
      let raw = stripComment(raw0);
      // makro w trakcie definicji
      if (inMacro) { if (/^\s*(\w+\s+)?endm\b/i.test(raw)) { macros[inMacro.name] = inMacro; inMacro = null; } else inMacro.body.push(raw0); continue; }
      // warunki
      const cm = /^\s*(#?if|#?ifdef|#?ifndef|#?else|#?endif)\b\s*(.*)$/i.exec(raw);
      if (cm) { const d = cm[1].toLowerCase().replace('#', ''); const active = cond.every(c => c);
        if (d === 'if') cond.push(active ? !!expr(cm[2], ln) : false); else if (d === 'ifdef') cond.push(active && (cm[2].trim() in defs || cm[2].trim() in sym || ci(cm[2].trim()) in (incl || {}))); else if (d === 'ifndef') cond.push(active && !(cm[2].trim() in defs || cm[2].trim() in sym || ci(cm[2].trim()) in (incl || {})));
        else if (d === 'else') { if (!cond.length) err(ln, 'ELSE bez IF'); else { const v = cond.pop(); cond.push(!v && cond.every(c => c)); } } else { if (!cond.length) err(ln, 'ENDIF bez IF'); cond.pop(); } continue; }
      if (!cond.every(c => c)) continue;
      // #define – podstawianie tekstu
      let dm = /^\s*#define\s+(\w+)\s*(.*)$/i.exec(raw); if (dm) { defs[dm[1]] = dm[2].trim(); continue; }
      dm = /^\s*#undefine\s+(\w+)/i.exec(raw); if (dm) { delete defs[dm[1]]; continue; }
      for (let k2 = 0; k2 < 4; k2++) { let ch = false; for (const n in defs) { const re = new RegExp('\\b' + n + '\\b', 'g'); if (re.test(raw)) { raw = raw.replace(re, defs[n]); ch = true; } } if (!ch) break; }
      if (!raw.trim()) continue;
      // etykieta
      let label = null, rest = raw;
      const lm = /^([A-Za-z_?@][\w?@.]*):?(\s+|$)/.exec(raw);
      if (lm && (raw[0] !== ' ' && raw[0] !== '\t')) { const w = lm[1], u = ci(w); const known = x => { const v = ci(x || ''); return v in OPS || PICDIR.has(v) || v in macros || x in macros || /^(EQU|SET|=|MACRO)$/i.test(x || ''); };
        const nxt = raw.slice(lm[0].length).trim().split(/[\s,]/)[0]; if (!known(w) || known(nxt) || /:$/.test(lm[0].trim())) { label = w; rest = raw.slice(lm[0].length); } }
      else { const lm2 = /^\s*([A-Za-z_?@][\w?@.]*):(\s+|$)/.exec(raw); if (lm2) { label = lm2[1]; rest = raw.slice(lm2[0].length); } }
      rest = rest.trim();
      const om = /^([#_A-Za-z][\w*+\-]*?)(?=\s|$)\s*(.*)$/.exec(rest);
      let op = om ? om[1] : '', U = ci(op), argstr = om ? om[2].trim() : '';
      // MAKRO: definicja
      if (ci(argstr.split(/\s/)[0] || '') === 'MACRO' && op && !(U in OPS)) { inMacro = { name: op, params: splitArgs(argstr.replace(/^macro\s*/i, '')).filter(x => x), body: [] }; continue; }
      if (U === 'MACRO' && label) { inMacro = { name: label, params: splitArgs(argstr).filter(x => x), body: [] }; continue; }
      const setLabel = v => { if (!label) return; if (p === 1 && label in sym && sym[label] !== v) err(ln, 'Etykieta „' + label + '” zdefiniowana dwa razy'); sym[label] = v; };
      if (U === 'EQU' || U === '=' || U === 'SET' || op === '=') { if (!label) { err(ln, 'EQU wymaga nazwy symbolu'); continue; } sym[label] = expr(argstr, ln); continue; }
      if (/^=/.test(rest) && label) { sym[label] = expr(rest.slice(1), ln); continue; }
      if (U === 'CONSTANT' || U === 'VARIABLE') { for (const a of splitArgs(argstr)) { const [n, v] = a.split('='); if (v !== undefined) sym[n.trim()] = expr(v, ln); } continue; }
      if (cblk !== null) { // blok CBLOCK
        if (U === 'ENDC' || ci(rest) === 'ENDC') { cblk = null; continue; }
        for (const a of splitArgs(rest)) { if (!a) continue; const m2 = /^(\w+)(?:\s*:\s*(.+))?$/.exec(a); if (!m2) { err(ln, 'Zły wpis w CBLOCK: ' + a); continue; } sym[m2[1]] = cblk; cblk += m2[2] ? expr(m2[2], ln) : 1; }
        if (label) { sym[label] = cblk; cblk++; } continue;
      }
      if (!op) { setLabel(pc); continue; }
      if (U in OPS) { setLabel(pc); inst(U, splitArgs(argstr), ln); continue; }
      const mac2 = macros[op] || macros[U];
      if (mac2) { setLabel(pc); const av = splitArgs(argstr); const uid = ++macroUid; const locals = [];
        const body = mac2.body.map(b => { let s2 = b; mac2.params.forEach((pn, i) => { s2 = s2.replace(new RegExp('\\b' + pn + '\\b', 'g'), av[i] !== undefined ? av[i] : ''); }); return s2; });
        const out = []; for (const b of body) { const lm3 = /^\s*local\s+(.*)$/i.exec(stripComment(b)); if (lm3) { for (const n of splitArgs(lm3[1])) locals.push(n); continue; } if (/^\s*exitm\b/i.test(b)) break; out.push(b); }
        const fin = out.map(b => { let s2 = b; for (const n of locals) s2 = s2.replace(new RegExp('\\b' + n + '\\b', 'g'), n + '_m' + uid); return { t: s2, ln, mac: true }; });
        queue.splice(qi, 0, ...fin); continue; }
      switch (U) {
        case 'LIST': for (const a of splitArgs(argstr)) { const m2 = /^(\w+)\s*=\s*(\S+)$/.exec(a); if (!m2) continue; if (ci(m2[1]) === 'R') radix = /^dec/i.test(m2[2]) ? 10 : /^oct/i.test(m2[2]) ? 8 : 16; if (ci(m2[1]) === 'P') chkProc(m2[2], ln); } break;
        case 'RADIX': radix = /^dec/i.test(argstr) ? 10 : /^oct/i.test(argstr) ? 8 : 16; break;
        case 'PROCESSOR': chkProc(argstr, ln); break;
        case 'INCLUDE': case '#INCLUDE': { const n = argstr.replace(/[<>"]/g, '').trim().toLowerCase(); if (/p16f84a?\.inc/.test(n) && !p18) incl = PIC16_INC; else if (/p18f4550\.inc|p18f4455\.inc|p18f2550\.inc/.test(n) && p18) incl = PIC18_INC; else if (/xc\.inc|p16f84a|p18f4550/.test(n)) incl = p18 ? PIC18_INC : PIC16_INC; else err(ln, 'Nieznany plik „' + n + '” – dostępny jest tylko ' + (p18 ? 'p18f4550.inc' : 'p16f84a.inc')); break; }
        case '__CONFIG': { const a = splitArgs(argstr); if (p18) { if (a.length < 2) { err(ln, '__CONFIG dla PIC18: __CONFIG _CONFIGxx, wartość'); break; } const ad = expr(a[0], ln) - 0x300000; if (ad >= 0 && ad < 14) cfg[ad] = expr(a[1], ln) & 255; } else cfg[0] = expr(a[0], ln) & 0x3fff; break; }
        case 'CONFIG': { if (!p18) { warn(ln, 'Dyrektywa CONFIG jest dla PIC18 – dla PIC16 użyj __CONFIG'); break; } for (const a of splitArgs(argstr)) { const k3 = a.replace(/\s+/g, '').toUpperCase(); const c3 = P18CFG[k3]; if (!c3) { warn(ln, 'Nieznane ustawienie CONFIG: ' + a + ' (pominięte)'); continue; } cfg[c3[0]] = (cfg[c3[0]] & ~c3[1]) | c3[2]; } break; }
        case 'ORG': setLabel(pc = expr(argstr, ln)); pc = expr(argstr, ln); setLabel(pc); break;
        case 'END': ended = true; break;
        case 'CBLOCK': cblk = argstr ? expr(argstr, ln) : (cblk || 0); break;
        case 'ENDC': err(ln, 'ENDC bez CBLOCK'); break;
        case 'RES': setLabel(pc); pc += expr(argstr, ln) * (p18 ? 1 : 1); break;
        case 'FILL': { const a = splitArgs(argstr); setLabel(pc); const n = expr(a[1], ln); for (let i = 0; i < n; i++) emit(expr(a[0], ln), ln); break; }
        case 'DT': { setLabel(pc); for (const a of splitArgs(argstr)) { const sb = strBytes(a); for (const b of sb || [expr(a, ln)]) emit((p18 ? 0x0C00 : 0x3400) | (b & 255), ln); } break; }
        case 'DW': case 'DATA': { setLabel(pc); for (const a of splitArgs(argstr)) { const sb = strBytes(a); if (sb) { if (p18) for (let i = 0; i < sb.length; i += 2) emit(sb[i] | ((sb[i + 1] || 0) << 8), ln); else for (const b of sb) emit(b, ln); } else emit(expr(a, ln), ln); } break; }
        case 'DB': { setLabel(pc); const bytes = []; for (const a of splitArgs(argstr)) { const sb = strBytes(a); if (sb) bytes.push(...sb); else bytes.push(expr(a, ln) & 255); } if (p18) { if (bytes.length & 1) bytes.push(0); for (let i = 0; i < bytes.length; i += 2) emit(bytes[i] | (bytes[i + 1] << 8), ln); } else for (let i = 0; i < bytes.length; i += 2) emit(((bytes[i] & 0x7f) << 7) | ((bytes[i + 1] || 0) & 0x7f), ln); break; }
        case 'DE': { setLabel(pc); let a0 = p18 ? pc : pc; for (const a of splitArgs(argstr)) { const sb = strBytes(a); for (const b of sb || [expr(a, ln)]) { const eaddr = p18 ? a0 - 0xF00000 : a0 - 0x2100; if (eaddr < 0 || eaddr >= (p18 ? 256 : 64)) { err(ln, 'DE: adres poza pamięcią EEPROM – użyj ORG ' + (p18 ? '0xF00000' : '0x2100')); } else ee.set(eaddr, b & 255); a0++; } } pc = a0; break; }
        case 'BANKSEL': { const f = expr(argstr, ln); if (p18) emit(0x0100 | ((f >> 8) & 15), ln); else { emit((f & 0x80 ? 0x1683 : 0x1283), ln); emit((f & 0x100 ? 0x1703 : 0x1303), ln); } break; }
        case 'BANKISEL': if (!p18) { const f = expr(argstr, ln); emit(f & 0x100 ? 0x1783 : 0x1383, ln); } break;
        case 'PAGESEL': if (!p18) { const a = expr(argstr, ln); emit(a & 0x800 ? 0x158A : 0x118A, ln); emit(a & 0x1000 ? 0x160A : 0x120A, ln); } break;
        case 'PAGESELW': break;
        case 'ERRORLEVEL': case 'TITLE': case 'SUBTITLE': case 'SPACE': case 'PAGE': case 'EXPAND': case 'NOEXPAND': case 'NOLIST': case '__MAXRAM': case '__BADRAM': case '__IDLOCS': case 'GLOBAL': case 'EXTERN': break;
        case 'MESSG': if (p === 2) diags.push({ line: ln, col: 1, type: 'note', msg: argstr.replace(/"/g, '') }); break;
        case 'ERROR': err(ln, argstr.replace(/"/g, '')); break;
        case 'UDATA': case 'UDATA_ACS': case 'CODE': case 'IDATA': err(ln, U + ': tryb relokowalny nie jest obsługiwany – użyj ORG (tryb absolutny) i CBLOCK dla zmiennych'); break;
        default:
          if (p === 1 || true) { err(ln, 'Nieznana instrukcja lub dyrektywa „' + op + '”' + (/^[a-z]/.test(op) && !label ? '' : '')); }
      }
    }
    if (inMacro) err(lines0.length, 'Brak ENDM po makrze ' + inMacro.name);
    if (cond.length) err(lines0.length, 'Brak ENDIF');
    if (!ended && p === 2) warn(lines0.length, 'Brak dyrektywy END na końcu programu');
  }
  function chkProc(v, ln) { const s2 = String(v).toLowerCase().replace(/^p/, ''); if (p18 ? !/18f4550/.test(s2) : !/16f84a?$/.test(s2)) err(ln, 'Ten program jest dla innego procesora (' + v + ') – wybrano ' + (p18 ? 'PIC18F4550' : 'PIC16F84A')); }
  let labels1 = {};
  run(1); labels1 = Object.assign({}, sym);
  diags.length = 0; run(2);
  const errors = diags.filter(d => d.type === 'error');
  // Intel HEX (adresy bajtowe, słowa little-endian)
  const bytes = new Map();
  if (p18) { for (const [a, w] of code) { bytes.set(a, w & 255); bytes.set(a + 1, w >> 8); } cfg.forEach((v, i) => bytes.set(0x300000 + i, v)); for (const [a, v] of ee) bytes.set(0xF00000 + a, v); }
  else { for (const [a, w] of code) { if (a >= 0x2000) continue; bytes.set(a * 2, w & 255); bytes.set(a * 2 + 1, w >> 8); } bytes.set(0x400E, cfg[0] & 255); bytes.set(0x400F, cfg[0] >> 8); for (const [a, v] of ee) { bytes.set(0x4200 + a * 2, v); bytes.set(0x4201 + a * 2, 0); } }
  const hex = toIntelHex(bytes);
  const used = p18 ? [...code.keys()].filter(a => a < 0x8000).length * 2 : [...code.keys()].filter(a => a < 0x400).length;
  return { ok: !errors.length, hex: errors.length ? '' : hex, diags, flash: used, words: p18 ? used / 2 : used, lines: code.lines, sym };
}
function toIntelHex(bytes) {
  const addrs = [...bytes.keys()].sort((a, b) => a - b); const out = []; let ext = -1;
  const rec = (type, addr, data) => { const b = [data.length, (addr >> 8) & 255, addr & 255, type, ...data]; const sum = (-b.reduce((s, v) => s + v, 0)) & 255; out.push(':' + b.concat(sum).map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('')); };
  for (let i = 0; i < addrs.length;) {
    const a0 = addrs[i]; const hi = a0 >>> 16; if (hi !== ext) { rec(4, 0, [hi >> 8, hi & 255]); ext = hi; }
    const data = [bytes.get(a0)]; let j = i + 1; while (j < addrs.length && addrs[j] === a0 + data.length && data.length < 16 && (addrs[j] >>> 16) === hi) { data.push(bytes.get(addrs[j])); j++; }
    rec(0, a0 & 0xffff, data); i = j;
  }
  rec(1, 0, []); return out.join('\n') + '\n';
}
function parseIntelHex(src) { const m = new Map(); let ext = 0; for (const l of src.split(/\r?\n/)) { if (l[0] !== ':') continue; const n = parseInt(l.substr(1, 2), 16), a = parseInt(l.substr(3, 4), 16), ty = parseInt(l.substr(7, 2), 16); if (ty === 4) ext = parseInt(l.substr(9, 4), 16) << 16; else if (ty === 2) ext = parseInt(l.substr(9, 4), 16) << 4; else if (ty === 0) for (let i = 0; i < n; i++) m.set(ext + a + i, parseInt(l.substr(9 + i * 2, 2), 16)); } return m; }
