'use strict';
/* ====== Układy cyfrowe: wspólna rama ======
   o.ins / o.outs: numery pinów (od 1). o.update(d, ev) -> mapa {pin: 0|1|null}. ev = {p, lvl, old} lub null (przeliczenie). */
// rezystancja wyjścia zależna od napięcia zasilania (z charakterystyk I_OH/I_OL w kartach katalogowych):
// 74HC ≈ 25 Ω przy 4,5 V; CD4000B ≈ 400 Ω przy 5 V, 200 Ω przy 10 V, 130 Ω przy 15 V; 74LS ≈ 30 Ω (stan niski)
// progi wejść: 74HC i CD4000 ≈ połowa zasilania; 74LS (TTL) ≈ 1,3–1,4 V niezależnie od zasilania
const FAM = {
  hc: { R: v => 25 * Math.pow(4.5 / Math.max(2, v), 1.3), minV: 2, maxV: 7, name: '74HC' },
  cd: { R: v => 2000 / Math.max(3, v), minV: 3, maxV: 18, name: 'CD4000' },
  ls: { R: () => 30, minV: 4.5, maxV: 7, name: '74LS', vth: () => [1.25, 1.45] },
};
function logicIC(id, o) {
  const fam = FAM[o.fam || 'hc'];
  const vcc = o.n, gnd = o.n / 2; // standard: VCC ostatni pin, GND pin n/2
  const iV = (o.vcc || vcc) - 1, iG = (o.gnd || gnd) - 1;
  icPart(id, {
    cat: o.cat, n: o.n, names: o.names, name: o.name, label: o.label, sub: o.sub, kw: o.kw, info: o.info,
    extra: o.extra,
    more: {
      sim: {
        supply: [iV, iG], minV: fam.minV, schmitt: o.schmitt, vth: o.schmitt ? (span => [0.34 * span, 0.55 * span]) : fam.vth,
        init(d) { d.st = o.init ? o.init() : {}; for (const p of o.ins) eListen(d, p - 1); },
        lin: o.pullups ? (d, S) => { for (const p of o.pullups) S.G(p - 1, iV, 1 / 20000); S.I(iV, 0); } : undefined,
        power(d, on) { if (!on) { for (const p of o.outs) eDrive(d, p - 1, null, 50, iV, iG); return; } apply(d, null); },
        onIn(d, p, lvl, old) { if (!d.pw) return; apply(d, { p: p + 1, lvl, old }); },
        commit(d) { const vs = dVp(d, iV, iG); d.s.vs = vs; d.s.warn = vs > 0.5 && vs < fam.minV ? 'icLowV' : vs > fam.maxV ? 'icHighV' : null;
          // wydajność wyjść zmienia się z napięciem zasilania
          if (d.pw && Math.abs(vs - (d.s.rv || 0)) > 0.25) { d.s.rv = vs; apply(d, null); } },
      },
      readings: (c, r) => [[{ pl: 'Zasilanie', en: 'Supply' }, si(r.vs || 0, 'V')]],
    },
  });
  function apply(d, ev) {
    const lv = p => d.inl[p - 1] === 1 ? 1 : 0;
    const res = o.update(d, ev, lv);
    for (const k in res) {
      let v = res[k]; if (o.oc && o.oc.includes(+k) && v === 1) v = null;
      eDrive(d, +k - 1, v, fam.R(Math.max(0.5, dVp(d, iV, iG))), iV, iG);
    }
  }
}
const gate = (fn, map) => (d, ev, lv) => { const r = {}; for (const [a, b, y] of map) r[y] = fn(lv(a), lv(b)) ? 1 : 0; return r; };
const NAND = (a, b) => !(a && b), AND = (a, b) => a && b, OR = (a, b) => a || b, NOR = (a, b) => !(a || b);
const HC_STD = [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]];
const HC_STD_N = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'];
const CD_STD = [[1, 2, 3], [5, 6, 4], [8, 9, 10], [12, 13, 11]];
const CD_STD_N = ['A', 'B', 'J', 'K', 'C', 'D', 'VSS', 'E', 'F', 'L', 'M', 'G', 'H', 'VDD'];
const gInfo = (pl, en, tbl) => ({ pl: pl + ' Pamiętaj o zasilaniu: VCC/VDD do plusa (pin 14), GND/VSS do masy (pin 7). Nieużywane wejścia podłącz do masy lub plusa.', en: en + ' Remember power: VCC/VDD to plus (pin 14), GND/VSS to ground (pin 7). Tie unused inputs to ground or plus.' });
function gatePart(id, label, fn, fam, sub, kw, info, map, names) {
  logicIC(id, { cat: 'gate', n: 14, fam, names, name: label, label, sub, kw, info, ins: map.flatMap(m => [m[0], m[1]]), outs: map.map(m => m[2]), update: gate(fn, map) });
}
gatePart('lg_74hc00', '74HC00', NAND, 'hc', { pl: '4× NAND', en: '4× NAND' }, '74hc00 7400 nand bramka gate', gInfo('Cztery bramki NAND: wyjście jest 0 tylko wtedy, gdy oba wejścia są 1. Z samych bramek NAND da się zbudować każdy układ cyfrowy.', 'Four NAND gates: the output is 0 only when both inputs are 1. Any digital circuit can be built from NAND gates alone.'), HC_STD, HC_STD_N);
gatePart('lg_74hc08', '74HC08', AND, 'hc', { pl: '4× AND', en: '4× AND' }, '74hc08 7408 and bramka gate', gInfo('Cztery bramki AND: wyjście 1, gdy oba wejścia są 1.', 'Four AND gates: output is 1 when both inputs are 1.'), HC_STD, HC_STD_N);
gatePart('lg_74hc32', '74HC32', OR, 'hc', { pl: '4× OR', en: '4× OR' }, '74hc32 7432 or bramka gate', gInfo('Cztery bramki OR: wyjście 1, gdy choć jedno wejście jest 1.', 'Four OR gates: output is 1 when at least one input is 1.'), HC_STD, HC_STD_N);
const NOR02 = [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]];
gatePart('lg_74hc02', '74HC02', NOR, 'hc', { pl: '4× NOR', en: '4× NOR' }, '74hc02 7402 nor bramka gate', gInfo('Cztery bramki NOR: wyjście 1 tylko wtedy, gdy oba wejścia są 0. Uwaga: w 74HC02 wyjścia są na pinach 1, 4, 10, 13.', 'Four NOR gates: output is 1 only when both inputs are 0. Note: in the 74HC02 the outputs are on pins 1, 4, 10, 13.'), NOR02, ['1Y', '1A', '1B', '2Y', '2A', '2B', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC']);
gatePart('lg_cd4011', 'CD4011', NAND, 'cd', { pl: '4× NAND (CMOS)', en: '4× NAND (CMOS)' }, 'cd4011 4011 nand cmos bramka gate', gInfo('Cztery bramki NAND w technologii CMOS, zasilanie 3–18 V.', 'Four CMOS NAND gates, 3–18 V supply.'), CD_STD, CD_STD_N);
gatePart('lg_cd4001', 'CD4001', NOR, 'cd', { pl: '4× NOR (CMOS)', en: '4× NOR (CMOS)' }, 'cd4001 4001 nor cmos bramka gate', gInfo('Cztery bramki NOR w technologii CMOS, zasilanie 3–18 V.', 'Four CMOS NOR gates, 3–18 V supply.'), CD_STD, CD_STD_N);
gatePart('lg_cd4081', 'CD4081', AND, 'cd', { pl: '4× AND (CMOS)', en: '4× AND (CMOS)' }, 'cd4081 4081 and cmos bramka gate', gInfo('Cztery bramki AND w technologii CMOS.', 'Four CMOS AND gates.'), CD_STD, CD_STD_N);
gatePart('lg_cd4071', 'CD4071', OR, 'cd', { pl: '4× OR (CMOS)', en: '4× OR (CMOS)' }, 'cd4071 4071 or cmos bramka gate', gInfo('Cztery bramki OR w technologii CMOS.', 'Four CMOS OR gates.'), CD_STD, CD_STD_N);
logicIC('lg_74hc14', {
  cat: 'gate', n: 14, fam: 'hc', schmitt: true, name: '74HC14', label: '74HC14', sub: { pl: '6× NOT z przerzutnikiem Schmitta', en: '6× NOT, Schmitt trigger' }, kw: '74hc14 7414 not inwerter inverter schmitt negacja',
  names: ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'],
  info: gInfo('Sześć negatorów (NOT) z histerezą Schmitta: przełączają się przy ok. ⅔ VCC w górę i ⅓ VCC w dół, więc „czyszczą” wolne i zaszumione sygnały (np. drgania styków).', 'Six inverters (NOT) with Schmitt hysteresis: they switch at about ⅔ VCC going up and ⅓ VCC going down, cleaning up slow or noisy signals (e.g. contact bounce).'),
  ins: [1, 3, 5, 9, 11, 13], outs: [2, 4, 6, 8, 10, 12],
  update: (d, ev, lv) => ({ 2: 1 - lv(1), 4: 1 - lv(3), 6: 1 - lv(5), 8: 1 - lv(9), 10: 1 - lv(11), 12: 1 - lv(13) }),
});
/* ---- przerzutniki, liczniki, rejestry ---- */
const rise = (ev, p) => ev && ev.p === p && ev.lvl === 1 && ev.old === 0;
const fall = (ev, p) => ev && ev.p === p && ev.lvl === 0 && ev.old === 1;
logicIC('lg_74hc74', {
  cat: 'seq', n: 14, fam: 'hc', name: '74HC74', label: '74HC74', sub: { pl: '2× przerzutnik D', en: '2× D flip-flop' }, kw: '74hc74 7474 przerzutnik d flip-flop zatrzask',
  names: ['1CLR̅', '1D', '1CLK', '1PRE̅', '1Q', '1Q̅', 'GND', '2Q̅', '2Q', '2PRE̅', '2CLK', '2D', '2CLR̅', 'VCC'],
  info: { pl: 'Dwa przerzutniki D: przy zboczu narastającym zegara (CLK) zapamiętują stan wejścia D na wyjściu Q. PRE̅ i CLR̅ (aktywne zerem) ustawiają Q od razu na 1 lub 0 – podłącz je do plusa.', en: 'Two D flip-flops: on the rising clock (CLK) edge they store input D on output Q. PRE̅ and CLR̅ (active low) force Q to 1 or 0 – tie them to plus.' },
  ins: [1, 2, 3, 4, 10, 11, 12, 13], outs: [5, 6, 8, 9], init: () => ({ q: [0, 0] }),
  update(d, ev, lv) {
    const F = [[1, 2, 3, 4, 5, 6], [13, 12, 11, 10, 9, 8]], r = {};
    F.forEach(([clr, D, clk, pre, Q, Qn], i) => {
      const c0 = !lv(clr), p0 = !lv(pre);
      if (c0 && p0) { r[Q] = 1; r[Qn] = 1; return; }
      if (c0) d.st.q[i] = 0; else if (p0) d.st.q[i] = 1; else if (rise(ev, clk)) d.st.q[i] = lv(D);
      r[Q] = d.st.q[i]; r[Qn] = 1 - d.st.q[i];
    }); return r;
  },
});
logicIC('lg_74hc107', {
  cat: 'seq', n: 14, fam: 'hc', name: '74HC107', label: '74HC107', sub: { pl: '2× przerzutnik JK', en: '2× JK flip-flop' }, kw: '74hc107 74107 przerzutnik jk flip-flop',
  names: ['1J', '1Q̅', '1Q', '1K', '2Q', '2Q̅', 'GND', '2J', '2CLK̅', '2CLR̅', '2K', '1CLK̅', '1CLR̅', 'VCC'],
  info: { pl: 'Dwa przerzutniki JK wyzwalane zboczem opadającym zegara: J=1,K=0 → Q=1; J=0,K=1 → Q=0; J=K=1 → zmiana stanu (dzielnik przez 2). CLR̅ zeruje – podłącz do plusa.', en: 'Two JK flip-flops triggered on the falling clock edge: J=1,K=0 → Q=1; J=0,K=1 → Q=0; J=K=1 → toggle (divide by 2). CLR̅ resets – tie it to plus.' },
  ins: [1, 4, 12, 13, 8, 11, 9, 10], outs: [2, 3, 5, 6], init: () => ({ q: [0, 0] }),
  update(d, ev, lv) {
    const F = [[1, 4, 12, 13, 3, 2], [8, 11, 9, 10, 5, 6]], r = {};
    F.forEach(([J, K, clk, clr, Q, Qn], i) => {
      if (!lv(clr)) d.st.q[i] = 0;
      else if (fall(ev, clk)) { const j = lv(J), k = lv(K); if (j && k) d.st.q[i] ^= 1; else if (j) d.st.q[i] = 1; else if (k) d.st.q[i] = 0; }
      r[Q] = d.st.q[i]; r[Qn] = 1 - d.st.q[i];
    }); return r;
  },
});
const Q4017 = [3, 2, 4, 7, 10, 1, 5, 6, 9, 11];
logicIC('lg_cd4017', {
  cat: 'seq', n: 16, fam: 'cd', name: 'CD4017', label: 'CD4017', sub: { pl: 'Licznik Johnsona 1 z 10', en: 'Decade counter, 1-of-10' }, kw: 'cd4017 4017 licznik johnson counter wedrujacy punkt swietlny running light',
  names: ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'VSS', 'Q8', 'Q4', 'Q9', 'CO', 'INH', 'CLK', 'RST', 'VDD'],
  info: { pl: 'Licznik dziesiętny: każde zbocze narastające CLK zapala kolejne wyjście Q0…Q9 – baza „wędrującego punktu świetlnego” (z NE555 jako zegarem). INH (13) i RST (15) podłącz do masy.', en: 'Decade counter: each rising CLK edge activates the next output Q0…Q9 – the basis of a “running light” (with an NE555 as clock). Tie INH (13) and RST (15) to ground.' },
  ins: [13, 14, 15], outs: [...Q4017, 12], init: () => ({ n: 0 }),
  update(d, ev, lv) {
    if (lv(15)) d.st.n = 0;
    else if (!lv(13) && rise(ev, 14)) d.st.n = (d.st.n + 1) % 10;
    else if (lv(14) && fall(ev, 13)) d.st.n = (d.st.n + 1) % 10;
    const r = {}; Q4017.forEach((p, i) => r[p] = d.st.n === i ? 1 : 0); r[12] = d.st.n < 5 ? 1 : 0; return r;
  },
});
logicIC('lg_74hc393', {
  cat: 'seq', n: 14, fam: 'hc', name: '74HC393', label: '74HC393', sub: { pl: '2× 4-bitowy licznik binarny', en: 'Dual 4-bit binary counter' }, kw: '74hc393 74393 licznik binarny binary counter',
  names: ['1CP̅', '1MR', '1Q0', '1Q1', '1Q2', '1Q3', 'GND', '2Q3', '2Q2', '2Q1', '2Q0', '2MR', '2CP̅', 'VCC'],
  info: { pl: 'Dwa liczniki 4-bitowe (0–15) liczące przy zboczu opadającym wejścia CP̅. MR=1 zeruje licznik – w pracy podłącz MR do masy. Połącz 1Q3 z 2CP̅, żeby liczyć do 255.', en: 'Two 4-bit counters (0–15) counting on the falling edge of CP̅. MR=1 resets the counter – tie MR to ground in normal use. Connect 1Q3 to 2CP̅ to count to 255.' },
  ins: [1, 2, 12, 13], outs: [3, 4, 5, 6, 8, 9, 10, 11], init: () => ({ n: [0, 0] }),
  update(d, ev, lv) {
    const r = {};
    [[1, 2, [3, 4, 5, 6]], [13, 12, [11, 10, 9, 8]]].forEach(([cp, mr, qs], i) => {
      if (lv(mr)) d.st.n[i] = 0; else if (fall(ev, cp)) d.st.n[i] = (d.st.n[i] + 1) & 15;
      qs.forEach((p, b) => r[p] = (d.st.n[i] >> b) & 1);
    }); return r;
  },
});
const Q595 = [15, 1, 2, 3, 4, 5, 6, 7];
logicIC('lg_74hc595', {
  cat: 'seq', n: 16, fam: 'hc', name: '74HC595', label: '74HC595', sub: { pl: '8-bitowy rejestr przesuwny', en: '8-bit shift register' }, kw: '74hc595 595 rejestr przesuwny shift register shiftout',
  names: ['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', "QH'", 'SRCLR̅', 'SRCLK', 'RCLK', 'OE̅', 'SER', 'QA', 'VCC'],
  info: { pl: 'Zamienia 3 piny mikrokontrolera na 8 wyjść: bity wsuwasz przez SER zboczem SRCLK, a zbocze RCLK (latch) przepisuje je na wyjścia QA–QH. OE̅ (13) do masy, SRCLR̅ (10) do plusa. QH\' łączy kolejne rejestry. W Arduino: shiftOut().', en: 'Turns 3 microcontroller pins into 8 outputs: shift bits in on SER with SRCLK edges, and a RCLK (latch) edge copies them to QA–QH. OE̅ (13) to ground, SRCLR̅ (10) to plus. QH\' chains registers. In Arduino: shiftOut().' },
  ins: [10, 11, 12, 13, 14], outs: [...Q595, 9], init: () => ({ sr: 0, st: 0 }),
  update(d, ev, lv) {
    if (!lv(10)) d.st.sr = 0; else if (rise(ev, 11)) d.st.sr = ((d.st.sr << 1) | lv(14)) & 255;
    if (rise(ev, 12)) d.st.st = d.st.sr;
    const r = {}, oe = lv(13); Q595.forEach((p, i) => r[p] = oe ? null : (d.st.st >> (7 - i)) & 1); r[9] = (d.st.sr >> 7) & 1; return r;
  },
});
const Y138 = [15, 14, 13, 12, 11, 10, 9, 7];
logicIC('lg_74hc138', {
  cat: 'dec', n: 16, fam: 'hc', name: '74HC138', label: '74HC138', sub: { pl: 'Dekoder 3 na 8', en: '3-to-8 decoder' }, kw: '74hc138 74138 dekoder demultiplekser decoder demux',
  names: ['A', 'B', 'C', 'G2A̅', 'G2B̅', 'G1', 'Y7̅', 'GND', 'Y6̅', 'Y5̅', 'Y4̅', 'Y3̅', 'Y2̅', 'Y1̅', 'Y0̅', 'VCC'],
  info: { pl: 'Liczba binarna na wejściach A, B, C (0–7) wybiera jedno z 8 wyjść – to wyjście przechodzi w stan 0 (aktywne zerem). Włączanie: G1=1, G2A̅=0, G2B̅=0.', en: 'The binary number on inputs A, B, C (0–7) selects one of 8 outputs – that output goes low (active low). Enable: G1=1, G2A̅=0, G2B̅=0.' },
  ins: [1, 2, 3, 4, 5, 6], outs: Y138,
  update(d, ev, lv) { const en = lv(6) && !lv(4) && !lv(5), n = lv(1) | lv(2) << 1 | lv(3) << 2; const r = {}; Y138.forEach((p, i) => r[p] = en && n === i ? 0 : 1); return r; },
});
const SEG7 = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const SEG47 = [...[0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7c, 0x07, 0x7f, 0x67], 0x58, 0x4c, 0x62, 0x69, 0x78, 0x00];
const SEGP = { a: 13, b: 12, c: 11, d: 10, e: 9, f: 15, g: 14 };
logicIC('lg_74ls47', {
  cat: 'dec', n: 16, fam: 'ls', name: '74LS47', label: '74LS47', sub: { pl: 'BCD → 7 segm. (wspólna anoda)', en: 'BCD → 7-seg (common anode)' }, kw: '74ls47 7447 dekoder bcd 7 segment wyswietlacz wspolna anoda',
  names: ['B', 'C', 'LT̅', 'BI̅/RBO̅', 'RBI̅', 'D', 'A', 'GND', 'e̅', 'd̅', 'c̅', 'b̅', 'a̅', 'g̅', 'f̅', 'VCC'],
  info: { pl: 'Zamienia liczbę BCD (DCBA, 0–9) na segmenty wyświetlacza ze wspólną anodą. Wyjścia a̅–g̅ zwierają do masy (otwarty kolektor) – każdy segment przez rezystor ok. 330 Ω. Zasilanie 5 V (TTL).', en: 'Converts a BCD number (DCBA, 0–9) into segments of a common-anode display. Outputs a̅–g̅ pull to ground (open collector) – each segment through a resistor of about 330 Ω. 5 V supply (TTL).' },
  ins: [7, 1, 2, 6, 3, 4, 5], outs: [...Object.values(SEGP), 4], oc: [...Object.values(SEGP), 4], pullups: [7, 1, 2, 6, 3, 4, 5],
  update(d, ev, lv) {
    const n = lv(7) | lv(1) << 1 | lv(2) << 2 | lv(6) << 3; let m = SEG47[n];
    // wygaszanie zer (RBI̅ = 0 i liczba 0) – wtedy BI̅/RBO̅ staje się wyjściem w stanie niskim
    const rbo = n === 0 && !lv(5) && lv(3);
    if (rbo) m = 0; else if (!lv(4)) m = 0; else if (!lv(3)) m = 0x7f;
    const r = { 4: rbo ? 0 : 1 }; 'abcdefg'.split('').forEach((s, i) => r[SEGP[s]] = (m >> i) & 1 ? 0 : 1); return r;
  },
});
logicIC('lg_cd4511', {
  cat: 'dec', n: 16, fam: 'cd', name: 'CD4511', label: 'CD4511', sub: { pl: 'BCD → 7 segm. (wspólna katoda)', en: 'BCD → 7-seg (common cathode)' }, kw: 'cd4511 4511 dekoder bcd 7 segment wyswietlacz wspolna katoda',
  names: ['B', 'C', 'LT̅', 'BL̅', 'LE', 'D', 'A', 'VSS', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VDD'],
  info: { pl: 'Dekoder BCD na 7 segmentów ze wspólną katodą, z zatrzaskiem. Wyjścia a–g dają prąd (przez rezystory do segmentów). LT̅ (3) i BL̅ (4) podłącz do plusa, LE (5) do masy.', en: 'BCD to 7-segment decoder for common-cathode displays, with a latch. Outputs a–g source current (via resistors to the segments). Tie LT̅ (3) and BL̅ (4) to plus and LE (5) to ground.' },
  ins: [7, 1, 2, 6, 3, 4, 5], outs: Object.values(SEGP), init: () => ({ n: 0 }),
  update(d, ev, lv) {
    if (!lv(5)) d.st.n = lv(7) | lv(1) << 1 | lv(2) << 2 | lv(6) << 3;
    let m = d.st.n < 10 ? SEG7[d.st.n] : 0;
    if (!lv(3)) m = 0x7f; else if (!lv(4)) m = 0;
    const r = {}; 'abcdefg'.split('').forEach((s, i) => r[SEGP[s]] = (m >> i) & 1); return r;
  },
});
