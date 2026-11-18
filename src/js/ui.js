'use strict';
/* ================= STAN I MODEL ================= */
const G = 20;
let S = { name: '', comps: [], wires: [], mats: [] };
let nid = 1; const newId = () => nid++;
let RT = {}; const rt = c => RT[c.id] || (RT[c.id] = {});
let sel = null, draft = null, hoverT = null, act = null, tab = 'props';
let view = { x: 40, y: 40, k: 1 };
let running = false, dirty = true;
const WIRE_COLS = [['#e5484d', { pl: 'czerwony', en: 'red' }], ['#2a2a2a', { pl: 'czarny', en: 'black' }], ['#3d7bf2', { pl: 'niebieski', en: 'blue' }], ['#2fb15f', { pl: 'zielony', en: 'green' }], ['#f2c12e', { pl: 'żółty', en: 'yellow' }], ['#f08a24', { pl: 'pomarańczowy', en: 'orange' }], ['#f2f2f2', { pl: 'biały', en: 'white' }], ['#9b59b6', { pl: 'fioletowy', en: 'purple' }]];
let wireColor = WIRE_COLS[0][0];
let hist = [];
const byId = id => S.comps.find(c => c.id === id);
const devOf = c => CIR && CIR.devs.find(d => d.c === c);
function snapshot() { return JSON.stringify({ name: S.name, comps: S.comps, wires: S.wires, mats: (S.mats || []).map(m => ({ ...m, _edit: undefined })) }); }
function pushHist() { hist.push(snapshot()); if (hist.length > 80) hist.shift(); }
function restore(js) {
  const o = typeof js === 'string' ? JSON.parse(js) : js;
  const comps = (o.comps || []).filter(c => PARTS[c.type]).map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot || 0, props: Object.assign(JSON.parse(JSON.stringify(PARTS[c.type].props || {})), c.props || {}) }));
  S = { name: o.name || t('myCircuit'), comps, wires: (o.wires || []).filter(w => comps.some(c => c.id === w.a.c) && comps.some(c => c.id === w.b.c)), mats: sanitizeMats(o.mats) };
  nid = 1 + Math.max(0, ...S.comps.map(c => c.id), ...S.wires.map(w => w.id), ...S.mats.map(m => m.id || 0));
  S.mats.forEach(m => { if (!m.id) m.id = nid++; });
  $('#projName').value = S.name; sel = null; draft = null; changed();
}
function changed() { CIR = null; dirty = true; renderProps(); saveSoon(); }
let saveT = 0; function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => LS.set('cappytronic.project2', snapshot()), 400); }
function undo() { if (running) return toast(t('stopToEdit')); if (!hist.length) return toast(t('nothingUndo')); restore(hist.pop()); }

/* ================= RYSOWANIE ================= */
const svg = $('#cv'), stage = $('#stage'), lyComps = $('#lyComps'), lyWires = $('#lyWires'), lyTop = $('#lyTop');
const compEls = new Map();
const NS = 'http://www.w3.org/2000/svg';
function compInner(c) {
  const P = PARTS[c.type]; let s = P.draw(c, running ? rt(c) : {});
  if (c.type !== 'bb' && !P.mcu && !P.noDots) for (const p of pinsOf(c)) s += `<rect x="${p.x - 3}" y="${p.y - 3}" width="6" height="6" rx="1" class="pin"/>`;
  return s;
}
function renderComps() {
  const order = S.comps.filter(c => c.type === 'bb').concat(S.comps.filter(c => c.type !== 'bb'));
  const live = new Set();
  order.forEach((c, i) => {
    live.add(c.id);
    let e = compEls.get(c.id);
    if (!e) { const g = document.createElementNS(NS, 'g'); e = { g, str: null, tr: '' }; compEls.set(c.id, e); }
    const tr = `translate(${c.x} ${c.y}) rotate(${c.rot * 90})`; if (tr !== e.tr) { e.g.setAttribute('transform', tr); e.tr = tr; }
    const str = compInner(c); if (str !== e.str) { e.g.innerHTML = str; e.str = str; }
    if (lyComps.children[i] !== e.g) lyComps.insertBefore(e.g, lyComps.children[i] || null);
  });
  for (const [id, e] of compEls) if (!live.has(id)) { e.g.remove(); compEls.delete(id); }
}
function wirePts(w) { const a = byId(w.a.c), b = byId(w.b.c); if (!a || !b) return null; return [pinPos(a, w.a.t), ...w.pts, pinPos(b, w.b.t)]; }
const pd = pts => 'M' + pts.map(p => p[0] + ' ' + p[1]).join('L');
function render() {
  renderMats(); renderComps();
  let s = '';
  for (const w of S.wires) {
    const p = wirePts(w); if (!p) continue; const d = pd(p), on = sel && sel.k === 'w' && sel.id === w.id;
    if (on) s += `<path d="${d}" fill="none" stroke="#2fcf93" stroke-opacity=".6" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${d}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${w.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const q of [p[0], p[p.length - 1]]) s += `<circle cx="${q[0]}" cy="${q[1]}" r="3.4" fill="${w.color}" stroke="rgba(0,0,0,.5)"/>`;
  }
  lyWires.innerHTML = s;
  let top = matTopSvg();
  if (sel && sel.k === 'c') { const c = byId(sel.id); if (c) { const b = bboxOf(c); top += `<g transform="translate(${c.x} ${c.y}) rotate(${c.rot * 90})"><rect x="${b[0] - 5}" y="${b[1] - 5}" width="${b[2] - b[0] + 10}" height="${b[3] - b[1] + 10}" rx="7" class="selbox"/></g>`; } }
  if (draft) { const a = byId(draft.a.c); if (a) { const st = pinPos(a, draft.a.t), end = hoverT ? pinPos(byId(hoverT.c), hoverT.t) : draft.cur; const p = [st, ...draft.pts];
    top += `<path d="${pd(p)}" fill="none" stroke="${wireColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`; const l = p[p.length - 1];
    top += `<path d="M${l[0]} ${l[1]}L${end[0]} ${end[1]}" stroke="${wireColor}" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>`; } }
  if (hoverT && !running) { const c = byId(hoverT.c); if (c) { const p = pinPos(c, hoverT.t); top += `<circle cx="${p[0]}" cy="${p[1]}" r="7" class="hring"/>`; } }
  lyTop.innerHTML = top;
}
function applyView() {
  $('#world').setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  const a = 20 * view.k, b = 100 * view.k; stage.style.backgroundSize = `${b}px ${b}px,${b}px ${b}px,${a}px ${a}px,${a}px ${a}px`; stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
}
function worldBox(c) { const b = bboxOf(c); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [px, py] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) { const p = rotp(px, py, c.rot); x0 = Math.min(x0, c.x + p[0]); x1 = Math.max(x1, c.x + p[0]); y0 = Math.min(y0, c.y + p[1]); y1 = Math.max(y1, c.y + p[1]); } return [x0, y0, x1, y1]; }
function fit() {
  const r = svg.getBoundingClientRect(); if (!S.comps.length && !(S.mats || []).length) { view = { x: r.width / 2 - 200, y: r.height / 2 - 150, k: 1 }; applyView(); return; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const c of S.comps) { const b = worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  for (const m of S.mats || []) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y - MAT_TAB_H); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); }
  for (const w of S.wires) for (const p of w.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const pad = 50, bottomPad = r.width < 700 ? 140 : 105; const k = clamp(Math.min((r.width - 2 * pad) / (x1 - x0), (r.height - pad - bottomPad) / (y1 - y0)), 0.2, 1.6);
  view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: pad + ((r.height - pad - bottomPad) - (y1 - y0) * k) / 2 - y0 * k }; applyView(); dirty = true;
}
function zoomAt(f, px, py) { const k = clamp(view.k * f, 0.2, 4); const wx = (px - view.x) / view.k, wy = (py - view.y) / view.k; view.k = k; view.x = px - wx * k; view.y = py - wy * k; applyView(); }

/* ================= TRAFIANIE ================= */
function hitTerm(wx, wy) {
  const rr = Math.max(6, 9 / view.k);
  for (let i = S.comps.length - 1; i >= 0; i--) { const c = S.comps[i]; if (c.type === 'bb') continue; const ps = pinsOf(c); for (let t2 = 0; t2 < ps.length; t2++) { const p = pinPos(c, t2); if (Math.abs(p[0] - wx) < rr && Math.abs(p[1] - wy) < rr && Math.hypot(p[0] - wx, p[1] - wy) < rr) return { c: c.id, t: t2 }; } }
  for (let i = S.comps.length - 1; i >= 0; i--) {
    const c = S.comps[i]; if (c.type !== 'bb') continue; const g = bbGeom(c); const l = unrot(wx - c.x, wy - c.y, c.rot); const col = Math.round(l[0] / 20);
    let best = null, bd = 1e9; for (const r of g.rows) { const d = Math.abs(l[1] - r.y); if (d < bd) { bd = d; best = r; } }
    if (bd < rr && Math.abs(l[0] - col * 20) < rr) { const t2 = g.idx.get(best.y + ',' + col); if (t2 !== undefined) return { c: c.id, t: t2 }; }
  }
  return null;
}
function localPt(c, wx, wy) { return unrot(wx - c.x, wy - c.y, c.rot); }
function inBox(c, wx, wy) { const l = localPt(c, wx, wy), b = bboxOf(c); return l[0] >= b[0] && l[0] <= b[2] && l[1] >= b[1] && l[1] <= b[3]; }
function hitBody(wx, wy) { for (let i = S.comps.length - 1; i >= 0; i--) { const c = S.comps[i]; if (c.type !== 'bb' && inBox(c, wx, wy)) return c; } for (let i = S.comps.length - 1; i >= 0; i--) { const c = S.comps[i]; if (c.type === 'bb' && inBox(c, wx, wy)) return c; } return null; }
function segD(px, py, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const L2 = dx * dx + dy * dy; let tt = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0; tt = clamp(tt, 0, 1); return Math.hypot(px - a[0] - tt * dx, py - a[1] - tt * dy); }
function hitWire(wx, wy) { const tol = Math.max(4, 6 / view.k); for (let i = S.wires.length - 1; i >= 0; i--) { const p = wirePts(S.wires[i]); if (!p) continue; for (let j = 0; j < p.length - 1; j++) if (segD(wx, wy, p[j], p[j + 1]) < tol) return S.wires[i]; } return null; }
function seated(bb) {
  const g = bbGeom(bb), out = [];
  for (const c of S.comps) { if (c === bb || c.type === 'bb') continue; if (pinsOf(c).some((_, i) => { const p = pinPos(c, i); const l = unrot(p[0] - bb.x, p[1] - bb.y, bb.rot); return Math.round(l[0]) % 20 === 0 && g.idx.has(Math.round(l[1]) + ',' + Math.round(l[0] / 20)); })) out.push(c); }
  return out;
}

/* ================= EDYCJA ================= */
function select(k, id) { sel = k ? { k, id } : null; dirty = true; if (sel && sel.k === 'c') { const c = byId(id); if (c && PARTS[c.type].mcu) codeBind(c); } renderProps(); if (sel && innerWidth <= 980) $('#props').classList.add('open'); }
function addComp(type, wx, wy, extra) { // extra – właściwości nadpisujące domyślne (np. pozycja z biblioteki zewnętrznej)
  const P = PARTS[type]; if (P.locked) { toast(t('lockedPart', { n: L(P.name) })); showLocked(P); return; }
  if (running) return toast(t('stopToEdit'));
  pushHist(); const b = typeof P.bbox === 'function' ? P.bbox({ props: P.props }) : P.bbox;
  const c = { id: newId(), type, x: Math.round((wx - (b[0] + b[2]) / 2) / G) * G, y: Math.round((wy - (b[1] + b[3]) / 2) / G) * G, rot: 0, props: JSON.parse(JSON.stringify(P.props || {})) };
  if (P.mcu) c.props.code = P.props.code;
  if (extra) Object.assign(c.props, JSON.parse(JSON.stringify(extra)));
  if (type === 'bb') S.comps.unshift(c); else S.comps.push(c);
  changed(); select('c', c.id);
}
function delSel() { if (!sel || running) return; pushHist(); if (sel.k === 'm') S.mats = S.mats.filter(m => m.id !== sel.id); else if (sel.k === 'c') { S.comps = S.comps.filter(c => c.id !== sel.id); S.wires = S.wires.filter(w => w.a.c !== sel.id && w.b.c !== sel.id); } else S.wires = S.wires.filter(w => w.id !== sel.id); sel = null; changed(); }
function rotSel() { if (!sel || sel.k !== 'c' || running) return; const c = byId(sel.id); pushHist(); c.rot = (c.rot + 1) % 4; changed(); }
function dupSel() { if (sel && sel.k === 'm' && !running) { const m = matById(sel.id); if (!m) return; pushHist(); const n = { ...m, id: newId(), x: m.x + 40, y: m.y + 40 }; delete n._edit; S.mats.push(n); changed(); select('m', n.id); return; } if (!sel || sel.k !== 'c' || running) return; const c = byId(sel.id); pushHist(); const n = JSON.parse(JSON.stringify(c)); n.id = newId(); n.x += 40; n.y += 40; n.props.pressed = false; if (n.type === 'bb') S.comps.unshift(n); else S.comps.push(n); changed(); select('c', n.id); }

function toWorld(e) { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]; }
const pointers = new Map(); let pinch = null;
svg.addEventListener('contextmenu', e => { e.preventDefault(); if (draft) { draft = null; dirty = true; } });
svg.addEventListener('pointerdown', e => {
  svg.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const r = svg.getBoundingClientRect(); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, v: { ...view } }; act = null; return; }
  if (e.button === 2) return;
  const [wx, wy] = toWorld(e);
  if (running) {
    const c = hitBody(wx, wy);
    if (c) { const P = PARTS[c.type];
      if (P.click) { P.click(c); E.dirty = true; dirty = true; renderProps(); return; }
      if (P.press) { c.props.pressed = true; act = { t: 'press', c }; E.dirty = true; dirty = true; return; }
      if (P.touch) { const a = P.touch.area(c), l = localPt(c, wx, wy); if (l[0] >= a.sx && l[0] <= a.sx + a.sw && l[1] >= a.sy && l[1] <= a.sy + a.sh) { act = { t: 'touch', c, a }; touchAt(c, a, l); return; } }
      if (c.type !== 'bb') select('c', c.id); }
    act = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return;
  }
  if (matPointerDown(wx, wy)) return;
  if (draft) {
    const tt = hitTerm(wx, wy);
    if (tt) { if (!(tt.c === draft.a.c && tt.t === draft.a.t)) { pushHist(); S.wires.push({ id: newId(), a: draft.a, b: tt, pts: draft.pts, color: wireColor }); } draft = null; changed(); }
    else { draft.pts.push([Math.round(wx / 10) * 10, Math.round(wy / 10) * 10]); dirty = true; }
    return;
  }
  const tt = hitTerm(wx, wy); if (tt) { draft = { a: tt, pts: [], cur: [wx, wy] }; sel = null; renderProps(); dirty = true; return; }
  const w = hitWire(wx, wy); if (w) { select('w', w.id); return; }
  const c = hitBody(wx, wy); if (!c && matPointerDownBody(wx, wy)) return; if (c) { select('c', c.id); act = { t: 'drag', c, ox: wx - c.x, oy: wy - c.y, moved: false, carry: c.type === 'bb' ? seated(c) : [] }; return; }
  select(null); act = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
});
function touchAt(c, a, l) { const fx = clamp((l[0] - a.sx) / a.sw, 0, 1), fy = clamp((l[1] - a.sy) / a.sh, 0, 1); rt(c).touch = { x: Math.round(200 + fx * 3700), y: Math.round(200 + fy * 3700) }; }
svg.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const k = clamp(pinch.v.k * d / pinch.d, 0.2, 4); const r = svg.getBoundingClientRect(); const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top; const wx = (pinch.mx - pinch.v.x) / pinch.v.k, wy = (pinch.my - pinch.v.y) / pinch.v.k; view = { k, x: mx - wx * k, y: my - wy * k }; applyView(); return; }
  const [wx, wy] = toWorld(e);
  if (act && act.t === 'touch') { touchAt(act.c, act.a, localPt(act.c, wx, wy)); return; }
  if (matPointerMove(wx, wy)) { hideTip(); return; }
  if (act && act.t === 'pan') { view.x = act.vx + e.clientX - act.sx; view.y = act.vy + e.clientY - act.sy; applyView(); hideTip(); return; }
  if (act && act.t === 'drag') {
    const c = act.c, nx = Math.round((wx - act.ox) / G) * G, ny = Math.round((wy - act.oy) / G) * G;
    if (nx !== c.x || ny !== c.y) { if (!act.moved) { pushHist(); act.moved = true; } const dx = nx - c.x, dy = ny - c.y, set = new Set([c.id, ...act.carry.map(q => q.id)]);
      for (const q of [c, ...act.carry]) { q.x += dx; q.y += dy; }
      if (act.carry.length) for (const w of S.wires) if (set.has(w.a.c) && set.has(w.b.c)) w.pts = w.pts.map(p => [p[0] + dx, p[1] + dy]);
      CIR = null; dirty = true; }
    hideTip(); return;
  }
  const prev = hoverT; hoverT = running ? null : hitTerm(wx, wy);
  if (draft) { draft.cur = [wx, wy]; dirty = true; } else if (JSON.stringify(prev) !== JSON.stringify(hoverT)) dirty = true;
  showTip(e, wx, wy);
});
function endPointer(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (matPointerUp()) return; if (act && act.t === 'press') { act.c.props.pressed = false; E.dirty = true; dirty = true; } if (act && act.t === 'touch') rt(act.c).touch = null; if (act && act.t === 'drag' && act.moved) changed(); act = null; }
svg.addEventListener('pointerup', endPointer); svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('pointerleave', () => { hideTip(); if (hoverT) { hoverT = null; dirty = true; } });
svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
const tip = $('#tip');
function hideTip() { tip.hidden = true; }
function showTip(e, wx, wy) {
  let h = '';
  if (hoverT) { const c = byId(hoverT.c); h = `<b>${esc(L(PARTS[c.type].name))}</b> · ${esc(pinName(c, hoverT.t))}`; }
  else { const c = hitBody(wx, wy); if (c && c.type !== 'bb') { const r = rt(c); h = `<b>${esc(L(PARTS[c.type].name))}</b>`; if (running && r.U !== undefined) h += ` · <span class="m">U = ${si(r.U, 'V')} · I = ${si(r.I || 0, 'A')}</span>`; } }
  if (!h) { tip.hidden = true; return; } tip.innerHTML = h; tip.hidden = false; const r = stage.getBoundingClientRect();
  let x = e.clientX - r.left + 14, y = e.clientY - r.top + 16; if (x + tip.offsetWidth > r.width - 8) x = e.clientX - r.left - tip.offsetWidth - 10; tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#fileModal').hidden) { $('#fileModal').hidden = true; return; }
  const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || e.target.closest('.CodeMirror')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); dupSel(); return; }
  if (e.key === 'Escape') { if (matMode) setMatMode(false); else if (draft) { draft = null; dirty = true; } else select(null); closeMenus(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); return; }
  if (e.key === 'r' || e.key === 'R') { rotSel(); return; }
  if (e.key === ' ') { e.preventDefault(); toggleSim(); }
});

/* ================= PALETA ================= */
function mini(type, props) {
  const P = PARTS[type]; const c = { id: 0, type, x: 0, y: 0, rot: 0, props: props || P.props || {} }; const b = bboxOf(c), pad = 8;
  let inner = ''; try { inner = P.draw(c, {}, pinsOf(c)); } catch (e) { inner = ''; }
  return `<svg viewBox="${b[0] - pad} ${b[1] - pad} ${b[2] - b[0] + 2 * pad} ${b[3] - b[1] + 2 * pad}" aria-hidden="true">${inner}</svg>`;
}
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
function partSearchText(P) { return norm([P.id, L(P.name), P.name && P.name.pl, P.name && P.name.en, typeof P.sub === 'object' ? (P.sub.pl + ' ' + P.sub.en) : P.sub || '', P.kw || '', L(CATS.find(c => c[0] === P.cat)[1])].join(' ')); }
let openCats = new Set(JSON.parse(LS.get('cappytronic.cats') || '["basic"]'));
const itemHtml = P => `<div class="pal-item${P.locked ? ' locked' : ''}" data-type="${P.id}" tabindex="0" role="button" title="${esc(L(P.name))}"><div class="pal-thumb">${P.locked ? '<svg viewBox="0 0 40 40"><rect x="8" y="10" width="24" height="20" rx="3" fill="#2b2f36" stroke="#000"/>' + [0, 1, 2, 3].map(i => `<rect x="${11 + i * 5}" y="5" width="2" height="5" fill="#bbb"/><rect x="${11 + i * 5}" y="30" width="2" height="5" fill="#bbb"/>`).join('') + '</svg>' : mini(P.id)}</div><span class="nm">${esc(L(P.name))}</span>${P.sub ? `<span class="sb">${esc(L(P.sub))}</span>` : ''}</div>`;
const palParts = () => Object.values(PARTS).filter(P => !P.ext); // P.ext – rodziny modeli biblioteki zewnętrznej (tylko w jej zakładce)
function buildPalette() {
  if (typeof palTab !== 'undefined' && palTab === 'ext') return buildExtPalette();
  const q = norm($('#search').value.trim()); const list = $('#plist'); let h = '';
  if (q) {
    const words = q.split(/\s+/); const hits = palParts().filter(P => { const s = partSearchText(P); return words.every(w => s.includes(w)); });
    h = hits.length ? `<div class="pal-grid">${hits.map(itemHtml).join('')}</div>` : `<div class="empty-s">${t('noResults')}</div>`;
  } else {
    for (const [cid, cname] of CATS) {
      const items = palParts().filter(P => P.cat === cid || (P.also || []).includes(cid)); if (!items.length) continue;
      const open = openCats.has(cid);
      h += `<details class="cat" data-cat="${cid}"${open ? ' open' : ''}><summary>${esc(L(cname))}<span class="n">${items.length}</span></summary>${open ? `<div class="pal-grid">${items.map(itemHtml).join('')}</div>` : ''}</details>`;
    }
  }
  list.innerHTML = h;
}
$('#search').addEventListener('input', buildPalette);
$('#plist').addEventListener('toggle', e => {
  const d = e.target; if (!d.classList || !d.classList.contains('cat')) return; const cid = d.dataset.cat;
  if (d.open) { openCats.add(cid); if (!d.querySelector('.pal-grid')) { const items = palParts().filter(P => P.cat === cid || (P.also || []).includes(cid)); d.insertAdjacentHTML('beforeend', `<div class="pal-grid">${items.map(itemHtml).join('')}</div>`); } } else openCats.delete(cid);
  LS.set('cappytronic.cats', JSON.stringify([...openCats]));
}, true);
(function paletteDrag() {
  const pal = $('#plist'); let gd = null;
  // pozycja biblioteki zewnętrznej (data-lcsc) wstawia element z właściwościami z katalogu
  const palProps = it => it.dataset.lcsc && typeof lcscProps === 'function' ? lcscProps(it.dataset.lcsc) : undefined;
  pal.addEventListener('pointerdown', e => { const it = e.target.closest('.pal-item'); if (!it) return; e.preventDefault(); it.setPointerCapture(e.pointerId); gd = { it, type: it.dataset.type, props: palProps(it), sx: e.clientX, sy: e.clientY, ghost: null }; });
  pal.addEventListener('pointermove', e => { if (!gd || PARTS[gd.type].locked) return; if (!gd.ghost && Math.hypot(e.clientX - gd.sx, e.clientY - gd.sy) > 6) { gd.ghost = document.createElement('div'); gd.ghost.className = 'ghost'; gd.ghost.innerHTML = `<div class="pal-thumb">${mini(gd.type, gd.props && Object.assign({}, PARTS[gd.type].props, gd.props))}</div>`; document.body.appendChild(gd.ghost); } if (gd.ghost) { gd.ghost.style.left = e.clientX + 'px'; gd.ghost.style.top = e.clientY + 'px'; } });
  pal.addEventListener('pointerup', e => { if (!gd) return; const r = svg.getBoundingClientRect();
    if (gd.ghost) { gd.ghost.remove(); if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) { const [wx, wy] = toWorld(e); addComp(gd.type, wx, wy, gd.props); } }
    else addComp(gd.type, (r.width / 2 - view.x) / view.k, (r.height / 2 - view.y) / view.k, gd.props);
    gd = null; });
  pal.addEventListener('pointercancel', () => { if (gd && gd.ghost) gd.ghost.remove(); gd = null; });
  pal.addEventListener('keydown', e => { const it = e.target.closest('.pal-item'); if (it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const r = svg.getBoundingClientRect(); addComp(it.dataset.type, (r.width / 2 - view.x) / view.k, (r.height / 2 - view.y) / view.k, palProps(it)); } });
})();
function showLocked(P) { lockedShown = P; tab = 'props'; sel = null; renderProps(); }
let lockedShown = null;

/* ================= PANEL WŁAŚCIWOŚCI ================= */
function setTab(tb) { tab = tb; document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tb)); $('#app').classList.toggle('wide', tb === 'code'); renderProps(); setTimeout(() => { if (CM) CM.refresh(); }, 30); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
const jv = v => esc(JSON.stringify(v));
function ctlHtml(c, u) {
  const p = c.props, lab = u.l ? `<span class="lbl">${esc(L(u.l))}</span>` : '';
  if (u.type === 'seg') return `<div>${lab}<div class="seg">${u.opts.map(o => `<button data-prop="${u.k}" data-val="${jv(o[0])}" data-live="${u.live ? 1 : 0}" aria-pressed="${String(o[0]) === String(p[u.k])}">${esc(L(o[1]))}</button>`).join('')}</div></div>`;
  if (u.type === 'select') return `<div>${lab}<select data-prop="${u.k}" data-json="1">${u.opts.map(o => `<option value="${jv(o[0])}"${String(o[0]) === String(p[u.k]) ? ' selected' : ''}>${esc(L(o[1]))}</option>`).join('')}</select></div>`;
  if (u.type === 'swatch') return `<div>${lab}<div class="sw">${u.opts.map(o => `<button data-prop="${u.k}" data-val="${jv(o[0])}" data-live="1" title="${esc(L(o[2]))}" style="background:${o[1]}" aria-pressed="${o[0] === p[u.k]}"></button>`).join('')}</div></div>`;
  if (u.type === 'si') return `<div>${lab}<div class="sirow"><input class="inp" data-si="${u.k}" data-unit="${u.unit}" value="${esc(siT(p[u.k], u.unit))}"><select data-prop="${u.k}" data-json="1"><option value="">▾</option>${(u.presets || []).map(v => `<option value="${v}">${esc(siT(v, u.unit))}</option>`).join('')}</select></div></div>`;
  if (u.type === 'range') return `<div><span class="lbl" data-rl="${u.k}">${esc(L(u.l))}: ${esc(u.fmt ? u.fmt(p[u.k], c) : p[u.k])}</span><input type="range" data-range="${u.k}" min="${u.min}" max="${u.max}" step="${u.step}" value="${p[u.k]}"></div>`;
  if (u.type === 'bands') { const b = bandsFor(p.r); return `<div><span class="lbl">${t('bandsLabel')}</span><div class="bands">${b.map(i => `<span class="band"><i style="background:${BANDS[i][0]}"></i>${LANG === 'pl' ? BANDS[i][1] : BANDS[i][2]}</span>`).join('')}<span class="band"><i style="background:#c9a227"></i>${t('tol')}</span></div></div>`; }
  if (u.type === 'serial') { const r = rt(c); return `<div class="serial" style="height:200px"><div class="sh">${t('serialMon')}<button class="btn" data-act="clrser" style="padding:2px 8px">${t('clearOut')}</button></div><pre id="modSer">${esc(r.text || '')}</pre><form id="modSend"><input id="modIn" placeholder="${esc(t('serialPh'))}"><button>${t('send')}</button></form></div>`; }
  return '';
}
function readingsHtml(c) {
  const P = PARTS[c.type], r = rt(c);
  if (!running || (r.U === undefined && !P.readings)) return `<div class="read"><div class="empty">${t('runToSee')}</div></div>`;
  let rows = P.readings ? P.readings(c, r) : [['U', si(r.U, 'V')], ['I', si(r.I || 0, 'A')], ['P', si(r.P || 0, 'W')]];
  if (!rows.length) return '';
  return `<div class="read">${rows.map(x => `<div class="row"><span>${typeof x[0] === 'string' ? x[0] : esc(L(x[0]))}</span><b>${esc(L(x[1]))}</b></div>`).join('')}</div>`;
}
function warnText(d) { const k = d.s.warn; if (!k) return ''; const P = d.P; return t('w_' + k, { n: L(P.name), i: si(Math.abs(d.s.I || 0), 'A'), p: si(d.s.P || 0, 'W'), e: d.mcu && d.mcu.pyErr ? (d.mcu.pyErr.line ? t('line') + ' ' + d.mcu.pyErr.line + ': ' : '') + explainPy(d.mcu.pyErr.msg) : '' }); }
function renderProps() {
  const pb = $('#pbody'); updateTaskCount();
  $('#codeDot').hidden = !S.comps.some(c => PARTS[c.type].mcu);
  if (tab === 'tasks') { pb.innerHTML = tasksHtml(); return; }
  if (tab === 'code') { renderCode(); return; }
  if (tab === 'mqtt') { renderMqtt(); return; }
  if (CM_HOST.parentNode) CM_HOST.remove();
  if (lockedShown && !sel) { const P = lockedShown; pb.innerHTML = `<div class="ph"><div><h2>${esc(L(P.name))}</h2><div class="sb">${esc(L(P.sub))} · ${t('notEmulated')}</div></div></div><p class="info">${esc(L(P.info))}</p>`; lockedShown = null; return; }
  if (sel && sel.k === 'm') { const m = matById(sel.id); if (!m) { sel = null; return renderProps(); } pb.innerHTML = matPropsHtml(m); return; }
  if (sel && sel.k === 'w') {
    const w = S.wires.find(x => x.id === sel.id); if (!w) { sel = null; return renderProps(); }
    pb.innerHTML = `<div class="ph"><div><h2>${t('wire')}</h2></div></div><p class="info">${t('wireInfo')}</p><div><span class="lbl">${t('colour')}</span><div class="sw">${WIRE_COLS.map(c => `<button data-wcol="${c[0]}" title="${esc(L(c[1]))}" style="background:${c[0]}" aria-pressed="${c[0] === w.color}"></button>`).join('')}</div></div><div class="acts"><button class="btn danger" data-act="del">${t('delWire')}</button></div>`; return;
  }
  if (sel && sel.k === 'c') {
    const c = byId(sel.id); if (!c) { sel = null; return renderProps(); } const P = PARTS[c.type];
    const d = running ? devOf(c) : null; const w = d ? warnText(d) : '';
    pb.innerHTML = `<div class="ph"><div class="ic">${mini(c.type, c.props)}</div><div><h2>${esc(L(P.name))}</h2>${P.sub ? `<div class="sb">${esc(L(P.sub))}</div>` : ''}</div></div><p class="info">${esc(L(P.info || ''))}</p>` + (c.props.lcsc && typeof lcscInfoHtml === 'function' ? lcscInfoHtml(c) : '') +
      (w ? `<div class="warnbox" id="warnbox">${esc(w)}</div>` : '<div id="warnbox" hidden></div>') +
      (P.ui || []).map(u => ctlHtml(c, u)).join('') +
      (P.mcu ? `<div class="acts"><button class="btn pri" data-act="code">${t('tabCode')} →</button>${running ? `<button class="btn" data-act="reset">${t('resetMcu')}</button>` : ''}</div>` : '') +
      (c.type === 'bb' || (P.readings && P.readings(c, rt(c)).length === 0 && running) || c.type === 'scope' ? '' : `<div><span class="lbl">${t('readings')}</span><div id="readings">${readingsHtml(c)}</div></div>`) +
      `<div class="acts"><button class="btn" data-act="rot">${t('rotate')} <kbd>R</kbd></button><button class="btn" data-act="dup">${t('duplicate')}</button><button class="btn danger" data-act="del">${t('del')}</button></div>`;
    return;
  }
  const cnt = S.comps.filter(c => c.type !== 'bb').length;
  pb.innerHTML = `<div class="ph"><div><h2>${esc(S.name)}</h2><div class="sb">${t('partsN', { n: cnt })} · ${t('wiresN', { n: S.wires.length })}</div></div></div>
  <div><span class="lbl">${t('howTo')}</span><ol class="steps"><li>${t('how1')}</li><li>${t('how2')}</li><li>${t('how3')}</li></ol></div>
  <div><span class="lbl">${t('wireColorNew')}</span><div class="sw">${WIRE_COLS.map(c => `<button data-ncol="${c[0]}" title="${esc(L(c[1]))}" style="background:${c[0]}" aria-pressed="${c[0] === wireColor}"></button>`).join('')}</div></div>
  <div><span class="lbl">${t('shortcuts')}</span><div class="keys"><kbd>R</kbd><span>${t('kRot')}</span><kbd>Del</kbd><span>${t('kDel')}</span><kbd>Ctrl+D</kbd><span>${t('kDup')}</span><kbd>Ctrl+Z</kbd><span>${t('kUndo')}</span><kbd>Esc</kbd><span>${t('kEsc')}</span><kbd>${LANG === 'pl' ? 'Spacja' : 'Space'}</kbd><span>${t('kSpace')}</span></div></div>`;
}
function setProp(c, k, v, live) { const P = PARTS[c.type]; if (!(running && live)) pushHist(); c.props[k] = v; if (running) { E.dirty = true; dirty = true; renderProps(); saveSoon(); } else changed(); }
$('#pbody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'del') return delSel(); if (a === 'rot') return rotSel(); if (a === 'dup') return dupSel(); if (a === 'code') return setTab('code');
  if (a === 'reset') { const c = byId(sel.id), d = devOf(c); if (d && d.mcu) d.mcu.resetReq = true; return; }
  if (a === 'clrser') { const c = byId(sel.id); rt(c).text = ''; $('#modSer').textContent = ''; return; }
  if (b.dataset.ncol) { wireColor = b.dataset.ncol; renderProps(); return; }
  if (b.dataset.wcol) { const w = S.wires.find(x => x.id === sel.id); pushHist(); w.color = b.dataset.wcol; changed(); return; }
  if (b.dataset.task) { const tk = TASKS.find(x => x.id === b.dataset.task); toast(L(tk.hint)); return; }
  if (b.dataset.prop && sel && sel.k === 'c') { const c = byId(sel.id); setProp(c, b.dataset.prop, JSON.parse(b.dataset.val), b.dataset.live === '1'); }
});
$('#pbody').addEventListener('change', e => {
  const el = e.target; if (!sel || sel.k !== 'c') return; const c = byId(sel.id);
  if (el.dataset.si) { const v = parseSI(el.value); if (isFinite(v) && v > 0) setProp(c, el.dataset.si, v, false); else el.value = siT(c.props[el.dataset.si], el.dataset.unit); return; }
  if (el.dataset.prop && el.value !== '') setProp(c, el.dataset.prop, JSON.parse(el.value), true);
});
$('#pbody').addEventListener('input', e => {
  const el = e.target; if (!el.dataset.range || !sel) return; const c = byId(sel.id), k = el.dataset.range; c.props[k] = +el.value; E.dirty = true; dirty = true; saveSoon();
  const u = PARTS[c.type].ui.find(x => x.k === k); const l = $(`[data-rl="${k}"]`); if (l) l.textContent = L(u.l) + ': ' + (u.fmt ? u.fmt(c.props[k], c) : c.props[k]);
});
$('#pbody').addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'modSend') { const c = byId(sel.id), d = devOf(c), inp = $('#modIn'); if (d && running) { UART_BRIDGE.send(d, [...new TextEncoder().encode(inp.value + '\n')]); } inp.value = ''; } if (e.target.id === 'serSend') serialSend(); });

/* ================= EDYTOR KODU ================= */
if (window.CodeMirror && !CodeMirror.modes['pic-asm']) CodeMirror.defineMode('pic-asm', () => ({
  token(st) {
    if (st.sol() && /^[A-Za-z_?@]/.test(st.string) && st.match(/^[A-Za-z_?@][\w?@.]*:?/)) return 'def';
    if (st.eatSpace()) return null; if (st.match(/^;.*/)) return 'comment';
    if (st.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    if (st.match(/^(?:0x[0-9a-f]+|[hdboq]'[0-9a-f]+'|\.\d+|[0-9][0-9a-f]*h?|'.')/i)) return 'number';
    if (st.match(/^#?[A-Za-z_][\w*+\-]*/)) { const w = st.current().toUpperCase().replace(/^#/, ''); if (/^(LIST|INCLUDE|__CONFIG|CONFIG|EQU|SET|CBLOCK|ENDC|ORG|END|DT|DE|DW|DB|DATA|RES|FILL|BANKSEL|PAGESEL|BANKISEL|DEFINE|UNDEFINE|IF|IFDEF|IFNDEF|ELSE|ENDIF|MACRO|ENDM|LOCAL|EXITM|PROCESSOR|RADIX|ERRORLEVEL|CONSTANT|VARIABLE|MESSG|ERROR)$/.test(w)) return 'meta'; if ((typeof P16OPS !== 'undefined' && w in P16OPS) || (typeof P18OPS !== 'undefined' && w in P18OPS)) return 'keyword'; return 'variable'; }
    st.next(); return null;
  },
  lineComment: ';',
}));
const CM_HOST = document.createElement('div'); CM_HOST.className = 'cmhost';
let CM = null, codeComp = null, compileState = null;
function codeBind(c) { codeComp = c; compileState = null; if (CM) { CM.__binding = true; CM.setValue(c.props.code || ''); CM.clearHistory(); CM.__binding = false; } }
function mcuList() { return S.comps.filter(c => PARTS[c.type].mcu); }
function isPyC(c) { return !!(c && PARTS[c.type].py); }
function isCppC(c) { return isPyC(c) && c.props.lang === 'cpp'; }
function renderCode() {
  const pb = $('#pbody'); const mcus = mcuList();
  if (!mcus.length) { pb.innerHTML = `<p class="info">${t('noMcu')}</p>`; return; }
  if (!codeComp || !mcus.includes(codeComp)) codeBind(mcus[0]);
  const c = codeComp, P = PARTS[c.type], pyb = isPyC(c), cpp = isCppC(c), py = pyb && !cpp, asm = !!P.asm;
  const stale = !py && (cpp ? !!c.props.wasm && c.props.wasmCode !== c.props.code : c.props.hex && c.props.hexCode !== c.props.code);
  const lang = pyb ? `<select id="langPick" title="${esc(t('langPick'))}"><option value="py"${cpp ? '' : ' selected'}>MicroPython</option><option value="cpp"${cpp ? ' selected' : ''}>C++ (Arduino)</option></select>` : '';
  const pick = mcus.length > 1 ? `<select id="mcuPick">${mcus.map(m => `<option value="${m.id}"${m === c ? ' selected' : ''}>${esc(L(PARTS[m.type].name))} #${m.id}</option>`).join('')}</select>` : '';
  const btns = py ? `${running ? `<button class="btn pri" id="btnPyRun">${t('pyRestart')}</button>` : ''}<button class="btn" id="btnSrcSave">${t('saveSrc')}</button><button class="btn" id="btnSrcOpen">${t('openSrc')}</button>`
    : cpp ? `<button class="btn pri" id="btnCompile">${t('compile')}</button><button class="btn" id="btnSrcSave">${t('saveSrc')}</button><button class="btn" id="btnSrcOpen">${t('openSrc')}</button>`
    : asm ? `<button class="btn pri" id="btnCompile">${t('asmCompile')}</button><button class="btn" id="btnHex">${t('loadHex')}</button><button class="btn" id="btnSrcSave">${t('saveSrc')}</button><button class="btn" id="btnSrcOpen">${t('openSrc')}</button>`
    : `<button class="btn pri" id="btnCompile">${t('compile')}</button><button class="btn" id="btnHex">${t('loadHex')}</button><button class="btn" id="btnSrcSave">${t('saveSrc')}</button>`;
  pb.innerHTML = `<div class="codewrap"><div class="codebar"><span class="who">${esc(t('codeFor', { n: L(P.name) }))}${pyb ? '' : asm ? ' · ' + t('asmLang') : P.cppLabel ? ' · ' + P.cppLabel : ' · Arduino C++'}</span>${lang}${pick}${btns}<button class="btn" id="btnUpload" title="${esc(t('upTip'))}">${t('upBtn')}</button></div>
    <div id="cmSlot" style="display:flex;flex:1;min-height:220px"></div><div id="cmsg">${compileMsg(stale)}</div>
    <div class="serial"><div class="sh">${t('serialMon')}${running && !pyb ? `<button class="btn" id="btnRst" style="padding:2px 8px;margin-left:auto">${t('resetMcu')}</button>` : ''}<button class="btn" id="btnClr" style="padding:2px 8px${running && !pyb ? ';margin-left:0' : ''}">${t('clearOut')}</button></div><pre id="serOut"></pre><form id="serSend"><input id="serIn" placeholder="${esc(t('serialPh'))}"${running ? '' : ' disabled'}><button${running ? '' : ' disabled'}>${t('send')}</button></form></div>
    <p class="hint">${py ? t('pyLibsHint') : cpp ? t('cppLibsHint') : asm ? t('asmHint') : P.libsHint ? t(P.libsHint) : t('libsHint')}</p></div>`;
  $('#cmSlot').appendChild(CM_HOST);
  if (!CM) {
    CM = CodeMirror(CM_HOST, { value: c.props.code || '', mode: py ? 'python' : asm ? 'pic-asm' : 'text/x-c++src', lineNumbers: true, indentUnit: py ? 4 : asm ? 8 : 2, tabSize: 4, matchBrackets: true, autoCloseBrackets: true,
      extraKeys: { 'Ctrl-S': () => codeRunKey(), 'Ctrl-Enter': () => codeRunKey(), Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(cm.getOption('indentUnit') === 4 ? '    ' : '  ', 'end') } });
    CM.on('change', () => { if (CM.__binding || !codeComp) return; codeComp.props.code = CM.getValue(); saveSoon(); markErrors([]); const m = $('#cmsg'); if (m && (codeComp.props.hex || isPyC(codeComp))) { compileState = null; m.innerHTML = compileMsg(!isPyC(codeComp) || isCppC(codeComp), true); } });
  }
  const want = py ? 'python' : asm ? 'pic-asm' : 'text/x-c++src'; if (CM.getOption('mode') !== want) { CM.setOption('mode', want); CM.setOption('indentUnit', py ? 4 : asm ? 8 : 2); }
  setTimeout(() => CM.refresh(), 0); updateSerial(true);
  if (py) { const d = devOf(c); markErrors(d && d.mcu && d.mcu.pyErr ? [d.mcu.pyErr.line] : []); }
  const lp = $('#langPick'); if (lp) lp.onchange = () => setCodeLang(c, lp.value);
  const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
  on('btnCompile', doCompile); on('btnHex', () => $('#hexOpen').click()); on('btnPyRun', pyRunNow);
  on('btnSrcSave', saveSource); on('btnUpload', openUpload); on('btnSrcOpen', () => $('#srcOpen').click());
  const mp = $('#mcuPick'); if (mp) mp.onchange = () => { codeBind(byId(+mp.value)); renderCode(); };
  const br = $('#btnRst'); if (br) br.onclick = () => { const d = devOf(codeComp); if (d && d.mcu) d.mcu.resetReq = true; };
  $('#btnClr').onclick = () => { const d = devOf(codeComp); if (d && d.mcu) d.mcu.serial = ''; updateSerial(true); };
}
function setCodeLang(c, lang) {
  const old = c.props.lang === 'cpp' ? 'cpp' : 'py'; if (old === lang) return;
  pushHist();
  c.props['code_' + old] = c.props.code;
  const o = PARTS[c.type].pyBoard;
  c.props.code = c.props['code_' + lang] != null ? c.props['code_' + lang] : (lang === 'cpp' ? cppDefaultCode(o) : o.code);
  c.props.lang = lang; delete c.props['code_' + lang];
  compileState = null; codeBind(c); renderCode(); saveSoon();
  toast(t('langSwitched', { l: lang === 'cpp' ? 'C++ (Arduino)' : 'MicroPython' }));
  const d = devOf(c); if (running && d) cppRestartDev(d);
}
function cppRestartDev(d) { if (d.py && !d.py.dead) pyStop(d); d.py = null; if (d.mcu) { d.mcu.done = false; d.mcu.pyErr = null; } d.P.sim.init(d); E.dirty = true; }
let cppBusy = new Set();
async function cppCompile(c) {
  if (!window.cappyNative || !window.cappyNative.compileCpp) return { ok: false, diags: [{ line: 0, type: 'error', msg: t('noCompiler') }] };
  let res; try { res = await window.cappyNative.compileCpp({ code: c.props.code, board: c.type }); } catch (e) { res = { ok: false, diags: [{ line: 0, type: 'error', msg: String(e) }] }; }
  if (res.ok) { c.props.wasm = res.wasm; c.props.wasmCode = c.props.code; saveSoon(); }
  return res;
}
async function cppAutoCompile(d) {
  const c = d.c; if (cppBusy.has(c.id)) return; cppBusy.add(c.id);
  const code = c.props.code;
  if (codeComp === c) { compileState = { busy: true }; const m = $('#cmsg'); if (m && tab === 'code') m.innerHTML = compileMsg(false); }
  const res = await cppCompile(c); cppBusy.delete(c.id);
  if (codeComp === c) { compileState = { res }; markErrors(res.ok ? [] : res.diags.filter(x => x.type === 'error').map(x => x.line)); const m = $('#cmsg'); if (m && tab === 'code') m.innerHTML = compileMsg(false); }
  if (!res.ok) { if (d.mcu) { d.mcu.serial += '[CappyTronic] ' + t('cppCompileFail') + '\n'; SERIAL.dirty = true; } return; }
  if (running && devOf(c) === d && c.props.code === code) cppRestartDev(d);
}
function codeRunKey() { if (isCppC(codeComp)) doCompile(); else if (isPyC(codeComp)) { if (running) pyRunNow(); else toggleSim(); } else doCompile(); }
function pyRunNow() { const d = devOf(codeComp); if (!running) { toggleSim(); return; } if (d && d.py) { d.mcu.serial += '\n— ' + t('pyRestarted') + ' —\n'; pyRestart(d); } else { toggleSim(); toggleSim(); } markErrors([]); const m = $('#cmsg'); if (m) m.innerHTML = compileMsg(false); }
function onPyError(d) { if (tab === 'code' && codeComp === d.c) { markErrors(d.mcu.pyErr.line ? [d.mcu.pyErr.line] : []); const m = $('#cmsg'); if (m) m.innerHTML = compileMsg(false); } }
async function saveSource() {
  const c = codeComp; if (!c) return; const py = isPyC(c) && !isCppC(c), ext = py ? 'py' : PARTS[c.type].asm ? 'asm' : 'ino', name = (py ? 'main' : (S.name || 'sketch').replace(/[\\/:*?"<>|\s]+/g, '_')) + '.' + ext;
  await saveData(name, c.props.code || '', ext, 'text/plain');
}
$('#srcOpen').onchange = e => { const f = e.target.files[0]; if (!f || !codeComp) return; const r = new FileReader(); r.onload = () => { codeBind(codeComp); codeComp.props.code = String(r.result); if (CM) { CM.__binding = true; CM.setValue(codeComp.props.code); CM.__binding = false; } saveSoon(); toast(t('srcLoaded', { f: f.name })); }; r.readAsText(f); e.target.value = ''; };
function compileMsg(stale, edited) {
  const c = codeComp;
  if (isCppC(c)) {
    if (!PY.ok) return `<div class="cmsg err">${t('pyNoSab')}</div>`;
    const d = devOf(c);
    if (compileState && compileState.busy) return `<div class="cmsg">${t('compiling')}</div>`;
    if (compileState && compileState.res && !compileState.res.ok) { const errs = compileState.res.diags.filter(d2 => d2.type === 'error'); return `<div class="cmsg err">${t('compileErr')}${errs.slice(0, 8).map(d2 => `<div class="e" data-line="${d2.line}">${d2.line ? t('line') + ' ' + d2.line + ': ' : ''}${esc(explainErr(d2.msg))}</div>`).join('')}</div>`; }
    if (d && d.mcu && d.mcu.pyErr && !edited) return `<div class="cmsg err">${t('cppRunErr')}<div class="e" data-line="0">${esc(d.mcu.pyErr.msg)}</div></div>`;
    if (!window.cappyNative) return `<div class="cmsg">${t('noCompiler')}</div>`;
    if (stale || (edited && c.props.wasm)) return `<div class="cmsg">${t('codeChanged')}</div>`;
    if (compileState && compileState.res && compileState.res.ok) return `<div class="cmsg ok">${t('cppCompiledOk', { f: Math.max(1, Math.round(compileState.res.flash / 1024)) })}</div>`;
    return `<div class="cmsg">${running && d && d.py ? t('cppRunning') : t('cppHowRun')}</div>`;
  }
  if (isPyC(c)) {
    if (!PY.ok) return `<div class="cmsg err">${t('pyNoSab')}</div>`;
    const d = devOf(c);
    if (d && d.mcu && d.mcu.pyErr && !edited) { const e = d.mcu.pyErr; return `<div class="cmsg err">${t('pyErrTitle')}<div class="e" data-line="${e.line}">${e.line ? t('line') + ' ' + e.line + ': ' : ''}${esc(explainPy(e.msg))}</div></div>`; }
    if (running && edited) return `<div class="cmsg">${t('pyChanged')}</div>`;
    return `<div class="cmsg">${running ? t('pyRunning') : t('pyHowRun')}</div>`;
  }
  if (compileState && compileState.busy) return `<div class="cmsg">${t('compiling')}</div>`;
  if (compileState && compileState.res) { const r = compileState.res; if (r.ok) return `<div class="cmsg ok">${r.asm ? t('asmOk', { w: r.words, m: r.max }) : r.stm ? t('compiledOkStm', { f: r.flash, r: r.ram }) : t('compiledOk', { f: r.flash, r: r.ram })}</div>`;
    const errs = r.diags.filter(d2 => d2.type === 'error'); return `<div class="cmsg err">${t('compileErr')}${errs.slice(0, 8).map(d2 => `<div class="e" data-line="${d2.line}">${d2.line ? t('line') + ' ' + d2.line + ': ' : ''}${esc(explainErr(d2.msg))}</div>`).join('')}</div>`; }
  if (!window.cappyNative && !PARTS[c.type].asm) return `<div class="cmsg">${t('noCompiler')}</div>`;
  if (stale) return `<div class="cmsg">${t('codeChanged')}</div>`;
  return '';
}
const PYERRX = [
  [/^IndentationError/, { pl: 'Złe wcięcie. W Pythonie bloki (po if, for, while, def) muszą mieć jednakowe wcięcie – zwykle 4 spacje.', en: 'Wrong indentation. In Python, blocks (after if, for, while, def) need consistent indentation – usually 4 spaces.' }],
  [/^SyntaxError/, { pl: 'Błąd składni – sprawdź dwukropek na końcu linii z if/for/while/def, nawiasy i cudzysłowy.', en: 'Syntax error – check the colon after if/for/while/def, the brackets and the quotes.' }],
  [/^NameError: name '(\w+)' isn't defined/, { pl: 'Nazwa „$1” nie istnieje – literówka albo brak importu (np. from machine import Pin).', en: 'The name “$1” does not exist – a typo or a missing import (e.g. from machine import Pin).' }],
  [/^ImportError: no module named '([\w.]+)'/, { pl: 'Nie ma modułu „$1” na tej płytce. Dostępne moduły są wypisane pod edytorem.', en: 'There is no module “$1” on this board. The available modules are listed below the editor.' }],
  [/^OSError: \[Errno 19\]/, { pl: 'Brak urządzenia I2C pod tym adresem (ENODEV). Sprawdź połączenia SDA/SCL, zasilanie i adres – pomoże i2c.scan().', en: 'No I2C device at this address (ENODEV). Check SDA/SCL wiring, power and the address – i2c.scan() helps.' }],
  [/^OSError: \[Errno 113\]/, { pl: 'Brak połączenia z siecią (EHOSTUNREACH). Najpierw połącz się z Wi-Fi albo sprawdź adres serwera.', en: 'No network connection (EHOSTUNREACH). Connect to Wi-Fi first or check the server address.' }],
  [/^OSError: \[Errno 111\]/, { pl: 'Serwer odmówił połączenia (ECONNREFUSED). Sprawdź adres i port oraz czy serwer MQTT działa (zakładka MQTT).', en: 'The server refused the connection (ECONNREFUSED). Check the address and port and whether the MQTT server is running (MQTT tab).' }],
  [/^OSError: \[Errno 13\]/, { pl: 'Połączenie zablokowane: ten adres jest poza siecią lokalną. Połączenia z internetem włączysz w zakładce MQTT.', en: 'Connection blocked: this address is outside the local network. Internet connections can be enabled in the MQTT tab.' }],
  [/^OSError: \[Errno 110\]/, { pl: 'Przekroczono czas oczekiwania (ETIMEDOUT) – serwer nie odpowiada.', en: 'Timed out (ETIMEDOUT) – the server does not respond.' }],
  [/^ValueError: invalid pin/, { pl: 'Ta płytka nie ma takiego pinu. Numery pinów znajdziesz w opisie płytki (najedź na pin).', en: 'This board has no such pin. Pin numbers are shown when you hover over a pin.' }],
  [/^TypeError/, { pl: 'Zły typ wartości – np. dodawanie tekstu do liczby (użyj str() albo int()).', en: 'Wrong value type – e.g. adding text to a number (use str() or int()).' }],
  [/^ZeroDivisionError/, { pl: 'Dzielenie przez zero.', en: 'Division by zero.' }],
];
function explainPy(m) { for (const [re, tx2] of PYERRX) { const mm = m.match(re); if (mm) return L(tx2).replace('$1', mm[1] || '') + ' (' + m + ')'; } return m; }
const ERRX = [
  [/expected ';' before/, { pl: 'Brakuje średnika ; na końcu instrukcji (zwykle w linii wyżej).', en: 'A semicolon ; is missing at the end of a statement (usually on the line above).' }],
  [/'(\w+)' was not declared in this scope/, { pl: 'Nazwa „$1” nie jest zadeklarowana – literówka, brak zmiennej albo brak #include.', en: 'The name “$1” is not declared – a typo, a missing variable or a missing #include.' }],
  [/expected '\}' at end of input/, { pl: 'Brakuje zamykającego nawiasu klamrowego }.', en: 'A closing curly brace } is missing.' }],
  [/expected '\)' before/, { pl: 'Brakuje nawiasu zamykającego ).', en: 'A closing parenthesis ) is missing.' }],
  [/(\S+\.h): No such file or directory/, { pl: 'Nie ma biblioteki „$1”. Sprawdź nazwę – listę dostępnych bibliotek masz poniżej.', en: 'There is no library “$1”. Check the name – the available libraries are listed below.' }],
  [/undefined reference to `?(setup|loop)/, { pl: 'Program musi mieć funkcje setup() i loop().', en: 'The program needs setup() and loop() functions.' }],
  [/expected ';' after/, { pl: 'Brakuje średnika ; na końcu instrukcji.', en: 'A semicolon ; is missing at the end of a statement.' }],
  [/use of undeclared identifier '(\w+)'/, { pl: 'Nazwa „$1” nie jest zadeklarowana – literówka, brak zmiennej albo brak #include.', en: 'The name “$1” is not declared – a typo, a missing variable or a missing #include.' }],
  [/'(\S+\.h)' file not found/, { pl: 'Nie ma biblioteki „$1”. Sprawdź nazwę – listę dostępnych bibliotek masz poniżej.', en: 'There is no library “$1”. Check the name – the available libraries are listed below.' }],
  [/expected '\}'/, { pl: 'Brakuje zamykającego nawiasu klamrowego }.', en: 'A closing curly brace } is missing.' }],
  [/expected '\)'/, { pl: 'Brakuje nawiasu zamykającego ).', en: 'A closing parenthesis ) is missing.' }],
  [/undefined reference to (setup|loop)|undefined symbol: _?Z?\d*(setup|loop)/, { pl: 'Program musi mieć funkcje setup() i loop().', en: 'The program needs setup() and loop() functions.' }],
  [/program too big/, { pl: 'Program jest za duży dla tego mikrokontrolera.', en: 'The program is too big for this microcontroller.' }],
];
function explainErr(m) { for (const [re, tx2] of ERRX) { const mm = m.match(re); if (mm) return L(tx2).replace('$1', mm[1] || '') + ' (' + m + ')'; } return m; }
let errMarks = [];
function markErrors(lines) { if (!CM) return; errMarks.forEach(l => CM.removeLineClass(l, 'background', 'cm-errline')); errMarks = []; for (const l of lines) if (l > 0) { const h = CM.addLineClass(l - 1, 'background', 'cm-errline'); errMarks.push(h); } }
async function doCompile() {
  const c = codeComp; if (!c) return;
  const P0 = PARTS[c.type];
  if (P0.asm) {
    const r = picAssemble(c.props.code || '', P0.asm); r.asm = true; r.max = P0.asm === 'p18' ? 16384 : 1024;
    compileState = { res: r };
    if (r.ok) { c.props.hex = r.hex; c.props.hexCode = c.props.code; delete c.props.eep; saveSoon(); if (running) { toggleSim(); toggleSim(); } markErrors([]); }
    else markErrors(r.diags.filter(d2 => d2.type === 'error').map(d2 => d2.line));
    if (tab === 'code') { const m = $('#cmsg'); if (m) m.innerHTML = compileMsg(false); } dirty = true; return;
  }
  if (!window.cappyNative) { $('#cmsg').innerHTML = compileMsg(false); return; }
  if (P0.cpp === 'stm') {
    compileState = { busy: true }; $('#cmsg').innerHTML = compileMsg(false);
    let res; try { res = await window.cappyNative.compileStm({ code: c.props.code }); } catch (e) { res = { ok: false, diags: [{ line: 0, type: 'error', msg: String(e) }] }; }
    res.stm = true; compileState = { res };
    if (res.ok) { c.props.hex = res.hex; c.props.hexCode = c.props.code; saveSoon(); if (running) { toggleSim(); toggleSim(); } markErrors([]); }
    else markErrors(res.diags.filter(d2 => d2.type === 'error').map(d2 => d2.line));
    if (tab === 'code') { const m = $('#cmsg'); if (m) m.innerHTML = compileMsg(false); } dirty = true; return;
  }
  if (isCppC(c)) {
    compileState = { busy: true }; $('#cmsg').innerHTML = compileMsg(false); cppBusy.add(c.id);
    const res = await cppCompile(c); cppBusy.delete(c.id); compileState = { res };
    if (res.ok) { markErrors([]); const d = devOf(c); if (running && d) cppRestartDev(d); }
    else markErrors(res.diags.filter(d2 => d2.type === 'error').map(d2 => d2.line));
    if (tab === 'code') { const m = $('#cmsg'); if (m) m.innerHTML = compileMsg(false); } dirty = true; return;
  }
  compileState = { busy: true }; $('#cmsg').innerHTML = compileMsg(false);
  let res; try { res = await window.cappyNative.compile({ code: c.props.code, target: PARTS[c.type].target }); } catch (e) { res = { ok: false, diags: [{ line: 0, type: 'error', msg: String(e) }] }; }
  compileState = { res };
  if (res.ok) { c.props.hex = res.hex; c.props.hexCode = c.props.code; saveSoon(); if (running) { toggleSim(); toggleSim(); } markErrors([]); }
  else markErrors(res.diags.filter(d2 => d2.type === 'error').map(d2 => d2.line));
  if (tab === 'code') { const m = $('#cmsg'); if (m) m.innerHTML = compileMsg(false); } dirty = true;
}
$('#pbody').addEventListener('click', e => { const el = e.target.closest('.e[data-line]'); if (el && CM) { const l = +el.dataset.line - 1; if (l >= 0) { CM.setCursor({ line: l, ch: 0 }); CM.focus(); } } });
$('#hexOpen').onchange = e => { const f = e.target.files[0]; if (!f || !codeComp) return; const r = new FileReader(); r.onload = () => { codeComp.props.hex = r.result; codeComp.props.hexCode = codeComp.props.code; saveSoon(); toast(t('hexLoaded')); if (running) { toggleSim(); toggleSim(); } }; r.readAsText(f); e.target.value = ''; };
function updateSerial(force) {
  if (!force && !SERIAL.dirty) return; SERIAL.dirty = false;
  const o = $('#serOut'); if (o && codeComp) { const d = devOf(codeComp); const txt = d && d.mcu ? d.mcu.serial : ''; if (o.textContent !== txt) { const atBottom = o.scrollTop + o.clientHeight > o.scrollHeight - 30; o.textContent = txt; if (atBottom || force) o.scrollTop = o.scrollHeight; } }
  const m = $('#modSer'); if (m && sel && sel.k === 'c') { const c = byId(sel.id); const txt = rt(c).text || ''; if (m.textContent !== txt) { m.textContent = txt; m.scrollTop = m.scrollHeight; } }
}
function serialSend() { const inp = $('#serIn'); const d = devOf(codeComp); if (d && d.mcu && running) { d.mcu.rxq.push(...new TextEncoder().encode(inp.value + '\n')); if (d.py) pyStdinPush(d); } inp.value = ''; }

/* ================= WYZWANIA ================= */
const anyDev = (type, f) => CIR && CIR.devs.some(d => d.c.type === type && f(d.s, d));
const TASKS = [
  { id: 'led', t: { pl: 'Zapal diodę LED', en: 'Light an LED' }, d: { pl: 'Prąd diody między 5 a 20 mA.', en: 'LED current between 5 and 20 mA.' }, hint: { pl: 'Bateria 9 V → rezystor 470 Ω → dioda (dłuższą nóżką do plusa) → minus baterii.', en: '9 V battery → 470 Ω resistor → LED (longer leg to plus) → battery minus.' }, ok: () => anyDev('led', s => s.I > 0.005 && s.I <= 0.021) },
  { id: 'burn', t: { pl: 'Sprawdź, po co jest rezystor', en: 'Find out why the resistor matters' }, d: { pl: 'Podłącz diodę bez rezystora i zobacz, co się stanie.', en: 'Connect an LED with no resistor and see what happens.' }, hint: { pl: 'Usuń rezystor z obwodu diody i uruchom symulację. Potem przemyśl, dlaczego tak się stało.', en: 'Remove the resistor from the LED circuit and start the simulation. Then think about why it happened.' }, ok: () => anyDev('led', s => s.burnt) },
  { id: 'volt', t: { pl: 'Zmierz napięcie', en: 'Measure a voltage' }, d: { pl: 'Multimetr w trybie V pokazuje więcej niż 0,5 V.', en: 'A multimeter in V mode reads more than 0.5 V.' }, hint: { pl: 'Ustaw multimetr na V i podłącz go równolegle do rezystora.', en: 'Set the multimeter to V and connect it in parallel with a resistor.' }, ok: () => anyDev('mm', (s, d) => d.c.props.mode === 'V' && Math.abs(s.U) > 0.5) },
  { id: 'amp', t: { pl: 'Zmierz prąd', en: 'Measure a current' }, d: { pl: 'Multimetr w trybie A pokazuje więcej niż 1 mA.', en: 'A multimeter in A mode reads more than 1 mA.' }, hint: { pl: 'Ustaw multimetr na A i wstaw go w przerwę obwodu (szeregowo).', en: 'Set the multimeter to A and put it in a break in the circuit (in series).' }, ok: () => anyDev('mm', (s, d) => d.c.props.mode === 'A' && Math.abs(s.I) > 0.001 && Math.abs(s.I) < 3) },
  { id: 'cap', t: { pl: 'Naładuj kondensator', en: 'Charge a capacitor' }, d: { pl: 'Napięcie na kondensatorze powyżej 5 V.', en: 'Capacitor voltage above 5 V.' }, hint: { pl: 'Połącz kondensator przez rezystor z baterią 9 V i poczekaj kilka sekund.', en: 'Connect the capacitor through a resistor to a 9 V battery and wait a few seconds.' }, ok: () => anyDev('capacitor', s => s.U > 5) },
  { id: 'tr', t: { pl: 'Tranzystor jako przełącznik', en: 'Transistor as a switch' }, d: { pl: 'Tranzystor BC547 w nasyceniu steruje diodą lub silnikiem.', en: 'A saturated BC547 drives an LED or motor.' }, hint: { pl: 'Baza przez rezystor 10 kΩ do plusa, emiter do masy, a obciążenie (dioda z rezystorem) między plusem a kolektorem.', en: 'Base through 10 kΩ to plus, emitter to ground, load (LED with resistor) between plus and collector.' }, ok: () => anyDev('q_bc547', s => s.region === 'sat' && s.Ic > 0.005) },
  { id: '555', t: { pl: 'Migacz na NE555', en: 'NE555 blinker' }, d: { pl: 'Zbuduj generator: wyjście 555 zmienia stan.', en: 'Build an oscillator: the 555 output toggles.' }, hint: { pl: 'Układ astabilny: R1 z VCC do pinu 7, R2 z 7 do 6, pin 6 z 2, kondensator z 2 do masy, pin 4 i 8 do VCC, 1 do masy.', en: 'Astable: R1 from VCC to pin 7, R2 from 7 to 6, pin 6 to 2, capacitor from 2 to ground, pins 4 and 8 to VCC, 1 to ground.' }, ok: () => anyDev('ic_555', s => { s.tog = (s.tog || 0) + (s.q !== s._q ? 1 : 0); s._q = s.q; return s.tog > 6; }) },
  { id: 'psu', t: { pl: 'Zasilacz z sieci', en: 'Mains power supply' }, d: { pl: 'Transformator + mostek + kondensator dają ponad 10 V stałego.', en: 'Transformer + bridge + capacitor give over 10 V DC.' }, hint: { pl: 'Otwórz przykład „Zasilacz 5 V z sieci” i sprawdź, jak działa każdy stopień.', en: 'Open the “5 V mains power supply” example and check each stage.' }, ok: () => CIR && CIR.devs.some(d => /^br_/.test(d.c.type) && d.s.U > 10) },
  { id: 'mcu', t: { pl: 'Pierwszy program', en: 'First program' }, d: { pl: 'Mikrokontroler wykonuje Twój program i wypisuje tekst w monitorze portu szeregowego.', en: 'A microcontroller runs your program and prints text to the serial monitor.' }, hint: { pl: 'Dodaj Arduino Uno, w zakładce Kod skompiluj przykład i uruchom symulację.', en: 'Add an Arduino Uno, compile the example in the Code tab and start the simulation.' }, ok: () => CIR && CIR.mcus.some(d => d.mcu && d.mcu.serial && d.mcu.serial.length > 2) },
  { id: 'lcd', t: { pl: 'Napis na wyświetlaczu', en: 'Text on a display' }, d: { pl: 'Wyświetl tekst na LCD albo OLED.', en: 'Show text on an LCD or OLED.' }, hint: { pl: 'Otwórz przykład „Arduino + LCD I2C”.', en: 'Open the “Arduino + I2C LCD” example.' }, ok: () => CIR && CIR.devs.some(d => (d.s.lcd && d.s.lcd.dd && d.s.lcd.dd.some(v => v !== 32 && v !== 0)) || (d.s.oled && d.s.oled.ram.some(v => v))) },
];
let done = new Set(); try { done = new Set(JSON.parse(LS.get('cappytronic.tasks') || '[]')); } catch (e) { }
function updateTaskCount() { $('#taskCnt').textContent = done.size + '/' + TASKS.length; }
function tasksHtml() {
  return `<div><span class="lbl">${t('progress', { d: done.size, n: TASKS.length })}</span><div class="prog"><i style="width:${done.size / TASKS.length * 100}%"></i></div></div>` +
    TASKS.map(tk => `<div class="task ${done.has(tk.id) ? 'done' : ''}"><span class="chk">${done.has(tk.id) ? '✓' : ''}</span><div><h3>${esc(L(tk.t))}</h3><p>${esc(L(tk.d))}</p>${done.has(tk.id) ? '' : `<button class="btn" style="margin-top:6px;padding:4px 10px;font-size:12px" data-task="${tk.id}">${t('hint')}</button>`}</div></div>`).join('') + `<p class="hint">${t('tasksAuto')}</p>`;
}
function checkTasks() { for (const tk of TASKS) if (!done.has(tk.id) && tk.ok()) { done.add(tk.id); LS.set('cappytronic.tasks', JSON.stringify([...done])); toast(t('taskDone', { t: L(tk.t) })); cappyOverride = { t: t('cappyBravo', { t: L(tk.t) }), m: 'happy', until: performance.now() + 5000 }; if (tab === 'tasks') renderProps(); else updateTaskCount(); } }

/* ================= CAPPY ================= */
let cappyOverride = null, lastCappy = '';
function cappyMsg() {
  if (cappyOverride && performance.now() < cappyOverride.until) return [cappyOverride.t, cappyOverride.m];
  if (draft) return [t('cWire'), 'calm'];
  if (!running) { if (!S.comps.length) return [t('cHello'), 'calm']; if (sel && sel.k === 'c') { const c = byId(sel.id); if (c) return [L(PARTS[c.type].info), 'calm']; } return [t('cReady'), 'calm']; }
  if (!CIR) return [t('cReady'), 'calm'];
  for (const d of CIR.devs) if (d.s.warn) return [warnText(d), 'alert'];
  const devs = CIR.devs; const R = d => d.s;
  if (!devs.some(d => d.P.gnd !== undefined || d.P.mcu)) return [t('cNoPower'), 'alert'];
  const flow = devs.some(d => !['mm', 'scope', 'bb'].includes(d.c.type) && Math.abs(R(d).I || 0) > 1e-4) || CIR.mcus.some(d => d.mcu && (d.mcu.cpu || (d.py && !d.py.dead)));
  if (!flow) { if (devs.some(d => d.c.type === 'switch' && !d.c.props.closed)) return [t('cSwitchOff'), 'calm']; if (devs.some(d => d.c.type === 'button')) return [t('cHoldBtn'), 'calm']; return [t('cNoFlow'), 'calm']; }
  if (CIR.mcus.some(d => d.mcu && (d.mcu.cpu || (d.py && !d.py.dead)))) return [t('cMcuRun'), 'happy'];
  const led = devs.find(d => d.c.type === 'led' && (R(d).br || 0) > 0.05); if (led) return [t('cLedOn', { i: si(R(led).I, 'A') }), 'happy'];
  const mo = devs.find(d => d.c.type === 'motor' && Math.abs(R(d).I) > 0.01); if (mo) return [t('cMotor', { i: si(R(mo).I, 'A') }), 'happy'];
  const cp = devs.find(d => d.c.type === 'capacitor'); if (cp) return [t('cCap', { u: si(R(cp).U, 'V') }), 'happy'];
  return [t('cWorks'), 'happy'];
}
function updateCappy() { const [tx2, m] = cappyMsg(); if (tx2 + m === lastCappy) return; lastCappy = tx2 + m; $('#cappyTxt').textContent = tx2; $('#cappy').dataset.mood = m; }
$('#cappyBtn').onclick = () => $('#cappy').classList.toggle('min');

/* ================= DŹWIĘK ================= */
let ac = null, gain = null, osc = null, soundOn = LS.get('cappytronic.sound') !== '0';
function audioInit() { try { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); osc = ac.createOscillator(); osc.type = 'square'; osc.frequency.value = 1150; gain = ac.createGain(); gain.gain.value = 0; osc.connect(gain).connect(ac.destination); osc.start(); } ac.resume(); } catch (e) { } }
function audioUpdate() { if (!gain) return; const on = running && soundOn && CIR && CIR.devs.some(d => d.c.type === 'buzzer' && d.s.active); gain.gain.setTargetAtTime(on ? 0.035 : 0, ac.currentTime, 0.015); }
$('#btnSound').onclick = () => { soundOn = !soundOn; LS.set('cappytronic.sound', soundOn ? '1' : '0'); $('#btnSound').setAttribute('aria-pressed', soundOn); audioUpdate(); };

/* ================= START / STOP ================= */
function simButton() { const b = $('#btnSim'); b.classList.toggle('on', running); b.innerHTML = running ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span>${t('simStop')}</span>` : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg><span>${t('simStart')}</span>`; }
function toggleSim() {
  running = !running;
  if (running) { draft = null; hoverT = null; simReset(); audioInit(); E.speedAvg = 1; }
  else { for (const c of S.comps) if (c.type === 'button') c.props.pressed = false; if (CIR) for (const d of CIR.mcus) if (d.mcu && d.mcu.per && d.mcu.per.eeprom) { const m = d.mcu.per.eeprom.backend.memory; let s = ''; for (let i = 0; i < m.length; i++) s += String.fromCharCode(m[i]); d.c.props.eep = btoa(s); } pyStopAll(); encStopAll(); RT = {}; audioUpdate(); saveSoon(); }
  simButton(); stage.classList.toggle('running', running); statusText(); dirty = true; renderProps(); updateCappy();
}
function statusText() { $('#stMode').innerHTML = running ? `<b>●</b> ${t('simMode')} · ${dec(E.t, 1)} s${E.speedAvg < 0.95 ? ` · ${t('speed')} ${Math.round(E.speedAvg * 100)}%` : ''}` : t('editMode'); }
$('#btnSim').onclick = toggleSim;

/* ================= PĘTLA ================= */
let lastUI = 0, lastFrame = performance.now();
function loop(ts) {
  const wall = Math.min(0.05, (ts - lastFrame) / 1000); lastFrame = ts;
  if (running) {
    if (!CIR) simReset();
    const t0 = performance.now(); let simd = 0;
    while (simd < wall && performance.now() - t0 < 14) { simStep(E.dt); simd += E.dt; }
    E.speedAvg = E.speedAvg * 0.95 + 0.05 * (wall > 0 ? Math.min(1, simd / wall) : 1);
    dirty = true; audioUpdate();
    if (ts - lastUI > 200) { lastUI = ts; checkTasks(); updateCappy(); const rd = $('#readings'); if (rd && sel && sel.k === 'c') { const c = byId(sel.id); if (c) rd.innerHTML = readingsHtml(c); const wb = $('#warnbox'); const d = c && devOf(c); if (wb && d) { const w = warnText(d); wb.hidden = !w; wb.textContent = w; } } statusText(); }
    updateSerial(false);
  }
  if (!running) updateCappy();
  if (dirty) { render(); dirty = false; }
  requestAnimationFrame(loop);
}

/* ================= PRZYKŁADY ================= */
function resolvePin(c, ref) {
  if (typeof ref === 'number') return ref;
  if (typeof ref === 'string' && ref.startsWith('h:')) { const [y, col] = ref.slice(2).split(',').map(Number); return bbGeom(c).idx.get(y + ',' + col); }
  const ps = pinsOf(c); let i = ps.findIndex(p => p.fn === ref); if (i < 0) i = ps.findIndex(p => p.s === ref); if (i < 0) i = ps.findIndex(p => L(p.n) === ref || (p.n && p.n.pl === ref)); if (i < 0) i = ps.findIndex(p => { const nn = typeof p.n === 'string' ? p.n : p.n && p.n.pl || ''; return nn === ref || nn.startsWith(ref + ' ') || nn.startsWith(ref + ':'); });
  if (i < 0) console.warn('pin not found', c.type, ref); return i;
}
function loadExample(i) {
  if (running) toggleSim(); pushHist(); const ex = EXAMPLES[i]; const ids = [];
  const comps = ex.comps.map(([type, x, y, rot, props]) => { const id = newId(); ids.push(id); return { id, type, x, y, rot: rot || 0, props: Object.assign(JSON.parse(JSON.stringify(PARTS[type].props || {})), props || {}) }; });
  S = { name: L(ex.n), comps, wires: [], mats: sanitizeMats(ex.mats).map(m => ({ ...m, id: newId() })) };
  for (const [ai, ar, bi, br, pts, col] of ex.wires) S.wires.push({ id: newId(), a: { c: ids[ai], t: resolvePin(comps[ai], ar) }, b: { c: ids[bi], t: resolvePin(comps[bi], br) }, pts: pts || [], color: WIRE_COLS[col || 0][0] });
  if (ex.code) { const m = comps[ex.code[0]]; m.props.code = ex.code[1]; m.props.hex = HEXES[ex.code[2]] || ''; m.props.hexCode = m.props.code; if (ex.code[3] === 'cpp') m.props.lang = 'cpp'; if (PARTS[m.type].asm) { const r = picAssemble(m.props.code, PARTS[m.type].asm); m.props.hex = r.ok ? r.hex : ''; m.props.hexCode = m.props.code; } codeBind(m); }
  $('#projName').value = S.name; sel = null; draft = null; changed(); fit(); toast(t('exLoaded'));
}
function buildExMenu() { let h = '', last = null; EXAMPLES.forEach((e, i) => { if (e.g !== last) { h += `<div class="mh">${esc(L(e.g))}</div>`; last = e.g; } h += `<button data-ex="${i}">${esc(L(e.n))}<small>${esc(L(e.d))}</small></button>`; }); $('#exMenu').innerHTML = h; }
function closeMenus() { $('#exMenu').hidden = true; $('#btnEx').setAttribute('aria-expanded', 'false'); }
$('#btnEx').onclick = e => { e.stopPropagation(); const m = $('#exMenu'); m.hidden = !m.hidden; $('#btnEx').setAttribute('aria-expanded', String(!m.hidden)); };
$('#exMenu').onclick = e => { const b = e.target.closest('[data-ex]'); if (b) { closeMenus(); loadExample(+b.dataset.ex); } };
document.addEventListener('click', e => { if (!e.target.closest('.menuwrap')) closeMenus(); });

/* ================= PLIK ================= */
const fm = $('#fileModal');
function exportJson() { return JSON.stringify({ app: 'CappyTronic', v: 2, name: S.name, comps: S.comps.map(c => ({ ...c, props: { ...c.props, pressed: undefined } })), wires: S.wires, mats: (S.mats || []).map(m => ({ ...m, _edit: undefined })) }); }
function importJson(txt) { let o; try { o = JSON.parse(txt); } catch (e) { return toast(t('badFile')); } if (!o || !Array.isArray(o.comps) || !Array.isArray(o.wires)) return toast(t('badFile')); if (running) toggleSim(); pushHist(); restore(o); fit(); fm.hidden = true; toast(t('loaded', { n: S.name })); }
$('#btnFile').onclick = () => { $('#fText').value = exportJson(); fm.hidden = false; $('#fClose').focus(); };
$('#fClose').onclick = () => fm.hidden = true; fm.onclick = e => { if (e.target === fm) fm.hidden = true; };
$('#fCopy').onclick = () => { const tA = $('#fText'); tA.select(); (navigator.clipboard ? navigator.clipboard.writeText(tA.value) : Promise.reject()).then(() => toast(t('copied')), () => { try { document.execCommand('copy'); toast(t('copied')); } catch (e) { } }); };
$('#fLoad').onclick = () => importJson($('#fText').value);
$('#fOpenBtn').onclick = () => $('#fOpen').click();
$('#fOpen').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { if (/\.(kicad_sch|net)$/i.test(f.name)) { fm.hidden = true; kiImport(String(r.result), f.name); } else importJson(r.result); }; r.readAsText(f); e.target.value = ''; };
$('#fSave').onclick = async () => {
  const data = exportJson(), fname = (S.name || 'projekt').replace(/[\\/:*?"<>|]/g, '_') + '.cappy';
  try { if (window.cappyNative && window.cappyNative.saveFile) { const p = await window.cappyNative.saveFile(fname, data); if (p) toast(t('savedAs', { f: p })); return; } if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: fname, types: [{ description: 'CappyTronic', accept: { 'application/json': ['.cappy'] } }] }); const w = await h.createWritable(); await w.write(data); await w.close(); toast(t('savedAs', { f: h.name })); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); toast(t('savedAs', { f: fname }));
};

/* ================= MOTYW I JĘZYK ================= */
let themeMode = LS.get('cappytronic.theme') || 'system';
function applyTheme() { const r = document.documentElement; if (themeMode === 'system') r.removeAttribute('data-theme'); else r.dataset.theme = themeMode; $('#btnTheme').title = t(themeMode === 'system' ? 'themeSystem' : themeMode === 'light' ? 'themeLight' : 'themeDark'); }
$('#btnTheme').onclick = () => { themeMode = themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system'; LS.set('cappytronic.theme', themeMode); applyTheme(); toast($('#btnTheme').title); };
function applyLang() {
  document.documentElement.lang = LANG; $('#langCode').textContent = LANG.toUpperCase(); $('#btnLang').title = t('lang');
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
  $('#zIn').title = t('zoomIn'); $('#zOut').title = t('zoomOut'); $('#btnUndo').title = t('undo') + ' (Ctrl+Z)';
  compEls.forEach(e => e.str = null); buildPalette(); buildExMenu(); simButton(); statusText(); applyTheme(); renderProps(); lastCappy = ''; updateCappy(); dirty = true;
}
$('#btnLang').onclick = () => { LANG = LANG === 'pl' ? 'en' : 'pl'; LS.set('cappytronic.lang', LANG); applyLang(); };

/* ================= RESZTA ================= */
$('#btnUndo').onclick = undo;
$('#btnClear').onclick = () => { if (running) toggleSim(); if (!S.comps.length && !S.wires.length && !(S.mats || []).length) return; pushHist(); S.comps = []; S.wires = []; S.mats = []; sel = null; changed(); toast(t('cleared')); };
$('#projName').oninput = e => { S.name = e.target.value; saveSoon(); if (!sel && tab === 'props') renderProps(); };
$('#zIn').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); };
$('#zOut').onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); };
$('#zFit').onclick = fit;
$('#btnPanel').onclick = () => $('#props').classList.toggle('open');
addEventListener('resize', () => { dirty = true; });
$('#btnSound').setAttribute('aria-pressed', soundOn);

function boot() {
  applyLang(); try { netInit(); } catch (e) { console.error(e); }
  const saved = LS.get('cappytronic.project2') || LS.get('cappytronic.project');
  let ok = false; if (saved) { try { const o = JSON.parse(saved); if (o.comps && o.comps.length) { restore(o); ok = true; } } catch (e) { } }
  if (!ok) loadExample(0); hist = [];
  setTab('props');
  requestAnimationFrame(() => { fit(); applyView(); renderProps(); updateCappy(); requestAnimationFrame(loop); });
}
