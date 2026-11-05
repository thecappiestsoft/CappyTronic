'use strict';
/* ====== Rejestr elementów ====== */
const PARTS = {};
const CATS = [
  ['basic', { pl: 'Podstawowe', en: 'Basics' }],
  ['src', { pl: 'Zasilanie i przyrządy', en: 'Power & instruments' }],
  ['diode', { pl: 'Diody', en: 'Diodes' }],
  ['bjt', { pl: 'Tranzystory bipolarne (BJT)', en: 'Bipolar transistors (BJT)' }],
  ['fet', { pl: 'Tranzystory polowe (FET)', en: 'Field-effect transistors (FET)' }],
  ['thy', { pl: 'Tyrystory i triaki', en: 'Thyristors & triacs' }],
  ['opamp', { pl: 'Wzmacniacze operacyjne i komparatory', en: 'Op-amps & comparators' }],
  ['reg', { pl: 'Stabilizatory i przetwornice', en: 'Regulators & converters' }],
  ['timer', { pl: 'Timery i źródła odniesienia', en: 'Timers & references' }],
  ['gate', { pl: 'Bramki logiczne', en: 'Logic gates' }],
  ['seq', { pl: 'Przerzutniki, liczniki, rejestry', en: 'Flip-flops, counters, registers' }],
  ['dec', { pl: 'Dekodery i sterowniki wyświetlaczy', en: 'Decoders & display drivers' }],
  ['res', { pl: 'Rezystory i potencjometry', en: 'Resistors & potentiometers' }],
  ['cap', { pl: 'Kondensatory, cewki, transformatory', en: 'Capacitors, inductors, transformers' }],
  ['opto', { pl: 'Optoelektronika', en: 'Optoelectronics' }],
  ['act', { pl: 'Przekaźniki i elementy wykonawcze', en: 'Relays & actuators' }],
  ['mcu', { pl: 'Mikrokontrolery', en: 'Microcontrollers' }],
  ['adc', { pl: 'Przetworniki ADC / DAC', en: 'ADC / DAC converters' }],
  ['mem', { pl: 'Pamięci', en: 'Memory' }],
  ['com', { pl: 'Komunikacja i interfejsy', en: 'Communication & interfaces' }],
  ['seg', { pl: 'Wyświetlacze segmentowe', en: 'Segment displays' }],
  ['lcd', { pl: 'Wyświetlacze tekstowe LCD', en: 'Character LCDs' }],
  ['glcd', { pl: 'Wyświetlacze graficzne mono', en: 'Monochrome graphic displays' }],
  ['tft', { pl: 'Wyświetlacze kolorowe TFT', en: 'Color TFT displays' }],
];
function def(id, P) { P.id = id; P.props = P.props || {}; PARTS[id] = P; return P; }
const pinsOf = c => { const P = PARTS[c.type]; return typeof P.pins === 'function' ? P.pins(c) : P.pins; };
const bboxOf = c => { const P = PARTS[c.type]; return typeof P.bbox === 'function' ? P.bbox(c) : P.bbox; };
function rotp(x, y, r) { for (let i = 0; i < r; i++) { const t = x; x = -y; y = t; } return [x, y]; }
function unrot(x, y, r) { for (let i = 0; i < r; i++) { const t = x; x = y; y = -t; } return [x, y]; }
function pinPos(c, i) { const p = pinsOf(c)[i]; const q = rotp(p.x, p.y, c.rot); return [c.x + q[0], c.y + q[1]]; }
const pinName = (c, i) => { const p = pinsOf(c)[i]; return p.num ? `${p.num}: ${L(p.n)}` : L(p.n); };

/* ====== Płytka stykowa ====== */
const BB_CACHE = {};
function bbGeom(c) {
  const cols = c.props && c.props.size === 'full' ? 63 : 30;
  if (BB_CACHE[cols]) return BB_CACHE[cols];
  const rows = [{ y: 0, rail: '+', n: { pl: 'Szyna + (góra)', en: '+ rail (top)' } }, { y: 20, rail: '−', n: { pl: 'Szyna − (góra)', en: '− rail (top)' } }];
  'abcde'.split('').forEach((l, i) => rows.push({ y: 60 + i * 20, l }));
  'fghij'.split('').forEach((l, i) => rows.push({ y: 200 + i * 20, l }));
  rows.push({ y: 320, rail: '+', n: { pl: 'Szyna + (dół)', en: '+ rail (bottom)' } }, { y: 340, rail: '−', n: { pl: 'Szyna − (dół)', en: '− rail (bottom)' } });
  const terms = [], idx = new Map();
  for (const r of rows) for (let col = 0; col < cols; col++) {
    if (r.rail && col % 6 === 5) continue;
    terms.push({ x: col * 20, y: r.y, g: r.rail ? 'R' + r.y : (r.y < 180 ? 'T' : 'B') + col, n: r.rail ? r.n : { pl: `Kolumna ${col + 1}, rząd ${r.l}`, en: `Column ${col + 1}, row ${r.l}` } });
    idx.set(r.y + ',' + col, terms.length - 1);
  }
  const W = (cols - 1) * 20;
  const T = (x, y, s, c) => `<text x="${x}" y="${y}" font-size="9" fill="${c || '#8a877d'}" text-anchor="middle" font-family="${FONT_UI}">${s}</text>`;
  let s = `<rect x="-20" y="-20" width="${W + 40}" height="380" rx="10" fill="#efeee9" stroke="#c4c0b4" stroke-width="2"/><rect x="-20" y="164" width="${W + 40}" height="12" fill="#dcd9cf"/>`;
  for (const [y, c] of [[-10, '#d8453b'], [30, '#2f6bd8'], [310, '#d8453b'], [350, '#2f6bd8']]) s += `<line x1="-6" y1="${y}" x2="${W + 6}" y2="${y}" stroke="${c}" stroke-width="2"/>`;
  s += T(-12, 3, '+', '#d8453b') + T(-12, 23, '−', '#2f6bd8') + T(-12, 323, '+', '#d8453b') + T(-12, 343, '−', '#2f6bd8');
  for (const r of rows) if (r.l) s += T(-12, r.y + 3, r.l);
  for (let c2 = 0; c2 < cols; c2++) if (c2 === 0 || (c2 + 1) % 5 === 0) s += T(c2 * 20, 48, c2 + 1) + T(c2 * 20, 300, c2 + 1);
  for (const h of terms) s += `<rect x="${h.x - 3}" y="${h.y - 3}" width="6" height="6" rx="1" fill="#3a3c3f"/>`;
  return BB_CACHE[cols] = { terms, idx, rows, art: s, bbox: [-20, -20, W + 20, 360] };
}
const bbTerms = c => bbGeom(c).terms;
def('bb', {
  cat: 'basic', name: { pl: 'Płytka stykowa', en: 'Breadboard' }, kw: 'breadboard plytka stykowa', props: { size: 'half' },
  pins: c => bbGeom(c).terms, bbox: c => bbGeom(c).bbox, draw: c => bbGeom(c).art,
  ui: [{ k: 'size', type: 'seg', l: { pl: 'Rozmiar', en: 'Size' }, opts: [['half', { pl: 'Połówka (30)', en: 'Half (30)' }], ['full', { pl: 'Pełna (63)', en: 'Full (63)' }]] }],
  info: { pl: 'Otwory w każdej kolumnie (a–e oraz f–j) są ze sobą połączone. Szyny + i − biegną wzdłuż płytki. Układy scalone wpinaj nad środkowym rowkiem.', en: 'The holes in each column (a–e and f–j) are connected. The + and − rails run along the board. Place chips across the centre channel.' },
});

/* ====== PODSTAWOWE (z pierwszej wersji) ====== */
// rezystancja wewnętrzna (świeże ogniwa alkaliczne): AA ≈ 0,15 Ω na ogniwo, bateria 9 V (6LR61) ≈ 1,7 Ω, 12 V (8×AA) ≈ 1,2 Ω
const R_BAT_OF = { 1.5: 0.15, 3: 0.3, 4.5: 0.45, 9: 1.7, 12: 1.2 };
const rBat = c => R_BAT_OF[c.props.v] || 0.5;
def('battery', {
  cat: 'basic', name: { pl: 'Bateria', en: 'Battery' }, kw: 'bateria battery zasilanie 9v aa', props: { v: 9 }, gnd: 1,
  pins: [{ x: 0, y: 0, n: { pl: 'Plus (+)', en: 'Plus (+)' } }, { x: 40, y: 0, n: { pl: 'Minus (−)', en: 'Minus (−)' } }], bbox: [-14, -8, 54, 106],
  ui: [{ k: 'v', type: 'seg', l: { pl: 'Napięcie', en: 'Voltage' }, opts: [[1.5, '1,5 V'], [3, '3 V'], [4.5, '4,5 V'], [9, '9 V'], [12, '12 V']] }],
  info: { pl: 'Źródło napięcia stałego. Umownie prąd płynie od plusa (+) przez obwód do minusa (−).', en: 'A DC voltage source. Conventional current flows from plus (+) through the circuit to minus (−).' },
  draw(c, r) {
    // zaciski (+ i −) na górze obudowy, jak w prawdziwej baterii 9 V
    const v = c.props.v; return `<rect x="-6" y="-5" width="12" height="13" rx="2" fill="#b9c1ca" stroke="#6f7881"/><rect x="34" y="-5" width="12" height="13" rx="2" fill="#b9c1ca" stroke="#6f7881"/>` +
      `<rect x="-10" y="8" width="60" height="92" rx="7" fill="#2c3138" stroke="${r.short ? '#ff4d4d' : '#14171b'}" stroke-width="${r.short ? 4 : 2}" class="${r.short ? 'warnpulse' : ''}"/>` +
      `<rect x="-10" y="40" width="60" height="34" fill="#f4a51c"/>` + tx(20, 63, String(v).replace('.', DEC()) + ' V', { s: 15, w: 800, c: '#2a1a00', f: FONT_D }) +
      tx(0, 28, '+', { s: 14, c: '#ff8a80' }) + tx(40, 28, '−', { s: 14, c: '#c3ccd4' });
  },
  sim: {
    lin(d, S) { S.V(0, 1, d.c.props.v, rBat(d.c)); },
    commit(d) { const U = dVp(d, 0, 1), I = (d.c.props.v - U) / rBat(d.c); measure2(d, I); d.s.short = I > 0.5 * d.c.props.v / rBat(d.c); d.s.warn = d.s.short ? 'short' : null; },
  },
  readings: (c, r) => [['U', si(r.U, 'V')], ['I', si(r.I, 'A')], ['P', si(r.P, 'W')]],
});

def('resistor', {
  cat: 'basic', name: { pl: 'Rezystor', en: 'Resistor' }, kw: 'rezystor opornik resistor ohm', props: { r: 330, w: 0.25 },
  pins: [{ x: 0, y: 0, n: '1' }, { x: 80, y: 0, n: '2' }], bbox: [-4, -12, 84, 12],
  ui: [{ k: 'r', type: 'si', unit: 'Ω', l: { pl: 'Rezystancja', en: 'Resistance' }, min: 0.1, max: 1e8, presets: [1, 10, 47, 100, 220, 330, 470, 680, 1e3, 2.2e3, 4.7e3, 10e3, 47e3, 100e3, 470e3, 1e6, 10e6] },
    { k: 'w', type: 'seg', l: { pl: 'Moc znamionowa', en: 'Power rating' }, opts: [[0.125, '⅛ W'], [0.25, '¼ W'], [0.5, '½ W'], [1, '1 W'], [2, '2 W'], [5, '5 W']] },
    { type: 'bands' }],
  info: { pl: 'Ogranicza prąd. Prawo Ohma: I = U / R. Wartość odczytasz z kolorowych pasków. Moc wydzielana P = U · I nie może przekroczyć mocy znamionowej.', en: 'Limits current. Ohm\'s law: I = U / R. Read the value from the colour bands. Dissipated power P = U · I must stay below the rating.' },
  draw(c, r) {
    const b = bandsFor(c.props.r), big = c.props.w >= 1, h = big ? 12 : 8.5;
    let s = leg('M0 0H80') + `<rect x="${big ? 10 : 15}" y="${-h}" width="${big ? 60 : 50}" height="${2 * h}" rx="${h - 1}" fill="${r.burnt ? '#4a3a2a' : big ? '#b8c7d6' : '#e3c48f'}" stroke="${big ? '#7c8ea0' : '#a8885a'}"/>`;
    if (!big) s += [24, 32, 40].map((x, i) => `<rect x="${x}" y="-8" width="4.5" height="16" fill="${BANDS[b[i]][0]}"/>`).join('') + `<rect x="54" y="-8" width="4.5" height="16" fill="#c9a227"/>`;
    else s += tx(40, 3, siT(c.props.r, 'Ω'), { s: 8, c: '#20303f', f: FONT_M });
    if (r.burnt || r.hot) s += smoke(40, -14);
    return s;
  },
  sim: {
    lin(d, S) { if (!d.s.burnt) S.G(0, 1, 1 / Math.max(1e-3, d.c.props.r)); },
    commit(d, dt) {
      const U = dVp(d, 0, 1), I = d.s.burnt ? 0 : U / d.c.props.r; measure2(d, I);
      const over = d.s.P > d.c.props.w * 1.5; d.s.hot = d.s.P > d.c.props.w;
      d.s.ot = over ? (d.s.ot || 0) + dt : 0; if (d.s.ot > 1.5) { d.s.burnt = true; E.dirty = true; }
      d.s.warn = d.s.burnt ? 'resBurnt' : d.s.hot ? 'resHot' : null;
    },
  },
  readings: (c, r) => [['U', si(r.U, 'V')], ['I', si(r.I, 'A')], ['P', si(r.P, 'W') + ' / ' + String(c.props.w).replace('.', DEC()) + ' W']],
});

/* LED: dioda Shockleya z rezystancją szeregową (węzeł wewnętrzny) */
const LED_COL = {
  red: { n: { pl: 'czerwona', en: 'red' }, vf: 1.85, c: '#ff3b30', d: '#7a1f1a' }, yellow: { n: { pl: 'żółta', en: 'yellow' }, vf: 2.0, c: '#ffd60a', d: '#7a6500' },
  green: { n: { pl: 'zielona', en: 'green' }, vf: 2.1, c: '#3ddc63', d: '#1b6430' }, blue: { n: { pl: 'niebieska', en: 'blue' }, vf: 3.0, c: '#3b82ff', d: '#1c3a80' },
  white: { n: { pl: 'biała', en: 'white' }, vf: 3.0, c: '#f4f6ff', d: '#8d94a3' }, orange: { n: { pl: 'pomarańczowa', en: 'orange' }, vf: 1.95, c: '#ff8a1f', d: '#7a3d07' },
  ir: { n: { pl: 'podczerwona (IR)', en: 'infrared (IR)' }, vf: 1.25, c: '#b06cff', d: '#3c2a52' },
};
const ledIs = vf => 0.01 * Math.exp(-vf / (2 * VT));
const LED_RS = 12;
function ledSim(vfOf) {
  return {
    int: 1,
    lin(d, S) { if (!d.s.burnt) S.G(0, 2, 1 / LED_RS); },
    nl(d, v) { if (d.s.burnt) return [0, 0, 0]; const vf = vfOf(d.c), i = diodeI(v[2] - v[1], ledIs(vf), 2); return [0, -i, i]; },
    commit(d, dt) {
      const I = d.s.burnt ? 0 : (dV(d, 0) - dV(d, 2)) / LED_RS; measure2(d, I);
      const tgt = d.s.burnt ? 0 : clamp(I / 0.02, 0, 1); d.s.br = (d.s.br || 0) + (tgt - (d.s.br || 0)) * Math.min(1, dt / 0.02);
      if (I > 0.05) { d.s.bt = (d.s.bt || 0) + dt; if (d.s.bt > 0.12) { d.s.burnt = true; E.dirty = true; } } else d.s.bt = 0;
      d.s.rev = d.s.U < -0.5;
      d.s.warn = d.s.burnt ? 'ledBurnt' : I > 0.021 ? 'ledHot' : d.s.rev && d.c.type === 'led' ? 'ledRev' : null;
    },
  };
}
def('led', {
  cat: 'basic', name: { pl: 'Dioda LED', en: 'LED' }, kw: 'dioda led swiatlo light ir podczerwien infrared', props: { color: 'red' },
  pins: [{ x: 0, y: 0, n: { pl: 'Anoda (+, dłuższa nóżka)', en: 'Anode (+, longer leg)' } }, { x: 20, y: 0, n: { pl: 'Katoda (−)', en: 'Cathode (−)' } }], bbox: [-8, -56, 28, 6],
  ui: [{ k: 'color', type: 'swatch', l: { pl: 'Kolor', en: 'Colour' }, opts: Object.keys(LED_COL).map(k => [k, LED_COL[k].c, LED_COL[k].n]) }],
  info: { pl: 'Świeci, gdy prąd płynie od anody (+) do katody (−). Zawsze łącz ją z rezystorem. Dioda IR świeci niewidzialną podczerwienią (jak pilot TV).', en: 'Lights up when current flows from anode (+) to cathode (−). Always use a resistor. The IR LED emits invisible infrared light (like a TV remote).' },
  draw(c, r) {
    const Lc = LED_COL[c.props.color] || LED_COL.red; const b = r.burnt ? 0 : (r.br || 0); const ir = c.props.color === 'ir';
    const fill = r.burnt ? '#3b3b3b' : (b > 0.02 && !ir ? Lc.c : Lc.d);
    let s = ''; if (b > 0.02 && !ir) s += `<circle cx="10" cy="-34" r="38" fill="${glow(Lc.c)}" opacity="${Math.min(1, 0.25 + b * 0.9).toFixed(2)}"/>`;
    s += leg('M0 0V-6L-3 -10V-19') + leg('M20 0V-19') + `<path d="M-3 -19V-38A13 13 0 0 1 23 -38V-19Z" fill="${fill}" opacity=".92" stroke="rgba(0,0,0,.35)"/><rect x="-6" y="-23" width="32" height="5" rx="1.5" fill="${fill}" stroke="rgba(0,0,0,.35)"/><ellipse cx="3" cy="-40" rx="2.5" ry="6" fill="#fff" opacity=".45"/>`;
    if (b > 0.02 && !ir) s += `<circle cx="10" cy="-35" r="${4 + b * 4}" fill="#fff" opacity="${(0.4 + b * 0.5).toFixed(2)}"/>`;
    if (ir) s += tx(10, -30, 'IR', { s: 8, c: b > 0.02 ? '#e9d5ff' : '#a99cc0' }) + (b > 0.02 ? `<circle cx="10" cy="-34" r="${18 + b * 8}" fill="none" stroke="#b06cff" stroke-dasharray="3 4" opacity=".7"/>` : '');
    if (r.burnt) s += smoke(6, -60) + tx(10, -30, '×', { s: 16, c: '#ff6b6b' });
    return s + tx(-9, -1, '+', { s: 9, c: '#e9eef2' });
  },
  sim: ledSim(c => (LED_COL[c.props.color] || LED_COL.red).vf),
  readings: (c, r) => [['U', si(r.U, 'V')], ['I', si(r.I, 'A')], [{ pl: 'Stan', en: 'State' }, r.burnt ? { pl: 'przepalona', en: 'burnt out' } : r.br > 0.02 ? { pl: 'świeci', en: 'on' } : { pl: 'zgaszona', en: 'off' }]],
});

def('switch', {
  cat: 'basic', name: { pl: 'Przełącznik', en: 'Switch' }, kw: 'przelacznik wlacznik switch toggle', props: { closed: true },
  pins: [{ x: 0, y: 0, n: '1' }, { x: 40, y: 0, n: '2' }], bbox: [-10, -48, 50, 6],
  ui: [{ k: 'closed', type: 'seg', live: true, l: { pl: 'Stan', en: 'State' }, opts: [[true, { pl: 'Włączony', en: 'On' }], [false, { pl: 'Wyłączony', en: 'Off' }]] }],
  info: { pl: 'Zamyka albo otwiera obwód. W czasie symulacji kliknij go, żeby przełączyć.', en: 'Opens or closes the circuit. Click it during simulation to toggle.' },
  click: c => { c.props.closed = !c.props.closed; },
  draw(c) { const on = c.props.closed; return leg('M0 0V-12') + leg('M40 0V-12') + `<rect x="-8" y="-34" width="56" height="22" rx="4" fill="#3a3f47" stroke="#1d2024"/><rect x="4" y="-27" width="32" height="8" rx="4" fill="#15181c"/><rect x="${on ? 22 : 6}" y="-31" width="12" height="16" rx="3" fill="#e9edf2"/>` + tx(20, -38, on ? t('on') : t('off'), { s: 8, c: on ? '#7ee2a0' : '#c3ccd4' }); },
  sim: { lin(d, S) { if (d.c.props.closed) S.G(0, 1, 100); }, commit(d) { measure2(d, d.c.props.closed ? dVp(d, 0, 1) * 100 : 0); } },
});
def('button', {
  cat: 'basic', name: { pl: 'Przycisk', en: 'Push button' }, kw: 'przycisk button tact', props: {},
  pins: [{ x: 0, y: 0, n: '1' }, { x: 40, y: 0, n: '2' }], bbox: [-4, -44, 44, 6],
  info: { pl: 'Przycisk chwilowy: obwód jest zamknięty tylko wtedy, gdy go przytrzymujesz.', en: 'Momentary button: the circuit is closed only while you hold it.' },
  press: true,
  draw(c) { const p = c.props.pressed; return leg('M0 0V-8') + leg('M40 0V-8') + `<rect x="0" y="-40" width="40" height="32" rx="4" fill="#2e333a" stroke="#14171b"/><circle cx="20" cy="-24" r="${p ? 9.5 : 11}" fill="${p ? '#a92b1b' : '#e8473a'}" stroke="#7d1d12" stroke-width="1.5"/>`; },
  sim: { lin(d, S) { if (d.c.props.pressed) S.G(0, 1, 100); }, commit(d) { measure2(d, d.c.props.pressed ? dVp(d, 0, 1) * 100 : 0); } },
});
const potFrac = c => c.props.taper === 'log' ? (Math.pow(10, 2 * c.props.pos) - 1) / 99 : c.props.pos;
def('pot', {
  cat: 'basic', name: { pl: 'Potencjometr', en: 'Potentiometer' }, kw: 'potencjometr pokretlo potentiometer lin log glosnosc volume', props: { r: 10000, pos: 0.5, taper: 'lin' },
  pins: [{ x: 0, y: 0, n: 'A' }, { x: 20, y: 0, n: { pl: 'W (ślizgacz)', en: 'W (wiper)' } }, { x: 40, y: 0, n: 'B' }], bbox: [-10, -48, 50, 6],
  ui: [{ k: 'r', type: 'si', unit: 'Ω', l: { pl: 'Rezystancja całkowita', en: 'Total resistance' }, presets: [100, 1e3, 4.7e3, 10e3, 47e3, 100e3, 1e6] },
    { k: 'taper', type: 'seg', l: { pl: 'Charakterystyka', en: 'Taper' }, opts: [['lin', { pl: 'Liniowa (LIN)', en: 'Linear (LIN)' }], ['log', { pl: 'Logarytmiczna (LOG)', en: 'Logarithmic (LOG)' }]] },
    { k: 'pos', type: 'range', live: true, l: { pl: 'Pokrętło', en: 'Knob' }, min: 0, max: 1, step: 0.01, fmt: (v, c) => Math.round(v * 100) + '% · A–W = ' + siT(Math.round(c.props.r * potFrac(c)), 'Ω') }],
  info: { pl: 'Rezystor z pokrętłem. Ślizgacz dzieli opór na A–W i W–B. Logarytmiczny (LOG) stosuje się do regulacji głośności, bo ucho słyszy logarytmicznie.', en: 'A resistor with a knob. The wiper splits the resistance into A–W and W–B. Logarithmic (LOG) ones are used for volume, because hearing is logarithmic.' },
  wheel: (c, d) => { c.props.pos = clamp(c.props.pos + d, 0, 1); },
  draw(c) { const a = -135 + 270 * c.props.pos; return leg('M0 0V-10') + leg('M20 0V-10') + leg('M40 0V-10') + `<rect x="-6" y="-44" width="52" height="34" rx="5" fill="#2f5fb3" stroke="#183a75"/><g transform="translate(20 -27) rotate(${a.toFixed(1)})"><circle r="13" fill="#d9dde3" stroke="#8a9099"/><rect x="-1.5" y="-12" width="3" height="8" rx="1" fill="#2c3138"/></g>` + tx(0, -14, 'A', { s: 7 }) + tx(40, -14, 'B', { s: 7 }) + (c.props.taper === 'log' ? tx(20, -47, 'LOG', { s: 6, c: '#c8d6f0' }) : ''); },
  sim: {
    lin(d, S) { const f = potFrac(d.c), R = d.c.props.r; S.G(0, 1, 1 / Math.max(0.5, R * f)); S.G(1, 2, 1 / Math.max(0.5, R * (1 - f))); },
    commit(d) { d.s.U = dVp(d, 0, 2); d.s.I = dVp(d, 0, 1) / Math.max(0.5, d.c.props.r * potFrac(d.c)); d.s.P = Math.abs(d.s.U * d.s.I); },
  },
});
const fmtC = c => siT(c, 'F');
def('capacitor', {
  cat: 'basic', name: { pl: 'Kondensator elektrolityczny', en: 'Electrolytic capacitor' }, kw: 'kondensator elektrolityczny capacitor electrolytic uf', props: { c: 1000e-6, vmax: 25 },
  pins: [{ x: 0, y: 0, n: { pl: 'Plus (+)', en: 'Plus (+)' } }, { x: 20, y: 0, n: { pl: 'Minus (−)', en: 'Minus (−)' } }], bbox: [-8, -64, 28, 6],
  ui: [{ k: 'c', type: 'si', unit: 'F', l: { pl: 'Pojemność', en: 'Capacitance' }, presets: [1e-6, 10e-6, 47e-6, 100e-6, 220e-6, 470e-6, 1000e-6, 2200e-6, 4700e-6] },
    { k: 'vmax', type: 'seg', l: { pl: 'Napięcie maks.', en: 'Rated voltage' }, opts: [[16, '16 V'], [25, '25 V'], [50, '50 V'], [400, '400 V']] }],
  info: { pl: 'Gromadzi ładunek jak mały zbiornik. Ładuje się w czasie τ = R · C. Jest spolaryzowany: odwrotne podłączenie albo za wysokie napięcie go niszczy.', en: 'Stores charge like a small tank. Charges with time constant τ = R · C. It is polarised: reverse connection or overvoltage destroys it.' },
  draw(c, r) {
    const lv = clamp((r.U || 0) / c.props.vmax, 0, 1), bad = r.burst;
    return leg('M0 0V-14') + leg('M20 0V-14') + `<rect x="-4" y="-52" width="28" height="38" rx="5" fill="${bad ? '#4a4f5a' : '#1f4fa8'}" stroke="#102a5c"/><rect x="14" y="-52" width="8" height="38" fill="#cfd8e8"/>` + tx(18, -30, '−', { s: 9, c: '#1f4fa8' }) +
      `<rect x="-1" y="${-17 - 32 * lv}" width="4" height="${32 * lv}" fill="#f4a51c"/>` + tx(10, -56, fmtC(c.props.c), { s: 7.5, c: '#e9eef2', w: 500 }) + (bad ? smoke(10, -62) : '');
  },
  sim: {
    dyn: true,
    lin(d, S, dt) { if (d.s.burst) { S.G(0, 1, 1e-3); return; } const g = d.c.props.c / dt, v0 = d.s.vc || 0; S.G(0, 1, g); S.I(0, g * v0); S.I(1, -g * v0); },
    commit(d, dt) {
      const U = dVp(d, 0, 1), I = d.s.burst ? U * 1e-3 : d.c.props.c * (U - (d.s.vc || 0)) / dt; d.s.vc = U; measure2(d, I);
      const bad = U < -1.5 || U > d.c.props.vmax * 1.15; d.s.bt = bad ? (d.s.bt || 0) + dt : 0;
      if (d.s.bt > 0.8 && !d.s.burst) { d.s.burst = true; E.dirty = true; }
      d.s.warn = d.s.burst ? 'capBurst' : U < -1.5 ? 'capRev' : U > d.c.props.vmax ? 'capOver' : null;
    },
  },
});
// Żarówka: włókno wolframowe. R ∝ T^1,2 (zimne ma ok. 1/14 rezystancji gorącego), równowaga cieplna P ∝ T^4, stała czasowa ok. 40 ms
const BULBS = { '3.5-0.3': [3.5, 0.3], '6-0.2': [6, 0.2], '12-0.1': [12, 0.1], '12-5w': [12, 5 / 12] };
const bulbR = (c, T) => { const [v, i] = BULBS[c.props.rating] || BULBS['6-0.2']; return v / i * Math.pow(Math.max(0.1, T), 1.2); };
// Silnik DC typu 130 (1,5–6 V): R = 2,5 Ω, L = 0,4 mH, k = 0,0045 V·s/rad, prąd biegu jałowego ok. 0,12 A
const MOT = { R: 2.5, L: 4e-4, k: 0.0045, J: 6e-7, Tf: 0.0045 * 0.12, b: 2e-8 };
const R_BUZZ = 200;
def('bulb', {
  cat: 'basic', name: { pl: 'Żarówka', en: 'Light bulb' }, kw: 'zarowka bulb lampa lamp zarnik wolfram', props: { rating: '6-0.2' },
  ui: [{ k: 'rating', type: 'select', l: { pl: 'Typ', en: 'Type' }, opts: [['3.5-0.3', '3,5 V / 0,3 A'], ['6-0.2', '6 V / 0,2 A'], ['12-0.1', '12 V / 0,1 A'], ['12-5w', '12 V / 5 W']] }],
  pins: [{ x: 0, y: 0, n: '1' }, { x: 40, y: 0, n: '2' }], bbox: [-4, -82, 44, 6],
  info: { pl: 'Zamienia energię elektryczną w światło i ciepło. Zimne włókno ma ok. 14 razy mniejszą rezystancję niż rozgrzane, dlatego w chwili włączenia płynie duży prąd. Jasność rośnie bardzo szybko z napięciem (≈ U^3,4).', en: 'Turns electrical energy into light and heat. A cold filament has about 14 times lower resistance than a hot one, so a large current flows at switch-on. Brightness rises steeply with voltage (≈ U^3.4).' },
  draw(c, r) {
    const b = r.br || 0; let s = ''; if (b > 0.03) s += `<circle cx="20" cy="-54" r="58" fill="${glow('#ffd34d')}" opacity="${Math.min(1, 0.2 + b).toFixed(2)}"/>`;
    return s + leg('M0 0V-8L8 -14') + leg('M40 0V-8L32 -14') + `<rect x="6" y="-32" width="28" height="18" rx="2" fill="#9aa3ad"/><path d="M6 -26H34M6 -20H34" stroke="#6f7881"/>` +
      `<circle cx="20" cy="-54" r="22" fill="${b > 0.03 ? '#fff3bf' : '#dfe9ef'}" opacity=".88" stroke="#b6c3cc"/><path d="M14 -33V-50Q20 -60 26 -50V-33" stroke="${b > 0.03 ? '#ff9f1a' : '#6b6b6b'}" stroke-width="${1.4 + b * 1.4}" fill="none"/>`;
  },
  sim: {
    dyn: true,
    lin(d, S) { S.G(0, 1, d.s.burnt ? 1e-9 : 1 / bulbR(d.c, d.s.T || 0.11)); },
    commit(d, dt) {
      const T = d.s.T || 0.11, U = dVp(d, 0, 1), I = d.s.burnt ? 0 : U / bulbR(d.c, T); measure2(d, I);
      const [v, i] = BULBS[d.c.props.rating] || BULBS['6-0.2'], Pn = v * i;
      // C·dT/dt = P − σ·T⁴ (w jednostkach względnych, T = 1 przy pracy znamionowej)
      d.s.T = Math.max(0.11, T + dt / 0.04 * (d.s.P / Pn - Math.pow(T, 4) + Math.pow(0.11, 4)) / 4);
      d.s.br = clamp(Math.pow(Math.max(0, (d.s.T - 0.45) / 0.55), 4.5), 0, 1.3); d.s.R = U / (I || 1e-9);
      d.s.warn = d.s.burnt ? 'bulbBurnt' : d.s.P > Pn * 1.5 ? 'bulbOver' : null; if (d.s.P > Pn * 2.2) { d.s.bt = (d.s.bt || 0) + dt; if (d.s.bt > 0.3) { d.s.burnt = true; E.dirty = true; } }
    },
  },
  readings: (c, r) => [['U', si(r.U || 0, 'V')], ['I', si(r.I || 0, 'A')], ['P', si(r.P || 0, 'W')], ['R', si(r.R || bulbR(c, 0.11), 'Ω')]],
});
def('motor', {
  cat: 'basic', name: { pl: 'Silnik DC', en: 'DC motor' }, kw: 'silnik motor dc wentylator fan 130', props: {},
  pins: [{ x: 0, y: 0, n: '1' }, { x: 40, y: 0, n: '2' }], bbox: [-10, -92, 50, 6],
  info: { pl: 'Mały silnik szczotkowy typu 130 (1,5–6 V, ok. 6000 obr./min przy 3 V). Wirując, wytwarza siłę elektromotoryczną przeciwną do zasilania, dlatego przy starcie pobiera dużo prądu (ok. 1,2 A przy 3 V), a rozpędzony – mało (ok. 0,12 A). Gdy odwrócisz kierunek prądu, zakręci się w drugą stronę. Wyłączany silnik wytwarza szpilki napięcia – stosuj diodę gaszącą.', en: 'A small type-130 brushed motor (1.5–6 V, about 6000 rpm at 3 V). While spinning it generates a back-EMF opposing the supply, so it draws a lot of current at start-up (about 1.2 A at 3 V) and little once up to speed (about 0.12 A). Reverse the current and it spins the other way. A switched-off motor produces voltage spikes – use a flyback diode.' },
  draw(c, r) {
    const a = r.ang || 0; const bl = [0, 120, 240].map(dd => `<ellipse cx="0" cy="-12" rx="5" ry="13" fill="#f4a51c" stroke="#a66b00" transform="rotate(${dd})"/>`).join('');
    return leg('M0 0V-10') + leg('M40 0V-10') + `<rect x="-6" y="-50" width="52" height="40" rx="10" fill="#b8bfc7" stroke="#7d858e"/><rect x="38" y="-44" width="8" height="28" rx="3" fill="#8f979f"/>` + tx(18, -25, 'M', { s: 15, w: 800, c: '#3a4048', f: FONT_D }) +
      `<rect x="18" y="-60" width="4" height="10" fill="#7a7f86"/><g transform="translate(20 -66) rotate(${(a % 360).toFixed(1)})">${bl}<circle r="4.5" fill="#3a4048"/></g>`;
  },
  sim: {
    dyn: true,
    // gałąź R + L + SEM (k·ω), całkowanie niejawne: i = g·(u − k·ω) + g·(L/dt)·i₀
    lin(d, S, dt) { const g = 1 / (MOT.R + MOT.L / dt), J = g * (-MOT.k * (d.s.w || 0) + MOT.L / dt * (d.s.il || 0)); S.G(0, 1, g); S.I(0, -J); S.I(1, J); },
    commit(d, dt) {
      const g = 1 / (MOT.R + MOT.L / dt), w0 = d.s.w || 0, U = dVp(d, 0, 1);
      const i = g * (U - MOT.k * w0) + g * MOT.L / dt * (d.s.il || 0); d.s.il = i; measure2(d, i);
      const Tm = MOT.k * i; let w = w0;
      if (Math.abs(w0) < 1 && Math.abs(Tm) <= MOT.Tf) w = 0; // tarcie statyczne
      else w = w0 + dt / MOT.J * (Tm - MOT.Tf * Math.sign(w0 || Tm) - MOT.b * w0);
      d.s.w = w; d.s.rpm = w * 60 / (2 * Math.PI);
      d.s.ang = ((d.s.ang || 0) + clamp(w * 180 / Math.PI, -1500, 1500) * dt) % 360;
      d.s.warn = Math.abs(U) > 9 ? 'motorOver' : null;
    },
  },
  readings: (c, r) => [['U', si(r.U || 0, 'V')], ['I', si(r.I || 0, 'A')], [{ pl: 'Obroty', en: 'Speed' }, Math.round(r.rpm || 0) + ' ' + ({ pl: 'obr./min', en: 'rpm' })[LANG]]],
});
def('buzzer', {
  cat: 'basic', name: { pl: 'Brzęczyk', en: 'Buzzer' }, kw: 'brzeczyk buzzer glosnik dzwiek sound', props: {},
  pins: [{ x: 0, y: 0, n: { pl: 'Plus (+)', en: 'Plus (+)' } }, { x: 20, y: 0, n: { pl: 'Minus (−)', en: 'Minus (−)' } }], bbox: [-12, -50, 40, 6],
  info: { pl: 'Brzęczyk aktywny (z wbudowanym generatorem ok. 2,3 kHz): piszczy, gdy podasz napięcie stałe 3–8 V od plusa do minusa. Przy 5 V pobiera ok. 25 mA. Odwrotnie podłączony nie działa.', en: 'Active buzzer (built-in oscillator, about 2.3 kHz): beeps when you apply 3–8 V DC from plus to minus. Draws about 25 mA at 5 V. It does nothing when connected backwards.' },
  draw(c, r) {
    let s = leg('M0 0V-9') + leg('M20 0V-9') + `<circle cx="10" cy="-28" r="19" fill="#1e2125" stroke="#000"/><circle cx="10" cy="-28" r="5" fill="#000" stroke="#444"/>` + tx(-1, -40, '+', { s: 9 });
    if (r.active) { const ph = (performance.now() / 500) % 1; s += [0, 1, 2].map(i => { const k = (ph + i / 3) % 1; return `<path d="M${30 + k * 10} ${-38 - k * 4} q${6 + k * 4} ${10 + k * 4} 0 ${20 + k * 8}" stroke="#f4a51c" stroke-width="2" fill="none" opacity="${(1 - k).toFixed(2)}"/>`; }).join(''); }
    return s;
  },
  sim: {
    nl(d, v) { const u = v[0] - v[1]; const i = softplus(u - 0.6, 0.05) / R_BUZZ + u * 1e-7; return [i, -i]; },
    commit(d) { const U = dVp(d, 0, 1); measure2(d, d.ip ? d.ip[0] : 0); d.s.active = U > 2.8; d.s.warn = U > 9 ? 'buzzOver' : U < -0.5 ? 'buzzRev' : null; },
  },
});
def('mm', {
  cat: 'basic', name: { pl: 'Multimetr', en: 'Multimeter' }, kw: 'multimetr miernik woltomierz amperomierz omomierz multimeter voltmeter ammeter ohmmeter', props: { mode: 'V' },
  pins: [{ x: 0, y: 0, n: { pl: 'Gniazdo + (V/A/Ω)', en: '+ jack (V/A/Ω)' } }, { x: 40, y: 0, n: { pl: 'Gniazdo COM (−)', en: 'COM jack (−)' } }], bbox: [-24, -130, 64, 6],
  ui: [{ k: 'mode', type: 'seg', live: true, l: { pl: 'Tryb pomiaru', en: 'Mode' }, opts: [['V', { pl: 'Napięcie (V)', en: 'Voltage (V)' }], ['A', { pl: 'Prąd (A)', en: 'Current (A)' }], ['O', { pl: 'Opór (Ω)', en: 'Resistance (Ω)' }]] }],
  info: { pl: 'Woltomierz podłączasz równolegle do elementu, amperomierz szeregowo (w przerwie obwodu), a omomierz do elementu odłączonego od zasilania.', en: 'Connect a voltmeter in parallel, an ammeter in series (in a break of the circuit), and an ohmmeter to a component that is not powered.' },
  draw(c, r) {
    const m = c.props.mode; let val = '- - -';
    if (r.U !== undefined) val = m === 'V' ? si(r.U, 'V') : m === 'A' ? si(r.I, 'A') : (r.R > 2e7 || r.R < 0 ? 'OL' : si(r.R, 'Ω'));
    const ang = m === 'V' ? -45 : m === 'A' ? 45 : 0;
    return leg('M0 0V-22', '#e5484d') + leg('M40 0V-22', '#2a2a2a') + `<rect x="-22" y="-128" width="84" height="112" rx="10" fill="#f4a51c" stroke="#a66b00" stroke-width="2"/><rect x="-14" y="-120" width="68" height="30" rx="3" fill="#b8c7a3" stroke="#6f7d5c"/>` +
      tx(20, -100, val, { s: 11.5, w: 500, c: '#1f2a17', f: FONT_M }) + `<circle cx="20" cy="-62" r="15" fill="#2b2f36"/><rect x="18.5" y="-76" width="3" height="11" rx="1.5" fill="#f4a51c" transform="rotate(${ang} 20 -62)"/>` +
      tx(-4, -66, 'V', { s: 10, c: m === 'V' ? '#2a1a00' : '#7a5410', w: 800 }) + tx(44, -66, 'A', { s: 10, c: m === 'A' ? '#2a1a00' : '#7a5410', w: 800 }) + tx(20, -82, 'Ω', { s: 8, c: m === 'O' ? '#2a1a00' : '#7a5410', w: 800 }) +
      `<circle cx="0" cy="-30" r="5" fill="#e5484d" stroke="#5a1416"/><circle cx="40" cy="-30" r="5" fill="#2a2a2a" stroke="#000"/>` + tx(0, -38, '+', { s: 8, c: '#2a1a00' }) + tx(40, -38, 'COM', { s: 7, c: '#2a1a00' });
  },
  sim: {
    lin(d, S) { const m = d.c.props.mode; if (m === 'A') S.G(0, 1, 100); else if (m === 'V') S.G(0, 1, 1e-7); else S.V(0, 1, 2, 2000); },
    commit(d) { const U = dVp(d, 0, 1), m = d.c.props.mode; d.s.U = U; d.s.I = m === 'A' ? U * 100 : m === 'V' ? U * 1e-7 : (2 - U) / 2000; d.s.R = m === 'O' ? (U >= 1.999 ? Infinity : U / ((2 - U) / 2000)) : 0; d.s.P = 0; },
  },
  readings: (c, r) => c.props.mode === 'O' ? [['R', r.R > 2e7 ? 'OL' : si(r.R, 'Ω')]] : [['U', si(r.U, 'V')], ['I', si(r.I, 'A')]],
});

/* ====== ZASILANIE I PRZYRZĄDY ====== */
def('dcsupply', {
  cat: 'src', name: { pl: 'Zasilacz laboratoryjny DC', en: 'Bench DC power supply' }, kw: 'zasilacz laboratoryjny power supply dc ograniczenie pradu current limit', props: { v: 5, ilim: 1 }, gnd: 1,
  pins: [{ x: 0, y: 0, n: '+' }, { x: 40, y: 0, n: '−' }], bbox: [-40, -122, 80, 6],
  ui: [{ k: 'v', type: 'range', live: true, l: { pl: 'Napięcie', en: 'Voltage' }, min: 0, max: 30, step: 0.1, fmt: v => dec(v, 1) + ' V' },
    { k: 'ilim', type: 'range', live: true, l: { pl: 'Ograniczenie prądu', en: 'Current limit' }, min: 0.01, max: 3, step: 0.01, fmt: v => si(v, 'A') }],
  info: { pl: 'Regulowane źródło 0–30 V z ograniczeniem prądu. Gdy obwód pobiera za dużo, zasilacz przechodzi w tryb CC (stały prąd) i obniża napięcie – chroni elementy.', en: 'Adjustable 0–30 V source with current limit. If the circuit draws too much, the supply enters CC mode (constant current) and lowers the voltage to protect parts.' },
  draw(c, r) {
    const cc = r.cc; return leg('M0 0V-18', '#e5484d') + leg('M40 0V-18', '#2a2a2a') +
      `<rect x="-38" y="-120" width="116" height="102" rx="8" fill="#d9dee4" stroke="#7d868f" stroke-width="2"/><rect x="-30" y="-112" width="100" height="44" rx="4" fill="#101418"/>` +
      tx(-24, -94, dec(r.U !== undefined ? r.U : c.props.v, 2) + ' V', { a: 'start', s: 13, c: '#ff5a4d', f: FONT_M, w: 500 }) + tx(-24, -76, si(r.I || 0, 'A'), { a: 'start', s: 11, c: '#5ef08a', f: FONT_M, w: 500 }) +
      tx(60, -94, 'CV', { s: 7, c: cc ? '#4a5560' : '#5ef08a' }) + tx(60, -78, 'CC', { s: 7, c: cc ? '#ff5a4d' : '#4a5560' }) +
      `<circle cx="-12" cy="-44" r="10" fill="#3a4048"/><circle cx="56" cy="-44" r="10" fill="#3a4048"/><circle cx="0" cy="-28" r="5" fill="#e5484d"/><circle cx="40" cy="-28" r="5" fill="#2a2a2a"/>` + tx(20, -44, 'DC', { s: 9, c: '#3a4048', w: 800 });
  },
  sim: {
    lin(d, S) { const p = d.c.props; if (d.s.cc) { S.I(0, p.ilim); S.I(1, -p.ilim); S.G(0, 1, 1e-4); } else S.V(0, 1, p.v, 0.01); },
    post(d) { const p = d.c.props, U = dVp(d, 0, 1); const I = d.s.cc ? p.ilim : (p.v - U) / 0.01; let cc = d.s.cc; if (!cc && I > p.ilim) cc = true; else if (cc && U > p.v) cc = false; if (cc !== d.s.cc) { d.s.cc = cc; d.s.flips = (d.s.flips || 0) + 1; return d.s.flips < 6; } return false; },
    commit(d) { d.s.flips = 0; const p = d.c.props, U = dVp(d, 0, 1); d.s.U = U; d.s.I = d.s.cc ? p.ilim - U * 1e-4 : (p.v - U) / 0.01; d.s.P = U * d.s.I; },
  },
});
function wave(c, tt) {
  const p = c.props, ph = (tt * p.f) % 1;
  const w = p.wave === 'square' ? (ph < 0.5 ? 1 : -1) : p.wave === 'tri' ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : Math.sin(2 * Math.PI * ph);
  return p.off + p.amp * w;
}
def('fgen', {
  cat: 'src', name: { pl: 'Generator funkcyjny', en: 'Function generator' }, kw: 'generator funkcyjny sygnal sinus prostokat trojkat function generator signal sine square', props: { wave: 'sine', f: 50, amp: 5, off: 0 }, gnd: 1,
  pins: [{ x: 0, y: 0, n: 'OUT' }, { x: 40, y: 0, n: 'COM' }], bbox: [-40, -112, 80, 6],
  ui: [{ k: 'wave', type: 'seg', live: true, l: { pl: 'Przebieg', en: 'Waveform' }, opts: [['sine', { pl: 'Sinus', en: 'Sine' }], ['square', { pl: 'Prostokąt', en: 'Square' }], ['tri', { pl: 'Trójkąt', en: 'Triangle' }]] },
    { k: 'f', type: 'si', unit: 'Hz', l: { pl: 'Częstotliwość', en: 'Frequency' }, presets: [0.5, 1, 5, 10, 50, 100, 500, 1000, 5000] },
    { k: 'amp', type: 'range', live: true, l: { pl: 'Amplituda', en: 'Amplitude' }, min: 0, max: 15, step: 0.1, fmt: v => dec(v, 1) + ' V' },
    { k: 'off', type: 'range', live: true, l: { pl: 'Przesunięcie (offset)', en: 'Offset' }, min: -10, max: 10, step: 0.1, fmt: v => dec(v, 1) + ' V' }],
  info: { pl: 'Wytwarza napięcie zmienne o zadanym kształcie. Połącz z oscyloskopem, żeby zobaczyć przebieg.', en: 'Produces an alternating voltage of a chosen shape. Connect an oscilloscope to see it.' },
  draw(c, r) {
    const p = c.props; let path = ''; for (let i = 0; i <= 40; i++) { const y = wave({ props: { ...p, amp: 1, off: 0, f: 1 } }, i / 40); path += (i ? 'L' : 'M') + (-28 + i * 2.2) + ' ' + (-80 - y * 12); }
    return leg('M0 0V-18', '#e5484d') + leg('M40 0V-18', '#2a2a2a') + `<rect x="-38" y="-110" width="116" height="92" rx="8" fill="#2f3a46" stroke="#121820" stroke-width="2"/><rect x="-32" y="-104" width="104" height="48" rx="3" fill="#0d2a26"/><path d="${path}" stroke="#4ef0c2" stroke-width="1.6" fill="none"/>` +
      tx(56, -95, siT(p.f, 'Hz'), { s: 6.5, c: '#9fe8d6', f: FONT_M, w: 500 }) + tx(56, -62, dec(p.amp, 1) + 'V', { s: 6.5, c: '#9fe8d6', f: FONT_M, w: 500 }) +
      `<circle cx="0" cy="-30" r="5" fill="#e5484d"/><circle cx="40" cy="-30" r="5" fill="#2a2a2a"/>` + tx(20, -40, 'GEN', { s: 7, c: '#c6d2de' });
  },
  sim: { dyn: true, maxDt: c => clamp(1 / (c.props.f * 60), 5e-6, 1e-3), lin(d, S) { S.V(0, 1, wave(d.c, E.t), 50); }, commit(d) { d.s.U = dVp(d, 0, 1); d.s.I = (wave(d.c, E.t) - d.s.U) / 50; d.s.P = 0; } },
});
def('mains', {
  cat: 'src', name: { pl: 'Gniazdo sieciowe 230 V AC', en: 'Mains outlet 230 V AC' }, kw: 'siec 230v ac gniazdko mains outlet zmienny', props: {}, gnd: 1,
  pins: [{ x: 0, y: 0, n: { pl: 'L (faza)', en: 'L (live)' } }, { x: 40, y: 0, n: { pl: 'N (neutralny)', en: 'N (neutral)' } }], bbox: [-30, -104, 70, 6],
  info: { pl: 'Napięcie sieciowe 230 V, 50 Hz (szczyt ok. 325 V). Tylko w symulatorze! W prawdziwym życiu nigdy nie podłączaj niczego do gniazdka bez nadzoru elektryka – grozi śmiercią.', en: '230 V, 50 Hz mains (peak about 325 V). Simulator only! In real life never connect anything to a wall socket without a qualified electrician – it can kill.' },
  draw(c, r) {
    return leg('M0 0V-16', '#8b5a2b') + leg('M40 0V-16', '#3d7bf2') + `<rect x="-28" y="-100" width="96" height="84" rx="12" fill="#f2f2ee" stroke="#9a9a94" stroke-width="2"/><circle cx="20" cy="-62" r="28" fill="#e2e2dc" stroke="#b5b5ae"/><circle cx="8" cy="-62" r="4.5" fill="#333"/><circle cx="32" cy="-62" r="4.5" fill="#333"/>` +
      `<path d="M50 -96 l8 0 l-6 10 l6 0 l-12 14 l3 -10 l-5 0z" fill="${r.trip ? '#999' : '#e5484d'}"/>` + tx(20, -24, r.trip ? t('fuseTripped') : '230 V ~', { s: 8, c: r.trip ? '#d6453d' : '#555' });
  },
  sim: {
    dyn: true, maxDt: () => 1 / (50 * 80),
    lin(d, S) { if (d.s.trip) { S.G(0, 1, 1e-9); return; } S.V(0, 1, 325.27 * Math.sin(2 * Math.PI * 50 * E.t), 0.4); },
    commit(d) { const U = dVp(d, 0, 1), I = d.s.trip ? 0 : (325.27 * Math.sin(2 * Math.PI * 50 * E.t) - U) / 0.4; measure2(d, I); if (Math.abs(I) > 25) { d.s.trip = true; E.dirty = true; } d.s.warn = d.s.trip ? 'fuse' : null; },
  },
});
/* oscyloskop 2-kanałowy */
def('scope', {
  cat: 'src', name: { pl: 'Oscyloskop', en: 'Oscilloscope' }, kw: 'oscyloskop przebieg wykres oscilloscope scope waveform', props: { tb: 0.005, v1: 2, v2: 2 }, gnd: 2,
  pins: [{ x: 0, y: 0, n: 'CH1' }, { x: 40, y: 0, n: 'CH2' }, { x: 80, y: 0, n: 'GND' }], bbox: [-60, -170, 140, 6],
  ui: [{ k: 'tb', type: 'select', l: { pl: 'Podstawa czasu (na działkę)', en: 'Timebase (per div)' }, opts: [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5].map(v => [v, siT(v, 's')]) },
    { k: 'v1', type: 'select', l: { pl: 'CH1 (na działkę)', en: 'CH1 (per div)' }, opts: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map(v => [v, siT(v, 'V')]) },
    { k: 'v2', type: 'select', l: { pl: 'CH2 (na działkę)', en: 'CH2 (per div)' }, opts: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map(v => [v, siT(v, 'V')]) }],
  info: { pl: 'Pokazuje, jak napięcie zmienia się w czasie. Kanał CH1 (żółty) i CH2 (błękitny) mierzą względem GND. Ekran ma 10 działek w poziomie.', en: 'Shows how voltage changes over time. CH1 (yellow) and CH2 (cyan) are measured against GND. The screen is 10 divisions wide.' },
  draw(c, r) {
    const W = 180, H = 120, x0 = -50, y0 = -160; let s = leg('M0 0V-22', '#f2d33c') + leg('M40 0V-22', '#3fd0e8') + leg('M80 0V-22', '#2a2a2a');
    s += `<rect x="-58" y="-168" width="196" height="146" rx="8" fill="#39424c" stroke="#161b20" stroke-width="2"/><rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="#06120f"/>`;
    for (let i = 1; i < 10; i++) s += `<line x1="${x0 + i * W / 10}" y1="${y0}" x2="${x0 + i * W / 10}" y2="${y0 + H}" stroke="#1f3a33" stroke-width="${i === 5 ? 1 : 0.6}"/>`;
    for (let i = 1; i < 8; i++) s += `<line x1="${x0}" y1="${y0 + i * H / 8}" x2="${x0 + W}" y2="${y0 + i * H / 8}" stroke="#1f3a33" stroke-width="${i === 4 ? 1 : 0.6}"/>`;
    const buf = r.buf;
    if (buf && buf.n > 1) {
      const span = c.props.tb * 10, tEnd = buf.tEnd, tStart = tEnd - span;
      for (const [ch, col, vd] of [[1, '#f2d33c', c.props.v1], [2, '#3fd0e8', c.props.v2]]) {
        let pth = '', k = 0;
        for (let i = 0; i < buf.n; i++) {
          const j = (buf.i - buf.n + i + buf.N) % buf.N, tt = buf.t[j]; if (tt < tStart - 1e-12) continue;
          const v = ch === 1 ? buf.a[j] : buf.b[j];
          const x = x0 + (tt - tStart) / span * W, y = clamp(y0 + H / 2 - v / vd * (H / 8), y0, y0 + H);
          pth += (k++ ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        }
        if (k > 1) s += `<path d="${pth}" stroke="${col}" stroke-width="1.4" fill="none"/>`;
      }
    }
    s += tx(x0 + 2, y0 + H + 10, 'CH1 ' + siT(c.props.v1, 'V'), { a: 'start', s: 6.5, c: '#f2d33c', f: FONT_M, w: 500 }) + tx(x0 + 70, y0 + H + 10, 'CH2 ' + siT(c.props.v2, 'V'), { a: 'start', s: 6.5, c: '#3fd0e8', f: FONT_M, w: 500 }) + tx(x0 + W, y0 + H + 10, siT(c.props.tb, 's') + '/div', { a: 'end', s: 6.5, c: '#d6dde4', f: FONT_M, w: 500 });
    return s;
  },
  sim: {
    lin(d, S) { S.G(0, 2, 1e-6); S.G(1, 2, 1e-6); },
    commit(d) {
      let b = d.s.buf; const N = 3000; if (!b) b = d.s.buf = { N, i: 0, n: 0, t: new Float64Array(N), a: new Float32Array(N), b: new Float32Array(N), tEnd: 0 };
      const span = d.c.props.tb * 10, every = span / 600;
      if (E.t - (b.last || -1) < every) return; b.last = E.t;
      b.t[b.i] = E.t; b.a[b.i] = dVp(d, 0, 2); b.b[b.i] = dVp(d, 1, 2); b.i = (b.i + 1) % N; b.n = Math.min(N, b.n + 1);
      // wyzwalanie: zbocze narastające CH1 przez poziom średni
      if (E.t - (b.tEnd || 0) >= span) {
        let lo = Infinity, hi = -Infinity; for (let k = 0; k < b.n; k++) { const v = b.a[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
        const lvl = (lo + hi) / 2; let trig = null;
        for (let k = b.n - 2; k >= 1; k--) { const j = (b.i - b.n + k + N) % N, j0 = (j - 1 + N) % N; if (b.a[j0] < lvl && b.a[j] >= lvl && E.t - b.t[j] >= span * 0.5 && hi - lo > 0.05) { trig = b.t[j]; break; } }
        b.tEnd = trig !== null ? trig + span * 0.5 : E.t;
      }
    },
  },
  readings: (c, r) => [],
});
