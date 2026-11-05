'use strict';
/* ===== pokazujemy podstawowe elementy także w ich właściwych kategoriach ===== */
PARTS.resistor.also = ['res']; PARTS.pot.also = ['res']; PARTS.capacitor.also = ['cap']; PARTS.led.also = ['opto'];
PARTS.motor.also = ['act']; PARTS.bulb.also = ['act']; PARTS.buzzer.also = ['act']; PARTS.mm.also = ['src']; PARTS.battery.also = ['src'];

/* ===== drabinka rezystorowa SIP ===== */
def('res_net', {
  cat: 'res', name: { pl: 'Drabinka rezystorowa (SIP)', en: 'Resistor network (SIP)' }, sub: { pl: '4 lub 8 rezystorów, wspólny pin 1', en: '4 or 8 resistors, common pin 1' }, kw: 'drabinka rezystorowa siec resistor network sip pull-up podciaganie', props: { n: 8, r: 10000 },
  pins: c => Array.from({ length: c.props.n + 1 }, (_, i) => ({ x: i * 20, y: 0, n: i === 0 ? { pl: '1 – wspólny', en: '1 – common' } : String(i + 1), num: i + 1 })),
  bbox: c => [-10, -36, c.props.n * 20 + 10, 4],
  ui: [{ k: 'n', type: 'seg', l: { pl: 'Liczba rezystorów', en: 'Resistors' }, opts: [[4, '4 (SIP-5)'], [8, '8 (SIP-9)']] }, { k: 'r', type: 'si', unit: 'Ω', l: { pl: 'Rezystancja każdego', en: 'Each resistance' }, presets: [220, 330, 1e3, 4.7e3, 10e3, 47e3, 100e3] }],
  info: { pl: 'Kilka rezystorów w jednej obudowie, wszystkie połączone z pinem 1 (oznaczonym kropką). Typowo: podciąganie linii danych do plusa (pull-up) albo rezystory do diod.', en: 'Several resistors in one package, all joined at pin 1 (marked with a dot). Typical use: pulling data lines up to plus (pull-up) or LED resistors.' },
  draw(c) { const n = c.props.n, W = n * 20 + 16; let s = ''; for (let i = 0; i <= n; i++) s += leg(`M${i * 20} 0V-8`); s += `<rect x="-8" y="-34" width="${W}" height="26" rx="4" fill="#d9c27a" stroke="#8c7a3a"/><circle cx="0" cy="-27" r="2.5" fill="#3a3010"/>` + tx(n * 10, -18, siT(c.props.r, 'Ω') + ' ×' + n, { s: 8, c: '#3a3010', f: FONT_M }); return s; },
  sim: { lin(d, S) { for (let i = 1; i <= d.c.props.n; i++) S.G(0, i, 1 / d.c.props.r); }, commit(d) { d.s.U = 0; } },
});

/* ===== kondensator ceramiczny ===== */
def('cap_cer', {
  cat: 'cap', name: { pl: 'Kondensator ceramiczny (MLCC)', en: 'Ceramic capacitor (MLCC)' }, sub: 'pF – µF', kw: 'kondensator ceramiczny mlcc ceramic capacitor pf nf 100nf', props: { c: 100e-9 },
  pins: [{ x: 0, y: 0, n: '1' }, { x: 20, y: 0, n: '2' }], bbox: [-10, -40, 30, 4],
  ui: [{ k: 'c', type: 'si', unit: 'F', l: { pl: 'Pojemność', en: 'Capacitance' }, presets: [10e-12, 22e-12, 100e-12, 1e-9, 10e-9, 22e-9, 47e-9, 100e-9, 220e-9, 470e-9, 1e-6] }],
  info: { pl: 'Mały, niespolaryzowany kondensator. 100 nF przy każdym układzie scalonym (między VCC a GND) odfiltrowuje zakłócenia wysokiej częstotliwości. Kod na obudowie: 104 = 10·10⁴ pF = 100 nF.', en: 'A small, non-polarised capacitor. 100 nF next to every chip (between VCC and GND) filters out high-frequency noise. Code on the body: 104 = 10·10⁴ pF = 100 nF.' },
  draw(c) { const pf = c.props.c * 1e12; const e = Math.max(0, Math.floor(Math.log10(pf)) - 1); const code = pf < 100 ? String(Math.round(pf)) : String(Math.round(pf / Math.pow(10, e))).slice(0, 2) + e; return leg('M0 0V-12L4 -18') + leg('M20 0V-12L16 -18') + `<ellipse cx="10" cy="-27" rx="15" ry="12" fill="#e2a33a" stroke="#9c6a14"/>` + tx(10, -24, code, { s: 8, c: '#4a2c00', f: FONT_M }); },
  sim: {
    dyn: true, lin(d, S, dt) { const g = d.c.props.c / dt, v0 = d.s.vc || 0; S.G(0, 1, g); S.I(0, g * v0); S.I(1, -g * v0); },
    commit(d, dt) { const U = dVp(d, 0, 1); measure2(d, d.c.props.c * (U - (d.s.vc || 0)) / dt); d.s.vc = U; },
  },
});
/* ===== cewka ===== */
def('inductor', {
  cat: 'cap', name: { pl: 'Cewka (dławik)', en: 'Inductor (choke)' }, kw: 'cewka dlawik inductor choke indukcyjnosc henr', props: { l: 0.01, rdc: 1 },
  pins: [{ x: 0, y: 0, n: '1' }, { x: 40, y: 0, n: '2' }], bbox: [-6, -30, 46, 4],
  ui: [{ k: 'l', type: 'si', unit: 'H', l: { pl: 'Indukcyjność', en: 'Inductance' }, presets: [10e-6, 100e-6, 1e-3, 10e-3, 100e-3, 1] }, { k: 'rdc', type: 'si', unit: 'Ω', l: { pl: 'Rezystancja uzwojenia', en: 'Winding resistance' }, presets: [0.1, 0.5, 1, 5, 20] }],
  info: { pl: 'Magazynuje energię w polu magnetycznym i przeciwstawia się zmianom prądu (U = L · dI/dt). Przy nagłym przerwaniu prądu wytwarza wysoką szpilkę napięcia.', en: 'Stores energy in a magnetic field and opposes changes in current (U = L · dI/dt). Interrupting its current suddenly produces a high voltage spike.' },
  draw() { let s = leg('M0 0V-12') + leg('M40 0V-12'); s += `<rect x="-2" y="-28" width="44" height="18" rx="9" fill="#2b2f36"/>`; for (let i = 0; i < 5; i++) s += `<ellipse cx="${4 + i * 8}" cy="-19" rx="4.5" ry="8" fill="none" stroke="#c87533" stroke-width="2.2"/>`; return s; },
  sim: {
    dyn: true, int: 1,
    lin(d, S, dt) { const p = d.c.props, g = dt / p.l, i0 = d.s.il || 0; S.G(0, 2, 1 / Math.max(1e-3, p.rdc)); S.G(2, 1, g); S.I(2, -i0); S.I(1, i0); },
    commit(d, dt) { const p = d.c.props; const v = dV(d, 2) - dV(d, 1); d.s.il = (d.s.il || 0) + dt / p.l * v; d.s.U = dVp(d, 0, 1); d.s.I = d.s.il; d.s.P = Math.abs(d.s.U * d.s.I); },
  },
});
/* ===== transformator (sprzężone indukcyjności) ===== */
const TRF = {
  '230-12': { pl: 'Sieciowy 230 V → 12 V', en: 'Mains 230 V → 12 V', n: 230 / 12, L1: 12, k: 0.996, rp: 25, rs: 0.6 },
  '230-9': { pl: 'Sieciowy 230 V → 9 V', en: 'Mains 230 V → 9 V', n: 230 / 9, L1: 12, k: 0.996, rp: 25, rs: 0.4 },
  '230-24': { pl: 'Sieciowy 230 V → 24 V', en: 'Mains 230 V → 24 V', n: 230 / 24, L1: 12, k: 0.996, rp: 25, rs: 1.2 },
  'p11': { pl: 'Impulsowy 1:1', en: 'Pulse 1:1', n: 1, L1: 1e-3, k: 0.98, rp: 0.2, rs: 0.2 },
  'p12': { pl: 'Impulsowy 1:2', en: 'Pulse 1:2', n: 0.5, L1: 1e-3, k: 0.98, rp: 0.2, rs: 0.4 },
};
def('transformer', {
  cat: 'cap', name: { pl: 'Transformator', en: 'Transformer' }, sub: { pl: 'sieciowy 230 V / impulsowy', en: 'mains 230 V / pulse' }, kw: 'transformator transformer trafo sieciowy 230v 12v impulsowy', props: { type: '230-12' },
  pins: [{ x: 0, y: 0, n: { pl: 'Pierwotne 1', en: 'Primary 1' } }, { x: 0, y: -80, n: { pl: 'Pierwotne 2', en: 'Primary 2' } }, { x: 100, y: 0, n: { pl: 'Wtórne 1', en: 'Secondary 1' } }, { x: 100, y: -80, n: { pl: 'Wtórne 2', en: 'Secondary 2' } }],
  bbox: [-10, -96, 110, 6],
  ui: [{ k: 'type', type: 'select', l: { pl: 'Typ', en: 'Type' }, opts: Object.keys(TRF).map(k => [k, TRF[k]]) }],
  info: { pl: 'Dwie cewki na wspólnym rdzeniu. Zmienny prąd w uzwojeniu pierwotnym indukuje napięcie we wtórnym: U₂ = U₁ · N₂/N₁. Działa tylko z prądem zmiennym – podłącz gniazdo 230 V lub generator.', en: 'Two coils on a shared core. Alternating current in the primary induces voltage in the secondary: U₂ = U₁ · N₂/N₁. Works only with AC – connect the 230 V outlet or a generator.' },
  draw(c) {
    const T = TRF[c.props.type]; let s = leg('M0 0V-6H14') + leg('M0 -80V-74H14') + leg('M100 0V-6H86') + leg('M100 -80V-74H86');
    s += `<rect x="12" y="-92" width="76" height="92" rx="4" fill="#5c636b" stroke="#2a2f34"/><rect x="40" y="-92" width="20" height="92" fill="#454b52"/><rect x="16" y="-82" width="22" height="72" rx="3" fill="#c87533"/><rect x="62" y="-82" width="22" height="72" rx="3" fill="#d79a52"/>`;
    return s + tx(50, -44, L(T).replace(/.*?(\d.*)/, '$1'), { s: 6.5, c: '#eef1f4', r: -90 });
  },
  sim: {
    dyn: true, int: 2, iso: () => [[0, 1, 4], [2, 3, 5]],
    lin(d, S, dt) {
      const T = TRF[d.c.props.type], L1 = T.L1, L2 = L1 / (T.n * T.n), M = T.k * Math.sqrt(L1 * L2), det = L1 * L2 - M * M;
      const g11 = dt * L2 / det, g22 = dt * L1 / det, g12 = -dt * M / det;
      S.G(0, 4, 1 / T.rp); S.G(2, 5, 1 / T.rs);
      // uzwojenie 1: węzły 4 -> 1, uzwojenie 2: węzły 5 -> 3
      const W = [[4, 1], [5, 3]], G = [[g11, g12], [g12, g22]], h = [d.s.i1 || 0, d.s.i2 || 0];
      for (let a = 0; a < 2; a++) { const [pa, na] = W[a]; for (let b = 0; b < 2; b++) { const [pb, nb] = W[b], g = G[a][b]; S.T(pa, pb, g); S.T(pa, nb, -g); S.T(na, pb, -g); S.T(na, nb, g); } S.I(pa, -h[a]); S.I(na, h[a]); }
    },
    commit(d, dt) {
      const T = TRF[d.c.props.type], L1 = T.L1, L2 = L1 / (T.n * T.n), M = T.k * Math.sqrt(L1 * L2), det = L1 * L2 - M * M;
      const v1 = dV(d, 4) - dV(d, 1), v2 = dV(d, 5) - dV(d, 3);
      d.s.i1 = (d.s.i1 || 0) + dt * (L2 * v1 - M * v2) / det; d.s.i2 = (d.s.i2 || 0) + dt * (-M * v1 + L1 * v2) / det;
      d.s.Up = dVp(d, 0, 1); d.s.Us = dVp(d, 2, 3);
      const k = 1 - 1 / 50; d.s.rp = Math.sqrt(k * (d.s.rp || 0) ** 2 + (1 - k) * d.s.Up ** 2); d.s.rs = Math.sqrt(k * (d.s.rs || 0) ** 2 + (1 - k) * d.s.Us ** 2);
    },
  },
  readings: (c, r) => [[{ pl: 'U pierwotne (sk.)', en: 'U primary (RMS)' }, si(r.rp || 0, 'V')], [{ pl: 'U wtórne (sk.)', en: 'U secondary (RMS)' }, si(r.rs || 0, 'V')]],
});

/* ===== OPTOELEKTRONIKA ===== */
def('led_rgb', {
  cat: 'opto', name: { pl: 'Dioda LED RGB', en: 'RGB LED' }, sub: { pl: 'wspólna katoda / anoda', en: 'common cathode / anode' }, kw: 'led rgb kolorowa trojkolorowa common cathode anode', props: { common: 'cc' },
  pins: [{ x: 0, y: 0, n: 'R' }, { x: 20, y: 0, n: { pl: 'Wspólna (najdłuższa)', en: 'Common (longest)' } }, { x: 40, y: 0, n: 'G' }, { x: 60, y: 0, n: 'B' }], bbox: [-6, -66, 66, 6],
  ui: [{ k: 'common', type: 'seg', l: { pl: 'Typ', en: 'Type' }, opts: [['cc', { pl: 'Wspólna katoda (−)', en: 'Common cathode (−)' }], ['ca', { pl: 'Wspólna anoda (+)', en: 'Common anode (+)' }]] }],
  info: { pl: 'Trzy diody (czerwona, zielona, niebieska) w jednej obudowie. Mieszając jasności (np. PWM z Arduino) uzyskasz dowolny kolor. Każdy kolor przez osobny rezystor.', en: 'Three LEDs (red, green, blue) in one package. Mix their brightness (e.g. Arduino PWM) to get any colour. Each colour needs its own resistor.' },
  draw(c, r) {
    const b = r.br || [0, 0, 0], tot = Math.max(...b); const col = tot > 0.02 ? mixColor(b[0], b[1], b[2]) : '#d8dde3';
    let s = tot > 0.02 ? `<circle cx="30" cy="-40" r="40" fill="${glow('#ffffff')}" opacity="${(0.2 + tot * 0.5).toFixed(2)}"/><circle cx="30" cy="-40" r="30" fill="${col}" opacity="${(0.25 * tot).toFixed(2)}"/>` : '';
    s += leg('M0 0V-22L18 -26') + leg('M20 0V-26L26 -28') + leg('M40 0V-26L34 -28') + leg('M60 0V-22L42 -26');
    return s + `<path d="M15 -26V-46A15 15 0 0 1 45 -46V-26Z" fill="${col}" opacity=".92" stroke="rgba(0,0,0,.3)"/><rect x="12" y="-30" width="36" height="5" rx="1.5" fill="${col}" stroke="rgba(0,0,0,.3)"/>` + tx(0, -4, 'R', { s: 7, c: '#ff9a90' }) + tx(40, -4, 'G', { s: 7, c: '#8ff0a8' }) + tx(60, -4, 'B', { s: 7, c: '#9ec2ff' });
  },
  sim: {
    int: 3,
    lin(d, S) { for (const [p, x] of [[0, 4], [2, 5], [3, 6]]) S.G(p, x, 1 / LED_RS); },
    nl(d, v) { const o = [0, 0, 0, 0, 0, 0, 0], cc = d.c.props.common === 'cc'; [[4, 1.9], [5, 2.9], [6, 2.9]].forEach(([x, vf]) => { const i = cc ? diodeI(v[x] - v[1], ledIs(vf), 2) : diodeI(v[1] - v[x], ledIs(vf), 2); if (cc) { o[x] += i; o[1] -= i; } else { o[1] += i; o[x] -= i; } }); return o; },
    commit(d) { const cc = d.c.props.common === 'cc'; d.s.br = [[0, 4], [2, 5], [3, 6]].map(([p, x]) => clamp((cc ? 1 : -1) * (dV(d, p) - dV(d, x)) / LED_RS / 0.02, 0, 1)); d.s.Ic = [[0, 4], [2, 5], [3, 6]].map(([p, x]) => (cc ? 1 : -1) * (dV(d, p) - dV(d, x)) / LED_RS); },
  },
  readings: (c, r) => (r.Ic || [0, 0, 0]).map((x, i) => [{ pl: ['I czerwona', 'I zielona', 'I niebieska'][i], en: ['I red', 'I green', 'I blue'][i] }, si(x, 'A')]),
});
/* ---- wyświetlacze segmentowe: macierz diod ---- */
function segDisplay(id, o) {
  def(id, {
    cat: 'seg', name: o.name, sub: o.sub, kw: o.kw, props: { common: 'cc', color: 'red' }, info: o.info,
    pins: o.pins, bbox: o.bbox,
    ui: [{ k: 'common', type: 'seg', l: { pl: 'Typ', en: 'Type' }, opts: [['cc', { pl: 'Wspólna katoda', en: 'Common cathode' }], ['ca', { pl: 'Wspólna anoda', en: 'Common anode' }]] },
      { k: 'color', type: 'swatch', l: { pl: 'Kolor', en: 'Colour' }, opts: ['red', 'green', 'blue', 'yellow', 'white'].map(k => [k, LED_COL[k].c, LED_COL[k].n]) }],
    draw(c, r) { return o.draw(c, r.br || [], LED_COL[c.props.color] || LED_COL.red); },
    sim: {
      nl(d, v) {
        const out = new Array(v.length).fill(0), cc = d.c.props.common === 'cc', vf = (LED_COL[d.c.props.color] || LED_COL.red).vf, Is = ledIs(vf);
        for (const [seg, com] of o.leds) { const a = cc ? seg : com, k = cc ? com : seg; const i = diodeI(v[a] - v[k], Is, 2) ; out[a] += i; out[k] -= i; }
        return out;
      },
      commit(d, dt) {
        const cc = d.c.props.common === 'cc', vf = (LED_COL[d.c.props.color] || LED_COL.red).vf, Is = ledIs(vf), V = d.n.map(k => CIR.V[k]);
        const br = d.s.br || (d.s.br = new Array(o.leds.length).fill(0)), k = Math.min(1, dt / 0.03); let hot = false;
        o.leds.forEach(([seg, com], j) => { const a = cc ? seg : com, kk = cc ? com : seg; const i = diodeI(V[a] - V[kk], Is, 2); if (i > 0.05) hot = true; br[j] += (clamp(i / 0.012, 0, 1) - br[j]) * k; });
        d.s.warn = hot ? 'segHot' : null;
      },
    },
    readings: () => [],
  });
}
// 7-segm. pojedynczy (np. 5161AS/BS): 1 e,2 d,3 COM,4 c,5 dp | 6 b,7 a,8 COM,9 f,10 g
const SEG_PATH = { a: 'M6 0H26L22 4H10Z', b: 'M27 1L27 21L24 18L23 5Z', c: 'M27 23L27 43L23 39L24 26Z', d: 'M6 44H26L22 40H10Z', e: 'M5 23L5 43L9 39L8 26Z', f: 'M5 1L5 21L8 18L9 5Z', g: 'M6 22L10 20H22L26 22L22 24H10Z' };
function sevenSegSVG(x, y, scale, segOn, col, sk) {
  let s = `<g transform="translate(${x} ${y}) scale(${scale}) skewX(-8)">`;
  'abcdefg'.split('').forEach((k, i) => { const b = segOn[i] || 0; s += `<path d="${SEG_PATH[k]}" fill="${b > 0.03 ? col.c : '#3a3a3a'}" opacity="${b > 0.03 ? (0.35 + 0.65 * b).toFixed(2) : 1}"/>`; });
  const b = segOn[7] || 0; s += `<circle cx="31" cy="43" r="2.4" fill="${b > 0.03 ? col.c : '#3a3a3a'}"/>`;
  return s + '</g>';
}
(function () {
  const names = ['e', 'd', 'COM', 'c', 'dp', 'b', 'a', 'COM', 'f', 'g'];
  const pins = names.map((n, i) => i < 5 ? { x: i * 20, y: 0, n: (i + 1) + ': ' + n, num: i + 1 } : { x: (9 - i) * 20, y: -120, n: (i + 1) + ': ' + n, num: i + 1 });
  const segPin = { a: 6, b: 5, c: 3, d: 1, e: 0, f: 8, g: 9, dp: 4 };
  segDisplay('seg7_1', {
    name: { pl: 'Wyświetlacz 7-segmentowy (1 cyfra)', en: '7-segment display (1 digit)' }, sub: '5161AS / 5161BS', kw: '7 segment siedmiosegmentowy wyswietlacz display 5161 cyfra digit',
    pins: pins.map(p => ({ ...p, n: p.n })), bbox: [-14, -126, 94, 6],
    info: { pl: 'Osiem diod LED (segmenty a–g i kropka dp) ze wspólną katodą (do masy) albo anodą (do plusa). Każdy segment przez rezystor ok. 330 Ω. Piny 3 i 8 to ta sama wspólna elektroda.', en: 'Eight LEDs (segments a–g and dot dp) with a common cathode (to ground) or anode (to plus). Each segment through a resistor of about 330 Ω. Pins 3 and 8 are the same common electrode.' },
    leds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].map(k => [segPin[k], 2]),
    draw(c, br, col) { let s = pins.map(p => leg(p.y === 0 ? `M${p.x} 0V-12` : `M${p.x} -120V-108`)).join(''); s += `<rect x="-12" y="-110" width="104" height="100" rx="3" fill="#1b1c1f" stroke="#000"/>` + sevenSegSVG(18, -100, 1.75, br, col); return s; },
  });
  PARTS.seg7_1.bridges = () => [[2, 7]];
})();
// 4 cyfry 3461AS/BS: góra 12..7: D1,a,f,D2,D3,b ; dół 1..6: e,d,dp,c,g,D4
(function () {
  const names = ['e', 'd', 'dp', 'c', 'g', 'D4', 'b', 'D3', 'D2', 'f', 'a', 'D1'];
  const pins = names.map((n, i) => i < 6 ? { x: i * 20, y: 0, n: (i + 1) + ': ' + n, num: i + 1 } : { x: (11 - i) * 20, y: -120, n: (i + 1) + ': ' + n, num: i + 1 });
  const sp = { a: 10, b: 6, c: 3, d: 1, e: 0, f: 9, g: 4, dp: 2 }, dg = [11, 8, 7, 5];
  const leds = []; for (let k = 0; k < 4; k++) for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']) leds.push([sp[s], dg[k]]);
  segDisplay('seg7_4', {
    name: { pl: 'Wyświetlacz 7-segm. 4 cyfry', en: '7-segment display, 4 digits' }, sub: '3461AS / 3461BS', kw: '7 segment 4 cyfry wyswietlacz multipleksowany multiplexed display 3461',
    pins, bbox: [-34, -126, 134, 6], leds,
    info: { pl: 'Cztery cyfry ze wspólnymi segmentami a–g: wybierasz cyfrę pinem D1–D4 i bardzo szybko przełączasz je po kolei (multipleksowanie) – oko widzi wszystkie naraz. Zwykle sterowany z mikrokontrolera.', en: 'Four digits sharing segments a–g: you select a digit with pins D1–D4 and switch between them very quickly (multiplexing) – the eye sees all at once. Usually driven from a microcontroller.' },
    draw(c, br, col) { let s = pins.map(p => leg(p.y === 0 ? `M${p.x} 0V-12` : `M${p.x} -120V-108`)).join(''); s += `<rect x="-32" y="-110" width="164" height="100" rx="3" fill="#1b1c1f" stroke="#000"/>`; for (let k = 0; k < 4; k++) s += sevenSegSVG(-22 + k * 38, -92, 1.32, br.slice(k * 8, k * 8 + 8), col); return s; },
  });
})();
// 14- i 16-segmentowe (wspólna katoda/anoda), układ pinów opisany na grafice
function alphaSeg(id, nseg) {
  const segs = nseg === 14 ? ['a', 'b', 'c', 'd', 'e', 'f', 'g1', 'g2', 'h', 'i', 'j', 'k', 'l', 'm'] : ['a1', 'a2', 'b', 'c', 'd1', 'd2', 'e', 'f', 'g1', 'g2', 'h', 'i', 'j', 'k', 'l', 'm'];
  const names = [...segs, 'dp', 'COM'], n = names.length, h = n / 2;
  const pins = names.map((nm, i) => i < h ? { x: i * 20, y: 0, n: nm, num: i + 1 } : { x: (n - 1 - i) * 20, y: -140, n: nm, num: i + 1 });
  const W = (h - 1) * 20;
  // geometria segmentów w układzie 40×60
  const G = { a: [8, 2, 32, 2], a1: [8, 2, 19, 2], a2: [21, 2, 32, 2], b: [34, 4, 34, 28], c: [34, 32, 34, 56], d: [8, 58, 32, 58], d1: [8, 58, 19, 58], d2: [21, 58, 32, 58], e: [6, 32, 6, 56], f: [6, 4, 6, 28], g1: [8, 30, 19, 30], g2: [21, 30, 32, 30], h: [9, 6, 18, 27], i: [20, 5, 20, 27], j: [31, 6, 22, 27], k: [9, 54, 18, 33], l: [20, 33, 20, 55], m: [31, 54, 22, 33] };
  segDisplay(id, {
    name: { pl: `Wyświetlacz ${nseg}-segmentowy`, en: `${nseg}-segment display` }, sub: { pl: 'alfanumeryczny, 1 znak', en: 'alphanumeric, 1 character' }, kw: `${nseg} segment alfanumeryczny alphanumeric wyswietlacz litery letters`,
    pins, bbox: [-14, -146, W + 14, 6], leds: segs.map((s, i) => [i, n - 1]).concat([[n - 2, n - 1]]),
    info: { pl: `Pokazuje cyfry i litery dzięki ${nseg} segmentom (plus kropka). Każdy segment ma osobny pin opisany na obudowie, wspólna elektroda to COM.`, en: `Shows digits and letters using ${nseg} segments (plus a dot). Each segment has its own pin labelled on the package; the common electrode is COM.` },
    draw(c, br, col) {
      let s = pins.map(p => leg(p.y === 0 ? `M${p.x} 0V-12` : `M${p.x} -140V-128`)).join('') + `<rect x="-12" y="-130" width="${W + 24}" height="120" rx="3" fill="#1b1c1f" stroke="#000"/>`;
      pins.forEach(p => s += tx(p.x, p.y === 0 ? -14 : -122, p.n, { s: 5, c: '#8a9098', f: FONT_M }));
      const ox = W / 2 - 34, oy = -112, sc = 1.6;
      segs.forEach((sg, i) => { const [x1, y1, x2, y2] = G[sg]; const b = br[i] || 0; s += `<line x1="${ox + x1 * sc}" y1="${oy + y1 * sc}" x2="${ox + x2 * sc}" y2="${oy + y2 * sc}" stroke="${b > 0.03 ? col.c : '#3a3a3a'}" stroke-width="5" stroke-linecap="round" opacity="${b > 0.03 ? (0.35 + 0.65 * b).toFixed(2) : 1}"/>`; });
      const b = br[segs.length] || 0; s += `<circle cx="${ox + 39 * sc}" cy="${oy + 58 * sc}" r="3.5" fill="${b > 0.03 ? col.c : '#3a3a3a'}"/>`;
      return s;
    },
  });
}
alphaSeg('seg14', 14); alphaSeg('seg16', 16);

/* ---- transoptory ---- */
function optoPart(id, o) {
  const pk = pkgDIP(o.n, o.names);
  def(id, {
    cat: 'opto', name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: {}, pins: pk.pins, bbox: pk.bbox,
    draw(c, r) { return pk.body(o.label, '') + ((r.If || 0) > 1e-3 ? `<circle cx="${pk.pins[0].x}" cy="-40" r="4" fill="#ff5a4d" opacity="${clamp(r.If / 0.01, 0.2, 1).toFixed(2)}"/>` : ''); },
    sim: {
      int: o.base === undefined ? 2 : 1, iso: () => o.base === undefined ? [[o.a, o.k, 4], [o.e, o.c, 5]] : [[o.a, o.k, 6], [o.e, o.c, o.base, 2]],
      lin(d, S) { S.G(o.a, d.n.length - 1 - (o.base === undefined ? 1 : 0), 1 / 15); },
      nl(d, v) {
        const out = new Array(v.length).fill(0); const xl = v.length - 1 - (o.base === undefined ? 1 : 0), b = o.base === undefined ? v.length - 1 : o.base;
        const iF = diodeI(v[xl] - v[o.k], ledIs(1.2), 1.8); out[xl] += iF; out[o.k] -= iF;
        const ip = Math.max(0, iF) * o.ctr / 300; // fotoprąd do bazy
        const r = bjtI(v[b] - v[o.e], v[b] - v[o.c], { Is: 1e-14, bf: 300, br: 5, va: 80, n: 1 });
        out[o.c] += r[0]; out[b] += r[1] - ip; out[o.e] -= r[0] + r[1] - ip; return out;
      },
      commit(d) { const xl = d.n.length - 1 - (o.base === undefined ? 1 : 0); d.s.If = (dV(d, o.a) - dV(d, xl)) * 15; d.s.Ic = d.ip ? d.ip[o.c] : 0; d.s.Vce = dVp(d, o.c, o.e); },
    },
    readings: (c, r) => [['I<sub>F</sub> (LED)', si(r.If || 0, 'A')], ['I<sub>C</sub>', si(r.Ic || 0, 'A')], ['U<sub>CE</sub>', si(r.Vce || 0, 'V')], ['CTR', Math.abs(r.If) > 1e-5 ? Math.round(r.Ic / r.If * 100) + ' %' : '—']],
  });
}
const optoInfo = { pl: 'Dioda LED i fototranzystor w jednej obudowie, bez połączenia elektrycznego. Świecąca dioda włącza tranzystor – izolacja galwaniczna oddziela np. mikrokontroler od obwodu wysokiego napięcia.', en: 'An LED and a phototransistor in one package with no electrical connection. The lit LED switches the transistor on – galvanic isolation separates e.g. a microcontroller from a high-voltage circuit.' };
optoPart('opto_pc817', { n: 4, names: ['A', 'K', 'E', 'C'], name: 'PC817', label: 'PC817', sub: { pl: 'Transoptor DIP-4', en: 'Optocoupler DIP-4' }, kw: 'pc817 transoptor optocoupler optoizolator', a: 0, k: 1, e: 2, c: 3, ctr: 1.0, info: optoInfo });
optoPart('opto_4n25', { n: 6, names: ['A', 'K', 'NC', 'E', 'C', 'B'], name: '4N25', label: '4N25', sub: { pl: 'Transoptor DIP-6 z wyprowadzoną bazą', en: 'Optocoupler DIP-6 with base pin' }, kw: '4n25 transoptor optocoupler', a: 0, k: 1, e: 3, c: 4, base: 5, ctr: 0.5, info: optoInfo });

/* ===== PRZEKAŹNIK ===== */
def('relay', {
  cat: 'act', name: { pl: 'Przekaźnik elektromagnetyczny', en: 'Electromechanical relay' }, sub: { pl: 'cewka 5 V lub 12 V', en: '5 V or 12 V coil' }, kw: 'przekaznik relay cewka coil srd-05vdc', props: { v: 5 },
  pins: [{ x: 0, y: 0, n: { pl: 'Cewka 1', en: 'Coil 1' } }, { x: 20, y: 0, n: { pl: 'Cewka 2', en: 'Coil 2' } }, { x: 60, y: 0, n: 'COM' }, { x: 80, y: 0, n: { pl: 'NO (normalnie otwarty)', en: 'NO (normally open)' } }, { x: 100, y: 0, n: { pl: 'NC (normalnie zamknięty)', en: 'NC (normally closed)' } }],
  bbox: [-12, -84, 112, 4],
  ui: [{ k: 'v', type: 'seg', l: { pl: 'Napięcie cewki', en: 'Coil voltage' }, opts: [[5, '5 V'], [12, '12 V']] }],
  info: { pl: 'Prąd cewki przyciąga zworę i przełącza styk COM z NC na NO – mały prąd steruje dużym, nawet 230 V. Cewka przy wyłączeniu daje szpilkę napięcia: równolegle do niej dodaj diodę gaszącą (1N4148/1N4007, katodą do plusa).', en: 'Coil current pulls the armature and moves contact COM from NC to NO – a small current controls a large one, even 230 V. The coil makes a voltage spike when switched off: add a flyback diode across it (1N4148/1N4007, cathode to plus).' },
  draw(c, r) { const on = r.on; return [0, 20, 60, 80, 100].map(x => leg(`M${x} 0V-10`)).join('') + `<rect x="-10" y="-82" width="120" height="72" rx="4" fill="#2f63c9" stroke="#163b85"/>` + tx(50, -60, (c.props.v) + 'VDC', { s: 9, c: '#e8f0ff', f: FONT_M }) + tx(50, -46, 'RELAY', { s: 7, c: '#b9cdf5' }) +
    `<path d="M60 -22 L${on ? 80 : 100} -32" stroke="#e8eef5" stroke-width="2.5"/><circle cx="60" cy="-22" r="2.5" fill="#e8eef5"/><circle cx="80" cy="-32" r="2" fill="#9fb3d8"/><circle cx="100" cy="-32" r="2" fill="#9fb3d8"/>` + tx(10, -26, '⏚', { s: 1, c: 'transparent' }) + `<rect x="2" y="-36" width="16" height="12" rx="2" fill="${on ? '#f4a51c' : '#173a80'}"/>`; },
  sim: {
    int: 1, dyn: true, iso: () => [[0, 1, 5], [2, 3, 4]],
    lin(d, S, dt) {
      const R = d.c.props.v === 5 ? 70 : 400, Lh = d.c.props.v === 5 ? 0.15 : 0.6, g = dt / Lh, i0 = d.s.il || 0;
      S.G(0, 5, 1 / R); S.G(5, 1, g); S.I(5, -i0); S.I(1, i0);
      if (d.s.on) S.G(2, 3, 100); else S.G(2, 4, 100);
    },
    commit(d, dt) {
      const Lh = d.c.props.v === 5 ? 0.15 : 0.6; d.s.il = (d.s.il || 0) + dt / Lh * (dV(d, 5) - dV(d, 1));
      const vc = dVp(d, 0, 1), R = d.c.props.v === 5 ? 70 : 400, i = Math.abs(d.s.il), iNom = d.c.props.v / R;
      if (!d.s.on && i > 0.7 * iNom) { d.s.on = true; E.dirty = true; } else if (d.s.on && i < 0.3 * iNom) { d.s.on = false; E.dirty = true; }
      d.s.U = vc; d.s.I = d.s.il; d.s.spike = Math.min(d.s.spike || 0, vc);
      d.s.warn = Math.abs(vc) > d.c.props.v * 4 ? 'flyback' : null;
    },
  },
  readings: (c, r) => [[{ pl: 'U cewki', en: 'Coil U' }, si(r.U || 0, 'V')], [{ pl: 'I cewki', en: 'Coil I' }, si(r.I || 0, 'A')], [{ pl: 'Styk', en: 'Contact' }, r.on ? 'COM–NO' : 'COM–NC']],
});
/* ===== SERWO ===== */
def('servo', {
  cat: 'act', name: { pl: 'Serwomechanizm SG90', en: 'SG90 servo' }, sub: { pl: 'sterowany impulsem 1–2 ms', en: 'controlled by 1–2 ms pulses' }, kw: 'serwo serwomechanizm servo sg90 pwm', props: {},
  pins: [{ x: 0, y: 0, n: { pl: 'GND (brązowy)', en: 'GND (brown)' } }, { x: 20, y: 0, n: { pl: 'VCC 5 V (czerwony)', en: 'VCC 5 V (red)' } }, { x: 40, y: 0, n: { pl: 'Sygnał (pomarańczowy)', en: 'Signal (orange)' } }], bbox: [-30, -116, 74, 4],
  info: { pl: 'Obraca ramię na kąt 0–180° zależny od długości impulsu na pinie sygnałowym (ok. 0,5 ms → 0°, 1,5 ms → 90°, 2,5 ms → 180°), powtarzanego co 20 ms. Prędkość ok. 0,1 s na 60°, strefa nieczułości 10 µs. W Arduino: biblioteka Servo (write(0…180) daje impulsy 544–2400 µs).', en: 'Turns its arm to 0–180° depending on the pulse width on the signal pin (about 0.5 ms → 0°, 1.5 ms → 90°, 2.5 ms → 180°), repeated every 20 ms. Speed about 0.1 s per 60°, dead band 10 µs. In Arduino: the Servo library (write(0…180) gives 544–2400 µs pulses).' },
  draw(c, r) { const a = r.ang == null ? 90 : r.ang; return leg('M0 0V-14', '#7a4a22') + leg('M20 0V-14', '#e5484d') + leg('M40 0V-14', '#f08a24') + `<rect x="-26" y="-74" width="88" height="60" rx="4" fill="#2f6bd8" stroke="#163f8a"/><rect x="-34" y="-58" width="104" height="8" rx="2" fill="#2f6bd8" stroke="#163f8a"/><circle cx="2" cy="-74" r="14" fill="#2559b5"/>` +
    `<g transform="translate(2 -74) rotate(${(a - 90).toFixed(1)})"><path d="M-5 0 L-3 -36 Q0 -40 3 -36 L5 0 Z" fill="#f2f2f2" stroke="#999"/><circle r="6" fill="#f2f2f2" stroke="#999"/></g>` + tx(30, -36, 'SG90', { s: 8, c: '#e8f0ff' }) + tx(30, -26, Math.round(a) + '°', { s: 7, c: '#ffe08a', f: FONT_M }); },
  sim: {
    init(d) { eListen(d, 2); d.s.ang = 90; d.s.tgt = 90; },
    lin(d, S) { const v = dVp(d, 1, 0); if (v > 3) S.G(1, 0, Math.abs((d.s.tgt || 0) - (d.s.ang || 0)) > 1 ? 1 / 25 : 1 / 600); },
    onIn(d, p, lvl) { const now = eNow(); if (lvl === 1) d.s.t0 = now; else if (d.s.t0 != null) { const w = now - d.s.t0; if (w > 4e-4 && w < 2.8e-3) { const a = clamp((w - 5e-4) / 2e-3 * 180, 0, 180); if (Math.abs(a - d.s.tgt) > 0.9) d.s.tgt = a; } } },
    commit(d, dt) { if (dVp(d, 1, 0) < 3.5) return; const diff = d.s.tgt - d.s.ang, step = 600 * dt; d.s.ang += clamp(diff, -step, step); },
  },
  readings: (c, r) => [[{ pl: 'Kąt', en: 'Angle' }, Math.round(r.ang == null ? 90 : r.ang) + '°']],
});
