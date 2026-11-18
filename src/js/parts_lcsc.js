'use strict';
/* ================= BIBLIOTEKA ZEWNĘTRZNA (LCSC): RODZINY MODELI =================
   Części używane tylko przez katalog z lcsc_catalog.js. Są zwykłymi elementami (def / bjtPart / fetPart…),
   ale mają flagę ext – nie pokazują się w głównej palecie, tylko w zakładce „Biblioteka zewnętrzna”.
   Parametry pochodzą z kart katalogowych (wartości typowe). Jeden model obsługuje wiele numerów katalogowych. */
const extPart = id => { PARTS[id].ext = true; return PARTS[id]; };

/* ---- diody (Schottky, Zenera) – jedna część, model wybierany właściwością model ---- */
// Is, n, rs dobrane tak, by spadek napięcia w przewodzeniu zgadzał się z kartą (np. SS34: ok. 0,5 V przy 3 A)
const zenerModel = (vz, it, rz, pmax, note) => ({ Is: 3e-9, n: 1.8, rs: Math.max(0.5, rz * 0.6), bv: vz - it * rz * 0.6, ibv: it, nbv: 1.2, imax: pmax / vz, pmax, note });
const XDIODE = {
  SS34: { Is: 1e-5, n: 1.05, rs: 0.03, bv: 40, ibv: 5e-4, imax: 3, note: { pl: 'Schottky 3 A, 40 V', en: 'Schottky 3 A, 40 V' } },
  SS54: { Is: 2e-5, n: 1.1, rs: 0.02, bv: 40, ibv: 5e-4, imax: 5, note: { pl: 'Schottky 5 A, 40 V', en: 'Schottky 5 A, 40 V' } },
  SS210: { Is: 1e-7, n: 1.2, rs: 0.1, bv: 100, ibv: 1e-4, imax: 2, note: { pl: 'Schottky 2 A, 100 V', en: 'Schottky 2 A, 100 V' } },
  ZMM5V6: zenerModel(5.6, 5e-3, 25, 0.5, { pl: 'Zener 5,6 V, 0,5 W', en: 'Zener 5.6 V, 0.5 W' }),
  ZMM3V3: zenerModel(3.3, 5e-3, 95, 0.5, { pl: 'Zener 3,3 V, 0,5 W', en: 'Zener 3.3 V, 0.5 W' }),
  BZT52C5V1: zenerModel(5.1, 5e-3, 60, 0.5, { pl: 'Zener 5,1 V, 0,5 W', en: 'Zener 5.1 V, 0.5 W' }),
};
diodePart('x_diode', { name: { pl: 'Dioda (biblioteka zewnętrzna)', en: 'Diode (external library)' }, sub: 'SS34, SS210, ZMM…', kw: 'dioda diode schottky zener ss34 ss210 zmm', models: XDIODE, body: '#2a2a2a', band: '#c9cdd2',
  info: { pl: 'Dioda z biblioteki zewnętrznej. Diody Schottky’ego (SS..) mają mały spadek napięcia; diody Zenera (ZMM, BZT52) podłączone odwrotnie utrzymują stałe napięcie.', en: 'A diode from the external library. Schottky diodes (SS..) have a low forward drop; Zener diodes (ZMM, BZT52) connected in reverse hold a fixed voltage.' } });
extPart('x_diode');

/* ---- tranzystory BJT w obudowie SOT-23 (nóżki: 1 – B, 2 – E, 3 – C) ----
   Napięcie Early’ego V_A = 100 V (karty go nie podają – wartość typowa). */
const sotInfo = { pl: ' Obudowa SOT-23: nóżka 1 – baza, 2 – emiter, 3 – kolektor.', en: ' SOT-23 package: pin 1 – base, 2 – emitter, 3 – collector.' };
const plus = (a, b) => ({ pl: a.pl + b.pl, en: a.en + b.en });
[['x_q_s8050', 'S8050', false, { Is: 1e-14, bf: 280, br: 5, va: 100, n: 1 }, 0.5, 0.3, { pl: 'NPN 25 V, 0,5 A', en: 'NPN 25 V, 0.5 A' }],
 ['x_q_ss8050', 'SS8050', false, { Is: 3e-14, bf: 280, br: 5, va: 100, n: 1 }, 1.5, 0.3, { pl: 'NPN 25 V, 1,5 A', en: 'NPN 25 V, 1.5 A' }],
 ['x_q_ss8550', 'SS8550', true, { Is: 3e-14, bf: 280, br: 5, va: 100, n: 1 }, 1.5, 0.3, { pl: 'PNP 25 V, 1,5 A', en: 'PNP 25 V, 1.5 A' }],
].forEach(([id, label, pnp, m, icmax, pmax, sub]) => {
  bjtPart(id, { name: label, sub, kw: label.toLowerCase() + (pnp ? ' pnp' : ' npn') + ' sot-23 tranzystor transistor', order: ['B', 'E', 'C'], label, pnp, m, icmax, pmax, info: plus(pnp ? pnpInfo : npnInfo, sotInfo) });
  extPart(id);
});

/* ---- MOSFET-y SMD (SOT-23: 1 – G, 2 – S, 3 – D) ----
   k [A/V²] dobrane z R_DS(on) w karcie: R ≈ 1 / (k · (U_GS − U_th)) */
const sotFetInfo = { pl: ' Obudowa SOT-23: nóżka 1 – bramka, 2 – źródło, 3 – dren.', en: ' SOT-23 package: pin 1 – gate, 2 – source, 3 – drain.' };
const pmosInfo = { pl: 'MOSFET z kanałem P: źródło (S) łącz z plusem. Przewodzi, gdy bramka jest niżej niż źródło o więcej niż próg U_th. Typowy „wyłącznik po stronie plusa”.', en: 'P-channel MOSFET: connect the source (S) to plus. It conducts when the gate is lower than the source by more than U_th. A typical “high-side switch”.' };
[['x_m_2n7002', '2N7002', false, { vth: 2.1, k: 0.025, lam: 0.01 }, 0.115, 0.3, 20, { pl: 'N 60 V, 115 mA', en: 'N 60 V, 115 mA' }],
 ['x_m_bss138', 'BSS138', false, { vth: 1.3, k: 0.033, lam: 0.01 }, 0.22, 0.36, 20, { pl: 'N 50 V, 220 mA, poziom logiczny', en: 'N 50 V, 220 mA, logic level' }],
 ['x_m_ao3400a', 'AO3400A', false, { vth: 1.05, k: 11, lam: 0.005 }, 5.7, 1.4, 12, { pl: 'N 30 V, 5,7 A, poziom logiczny', en: 'N 30 V, 5.7 A, logic level' }],
 ['x_m_ao3401a', 'AO3401A', true, { vth: 0.9, k: 4.5, lam: 0.005 }, 4, 1.4, 12, { pl: 'P −30 V, −4 A', en: 'P −30 V, −4 A' }],
 ['x_m_si2301', 'SI2301CDS', true, { vth: 0.75, k: 2.5, lam: 0.01 }, 3.1, 0.86, 8, { pl: 'P −20 V, −3,1 A', en: 'P −20 V, −3.1 A' }],
].forEach(([id, label, p, m, idmax, pmax, vgsmax, sub]) => {
  fetPart(id, { name: label, sub, kw: label.toLowerCase() + ' mosfet sot-23 ' + (p ? 'p kanal' : 'n kanal'), order: ['G', 'S', 'D'], label, p, m, idmax, pmax, vgsmax, info: plus(p ? pmosInfo : nmosInfo, sotFetInfo) });
  extPart(id);
});

/* ---- wzmacniacz operacyjny rail-to-rail LMV324 ---- */
OPM.lmv324 = { hl: 0.03, hh: 0.03, A: 1e5, gbw: 1e6, sr: 1e6, vos: 1.7e-3, ib: -15e-9, rout: 50, iq: 0.1e-3, ilim: 0.04, minV: 2.7 };
opampIC('x_op_lmv324', 'LMV324', 'quad', 'lmv324', { sub: { pl: 'Poczwórny, wyjście rail-to-rail, 2,7–5,5 V', en: 'Quad, rail-to-rail output, 2.7–5.5 V' }, kw: 'lmv324 wzmacniacz operacyjny rail-to-rail quad', info: { pl: opInfo.pl + ' Wyjście dochodzi prawie do obu szyn zasilania; zasilanie 2,7–5,5 V.', en: opInfo.en + ' The output swings almost to both rails; 2.7–5.5 V supply.' } });
extPart('x_op_lmv324');

/* ---- stabilizatory LDO – rodziny z napięciem wyjściowym jako właściwością ----
   Model regPart: źródło napięcia z ograniczeniem prądu i spadkiem napięcia (dropout). Wyprowadzenia w kolejności
   IN, GND, OUT (fizyczne numery nóżek obudowy SMD podaje opis). Wejście EN (ME6211, AP2112) jest na stałe włączone. */
const ldoFamily = (id, o) => {
  regPart(id, {
    name: o.name, sub: o.sub, kw: o.kw, props: { v: o.vs[0][0] },
    ui: [{ k: 'v', type: 'seg', l: { pl: 'Napięcie wyjściowe', en: 'Output voltage' }, opts: o.vs.map(([v]) => [v, String(v).replace('.', ',') + ' V']) }],
    order: ['IN', 'GND', 'OUT'], pn: [IN, GNDn, OUTn], ref: 'GND', vnom: c => c.props.v, drop: o.drop, ilim: o.ilim, iq: o.iq, label: c => o.label + '-' + String(c.props.v).replace('.', '.'),
    info: o.info,
  });
  extPart(id);
};
const ldoInfo = (pl, en) => ({ pl: 'Stabilizator LDO (niski spadek napięcia): daje stałe napięcie, gdy wejście jest wyższe od wyjścia o więcej niż napięcie dropout. ' + pl, en: 'LDO regulator (low dropout): gives a fixed voltage while the input is above the output by more than the dropout voltage. ' + en });
ldoFamily('x_ldo_ams1117', { name: 'AMS1117', label: 'AMS1117', sub: { pl: 'LDO 1 A, dropout ok. 1,1 V', en: 'LDO 1 A, dropout about 1.1 V' }, kw: 'ams1117 lm1117 ldo stabilizator regulator 3.3 5.0 1.8',
  vs: [[3.3], [5], [1.8], [2.5], [1.5], [1.2]], drop: 1.1, ilim: 1.1, iq: 5e-3,
  info: ldoInfo('AMS1117: prąd do 1 A, dropout ok. 1,1 V. Obudowa SOT-223: 1 – GND, 2 – OUT (i radiator), 3 – IN. Na wyjściu potrzebny kondensator ≥ 22 µF.', 'AMS1117: up to 1 A, dropout about 1.1 V. SOT-223 package: 1 – GND, 2 – OUT (and tab), 3 – IN. Needs ≥ 22 µF at the output.') });
ldoFamily('x_ldo_xc6206', { name: 'XC6206', label: 'XC6206', sub: { pl: 'LDO 200 mA, I_q 1 µA', en: 'LDO 200 mA, I_q 1 µA' }, kw: 'xc6206 662k ldo stabilizator regulator 3.3 sot-23',
  vs: [[3.3], [1.8], [2.5], [3]], drop: 0.25, ilim: 0.3, iq: 1e-6,
  info: ldoInfo('XC6206: prąd do 200 mA, bardzo mały pobór własny (1 µA) – dobry do zasilania bateryjnego. SOT-23: 1 – GND, 2 – OUT, 3 – IN.', 'XC6206: up to 200 mA, very low quiescent current (1 µA) – good for battery power. SOT-23: 1 – GND, 2 – OUT, 3 – IN.') });
ldoFamily('x_ldo_me6211', { name: 'ME6211', label: 'ME6211', sub: { pl: 'LDO 500 mA, dropout 0,1 V', en: 'LDO 500 mA, dropout 0.1 V' }, kw: 'me6211 ldo stabilizator regulator 3.3 sot-23-5',
  vs: [[3.3], [1.8], [2.8]], drop: 0.1, ilim: 0.6, iq: 40e-6,
  info: ldoInfo('ME6211: prąd do 500 mA, dropout ok. 0,1 V przy 100 mA. SOT-23-5: 1 – IN, 2 – GND, 3 – EN (w symulatorze zawsze włączone), 5 – OUT.', 'ME6211: up to 500 mA, dropout about 0.1 V at 100 mA. SOT-23-5: 1 – IN, 2 – GND, 3 – EN (always on in the simulator), 5 – OUT.') });
ldoFamily('x_ldo_ap2112', { name: 'AP2112', label: 'AP2112', sub: { pl: 'LDO 600 mA, dropout 0,25 V', en: 'LDO 600 mA, dropout 0.25 V' }, kw: 'ap2112 ap2112k ldo stabilizator regulator 3.3 sot-25',
  vs: [[3.3], [1.8], [2.5]], drop: 0.25, ilim: 0.8, iq: 55e-6,
  info: ldoInfo('AP2112: prąd do 600 mA, dropout ok. 0,25 V. SOT-25: 1 – IN, 2 – GND, 3 – EN (w symulatorze zawsze włączone), 5 – OUT.', 'AP2112: up to 600 mA, dropout about 0.25 V. SOT-25: 1 – IN, 2 – GND, 3 – EN (always on in the simulator), 5 – OUT.') });
