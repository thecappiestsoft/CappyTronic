'use strict';
/* ================= DIODY ================= */
const PN_AK = [{ pl: 'Anoda', en: 'Anode' }, { pl: 'Katoda (pasek)', en: 'Cathode (band)' }];
function diodePart(id, o) {
  const pk = pkgAxial(PN_AK.map((n, i) => ({ pl: (i ? 'K – ' : 'A – ') + n.pl, en: (i ? 'K – ' : 'A – ') + n.en })), 60);
  const M = c => o.models ? o.models[c.props.model] || o.models[Object.keys(o.models)[0]] : o;
  def(id, {
    cat: 'diode', name: o.name, sub: o.sub, kw: o.kw, props: o.models ? { model: Object.keys(o.models)[0] } : {},
    pins: pk.pins, bbox: pk.bbox, info: o.info,
    ui: o.models ? [{ k: 'model', type: 'select', l: { pl: 'Typ', en: 'Type' }, opts: Object.keys(o.models).map(k => [k, k + (o.models[k].note ? ' – ' + L(o.models[k].note) : '')]) }] : undefined,
    draw(c, r) { const m = M(c); return pk.body(o.body, o.band, o.models ? c.props.model : o.label, o.glass) + (r.burnt ? smoke(30, -12) : ''); },
    sim: {
      int: 1,
      lin(d, S) { if (!d.s.burnt) S.G(0, 2, 1 / M(d.c).rs); },
      nl(d, v) { if (d.s.burnt) return [0, 0, 0]; const m = M(d.c); const i = diodeI(v[2] - v[1], m.Is, m.n, m.bv, m.ibv, m.nbv); return [0, -i, i]; },
      commit(d, dt) {
        const m = M(d.c); const I = d.s.burnt ? 0 : (dV(d, 0) - dV(d, 2)) / m.rs; measure2(d, I);
        if (Math.abs(I) > m.imax * 2 || d.s.P > (m.pmax || 1e9) * 1.5) { d.s.bt = (d.s.bt || 0) + dt; if (d.s.bt > 0.3) { d.s.burnt = true; E.dirty = true; } } else d.s.bt = 0;
        d.s.warn = d.s.burnt ? 'semiBurnt' : Math.abs(I) > m.imax ? 'diodeOver' : null;
      },
    },
    readings: (c, r) => [['U<sub>AK</sub>', si(r.U, 'V')], ['I', si(r.I, 'A')], ['P', si(r.P, 'W')]],
  });
}
const N400 = {}; [['1N4001', 50], ['1N4002', 100], ['1N4003', 200], ['1N4004', 400], ['1N4005', 600], ['1N4006', 800], ['1N4007', 1000]].forEach(([k, bv]) => N400[k] = { Is: 7e-9, n: 1.8, rs: 0.04, bv, ibv: 5e-6, imax: 1, note: { pl: bv + ' V', en: bv + ' V' } });
diodePart('d_1n400x', { name: { pl: 'Dioda prostownicza 1N4001–1N4007', en: 'Rectifier diode 1N4001–1N4007' }, sub: { pl: '1 A, niska częstotliwość', en: '1 A, low frequency' }, kw: 'dioda prostownicza 1n4001 1n4007 1n400x rectifier diode', models: N400, body: '#1c1c1c', band: '#c9cdd2',
  info: { pl: 'Przewodzi prąd tylko od anody do katody (pasek). Spadek napięcia ok. 0,7–1 V. Typy różnią się maksymalnym napięciem wstecznym (50–1000 V). Prąd do 1 A.', en: 'Conducts only from anode to cathode (band). Forward drop about 0.7–1 V. Types differ in max reverse voltage (50–1000 V). Current up to 1 A.' } });
diodePart('d_1n4148', { name: '1N4148', sub: { pl: 'Dioda szybka / impulsowa', en: 'Fast switching diode' }, kw: 'dioda szybka impulsowa 1n4148 signal fast switching', Is: 2.52e-9, n: 1.752, rs: 0.568, bv: 100, ibv: 1e-7, imax: 0.3, body: '#d97b2b', band: '#1a1a1a', glass: true, label: '1N4148',
  info: { pl: 'Bardzo szybka dioda sygnałowa (czas przełączania 4 ns). Dla małych prądów – do 300 mA.', en: 'Very fast small-signal diode (4 ns recovery). For small currents – up to 300 mA.' } });
diodePart('d_schottky', { name: { pl: 'Dioda Schottky’ego', en: 'Schottky diode' }, sub: '1N5819, BAT54', kw: 'schottky 1n5819 bat54 dioda przetwornica', models: { '1N5819': { Is: 3e-6, n: 1.05, rs: 0.05, bv: 40, ibv: 1e-5, imax: 1, note: { pl: '1 A, 40 V', en: '1 A, 40 V' } }, 'BAT54': { Is: 2e-7, n: 1.0, rs: 1.5, bv: 30, ibv: 2e-6, imax: 0.2, note: { pl: '200 mA, 30 V', en: '200 mA, 30 V' } } }, body: '#1c1c1c', band: '#c9cdd2',
  info: { pl: 'Niski spadek napięcia (ok. 0,2–0,4 V) i bardzo szybkie przełączanie. Idealna do przetwornic i zabezpieczeń.', en: 'Low forward drop (about 0.2–0.4 V) and very fast switching. Ideal for converters and protection.' } });
const ZM = {};
[['BZX55C3V3', 3.3, 5e-3, 85], ['BZX55C4V7', 4.7, 5e-3, 60], ['BZX55C5V1', 5.1, 5e-3, 40], ['BZX55C6V2', 6.2, 5e-3, 10], ['BZX55C9V1', 9.1, 5e-3, 10], ['BZX55C12', 12, 5e-3, 20],
 ['1N4733A', 5.1, 49e-3, 7], ['1N4734A', 5.6, 45e-3, 5], ['1N4739A', 9.1, 28e-3, 5], ['1N4742A', 12, 21e-3, 9], ['1N4744A', 15, 17e-3, 14]].forEach(([k, vz, it, rz]) => ZM[k] = { Is: 3e-9, n: 1.8, rs: Math.max(0.5, rz * 0.6), bv: vz - it * rz * 0.6, ibv: it, nbv: 1.2, imax: k[0] === 'B' ? 0.1 : 0.17, pmax: k[0] === 'B' ? 0.5 : 1, note: { pl: dec(vz, 1) + ' V', en: vz + ' V' } });
diodePart('d_zener', { name: { pl: 'Dioda Zenera', en: 'Zener diode' }, sub: 'BZX55, 1N47xx', kw: 'zener dioda bzx55 1n4733a 1n47 stabilizacja napiecie odniesienia reference', models: ZM, body: '#e08a3b', band: '#1a1a1a', glass: true,
  info: { pl: 'Podłączona odwrotnie (katodą do plusa) utrzymuje stałe napięcie – np. 5,1 V. Zawsze z rezystorem szeregowym. Używana jako źródło napięcia odniesienia.', en: 'Connected in reverse (cathode to plus) it holds a fixed voltage – e.g. 5.1 V. Always use a series resistor. Used as a voltage reference.' } });
// mostek prostowniczy
function bridgePart(id, label, imax, big) {
  const names = ['~', '+', '−', '~'].map((n, i) => n === '~' ? { pl: '~ (AC)', en: '~ (AC)' } : n);
  const pins = [{ x: 0, y: 0, n: names[0] }, { x: 20, y: 0, n: '+' }, { x: 40, y: 0, n: '−' }, { x: 60, y: 0, n: names[3] }];
  pins[0].n = '~1'; pins[3].n = '~2';
  def(id, {
    cat: 'diode', name: { pl: 'Mostek prostowniczy ' + label, en: 'Bridge rectifier ' + label }, sub: { pl: '4 diody w obudowie, ' + imax + ' A', en: '4 diodes in one package, ' + imax + ' A' }, kw: 'mostek prostowniczy graetz bridge rectifier ' + label.toLowerCase(),
    pins, bbox: big ? [-14, -84, 74, 4] : [-8, -46, 68, 4],
    info: { pl: 'Cztery diody w układzie Graetza zamieniają prąd zmienny (wejścia ~) na pulsujący prąd stały (+ i −). Za mostkiem zwykle dajemy kondensator filtrujący.', en: 'Four diodes in a Graetz bridge turn AC (inputs ~) into pulsating DC (+ and −). A smoothing capacitor usually follows.' },
    draw(c, r) {
      let s = [0, 20, 40, 60].map(x => leg(`M${x} 0V-12`)).join('');
      if (big) s += `<rect x="-12" y="-82" width="84" height="70" rx="4" fill="#202226" stroke="#000"/><circle cx="30" cy="-60" r="7" fill="#3a3d42"/>` + tx(30, -34, label, { s: 9, c: '#e3e6ea', f: FONT_M });
      else s += `<rect x="-6" y="-44" width="72" height="32" rx="3" fill="#202226" stroke="#000"/>` + tx(30, -26, label, { s: 8, c: '#e3e6ea', f: FONT_M });
      return s + tx(0, -16, '~', { s: 8, c: '#bbb' }) + tx(20, -16, '+', { s: 8, c: '#ff8a80' }) + tx(40, -16, '−', { s: 8, c: '#9ecbff' }) + tx(60, -16, '~', { s: 8, c: '#bbb' });
    },
    sim: {
      nl(d, v) { const D = (a, k) => diodeI(v[a] - v[k], 1e-8, 1.9, 600, 1e-6); const o = [0, 0, 0, 0];
        for (const [a, k] of [[0, 1], [3, 1], [2, 0], [2, 3]]) { const i = D(a, k); o[a] += i; o[k] -= i; } return o; },
      commit(d) { d.s.U = dVp(d, 1, 2); d.s.I = -(d.ip ? d.ip[1] : 0); d.s.P = 0; d.s.warn = Math.abs(d.s.I) > imax ? 'diodeOver' : null; },
    },
    readings: (c, r) => [['U<sub>DC</sub>', si(r.U, 'V')], ['I<sub>DC</sub>', si(r.I, 'A')]],
  });
}
bridgePart('br_df04m', 'DF04M', 1, false);
bridgePart('br_br810', 'BR810', 8, true);

/* ================= BJT ================= */
function bjtI(vbe, vbc, m) { // NPN: zwraca [Ic, Ib]
  const eb = jexp(vbe / (m.n * VT), m.Is), ec = jexp(vbc / (m.n * VT), m.Is);
  const ibe = m.Is / m.bf * (eb - 1), ibc = m.Is / m.br * (ec - 1);
  const vce = vbe - vbc;
  // efekt Early’ego: dla U_CE < 0 (praca odwrotna) też ≥ 1 – czynnik malejący do 0,1 dawał fałszywe rozwiązania Newtona (np. 2N3906 jako klucz górny)
  const ict = m.Is * (eb - ec) * (1 + Math.abs(vce) / m.va);
  return [ict - ibc, ibe + ibc];
}
const ROLE = { C: { pl: 'C – kolektor', en: 'C – collector' }, B: { pl: 'B – baza', en: 'B – base' }, E: { pl: 'E – emiter', en: 'E – emitter' }, D: { pl: 'D – dren', en: 'D – drain' }, G: { pl: 'G – bramka', en: 'G – gate' }, S: { pl: 'S – źródło', en: 'S – source' },
  A: { pl: 'A – anoda', en: 'A – anode' }, K: { pl: 'K – katoda', en: 'K – cathode' }, MT1: { pl: 'MT1 (A1)', en: 'MT1 (A1)' }, MT2: { pl: 'MT2 (A2)', en: 'MT2 (A2)' } };
function bjtPart(id, o) {
  const pk = o.pkg === 'TO220' ? pkgTO220(o.order) : pkgTO92(o.order);
  const ix = r => o.order.indexOf(r);
  const iC = ix('C'), iB = ix('B'), iE = ix('E');
  const pins = pk.pins.map((p, i) => ({ ...p, n: ROLE[o.order[i]] }));
  const pol = o.pnp ? -1 : 1;
  def(id, {
    cat: 'bjt', name: o.name, sub: o.sub, kw: o.kw, pins, bbox: pk.bbox, info: o.info, props: {},
    draw(c, r) { return pk.body(o.label, o.sub2) + tx(o.pkg === 'TO220' ? 20 : 20, o.pkg === 'TO220' ? -24 + 0 : -34, '', {}) + (r.burnt ? smoke(20, -50) : ''); },
    sim: {
      int: o.darl ? 1 : 0,
      lin(d, S) { if (o.darl) { S.G(iB, 3, 1 / o.darl[0]); S.G(3, iE, 1 / o.darl[1]); } },
      nl(d, v) {
        const out = new Array(v.length).fill(0); if (d.s.burnt) return out;
        const q = (b, cc, e, m) => { const r = bjtI(pol * (v[b] - v[e]), pol * (v[b] - v[cc]), m); const ic = pol * r[0], ib = pol * r[1]; out[cc] += ic; out[b] += ib; out[e] -= ic + ib; };
        if (o.darl) { q(iB, iC, 3, o.m1); q(3, iC, iE, o.m); } else q(iB, iC, iE, o.m);
        return out;
      },
      commit(d, dt) {
        const ic = d.ip ? d.ip[iC] : 0, ib = d.ip ? d.ip[iB] : 0, vce = dVp(d, iC, iE), vbe = dVp(d, iB, iE);
        d.s.Ic = ic; d.s.Ib = ib; d.s.Vce = vce; d.s.Vbe = vbe; d.s.U = vce; d.s.I = ic; d.s.P = Math.abs(vce * ic) + Math.abs(vbe * ib);
        const ov = Math.abs(ic) > o.icmax * 1.5 || d.s.P > o.pmax * 1.5; d.s.bt = ov ? (d.s.bt || 0) + dt : 0; if (d.s.bt > 0.5) { d.s.burnt = true; E.dirty = true; }
        d.s.region = Math.abs(ic) < 1e-7 ? 'off' : (pol * vce < (o.darl ? 1.0 : 0.3) ? 'sat' : 'act');
        d.s.warn = d.s.burnt ? 'semiBurnt' : Math.abs(ic) > o.icmax || d.s.P > o.pmax ? 'bjtOver' : null;
      },
    },
    readings: (c, r) => [['I<sub>C</sub>', si(r.Ic || 0, 'A')], ['I<sub>B</sub>', si(r.Ib || 0, 'A')], ['β = I<sub>C</sub>/I<sub>B</sub>', Math.abs(r.Ib) > 1e-9 ? dec(r.Ic / r.Ib, 0) : '—'], ['U<sub>CE</sub>', si(r.Vce || 0, 'V')], ['U<sub>BE</sub>', si(r.Vbe || 0, 'V')], ['P', si(r.P || 0, 'W')],
      [{ pl: 'Stan', en: 'Region' }, { off: { pl: 'odcięcie', en: 'cut-off' }, sat: { pl: 'nasycenie', en: 'saturation' }, act: { pl: 'aktywny', en: 'active' } }[r.region || 'off']]],
  });
}
const npnInfo = { pl: 'Tranzystor NPN: mały prąd bazy (B) steruje dużym prądem kolektora (C → E). Wzmocnienie β ≈ I_C / I_B. Do bazy zawsze dawaj rezystor.', en: 'NPN transistor: a small base current (B) controls a larger collector current (C → E). Gain β ≈ I_C / I_B. Always use a base resistor.' };
const pnpInfo = { pl: 'Tranzystor PNP: działa odwrotnie niż NPN – emiter podłącz do plusa, a przewodzi, gdy baza jest niżej niż emiter (prąd wypływa z bazy).', en: 'PNP transistor: works the opposite way to NPN – emitter goes to plus, and it conducts when the base is lower than the emitter (current flows out of the base).' };
bjtPart('q_bc547', { name: 'BC547', sub: { pl: 'NPN małej mocy', en: 'Small-signal NPN' }, kw: 'bc547 npn tranzystor transistor', order: ['C', 'B', 'E'], label: 'BC547', m: { Is: 1.8e-14, bf: 300, br: 7.5, va: 60, n: 1 }, icmax: 0.1, pmax: 0.5, info: npnInfo });
bjtPart('q_2n3904', { name: '2N3904', sub: { pl: 'NPN małej mocy', en: 'Small-signal NPN' }, kw: '2n3904 npn tranzystor transistor', order: ['E', 'B', 'C'], label: '2N3904', m: { Is: 6.7e-15, bf: 200, br: 6, va: 75, n: 1 }, icmax: 0.2, pmax: 0.625, info: npnInfo });
bjtPart('q_2n2222', { name: '2N2222 (PN2222A)', sub: { pl: 'NPN uniwersalny', en: 'General-purpose NPN' }, kw: '2n2222 pn2222 npn tranzystor transistor', order: ['E', 'B', 'C'], label: '2N2222', m: { Is: 1.4e-14, bf: 200, br: 6, va: 74, n: 1 }, icmax: 0.6, pmax: 0.625, info: npnInfo });
bjtPart('q_bc557', { name: 'BC557', sub: { pl: 'PNP małej mocy', en: 'Small-signal PNP' }, kw: 'bc557 pnp tranzystor transistor', order: ['C', 'B', 'E'], label: 'BC557', pnp: true, m: { Is: 1e-14, bf: 250, br: 5, va: 50, n: 1 }, icmax: 0.1, pmax: 0.5, info: pnpInfo });
bjtPart('q_2n3906', { name: '2N3906', sub: { pl: 'PNP małej mocy', en: 'Small-signal PNP' }, kw: '2n3906 pnp tranzystor transistor', order: ['E', 'B', 'C'], label: '2N3906', pnp: true, m: { Is: 1.4e-14, bf: 180, br: 4, va: 20, n: 1 }, icmax: 0.2, pmax: 0.625, info: pnpInfo });
const darlInfo = { pl: 'Darlington: dwa tranzystory w jednej obudowie, wzmocnienie ok. 1000. Steruje silnikami i żarówkami prosto z mikrokontrolera. Napięcie U_BE ≈ 1,4 V, a nasycenia ok. 1 V.', en: 'Darlington: two transistors in one package, gain about 1000. Drives motors and lamps straight from a microcontroller. U_BE ≈ 1.4 V and saturation about 1 V.' };
bjtPart('q_tip122', { name: 'TIP122', sub: { pl: 'NPN Darlington mocy', en: 'NPN power Darlington' }, kw: 'tip122 darlington npn mocy power', pkg: 'TO220', order: ['B', 'C', 'E'], label: 'TIP122', darl: [8000, 120], m1: { Is: 1e-13, bf: 60, br: 3, va: 100, n: 1 }, m: { Is: 1e-12, bf: 40, br: 3, va: 100, n: 1.1 }, icmax: 5, pmax: 65, info: darlInfo });
bjtPart('q_tip127', { name: 'TIP127', sub: { pl: 'PNP Darlington mocy', en: 'PNP power Darlington' }, kw: 'tip127 darlington pnp mocy power', pkg: 'TO220', order: ['B', 'C', 'E'], label: 'TIP127', pnp: true, darl: [8000, 120], m1: { Is: 1e-13, bf: 60, br: 3, va: 100, n: 1 }, m: { Is: 1e-12, bf: 40, br: 3, va: 100, n: 1.1 }, icmax: 5, pmax: 65, info: darlInfo });
// 2N3055 – obudowa TO-3
(function () {
  const order = ['B', 'E', 'C'];
  def('q_2n3055', {
    cat: 'bjt', name: '2N3055', sub: { pl: 'NPN mocy, obudowa TO-3', en: 'NPN power, TO-3 package' }, kw: '2n3055 npn mocy power to-3', props: {},
    pins: order.map((r, i) => ({ x: i * 20, y: 0, n: ROLE[r] })), bbox: [-30, -100, 70, 4],
    info: { pl: 'Klasyczny tranzystor mocy (15 A, 115 W) w metalowej obudowie TO-3. Obudowa jest kolektorem. Wzmocnienie β tylko 20–70, więc baza potrzebuje sporego prądu.', en: 'Classic power transistor (15 A, 115 W) in a metal TO-3 can. The case is the collector. Gain β is only 20–70, so the base needs plenty of current.' },
    draw(c, r) { return leg('M0 0V-30') + leg('M20 0V-30') + leg('M40 0V-14L40 -30') + `<path d="M-28 -60 Q20 -110 68 -60 Q20 -10 -28 -60Z" fill="#c9ced4" stroke="#6f777f" stroke-width="2"/><circle cx="20" cy="-60" r="24" fill="#b3b9c0" stroke="#7d858d"/><circle cx="-14" cy="-60" r="4" fill="#3a3f45"/><circle cx="54" cy="-60" r="4" fill="#3a3f45"/>` + tx(20, -58, '2N3055', { s: 7.5, c: '#2a2f35', f: FONT_M }) + tx(0, -34, 'B', { s: 6.5, c: '#2a2f35' }) + tx(20, -34, 'E', { s: 6.5, c: '#2a2f35' }) + tx(40, -34, 'C', { s: 6.5, c: '#2a2f35' }) + (r.burnt ? smoke(20, -90) : ''); },
    sim: {
      nl(d, v) { if (d.s.burnt) return [0, 0, 0]; const r = bjtI(v[0] - v[1], v[0] - v[2], { Is: 5e-12, bf: 40, br: 3, va: 100, n: 1.1 }); return [r[1], -(r[0] + r[1]), r[0]]; },
      commit(d, dt) { const ic = d.ip[2], ib = d.ip[0]; d.s.Ic = ic; d.s.Ib = ib; d.s.Vce = dVp(d, 2, 1); d.s.Vbe = dVp(d, 0, 1); d.s.P = Math.abs(d.s.Vce * ic); d.s.U = d.s.Vce; d.s.I = ic;
        d.s.region = Math.abs(ic) < 1e-7 ? 'off' : d.s.Vce < 0.4 ? 'sat' : 'act'; if (ic > 22 || d.s.P > 170) { d.s.bt = (d.s.bt || 0) + dt; if (d.s.bt > 0.5) d.s.burnt = true; } d.s.warn = d.s.burnt ? 'semiBurnt' : ic > 15 || d.s.P > 115 ? 'bjtOver' : null; },
    },
    readings: (c, r) => PARTS.q_bc547.readings(c, r),
  });
})();

/* ================= FET ================= */
function mosI(vgs, vds, m) { // N-kanał, zwraca Id (D->S)
  let sw = 1; if (vds < 0) { vgs = vgs - vds; vds = -vds; sw = -1; }
  const vov = softplus(vgs - m.vth, 0.04);
  const id = vds < vov ? m.k * (vov * vds - vds * vds / 2) * (1 + m.lam * vds) : m.k / 2 * vov * vov * (1 + m.lam * vds);
  return sw * id;
}
function fetPart(id, o) {
  const pk = o.pkg === 'TO220' ? pkgTO220(o.order) : pkgTO92(o.order);
  const iD = o.order.indexOf('D'), iG = o.order.indexOf('G'), iS = o.order.indexOf('S');
  const pol = o.p ? -1 : 1;
  def(id, {
    cat: 'fet', name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: {},
    pins: pk.pins.map((p, i) => ({ ...p, n: ROLE[o.order[i]] })), bbox: pk.bbox,
    draw(c, r) { return pk.body(o.label) + (r.burnt ? smoke(20, -50) : ''); },
    sim: {
      nl(d, v) {
        const out = [0, 0, 0]; if (d.s.burnt) return out;
        const vgs = pol * (v[iG] - v[iS]), vds = pol * (v[iD] - v[iS]);
        let id = o.jfet ? jfetI(vgs, vds, o.m) : mosI(vgs, vds, o.m);
        let ig = 0;
        if (o.jfet) { ig = diodeI(vgs, 1e-14, 1) + diodeI(vgs - vds, 1e-14, 1); id -= diodeI(vgs - vds, 1e-14, 1); }
        else { const ib = diodeI(-vds, 1e-12, 1.2); id -= ib; ig = vgs * 1e-12; }  // dioda podłożowa S->D
        out[iD] += pol * id; out[iS] -= pol * (id + ig); out[iG] += pol * ig; return out;
      },
      commit(d, dt) {
        const idd = d.ip[iD]; d.s.Id = idd; d.s.Vgs = dVp(d, iG, iS); d.s.Vds = dVp(d, iD, iS); d.s.U = d.s.Vds; d.s.I = idd; d.s.P = Math.abs(d.s.Vds * idd);
        d.s.region = Math.abs(idd) < 1e-6 ? 'off' : (o.jfet ? 'act' : (pol * d.s.Vds < pol * d.s.Vgs - o.m.vth * (o.jfet ? 0 : 1) ? 'lin' : 'act'));
        if (Math.abs(pol * d.s.Vgs) > (o.vgsmax || 20)) d.s.gate = (d.s.gate || 0) + dt; if (d.s.gate > 0.1) d.s.burnt = true;
        if (Math.abs(idd) > o.idmax * 1.5 || d.s.P > o.pmax * 1.5) { d.s.bt = (d.s.bt || 0) + dt; if (d.s.bt > 0.5) d.s.burnt = true; } else d.s.bt = 0;
        d.s.warn = d.s.burnt ? 'semiBurnt' : Math.abs(idd) > o.idmax || d.s.P > o.pmax ? 'fetOver' : null;
      },
    },
    readings: (c, r) => [['I<sub>D</sub>', si(r.Id || 0, 'A')], ['U<sub>GS</sub>', si(r.Vgs || 0, 'V')], ['U<sub>DS</sub>', si(r.Vds || 0, 'V')], ['P', si(r.P || 0, 'W')],
      [{ pl: 'Stan', en: 'Region' }, { off: { pl: 'zatkany', en: 'off' }, lin: { pl: 'przewodzi (liniowy, jak rezystor)', en: 'on (linear, like a resistor)' }, act: { pl: 'nasycenie (źródło prądu)', en: 'saturation (current source)' } }[r.region || 'off']]],
  });
}
function jfetI(vgs, vds, m) { let sw = 1; if (vds < 0) { vgs = vgs - vds; vds = -vds; sw = -1; } const vov = softplus(vgs - m.vp, 0.03), k = 2 * m.idss / (m.vp * m.vp); const id = vds < vov ? k * (vov * vds - vds * vds / 2) * (1 + m.lam * vds) : k / 2 * vov * vov * (1 + m.lam * vds); return sw * id; }
const nmosInfo = { pl: 'MOSFET z kanałem N: steruje się go napięciem bramki (G), bramka prawie nie pobiera prądu. Przewodzi D → S, gdy U_GS przekroczy próg (U_th). Ma wbudowaną diodę S → D.', en: 'N-channel MOSFET: controlled by gate voltage (G); the gate draws almost no current. Conducts D → S once U_GS exceeds the threshold (U_th). It has a built-in S → D body diode.' };
fetPart('m_2n7000', { name: '2N7000', sub: { pl: 'MOSFET N małej mocy', en: 'Small-signal N-MOSFET' }, kw: '2n7000 mosfet n kanal', order: ['S', 'G', 'D'], label: '2N7000', m: { vth: 2.1, k: 0.25, lam: 0.01 }, idmax: 0.2, pmax: 0.4, info: nmosInfo });
fetPart('m_bs170', { name: 'BS170', sub: { pl: 'MOSFET N małej mocy', en: 'Small-signal N-MOSFET' }, kw: 'bs170 mosfet n kanal', order: ['D', 'G', 'S'], label: 'BS170', m: { vth: 2.1, k: 0.3, lam: 0.01 }, idmax: 0.5, pmax: 0.83, info: nmosInfo });
fetPart('m_irf540n', { name: 'IRF540N', sub: { pl: 'MOSFET N mocy, 33 A', en: 'Power N-MOSFET, 33 A' }, kw: 'irf540n irf540 mosfet mocy power n silnik motor', pkg: 'TO220', order: ['G', 'D', 'S'], label: 'IRF540N', m: { vth: 3.0, k: 4, lam: 0.005 }, idmax: 33, pmax: 130, info: nmosInfo });
fetPart('m_irfz44n', { name: 'IRFZ44N', sub: { pl: 'MOSFET N mocy, 49 A', en: 'Power N-MOSFET, 49 A' }, kw: 'irfz44n irfz44 mosfet mocy power n', pkg: 'TO220', order: ['G', 'D', 'S'], label: 'IRFZ44N', m: { vth: 3.0, k: 9, lam: 0.005 }, idmax: 49, pmax: 94, info: nmosInfo });
fetPart('m_irf9540n', { name: 'IRF9540N', sub: { pl: 'MOSFET P mocy, −23 A', en: 'Power P-MOSFET, −23 A' }, kw: 'irf9540n irf9540 mosfet mocy power p kanal', pkg: 'TO220', order: ['G', 'D', 'S'], label: 'IRF9540N', p: true, m: { vth: 3.0, k: 1.5, lam: 0.005 }, idmax: 23, pmax: 140,
  info: { pl: 'MOSFET z kanałem P: źródło (S) łącz z plusem. Przewodzi, gdy bramka jest co najmniej ok. 3 V niżej niż źródło. Używany jako „wyłącznik po stronie plusa”.', en: 'P-channel MOSFET: connect the source (S) to plus. It conducts when the gate is at least about 3 V below the source. Used as a “high-side switch”.' } });
const jfetInfo = { pl: 'JFET z kanałem N: przewodzi przy U_GS = 0 (prąd I_DSS), a ujemne napięcie bramki go przytyka. Stosowany w przedwzmacniaczach audio i układach w.cz.', en: 'N-channel JFET: conducts at U_GS = 0 (current I_DSS), and a negative gate voltage pinches it off. Used in audio preamps and RF circuits.' };
fetPart('j_bf245', { name: 'BF245', sub: { pl: 'JFET N (audio, w.cz.)', en: 'N-JFET (audio, RF)' }, kw: 'bf245 jfet n', order: ['D', 'S', 'G'], label: 'BF245', jfet: true, m: { vp: -2.0, idss: 4e-3, lam: 0.02, vth: 0 }, idmax: 0.025, pmax: 0.3, info: jfetInfo });
fetPart('j_2n3819', { name: '2N3819', sub: { pl: 'JFET N (audio, w.cz.)', en: 'N-JFET (audio, RF)' }, kw: '2n3819 jfet n', order: ['D', 'S', 'G'], label: '2N3819', jfet: true, m: { vp: -3.0, idss: 10e-3, lam: 0.02, vth: 0 }, idmax: 0.05, pmax: 0.35, info: jfetInfo });

/* ================= TYRYSTORY I TRIAKI (model behawioralny z zatrzaskiem) ================= */
function thyPart(id, o) {
  const pk = pkgTO220(o.order);
  const ix = r => o.order.indexOf(r);
  const iA = o.triac ? ix('MT2') : ix('A'), iK = o.triac ? ix('MT1') : ix('K'), iG = ix('G');
  def(id, {
    cat: 'thy', name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: {},
    pins: pk.pins.map((p, i) => ({ ...p, n: ROLE[o.order[i]] })), bbox: pk.bbox,
    draw(c, r) { return pk.body(o.label) + (r.on ? `<circle cx="44" cy="-52" r="3.5" fill="#5ef08a"/>` : ''); },
    sim: {
      maxDt: () => 1e-4,
      nl(d, v) {
        const vak = v[iA] - v[iK], vg = v[iG] - v[iK];
        let ia;
        if (d.s.on) ia = o.triac ? Math.sign(vak) * softplus(Math.abs(vak) - 1.0, 0.02) / 0.03 : softplus(vak - 1.0, 0.02) / 0.03 + vak * 1e-6;
        else ia = vak * 1e-8;
        const ig = o.triac ? diodeI(vg, 1e-13, 1.6) - diodeI(-vg, 1e-13, 1.6) : diodeI(vg, 1e-13, 1.5) + vg / 1000;
        const out = [0, 0, 0]; out[iA] += ia; out[iK] -= ia + ig; out[iG] += ig; return out;
      },
      post(d) {
        if (!d.ip) return false;
        const vak = dVp(d, iA, iK), ia = d.ip[iA], ig = d.ip[iG];
        if (!d.s.on && Math.abs(ig) > o.igt && (o.triac ? Math.abs(vak) > 0.6 : vak > 0.6)) { d.s.on = true; return true; }
        if (!d.s.on && (o.triac ? Math.abs(vak) : vak) > o.vbo) { d.s.on = true; return true; }
        if (d.s.on && (o.triac ? Math.abs(ia) : ia) < o.ih && Math.abs(ig) < o.igt) { d.s.on = false; return true; }
        return false;
      },
      commit(d) { d.s.U = dVp(d, iA, iK); d.s.I = d.ip ? d.ip[iA] : 0; d.s.Ig = d.ip ? d.ip[iG] : 0; d.s.P = Math.abs(d.s.U * d.s.I); },
    },
    readings: (c, r) => [[o.triac ? 'U<sub>MT2–MT1</sub>' : 'U<sub>AK</sub>', si(r.U || 0, 'V')], [o.triac ? 'I<sub>MT2</sub>' : 'I<sub>A</sub>', si(r.I || 0, 'A')], ['I<sub>G</sub>', si(r.Ig || 0, 'A')], [{ pl: 'Stan', en: 'State' }, r.on ? { pl: 'przewodzi (zatrzaśnięty)', en: 'conducting (latched)' } : { pl: 'zablokowany', en: 'blocking' }]],
  });
}
const scrInfo = { pl: 'Tyrystor (SCR): krótki impuls prądu bramki (G) włącza go, a potem przewodzi A → K sam, aż prąd spadnie poniżej prądu podtrzymania. Steruje dużymi prądami stałymi.', en: 'Thyristor (SCR): a short gate (G) pulse turns it on and it then keeps conducting A → K by itself until the current drops below the holding current. Controls large DC currents.' };
thyPart('t_bt151', { name: 'BT151', sub: { pl: 'Tyrystor 12 A, 500 V', en: 'Thyristor 12 A, 500 V' }, kw: 'bt151 tyrystor scr thyristor', order: ['K', 'A', 'G'], label: 'BT151', igt: 2e-3, ih: 7e-3, vbo: 650, info: scrInfo });
thyPart('t_2n6507', { name: '2N6507', sub: { pl: 'Tyrystor 25 A, 400 V', en: 'Thyristor 25 A, 400 V' }, kw: '2n6507 tyrystor scr thyristor', order: ['K', 'A', 'G'], label: '2N6507', igt: 9e-3, ih: 18e-3, vbo: 500, info: scrInfo });
const triacInfo = { pl: 'Triak: „dwukierunkowy tyrystor” do prądu zmiennego. Impuls bramki włącza go w obu połówkach sinusoidy, a wyłącza się sam przy przejściu prądu przez zero. Serce ściemniaczy światła.', en: 'Triac: a “bidirectional thyristor” for AC. A gate pulse turns it on in either half-cycle, and it switches off by itself when the current crosses zero. The heart of light dimmers.' };
thyPart('t_bt136', { name: 'BT136', sub: { pl: 'Triak 4 A, 600 V', en: 'Triac 4 A, 600 V' }, kw: 'bt136 triak triac sciemniacz dimmer', order: ['MT1', 'MT2', 'G'], label: 'BT136', triac: true, igt: 10e-3, ih: 10e-3, vbo: 700, info: triacInfo });
thyPart('t_mac218', { name: 'MAC218', sub: { pl: 'Triak 8 A, 600 V', en: 'Triac 8 A, 600 V' }, kw: 'mac218 triak triac', order: ['MT1', 'MT2', 'G'], label: 'MAC218', triac: true, igt: 30e-3, ih: 20e-3, vbo: 700, info: triacInfo });
