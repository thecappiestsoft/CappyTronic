'use strict';
/* ================= EKSPORT / IMPORT: JSON i KiCad =================
   Eksport: schemat .kicad_sch (format KiCad 7 – otwierają go też KiCad 8, 9 i 10) oraz netlista .net do edytora PCB.
   Import: .kicad_sch (połączenia liczone z przewodów, etykiet i symboli zasilania) oraz .net. */

/* ---------- S-wyrażenia ---------- */
function sxParse(src) {
  let i = 0; const n = src.length;
  function skip() { while (i < n) { const c = src[i]; if (c === ' ' || c === '\n' || c === '\r' || c === '\t') i++; else break; } }
  function atom() {
    if (src[i] === '"') { i++; let s = ''; while (i < n && src[i] !== '"') { if (src[i] === '\\') { i++; const e = src[i]; s += e === 'n' ? '\n' : e; i++; continue; } s += src[i++]; } i++; return { s }; }
    let s = ''; while (i < n && !/[\s()]/.test(src[i])) s += src[i++]; return s;
  }
  function list() { i++; const out = []; for (;;) { skip(); if (i >= n) return out; if (src[i] === ')') { i++; return out; } out.push(src[i] === '(' ? list() : atom()); } }
  skip(); if (src[i] !== '(') throw new Error('not an s-expression'); return list();
}
const sxv = a => a && typeof a === 'object' && !Array.isArray(a) ? a.s : a;
const sxFind = (l, k) => l.find(x => Array.isArray(x) && x[0] === k);
const sxAll = (l, k) => l.filter(x => Array.isArray(x) && x[0] === k);
const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
const mm = v => (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '') || '0';

/* ---------- sieci obwodu (jak w symulatorze) ---------- */
const KI_SKIP = new Set(['bb', 'mm', 'scope', 'fgen']);
function kiNets() {
  const par = new Map(); const f = k => { let p = par.get(k); if (p === undefined) { par.set(k, k); return k; } if (p === k) return k; const r = f(p); par.set(k, r); return r; };
  const un = (a, b) => { a = f(a); b = f(b); if (a !== b) par.set(a, b); };
  const K = (c, t2) => c + ':' + t2;
  for (const w of S.wires) if (byId(w.a.c) && byId(w.b.c)) un(K(w.a.c, w.a.t), K(w.b.c, w.b.t));
  const pos = new Map();
  for (const c of S.comps) {
    const pins = pinsOf(c);
    for (let i = 0; i < pins.length; i++) { const k = K(c.id, i); f(k); if (c.type === 'bb') un(k, 'g' + c.id + bbTerms(c)[i].g); const p = pinPos(c, i), pk = Math.round(p[0]) + ',' + Math.round(p[1]); const prev = pos.get(pk); if (prev) un(prev, k); else pos.set(pk, k); }
    const P = PARTS[c.type]; if (P.bridges) for (const [a, b] of P.bridges(c)) un(K(c.id, a), K(c.id, b));
  }
  return { root: (c, i) => f(K(c.id, i)) };
}
const KI_REF = { resistor: 'R', res_net: 'RN', pot: 'RV', capacitor: 'C', cap_cer: 'C', inductor: 'L', transformer: 'T', led: 'D', led_rgb: 'D', ws2812: 'D', switch: 'SW', button: 'SW', buzzer: 'BZ', motor: 'M', bulb: 'LA', battery: 'BT', relay: 'K', servo: 'M', dcsupply: 'J', mains: 'J' };
function kiRefPrefix(P) {
  if (KI_REF[P.id]) return KI_REF[P.id];
  if (P.cat === 'diode') return 'D'; if (P.cat === 'bjt' || P.cat === 'fet' || P.cat === 'thy') return 'Q';
  if (P.cat === 'mcu' && P.py) return 'A'; if (P.id.startsWith('ard_')) return 'A';
  if (P.cat === 'seg') return 'DS';
  if (P.pk || /^(lcd|oled|nokia|st7920|tft_|rtc_ds3231|adc_ads|dac_|usb_|eth_|can_|dcdc_)/.test(P.id)) return 'M';
  return 'U';
}
const kiNum = v => String(+v.toPrecision(3)).replace(/\.0+$/, '');
function kiFmt(v, unit) { for (const [m, p] of [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']]) if (Math.abs(v) >= m * 0.9999) { const s = kiNum(v / m); return unit === 'R' && p === '' ? s : s + p; } return String(v); }
function kiValue(c) {
  const P = PARTS[c.type], p = c.props;
  switch (c.type) {
    case 'resistor': return kiFmt(p.r, 'R'); case 'pot': return kiFmt(p.r, 'R'); case 'res_net': return kiFmt(p.r, 'R') + ' x' + p.n;
    case 'capacitor': case 'cap_cer': return kiFmt(p.c) + 'F'; case 'inductor': return kiFmt(p.l) + 'H';
    case 'battery': return String(p.v).replace(',', '.') + 'V'; case 'dcsupply': return 'DC ' + p.v + 'V'; case 'mains': return 'AC 230V';
    case 'led': return 'LED_' + p.color; case 'relay': return 'Relay_' + p.v + 'V';
    case 'reg_78xx': return '78' + String(p.v).padStart(2, '0'); case 'reg_79xx': return '79' + String(p.v).padStart(2, '0');
  }
  if (p.model) return p.model;
  return L(P.name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
}
const FP_HDR = n => `Connector_PinHeader_2.54mm:PinHeader_1x${String(n).padStart(2, '0')}_P2.54mm_Vertical`;
function kiFootprint(c) {
  const P = PARTS[c.type], p = c.props, np = pinsOf(c).length;
  switch (c.type) {
    case 'resistor': return p.w >= 2 ? 'Resistor_THT:R_Axial_DIN0414_L11.9mm_D4.5mm_P15.24mm_Horizontal' : p.w >= 1 ? 'Resistor_THT:R_Axial_DIN0411_L9.9mm_D3.6mm_P12.70mm_Horizontal' : p.w >= 0.5 ? 'Resistor_THT:R_Axial_DIN0309_L9.0mm_D3.2mm_P12.70mm_Horizontal' : 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal';
    case 'res_net': return 'Resistor_THT:R_Array_SIP' + (p.n + 1);
    case 'pot': return 'Potentiometer_THT:Potentiometer_Bourns_3386P_Vertical';
    case 'capacitor': return 'Capacitor_THT:CP_Radial_D8.0mm_P3.50mm';
    case 'cap_cer': return 'Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm';
    case 'led': return 'LED_THT:LED_D5.0mm';
    case 'buzzer': return 'Buzzer_Beeper:Buzzer_12x9.5RM7.6';
    case 'button': return 'Button_Switch_THT:SW_PUSH_6mm';
    case 'mains': return 'TerminalBlock:TerminalBlock_bornier-2_P5.08mm';
    case 'battery': case 'dcsupply': case 'switch': case 'motor': case 'bulb': case 'servo': case 'ws2812': return FP_HDR(np);
    case 'd_1n4148': case 'd_zener': return 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal';
    case 'd_1n400x': return 'Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal';
    case 'd_schottky': return p.model === 'BAT54' ? 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal' : 'Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal';
    case 'q_2n3055': return 'Package_TO_SOT_THT:TO-3';
  }
  if (P.cat === 'bjt' || P.cat === 'fet' || P.cat === 'thy' || c.type === 'ref_tl431') return np === 3 && Array.isArray(P.bbox) && P.bbox[1] <= -80 ? 'Package_TO_SOT_THT:TO-220-3_Vertical' : 'Package_TO_SOT_THT:TO-92_Inline';
  if (/^reg_/.test(c.type)) return 'Package_TO_SOT_THT:TO-220-3_Vertical';
  if (pinsOf(c).every(x => x.num) && !P.mcu && !P.py && P.cat !== 'seg' && pinsOf(c).some(x => x.y < 0)) return `Package_DIP:DIP-${np}_W7.62mm`;
  if (c.type === 'mcu_m328p') return 'Package_DIP:DIP-28_W7.62mm';
  if (c.type === 'mcu_t85') return 'Package_DIP:DIP-8_W7.62mm';
  if (P.pk && np <= 40) return FP_HDR(np);
  return '';
}
// numery wyprowadzeń w KiCad: jak w obudowie (DIP), dla diod 1 = katoda, 2 = anoda
function kiPinNums(c) {
  const P = PARTS[c.type], pins = pinsOf(c);
  if (c.type === 'led' || P.cat === 'diode' && pins.length === 2) return ['2', '1'];
  return pins.map((p, i) => String(p.num || i + 1));
}
function kiPinName(c, i) { const p = pinsOf(c)[i]; let s = p.s || (typeof p.n === 'string' ? p.n : L(p.n)); s = String(s).replace(/^\d+:\s*/, ''); return s.length > 14 ? s.slice(0, 14) : s; }

/* ---------- symbole ---------- */
const FONT = '(effects (font (size 1.27 1.27)))', FONTH = '(effects (font (size 1.27 1.27)) hide)';
const STROKE = '(stroke (width 0.254) (type default))';
const poly = (pts, fill) => `(polyline (pts ${pts.map(p => `(xy ${mm(p[0])} ${mm(p[1])})`).join(' ')}) ${STROKE} (fill (type ${fill || 'none'})))`;
const pinS = (x, y, ang, len, name, num) => `(pin passive line (at ${mm(x)} ${mm(y)} ${ang}) (length ${mm(len)}) (name ${q(name || '~')} ${FONT}) (number ${q(num)} ${FONT}))`;
// szablony graficzne dla elementów dwójnikowych (oś pozioma, piny w (-3.81,0) i (3.81,0))
const KI_SHAPES = {
  R: () => `(rectangle (start -2.54 1.016) (end 2.54 -1.016) ${STROKE} (fill (type none)))`,
  C: () => poly([[-0.635, 2.032], [-0.635, -2.032]]) + poly([[0.635, 2.032], [0.635, -2.032]]),
  CP: () => poly([[-0.635, 2.032], [-0.635, -2.032]]) + `(rectangle (start 0.635 2.032) (end 1.27 -2.032) ${STROKE} (fill (type outline)))` + poly([[-2.032, 1.524], [-1.524, 1.524]]) + poly([[-1.778, 1.778], [-1.778, 1.27]]),
  L: () => { let s = ''; for (let k = 0; k < 4; k++) { const x0 = -2.54 + k * 1.27; s += `(arc (start ${mm(x0)} 0) (mid ${mm(x0 + 0.635)} 0.635) (end ${mm(x0 + 1.27)} 0) ${STROKE} (fill (type none)))`; } return s; },
  D: () => poly([[-1.27, 1.27], [-1.27, -1.27], [1.27, 0], [-1.27, 1.27]], 'none') + poly([[1.27, 1.27], [1.27, -1.27]]),
  LED: () => KI_SHAPES.D() + poly([[-0.508, 1.778], [0.762, 3.048]]) + poly([[0.508, 1.778], [1.778, 3.048]]),
  ZD: () => poly([[-1.27, 1.27], [-1.27, -1.27], [1.27, 0], [-1.27, 1.27]]) + poly([[0.762, 1.27], [1.27, 1.27], [1.27, -1.27], [1.778, -1.27]]),
  BAT: () => poly([[-0.635, 2.54], [-0.635, -2.54]]) + poly([[0.635, 1.27], [0.635, -1.27]]) + poly([[-2.032, 2.286], [-1.524, 2.286]]) + poly([[-1.778, 2.54], [-1.778, 2.032]]),
  SW: () => `(circle (center -2.032 0) (radius 0.508) ${STROKE} (fill (type none)))(circle (center 2.032 0) (radius 0.508) ${STROKE} (fill (type none)))` + poly([[-1.524, 0.254], [1.778, 1.524]]),
  BTN: () => `(circle (center -2.032 0) (radius 0.508) ${STROKE} (fill (type none)))(circle (center 2.032 0) (radius 0.508) ${STROKE} (fill (type none)))` + poly([[-2.54, 1.27], [2.54, 1.27]]) + poly([[0, 1.27], [0, 3.048]]),
  M: () => `(circle (center 0 0) (radius 2.286) ${STROKE} (fill (type none)))` + poly([[-1.016, -1.016], [-1.016, 1.016], [0, 0], [1.016, 1.016], [1.016, -1.016]]),
  LAMP: () => `(circle (center 0 0) (radius 2.286) ${STROKE} (fill (type none)))` + poly([[-1.524, 1.524], [1.524, -1.524]]) + poly([[-1.524, -1.524], [1.524, 1.524]]),
  BZ: () => `(rectangle (start -2.032 2.032) (end 2.032 -1.016) ${STROKE} (fill (type none)))` + poly([[-1.27, 2.032], [0, 3.302], [1.27, 2.032]]),
};
const KI_SHAPE_OF = { resistor: 'R', capacitor: 'CP', cap_cer: 'C', inductor: 'L', led: 'LED', d_zener: 'ZD', battery: 'BAT', dcsupply: 'BAT', switch: 'SW', button: 'BTN', motor: 'M', bulb: 'LAMP', buzzer: 'BZ', d_1n400x: 'D', d_1n4148: 'D', d_schottky: 'D' };
function kiSymbolKey(c) { const P = PARTS[c.type]; return (KI_SHAPE_OF[c.type] ? 'CT_' + KI_SHAPE_OF[c.type] : 'CT_' + c.type + (c.type === 'res_net' ? '_' + c.props.n : '')).replace(/[^A-Za-z0-9_]/g, '_'); }
// geometria symbolu: piny w układzie biblioteki (oś Y w górę) + rysunek
function kiSymbolGeom(c) {
  const shape = KI_SHAPE_OF[c.type], nums = kiPinNums(c);
  if (shape) return { pins: [{ x: -3.81, y: 0, a: 0, len: 1.27, num: nums[0], name: '~' }, { x: 3.81, y: 0, a: 180, len: 1.27, num: nums[1], name: '~' }], draw: KI_SHAPES[shape](), hideNames: true, hideNums: true, h: 5.08, w: 7.62 };
  const pins = pinsOf(c); const n = pins.length;
  let left = [], right = [];
  if (pins.every(p => p.num) && n % 2 === 0 && !PARTS[c.type].pyBoard) { const h = n / 2; for (let i = 0; i < n; i++) { const k = pins.findIndex(p => p.num === i + 1); (i < h ? left : right).push(k); } right.reverse(); }
  else if (n <= 3) { left = [...Array(n).keys()]; }
  else { const h = Math.ceil(n / 2); left = [...Array(h).keys()]; right = [...Array(n - h).keys()].map(k => k + h); }
  const nl = Math.max(...left.map(i => kiPinName(c, i).length), 1), nr = right.length ? Math.max(...right.map(i => kiPinName(c, i).length), 1) : 0;
  let w = Math.ceil(((nl + nr) * 0.75 + 4) / 2.54) * 2.54; w = Math.max(w, 10.16);
  const rows = Math.max(left.length, right.length); const top = (rows - 1) * 1.27 + 0;
  const hw = w / 2;
  const out = [];
  left.forEach((i, k) => out.push({ x: -hw - 2.54, y: top - k * 2.54, a: 0, len: 2.54, num: nums[i], name: kiPinName(c, i), idx: i }));
  right.forEach((i, k) => out.push({ x: hw + 2.54, y: top - k * 2.54, a: 180, len: 2.54, num: nums[i], name: kiPinName(c, i), idx: i }));
  const ht = top + 2.54, hb = top - (rows - 1) * 2.54 - 2.54;
  return { pins: out, draw: `(rectangle (start ${mm(-hw)} ${mm(ht)}) (end ${mm(hw)} ${mm(hb)}) ${STROKE} (fill (type background)))`, hideNames: false, hideNums: false, h: ht - hb, w: w + 5.08, top: ht, bottom: hb };
}
function kiLibSymbol(key, g, ref) {
  const name = key;
  return `(symbol ${q('CappyTronic:' + name)}${g.hideNums ? ' (pin_numbers hide)' : ''} (pin_names (offset ${g.hideNames ? 0 : 1.016})${g.hideNames ? ' hide' : ''}) (in_bom yes) (on_board yes)
      (property "Reference" ${q(ref)} (at 0 ${mm((g.top || 2.54) + 1.27)} 0) ${FONT})
      (property "Value" ${q(name)} (at 0 ${mm((g.bottom || -2.54) - 1.27)} 0) ${FONT})
      (property "Footprint" "" (at 0 0 0) ${FONTH})
      (property "Datasheet" "" (at 0 0 0) ${FONTH})
      (symbol ${q(name + '_0_1')} ${g.draw})
      (symbol ${q(name + '_1_1')} ${g.pins.map(p => pinS(p.x, p.y, p.a, p.len, p.name, p.num)).join(' ')}))`;
}

/* ---------- eksport ---------- */
function kiCollect() {
  const N = kiNets(); const parts = S.comps.filter(c => !KI_SKIP.has(c.type) && pinsOf(c).length && !PARTS[c.type].locked);
  const skipped = S.comps.filter(c => KI_SKIP.has(c.type) && c.type !== 'bb');
  // nazwy sieci
  const nets = new Map(); const counters = {};
  const order = [...parts].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const c of order) { const P = PARTS[c.type]; const pre = kiRefPrefix(P); counters[pre] = (counters[pre] || 0) + 1; c._ref = pre + counters[pre]; }
  for (const c of parts) pinsOf(c).forEach((p, i) => { const r = N.root(c, i); if (!nets.has(r)) nets.set(r, { nodes: [], names: [] }); nets.get(r).nodes.push({ c, i }); });
  for (const [r, net] of nets) {
    for (const { c, i } of net.nodes) {
      const P = PARTS[c.type], p = pinsOf(c)[i];
      if (p.fn === 'GND' || (P.gnd === i && c.type !== 'mains') || (c.type === 'battery' && i === 1) || (c.type === 'dcsupply' && i === 1)) net.names.push([0, 'GND']);
      else if (c.type === 'battery' && i === 0) net.names.push([1, '+' + String(c.props.v).replace('.', 'V') + (String(c.props.v).includes('.') ? '' : 'V')]);
      else if (c.type === 'dcsupply' && i === 0) net.names.push([1, '+VDC']);
      else if (p.fn === '5V') net.names.push([1, '+5V']); else if (p.fn === '3V3') net.names.push([1, '+3V3']); else if (p.fn === 'VIN') net.names.push([2, 'VIN']);
      else if ((P.mcu || P.py) && p.fn && p.fn !== 'NC') net.names.push([3, String(p.s || p.fn).replace(/[^A-Za-z0-9_+-]/g, '')]);
    }
  }
  const used = {}; let auto = 1;
  for (const [r, net] of nets) {
    net.names.sort((a, b) => a[0] - b[0]);
    let nm = net.names.length ? net.names[0][1] : null;
    if (!nm) { const f = net.nodes[0]; nm = `Net-(${f.c._ref}-Pad${kiPinNums(f.c)[f.i]})`; if (net.nodes.length === 1) nm = null; }
    if (nm && used[nm] && !['GND'].includes(nm)) { used[nm]++; nm = nm + '_' + used[nm]; } else if (nm) used[nm] = 1;
    if (!nm && net.nodes.length > 1) nm = 'N' + (auto++);
    net.name = nm;
  }
  return { parts, nets, skipped };
}
function kiExportSch() {
  const { parts, nets, skipped } = kiCollect();
  const root = uuid(), proj = (S.name || 'cappytronic').replace(/[^A-Za-z0-9_-]+/g, '_');
  const libs = new Map(); const placed = [];
  const netOf = (c, i) => { for (const [r, n] of nets) if (n.nodes.some(x => x.c === c && x.i === i)) return n; return null; };
  // rozmieszczenie: w wierszach, wg rodzaju
  const rank = c => { const P = PARTS[c.type]; return (P.mcu || P.py) ? 0 : P.cat === 'src' || c.type === 'battery' ? 1 : /^(U|M|A|DS)$/.test(kiRefPrefix(P)) ? 2 : 3; };
  // elementy z tej samej maty (modułu) trzymamy razem i obrysowujemy prostokątem z nazwą modułu
  const mats = S.mats || [], mIdx = c => { const m = matOf(c); return m ? mats.indexOf(m) : mats.length; };
  const list = [...parts].sort((a, b) => mIdx(a) - mIdx(b) || rank(a) - rank(b) || (a._ref > b._ref ? 1 : -1));
  const groups = new Map(); let curG = null;
  let X = 30.48, Y = 30.48, rowH = 0; const PAGE_W = list.length > 30 ? 560 : 400;
  let body = '';
  for (const c of list) {
    const key = kiSymbolKey(c), g = kiSymbolGeom(c);
    if (!libs.has(key)) libs.set(key, kiLibSymbol(key, g, kiRefPrefix(PARTS[c.type])));
    const labelW = Math.max(...g.pins.map(p => { const n = netOf(c, p.idx !== undefined ? p.idx : g.pins.indexOf(p)); return n && n.name ? n.name.length * 1.1 + 5 : 3; }));
    const w = g.w + 2 * labelW + 7.62, h = Math.max(g.h, 5.08) + 12.7;
    const gi = mIdx(c);
    if (gi !== curG) { if (curG !== null) { X = 30.48; Y += rowH + 12.7; rowH = 0; } curG = gi; if (gi < mats.length) Y += 7.62; }
    if (X + w > PAGE_W) { X = 30.48; Y += rowH + 7.62; rowH = 0; }
    if (gi < mats.length) { const gb = groups.get(gi) || { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; gb.x0 = Math.min(gb.x0, X); gb.y0 = Math.min(gb.y0, Y); gb.x1 = Math.max(gb.x1, X + w); gb.y1 = Math.max(gb.y1, Y + h); groups.set(gi, gb); }
    const cx = Math.round((X + w / 2) / 2.54) * 2.54, cy = Math.round((Y + (g.top || 2.54) + 5.08) / 2.54) * 2.54;
    X += w; rowH = Math.max(rowH, h);
    const meta = JSON.stringify({ type: c.type, props: Object.assign({}, c.props, { code: undefined, hex: undefined, hexCode: undefined, eep: undefined, mem: undefined, pressed: undefined }), x: c.x, y: c.y, rot: c.rot });
    const fp = kiFootprint(c), val = kiValue(c), ds = '';
    const ty = g.top !== undefined ? cy - g.top - 1.27 : cy - 3.81, by = g.bottom !== undefined ? cy - g.bottom + 2.54 : cy + 3.81;
    body += `  (symbol (lib_id ${q('CappyTronic:' + key)}) (at ${mm(cx)} ${mm(cy)} 0) (unit 1) (in_bom yes) (on_board yes) (dnp no) (uuid ${uuid()})
    (property "Reference" ${q(c._ref)} (at ${mm(cx)} ${mm(ty)} 0) ${FONT})
    (property "Value" ${q(val)} (at ${mm(cx)} ${mm(by)} 0) ${FONT})
    (property "Footprint" ${q(fp)} (at ${mm(cx)} ${mm(cy)} 0) ${FONTH})
    (property "Datasheet" ${q(ds)} (at ${mm(cx)} ${mm(cy)} 0) ${FONTH})
    (property "CappyTronic" ${q(meta)} (at ${mm(cx)} ${mm(cy)} 0) ${FONTH})
${g.pins.map(p => `    (pin ${q(p.num)} (uuid ${uuid()}))`).join('\n')}
    (instances (project ${q(proj)} (path ${q('/' + root)} (reference ${q(c._ref)}) (unit 1)))))\n`;
    // przewody i etykiety sieci
    g.pins.forEach((p, k) => {
      const idx = p.idx !== undefined ? p.idx : k; const sx = cx + p.x, sy = cy - p.y; const n = netOf(c, idx);
      const dir = p.a === 0 ? -1 : p.a === 180 ? 1 : 0; const ex = sx + dir * 2.54;
      if (!n || !n.name) { body += `  (no_connect (at ${mm(sx)} ${mm(sy)}) (uuid ${uuid()}))\n`; return; }
      body += `  (wire (pts (xy ${mm(sx)} ${mm(sy)}) (xy ${mm(ex)} ${mm(sy)})) (stroke (width 0) (type default)) (uuid ${uuid()}))\n`;
      body += `  (label ${q(n.name)} (at ${mm(ex)} ${mm(sy)} ${dir < 0 ? 180 : 0}) (fields_autoplaced) (effects (font (size 1.27 1.27)) (justify ${dir < 0 ? 'right' : 'left'} bottom)) (uuid ${uuid()}))\n`;
    });
  }
  for (const [gi, gb] of groups) { const m = mats[gi], col = m.col.match(/\w\w/g).map(h => parseInt(h, 16)).join(' ');
    body += `  (rectangle (start ${mm(gb.x0 - 2.54)} ${mm(gb.y0 - 2.54)}) (end ${mm(gb.x1 + 2.54)} ${mm(gb.y1 + 1.27)}) (stroke (width 0.3) (type dash) (color ${col} 1)) (fill (type none)) (uuid ${uuid()}))\n`;
    body += `  (text ${q(m.title || t('matDefault'))} (at ${mm(gb.x0 - 2.54)} ${mm(gb.y0 - 3.81)} 0) (effects (font (size 2 2) (thickness 0.4) bold (color ${col} 1)) (justify left bottom)) (uuid ${uuid()}))\n`;
    if (m.note) body += `  (text ${q(m.note)} (at ${mm(gb.x0)} ${mm(gb.y1 + 3.81)} 0) (effects (font (size 1.27 1.27) italic) (justify left top)) (uuid ${uuid()}))\n`; }
  const paper = PAGE_W > 420 || Y > 250 ? 'A2' : 'A3';
  const txt = `(kicad_sch (version 20230121) (generator eeschema)
  (uuid ${root})
  (paper ${q(paper)})
  (title_block (title ${q(S.name || 'CappyTronic')}) (date ${q(new Date().toISOString().slice(0, 10))}) (company "CappyTronic") (comment 1 ${q(t('kiComment'))})${mats.length ? ` (comment 9 ${q('CappyTronic-mats:' + JSON.stringify(mats.map(m => ({ x: m.x, y: m.y, w: m.w, h: m.h, col: m.col, title: m.title, note: m.note, carry: m.carry }))))})` : ''})
  (lib_symbols
${[...libs.values()].map(s => '    ' + s).join('\n')}
  )
${body}  (sheet_instances (path "/" (page "1")))
)
`;
  return { text: txt, report: { parts: parts.length, nets: [...nets.values()].filter(n => n.name).length, skipped, noFp: parts.filter(c => !kiFootprint(c)).map(c => c._ref + ' ' + kiValue(c)) } };
}
function kiExportNet() {
  const { parts, nets, skipped } = kiCollect();
  const comps = parts.map(c => `    (comp (ref ${q(c._ref)})
      (value ${q(kiValue(c))})
      (footprint ${q(kiFootprint(c))})
      (libsource (lib "CappyTronic") (part ${q(kiSymbolKey(c))}) (description ${q(L(PARTS[c.type].name))}))
      (property (name "CappyTronic") (value ${q(JSON.stringify({ type: c.type }))}))
      (sheetpath (names "/") (tstamps "/"))
      (tstamps ${q(uuid())}))`).join('\n');
  let code = 1;
  const netTxt = [...nets.values()].filter(n => n.name).map(n => `    (net (code ${q(code++)}) (name ${q(n.name)})
${n.nodes.map(({ c, i }) => `      (node (ref ${q(c._ref)}) (pin ${q(kiPinNums(c)[i])}) (pinfunction ${q(kiPinName(c, i))}) (pintype "passive"))`).join('\n')})`).join('\n');
  const txt = `(export (version "E")
  (design
    (source ${q((S.name || 'cappytronic') + '.kicad_sch')})
    (date ${q(new Date().toISOString())})
    (tool "CappyTronic 2.1"))
  (components
${comps})
  (nets
${netTxt}))
`;
  return { text: txt, report: { parts: parts.length, nets: code - 1, skipped, noFp: parts.filter(c => !kiFootprint(c)).map(c => c._ref + ' ' + kiValue(c)) } };
}

/* ---------- import ---------- */
function kiParseNumber(s) {
  s = String(s || '').trim().replace(',', '.').replace(/Ω|ohm/gi, '').replace(/F$|H$|V$/i, '');
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([pnuµmkKMGR]?)([0-9]*)/); if (!m) return NaN;
  let v = parseFloat(m[1]); const mul = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, '': 1 }[m[2]];
  if (m[3] && m[2]) v = parseFloat(m[1] + '.' + m[3]);   // 4k7 -> 4.7k
  return v * mul;
}
const kiNorm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let KI_INDEX = null;
function kiIndex() {
  if (KI_INDEX) return KI_INDEX; KI_INDEX = [];
  for (const P of Object.values(PARTS)) {
    if (P.locked || P.id === 'bb') continue;
    const names = [P.id, typeof P.name === 'string' ? P.name : P.name.en, typeof P.sub === 'string' ? P.sub : ''].concat((P.kw || '').split(/\s+/));
    for (const n of names) { const k = kiNorm(n); if (k.length >= 4 && /\d/.test(k)) KI_INDEX.push([k, P.id]); }
  }
  KI_INDEX.sort((a, b) => b[0].length - a[0].length); return KI_INDEX;
}
// dopasowanie elementu KiCad do części CappyTronic
function kiMatch(cmp) {
  if (cmp.meta) { try { const m = JSON.parse(cmp.meta); if (PARTS[m.type]) return { type: m.type, props: m.props || {}, meta: m }; } catch (e) { } }
  const lib = String(cmp.lib || ''), part = String(cmp.part || ''), val = String(cmp.value || ''), ref = String(cmp.ref || ''), fp = String(cmp.footprint || '');
  const pre = (ref.match(/^[A-Za-z]+/) || [''])[0].toUpperCase(); const all = kiNorm(part + ' ' + val);
  const lp = (lib + ':' + part).toLowerCase();
  // układy z numerem katalogowym
  for (const [k, id] of kiIndex()) if (all.includes(k)) {
    const P = PARTS[id]; const props = {};
    if (id === 'reg_78xx' || id === 'reg_79xx') { const m = all.match(/7[89](\d\d)/); if (m) props.v = +m[1]; }
    if (P.ui && P.ui.some(u => u.k === 'model')) { const opt = P.ui.find(u => u.k === 'model').opts.find(o => all.includes(kiNorm(o[0]))); if (opt) props.model = opt[0]; }
    return { type: id, props };
  }
  if (/regulator_linear:l?78|^l?78\d\d/.test(lp + val.toLowerCase())) { const m = (val + part).match(/78(\d\d)/); return { type: 'reg_78xx', props: { v: m ? +m[1] : 5 } }; }
  const v = kiParseNumber(val);
  if (pre === 'RV' || /r_pot|potentiometer/.test(lp)) return { type: 'pot', props: isFinite(v) ? { r: v } : {} };
  if (pre === 'RN' || /r_network|r_pack/.test(lp)) return { type: 'res_net', props: isFinite(v) ? { r: v } : {} };
  if (pre === 'R' || /^device:r(_small|_us)?$/.test(lp)) return { type: 'resistor', props: isFinite(v) && v > 0 ? { r: v } : {} };
  if (/c_polarized|cp(_small)?$|:cp\b|elko|electrolytic/.test(lp) || (pre === 'C' && isFinite(v) && v >= 1e-6)) return { type: 'capacitor', props: isFinite(v) && v > 0 ? { c: v } : {} };
  if (pre === 'C' || /device:c(_small)?$/.test(lp)) return { type: 'cap_cer', props: isFinite(v) && v > 0 ? { c: v } : {} };
  if (pre === 'L' || /device:l(_small)?$/.test(lp)) return { type: 'inductor', props: isFinite(v) && v > 0 ? { l: v } : {} };
  if (/led/.test(lp) || /^LED/i.test(val)) { const col = Object.keys(LED_COL).find(k => val.toLowerCase().includes(k) || val.toLowerCase().includes(LED_COL[k].n.pl.slice(0, 5))); return { type: /rgb/.test(lp) ? 'led_rgb' : 'led', props: col ? { color: col } : {} }; }
  if (/zener/.test(lp)) return { type: 'd_zener', props: {} };
  if (/schottky/.test(lp)) return { type: 'd_schottky', props: {} };
  if (pre === 'D' || /device:d(_small)?$/.test(lp)) return { type: /4148/.test(val) ? 'd_1n4148' : 'd_1n400x', props: {} };
  if (/q_npn|npn/.test(lp)) return { type: 'q_bc547', props: {} };
  if (/q_pnp|pnp/.test(lp)) return { type: 'q_bc557', props: {} };
  if (/q_nmos|nmos|n-channel/.test(lp)) return { type: 'm_2n7000', props: {} };
  if (/q_pmos|pmos|p-channel/.test(lp)) return { type: 'm_irf9540n', props: {} };
  if (pre === 'BT' || /battery/.test(lp)) return { type: 'battery', props: isFinite(kiParseNumber(val)) ? { v: kiParseNumber(val) } : {} };
  if (/sw_push|push/.test(lp)) return { type: 'button', props: {} };
  if (pre === 'SW' || /sw_spst|switch/.test(lp)) return { type: 'switch', props: {} };
  if (pre === 'BZ' || /buzzer/.test(lp)) return { type: 'buzzer', props: {} };
  if (/motor/.test(lp)) return { type: 'motor', props: {} };
  if (pre === 'K' || /relay/.test(lp)) return { type: 'relay', props: {} };
  if (/arduino_uno/.test(lp)) return { type: 'ard_uno', props: {} };
  if (/arduino_nano/.test(lp)) return { type: 'ard_nano', props: {} };
  if (/arduino_mega/.test(lp)) return { type: 'ard_mega', props: {} };
  if (/esp32-c3|esp32c3/.test(lp + val.toLowerCase())) return { type: 'esp32c3zero', props: {} };
  if (/pico/.test(lp + val.toLowerCase())) return { type: 'picow', props: {} };
  if (/esp32/.test(lp + val.toLowerCase())) return { type: 'esp32devkit', props: {} };
  if (/ws2812|neopixel|sk6812/.test(lp + val.toLowerCase())) return { type: 'ws2812', props: {} };
  return null;
}
// numer/nazwa wyprowadzenia KiCad -> indeks pinu CappyTronic
function kiMapPin(type, props, cmp, pinNum, pinName, viaMeta) {
  const fake = { type, props: Object.assign({}, PARTS[type].props, props) }; const pins = pinsOf(fake);
  if (viaMeta) { const nums = kiPinNums(fake); const i = nums.indexOf(String(pinNum)); if (i >= 0) return i; }
  const nm = kiNorm(pinName);
  const P = PARTS[type];
  if (type === 'led' || (P.cat === 'diode' && pins.length === 2)) { if (nm === 'A' || nm === 'ANODE') return 0; if (nm === 'K' || nm === 'CATHODE') return 1; return pinNum === '1' ? 1 : pinNum === '2' ? 0 : -1; }
  if (P.cat === 'bjt' || P.cat === 'fet') { const letter = nm[0]; const i = pins.findIndex(p => kiNorm(L(p.n))[0] === letter); if (i >= 0 && 'BCEGDS'.includes(letter)) return i; }
  if (pins.some(p => p.num)) { const i = pins.findIndex(p => String(p.num) === String(pinNum)); if (i >= 0 && !P.py && !P.mcu) return i; }
  if (nm && (P.mcu || P.py || P.pk || pins.length > 3)) {
    const cands = pins.map((p, i) => ({ i, keys: [p.s, p.fn, typeof p.n === 'string' ? p.n : L(p.n)].filter(Boolean).map(kiNorm) }));
    const variants = [nm, nm.replace(/^GPIO/, 'G'), nm.replace(/^IO/, 'G'), nm.replace(/^GP/, 'G'), nm.replace(/^D(\d+)$/, 'D$1'), nm === 'VCC' ? '5V' : nm, nm === '33V' ? '3V3' : nm];
    for (const v of variants) { const c = cands.find(x => x.keys.includes(v)); if (c) return c.i; }
  }
  const n = parseInt(pinNum, 10); if (n >= 1 && n <= pins.length) return n - 1;
  return -1;
}
// odczyt pliku .net
function kiReadNet(tree) {
  const comps = [], nets = [];
  const cs = sxFind(tree, 'components') || [];
  for (const c of sxAll(cs, 'comp')) {
    const g = k => { const x = sxFind(c, k); return x ? sxv(x[1]) : ''; };
    const ls = sxFind(c, 'libsource') || []; const props = {};
    for (const p of sxAll(c, 'property')) { const n = sxFind(p, 'name'), v = sxFind(p, 'value'); if (n && v) props[sxv(n[1])] = sxv(v[1]); }
    for (const f of (sxFind(c, 'fields') || []).filter(Array.isArray)) if (f[0] === 'field') { const n = sxFind(f, 'name'); if (n) props[sxv(n[1])] = sxv(f[f.length - 1]); }
    comps.push({ ref: g('ref'), value: g('value'), footprint: g('footprint'), lib: ls.length ? sxv((sxFind(ls, 'lib') || [])[1]) : '', part: ls.length ? sxv((sxFind(ls, 'part') || [])[1]) : '', meta: props.CappyTronic });
  }
  const ns = sxFind(tree, 'nets') || [];
  for (const n of sxAll(ns, 'net')) { const name = sxv((sxFind(n, 'name') || [])[1]); const nodes = sxAll(n, 'node').map(x => ({ ref: sxv((sxFind(x, 'ref') || [])[1]), pin: sxv((sxFind(x, 'pin') || [])[1]), name: sxv((sxFind(x, 'pinfunction') || [])[1]) || '' })); nets.push({ name, nodes }); }
  return { comps, nets };
}
// odczyt schematu .kicad_sch – połączenia liczone geometrycznie
function kiReadSch(tree) {
  const libs = {};
  const ls = sxFind(tree, 'lib_symbols') || [];
  for (const s of sxAll(ls, 'symbol')) {
    const id = sxv(s[1]); const pins = []; const isPower = !!sxFind(s, 'power');
    const walk = (node, unit) => { for (const x of node) if (Array.isArray(x)) {
      if (x[0] === 'symbol') { const m = /_(\d+)_(\d+)$/.exec(sxv(x[1])); walk(x, m ? +m[1] : 0); }
      else if (x[0] === 'pin') { const at = sxFind(x, 'at'); const nm = sxFind(x, 'name'), nu = sxFind(x, 'number'); pins.push({ x: +at[1], y: +at[2], unit, name: nm ? sxv(nm[1]) : '', num: nu ? sxv(nu[1]) : '' }); }
    } };
    walk(s, 0);
    const props = {}; for (const p of sxAll(s, 'property')) props[sxv(p[1])] = sxv(p[2]);
    libs[id] = { pins, power: isPower, props };
  }
  const key = (x, y) => Math.round(x * 100) + ',' + Math.round(y * 100);
  const par = new Map(); const f = k => { let p = par.get(k); if (p === undefined) { par.set(k, k); return k; } if (p === k) return k; const r = f(p); par.set(k, r); return r; };
  const un = (a, b) => { a = f(a); b = f(b); if (a !== b) par.set(a, b); };
  const wires = sxAll(tree, 'wire').map(w => { const pts = sxFind(w, 'pts').filter(Array.isArray).map(p => [+p[1], +p[2]]); return pts; });
  const points = [];   // [x,y,key]
  const insts = [];
  for (const s of sxAll(tree, 'symbol')) {
    const lid = sxv((sxFind(s, 'lib_id') || [])[1]); const lib = libs[lid] || libs[sxv((sxFind(s, 'lib_name') || [])[1])]; if (!lib) continue;
    const at = sxFind(s, 'at'); const X = +at[1], Y = +at[2], ang = +(at[3] || 0);
    const mir = sxFind(s, 'mirror'); const unit = +((sxFind(s, 'unit') || [0, 1])[1]);
    const props = {}; for (const p of sxAll(s, 'property')) props[sxv(p[1])] = sxv(p[2]);
    const inst = { ref: props.Reference || '', value: props.Value || '', footprint: props.Footprint || '', lib: (lid || '').split(':')[0], part: (lid || '').split(':').slice(1).join(':'), meta: props.CappyTronic, power: lib.power, pins: [] };
    const th = ang * Math.PI / 180, co = Math.round(Math.cos(th)), si2 = Math.round(Math.sin(th));
    for (const p of lib.pins) {
      if (p.unit && unit && p.unit !== unit) continue;
      let px = p.x, py = -p.y;
      let rx = px * co + py * si2, ry = -px * si2 + py * co;
      if (mir) { if (sxv(mir[1]) === 'x') ry = -ry; else rx = -rx; }
      const sx = X + rx, sy = Y + ry; const k = key(sx, sy); points.push([sx, sy, k]);
      inst.pins.push({ num: p.num, name: p.name, k });
    }
    insts.push(inst);
  }
  for (const l of [...sxAll(tree, 'label'), ...sxAll(tree, 'global_label'), ...sxAll(tree, 'hierarchical_label')]) { const at = sxFind(l, 'at'); const k = key(+at[1], +at[2]); points.push([+at[1], +at[2], k]); un(k, 'LBL:' + sxv(l[1])); }
  for (const j of sxAll(tree, 'junction')) { const at = sxFind(j, 'at'); points.push([+at[1], +at[2], key(+at[1], +at[2])]); }
  for (const w of wires) { for (let i = 0; i + 1 < w.length; i++) { un(key(...w[i]), key(...w[i + 1])); points.push([w[i][0], w[i][1], key(...w[i])], [w[i + 1][0], w[i + 1][1], key(...w[i + 1])]); } }
  // punkty leżące na odcinku przewodu
  for (const w of wires) for (let i = 0; i + 1 < w.length; i++) {
    const [x1, y1] = w[i], [x2, y2] = w[i + 1];
    for (const [px, py, k] of points) { const onSeg = Math.abs((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) < 0.01 && px >= Math.min(x1, x2) - 0.01 && px <= Math.max(x1, x2) + 0.01 && py >= Math.min(y1, y2) - 0.01 && py <= Math.max(y1, y2) + 0.01; if (onSeg) un(k, key(x1, y1)); }
  }
  for (const s of insts) if (s.power) for (const p of s.pins) un(p.k, 'LBL:' + s.value);
  const groups = new Map();
  for (const s of insts) if (!s.power) for (const p of s.pins) { const r = f(p.k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push({ ref: s.ref, pin: p.num, name: p.name }); }
  const nets = []; let n = 1;
  for (const [r, nodes] of groups) { let name = null; for (const [k] of par) if (k.startsWith('LBL:') && f(k) === r) { name = k.slice(4); break; } nets.push({ name: name || 'N' + n++, nodes }); }
  // elementy wieloczęściowe (np. 74HC00 jako 5 symboli) łączymy po referencji
  const comps = []; const seen = new Set();
  for (const s of insts) if (!s.power && !seen.has(s.ref)) { seen.add(s.ref); comps.push(s); }
  return { comps, nets };
}
function kiImport(text, fname) {
  let tree; try { tree = sxParse(text); } catch (e) { return toast(t('badFile')); }
  const kind = tree[0];
  const data = kind === 'export' ? kiReadNet(tree) : kind === 'kicad_sch' ? kiReadSch(tree) : null;
  if (!data) return toast(t('badFile'));
  if (running) toggleSim(); pushHist();
  const report = { ok: [], skip: [], pins: [] };
  const comps = []; const byRef = {};
  let X = 0, Y = 0, rowH = 0;
  for (const cmp of data.comps) {
    if (!cmp.ref || cmp.ref.startsWith('#')) continue;
    const m = kiMatch(cmp);
    if (!m) { report.skip.push(`${cmp.ref} (${cmp.value || cmp.part})`); continue; }
    const P = PARTS[m.type]; const props = Object.assign(JSON.parse(JSON.stringify(P.props || {})), m.props || {});
    if (P.mcu && !P.py) props.code = P.props.code;
    const c = { id: newId(), type: m.type, x: 0, y: 0, rot: 0, props };
    if (m.meta && m.meta.x !== undefined) { c.x = m.meta.x; c.y = m.meta.y; c.rot = m.meta.rot || 0; }
    else { const b = bboxOf(c); const w = b[2] - b[0] + 60, h = b[3] - b[1] + 80; if (X + w > 1600) { X = 0; Y += rowH; rowH = 0; } c.x = Math.round((X - b[0]) / 20) * 20; c.y = Math.round((Y - b[1]) / 20) * 20; X += w; rowH = Math.max(rowH, h); }
    comps.push(c); byRef[cmp.ref] = { c, m, cmp }; report.ok.push(`${cmp.ref} → ${L(P.name)}`);
  }
  const wires = []; const colFor = name => /^(GND|VSS|0V)/i.test(name || '') ? WIRE_COLS[1][0] : /^\+|VCC|VDD|VIN|5V|3V3/i.test(name || '') ? WIRE_COLS[0][0] : WIRE_COLS[2 + (wires.length % 5)][0];
  for (const net of data.nets) {
    const pts = [];
    for (const nd of net.nodes) { const e = byRef[nd.ref]; if (!e) continue; const i = kiMapPin(e.c.type, e.c.props, e.cmp, nd.pin, nd.name, !!e.m.meta); if (i < 0) { report.pins.push(`${nd.ref}.${nd.pin}${nd.name ? ' (' + nd.name + ')' : ''}`); continue; } if (!pts.some(p => p.c === e.c && p.i === i)) pts.push({ c: e.c, i }); }
    if (pts.length < 2) continue;
    const pos = pts.map(p => ({ ...p, xy: pinPos(p.c, p.i) })).sort((a, b) => a.xy[0] - b.xy[0] || a.xy[1] - b.xy[1]);
    const col = colFor(net.name);
    for (let k = 1; k < pos.length; k++) wires.push({ id: newId(), a: { c: pos[k - 1].c.id, t: pos[k - 1].i }, b: { c: pos[k].c.id, t: pos[k].i }, pts: [], color: col });
  }
  let mats = [];
  if (kind === 'kicad_sch') { const tb = sxFind(tree, 'title_block'); if (tb) for (const cm of sxAll(tb, 'comment')) { const v = sxv(cm[2]); if (+sxv(cm[1]) === 9 && v.startsWith('CappyTronic-mats:')) try { mats = sanitizeMats(JSON.parse(v.slice(17))).map(m => ({ ...m, id: newId() })); } catch (e) { } } }
  S = { name: (fname || 'KiCad').replace(/\.(kicad_sch|net)$/i, ''), comps, wires, mats };
  $('#projName').value = S.name; sel = null; draft = null; changed(); fit();
  showImportReport(report, data.nets.length);
}
function showImportReport(r, nets) {
  const li = a => a.map(x => `<li>${esc(x)}</li>`).join('');
  $('#impBody').innerHTML = `<p class="imp-ok">${esc(t('impDone', { n: r.ok.length, w: nets }))}</p>` +
    (r.skip.length ? `<p class="imp-warn">${esc(t('impSkipped', { n: r.skip.length }))}</p><ul class="hint">${li(r.skip.slice(0, 40))}</ul>` : '') +
    (r.pins.length ? `<p class="imp-warn">${esc(t('impPins', { n: r.pins.length }))}</p><ul class="hint">${li(r.pins.slice(0, 40))}</ul>` : '') +
    `<p class="hint">${esc(t('impNote'))}</p>`;
  $('#impModal').hidden = false;
}
$('#impClose').onclick = () => $('#impModal').hidden = true;
$('#impModal').onclick = e => { if (e.target.id === 'impModal') $('#impModal').hidden = true; };

/* ---------- zapis plików ---------- */
async function saveData(fname, data, kind, mime) {
  try {
    if (window.cappyNative && window.cappyNative.saveFile) { const p = await window.cappyNative.saveFile(fname, data, kind); if (p) toast(t('savedAs', { f: p })); return; }
    if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: fname }); const w = await h.createWritable(); await w.write(data); await w.close(); toast(t('savedAs', { f: h.name })); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime || 'application/octet-stream' })); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); toast(t('savedAs', { f: fname }));
}
const baseName = () => (S.name || 'projekt').replace(/[\\/:*?"<>|]/g, '_');
$('#fExpJson').onclick = () => saveData(baseName() + '.json', JSON.stringify(JSON.parse(exportJson()), null, 2), 'json', 'application/json');
$('#fExpSch').onclick = () => { const r = kiExportSch(); saveData(baseName() + '.kicad_sch', r.text, 'kicad_sch', 'text/plain'); kiExportNote(r.report); };
$('#fExpNet').onclick = () => { const r = kiExportNet(); saveData(baseName() + '.net', r.text, 'net', 'text/plain'); kiExportNote(r.report); };
function kiExportNote(r) {
  const parts = [t('expDone', { n: r.parts, w: r.nets })];
  if (r.skipped.length) parts.push(t('expSkipped', { l: r.skipped.map(c => L(PARTS[c.type].name)).join(', ') }));
  if (r.noFp.length) parts.push(t('expNoFp', { l: r.noFp.slice(0, 8).join(', ') + (r.noFp.length > 8 ? '…' : '') }));
  toast(parts.join(' '));
}
$('#fImpAny').onclick = () => $('#fOpen').click();
